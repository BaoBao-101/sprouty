import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { sessionPlugin } from './session.js';

const DAY = 24 * 60 * 60 * 1000;
const user = { id: 'user1', email: 'me@x.vn', name: 'Mai', role: 'customer', status: 'active', vipUntil: null, createdAt: new Date() };

function fakePrisma() {
  const sessions = new Map();
  let next = 0;
  return {
    sessions,
    session: {
      async create({ data }) {
        const row = { id: `sess${String(++next).padStart(20, '0')}`, createdAt: new Date(), ...data };
        sessions.set(row.id, row);
        return row;
      },
      async findFirst({ where }) {
        const row = sessions.get(where.id);
        return row ? { ...row, user } : null;
      },
      async update({ where, data }) { Object.assign(sessions.get(where.id), data); },
      async deleteMany({ where }) { sessions.delete(where.id); },
    },
    $executeRaw: async () => 0,
  };
}

async function build() {
  const app = Fastify();
  const prisma = fakePrisma();
  app.decorate('prisma', prisma);
  await app.register(fastifyCookie, { secret: 'test-secret' });
  await app.register(sessionPlugin);
  app.post('/login', async (req, reply) => app.setSession(req, reply, user.id, { client: req.query.client }));
  app.get('/who', async (req) => ({ user: req.user?.id || null }));
  await app.ready();
  return { app, prisma };
}

test('an app sign-in returns a token and sets no cookie', async () => {
  const { app } = await build();
  const res = await app.inject({ method: 'POST', url: '/login?client=app' });
  const body = res.json();
  assert.ok(body.token);
  assert.ok(body.csrfToken);
  assert.equal(res.cookies.length, 0);

  const who = await app.inject({ method: 'GET', url: '/who', headers: { authorization: `Bearer ${body.token}` } });
  assert.equal(who.json().user, user.id);
  assert.equal(who.cookies.length, 0, 'a bearer request is not answered with a cookie');
  await app.close();
});

test('a forged or unsigned token is anonymous', async () => {
  const { app, prisma } = await build();
  const { token } = (await app.inject({ method: 'POST', url: '/login?client=app' })).json();
  const rawId = [...prisma.sessions.keys()][0];
  for (const bad of [rawId, `${token}x`, 'Bearer', '']) {
    const who = await app.inject({ method: 'GET', url: '/who', headers: { authorization: `Bearer ${bad}` } });
    assert.equal(who.json().user, null, bad);
  }
  await app.close();
});

test('tokens and cookies cannot stand in for each other', async () => {
  const { app } = await build();
  const web = await app.inject({ method: 'POST', url: '/login' });
  const cookie = web.cookies.find((c) => c.name === 'session_id');
  assert.ok(cookie, 'the website still gets its cookie');
  assert.equal(web.json().token, undefined);

  // The website's session id, presented as an app token.
  const asBearer = await app.inject({ method: 'GET', url: '/who', headers: { authorization: `Bearer ${cookie.value}` } });
  assert.equal(asBearer.json().user, null);

  // The app's token, presented as the website's cookie.
  const { token } = (await app.inject({ method: 'POST', url: '/login?client=app' })).json();
  const asCookie = await app.inject({ method: 'GET', url: '/who', cookies: { session_id: token } });
  assert.equal(asCookie.json().user, null);
  await app.close();
});

test('a dead cookie left in the app does not hide its token', async () => {
  const { app, prisma } = await build();
  const web = await app.inject({ method: 'POST', url: '/login' });
  const cookie = web.cookies.find((c) => c.name === 'session_id');
  prisma.sessions.clear();
  const { token } = (await app.inject({ method: 'POST', url: '/login?client=app' })).json();

  const who = await app.inject({
    method: 'GET',
    url: '/who',
    cookies: { session_id: cookie.value },
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(who.json().user, user.id);
  assert.ok(who.cookies.some((c) => c.name === 'session_id' && c.value === ''), 'the dead cookie is cleared');
  await app.close();
});

test('an app session outlives the website idle timeout but not its own', async () => {
  const { app, prisma } = await build();
  const { token } = (await app.inject({ method: 'POST', url: '/login?client=app' })).json();
  const row = [...prisma.sessions.values()][0];
  assert.equal(row.data.client, 'app');
  assert.ok(row.expiresAt.getTime() - Date.now() > 170 * DAY);

  row.lastSeenAt = new Date(Date.now() - 2 * DAY);
  const after2Days = await app.inject({ method: 'GET', url: '/who', headers: { authorization: `Bearer ${token}` } });
  assert.equal(after2Days.json().user, user.id);

  row.lastSeenAt = new Date(Date.now() - 61 * DAY);
  const after61Days = await app.inject({ method: 'GET', url: '/who', headers: { authorization: `Bearer ${token}` } });
  assert.equal(after61Days.json().user, null);
  assert.equal(prisma.sessions.size, 0, 'the idle session is deleted');
  await app.close();
});
