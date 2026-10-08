# Deploy: frontend on Vercel, API on the VPS

Written for: whoever deploys this next.

Sprouty runs as two halves on two hosts, and they are configured differently.
Copying the repo's files wholesale onto the VPS breaks it — that is how the API
went down for twenty minutes, twice, on 2026-10-08. This page is what you need
to know to not repeat it.

```
sprouty.id.vn / www.sprouty.id.vn  →  Vercel   the SPA
api.sprouty.id.vn                  →  VPS      Fastify + Postgres in Docker
```

The browser only ever talks to the Vercel origin. `vercel.json` rewrites
`/api/*` and `/uploads/*` back to `api.sprouty.id.vn`, server-side, so the app
stays same-origin: the session cookie (`sameSite: Strict`, no `Domain`) keeps
working and CORS never enters the picture.

---

## Three files differ between the repo and the VPS

The repo is set up to run the **whole stack locally**, where nginx serves the
built SPA and holds a certificate for the apex domain. The VPS does neither.

| File | In the repo (local) | On the VPS |
| --- | --- | --- |
| `docker-compose.yml` | service `frontend`, builds `./frontend` | service `nginx`, plain `nginx:stable-alpine` |
| `docker/nginx.conf` | serves the SPA, cert for `sprouty.id.vn` | API gateway only, cert for `api.sprouty.id.vn` — see `docker/nginx.vps.conf` |
| `.env` | development values | production secrets — **never overwrite** |

**The VPS holds a certificate for `api.sprouty.id.vn` and nothing else.** Copy
the repo's `nginx.conf` over and nginx refuses to start on a missing
`sprouty.id.vn` certificate, which takes the API down with it.

`docker/nginx.vps.conf` in this repo is the VPS's copy, kept here so it survives
the next person who copies files up.

---

## Deploying the API

The VPS is a git clone but has no credentials for this private repo, so files go
up over SSH. **Exclude the three files above.**

```bash
# From the repo root. git ls-files keeps node_modules, dist and .env out.
git ls-files -z \
  | grep -zv -e '^docker-compose\.yml$' -e '^docker/nginx\.conf$' \
  | tar --null -czf - -T - \
  | ssh sprouty 'cat > /tmp/sprouty.tar.gz'

ssh sprouty '
  cd /var/www/sprouty
  sudo tar xzf /tmp/sprouty.tar.gz -C /var/www/sprouty && rm /tmp/sprouty.tar.gz
  sudo docker compose up -d --build backend
'
```

The backend container runs `prisma migrate deploy && node prisma/seed.js` on
start, so migrations apply by themselves.

Then check it actually came up — a crash-looping backend answers 502 through
nginx, which looks like a network problem and is not one:

```bash
curl -s https://api.sprouty.id.vn/api/v1/health
ssh sprouty 'sudo docker compose -f /var/www/sprouty/docker-compose.yml logs backend --tail 30'
```

### If nginx returns 502 after a backend rebuild

nginx resolves `backend` once at startup. Recreating the backend container gives
it a new IP and nginx keeps proxying to the old one:

```bash
ssh sprouty 'cd /var/www/sprouty && sudo docker compose restart nginx'
```

---

## Deploying the frontend

Push to `main`. Vercel builds from `vercel.json`:

```
Build Command    cd frontend && npm install && npm run build
Output Directory frontend/dist
```

If a push does not trigger a build, the project is not linked to the repo —
check Vercel → Settings → Git. A deploy is required for changes to `vercel.json`
itself to take effect, which is easy to miss: until it lands, the site loads but
every API call returns Vercel's own 404.

---

## Environment

Everything new has a safe default, so a missing variable degrades rather than
breaks:

| Variable | Default | Why the default is right in production |
| --- | --- | --- |
| `PLANT_TIME_SCALE` | `1` | Real time. Anything higher collapses every cooldown. |
| `PLANT_TZ_OFFSET` | `7` | Asia/Ho_Chi_Minh, for the day/night curve and care streak. |
| `WORKSHOP_REWARD_THRESHOLD` | `3` | Kits per free workshop seat. |
| `PHYSICAL_CATEGORIES` | empty | Nothing ships, so checkout asks for no address. |
| `ALLOW_FAKE_PAYMENTS` | `false` | Also requires a non-production `NODE_ENV`, so it cannot be switched on here by accident. |

`PUBLIC_ASSET_BASE_URL` is the one that needs thought. It is a **full URL** on
the VPS (`https://api.sprouty.id.vn/uploads`) because asset records have to carry
an origin the Vercel-hosted frontend can resolve. `server.js` takes only the path
from it for the static mount — a full URL used as a route prefix is what Fastify
rejects at boot with "The first character of a path should be / or *".

---

## The seed runs on every start

`backend/Dockerfile` ends with:

```
prisma migrate deploy && node prisma/seed.js && node src/server.js
```

and the seed upserts with `update: product`. So **the eight seeded products
(ids 1, 2, 5–10) are reset to their seed values on every deploy.** Products
created through the admin are untouched.

If someone edits a seeded product's price or name in the admin on production,
the next deploy reverts it. Worth changing before that bites — the fix is to
make the seed create-only for products that already exist.
