# Cây mô phỏng (virtual plants) & ưu đãi workshop

Written for: developers working on this codebase.

Sprouty used to ship a physical kit — a pot, paint, real seeds — and the site
was a companion to it. It no longer ships anything. A kit is now a **simulated
plant**: buying one issues an activation code, and entering that code on
"Cây của tôi" sows a seed the customer raises on the site, reading simulated IoT
sensors and caring for it on cooldowns until it is ready to harvest.

This document covers what that changed, where the rules live, and the two
decisions that shape everything else.

---

## The two load-bearing decisions

### 1. There is no scheduler

Every metric is a pure function of the plant's stored state and the time elapsed
since `VirtualPlant.lastTickAt`. `tick()` runs on **every read** and before every
care action, so a plant left alone for two days has dried out by the moment its
owner opens the page.

This means **a read is a write**: `GET /me/plants/:id` advances the simulation
and persists it. That is deliberate. A cron job would produce the same numbers
but would also be a second source of truth for them, and would need a container
that currently only serves requests.

The practical consequence: `tick()` steps the simulation in 30-minute slices so a
plant untouched for a week does not get one enormous jump that overshoots every
threshold at once, and it samples the day/night curve at the middle of each
slice rather than all at `now`.

### 2. Care the child performs is what grows the plant

Time alone adds very little. Automation (pump, grow light, fan) only keeps a
plant *alive* while nobody is looking — it grants no growth points at all.

A care action pays out **in proportion to how much the plant actually needed
it**: watering dry soil is worth full growth, watering wet soil is worth nothing
and costs health. That is what makes reading the sensors matter rather than
mashing every button on sight, and it is the whole educational point.

---

## Where the rules live

| File | Holds |
| --- | --- |
| `backend/src/services/plant-sim.js` | The engine. Stages, species, devices, care actions, the tick, the environment model. Pure arithmetic — knows nothing about Prisma, so it is testable on its own. |
| `backend/src/services/plants.js` | The database half. Loads a plant, ticks it, writes it back, assembles the dashboard payload. |
| `backend/src/routes/plants.js` | The HTTP surface. |
| `backend/src/services/rewards.js` | "Mua 3 tặng 1 workshop". |
| `frontend/src/components/PlantArt.tsx` | The plant drawing, derived from stage + progress + health. |
| `frontend/src/components/PlantForms.tsx` | The six growth forms — vine, root, stalk, head, bush, leafy. |
| `frontend/src/components/icons/SproutyIcon.tsx` | The icon set. |
| `frontend/src/components/PlantGuide.tsx` | The first-run "Cây cần gì?" guide. |
| `backend/scripts/seed-demo-plants.js` | A demo garden with one plant per stage. |

`plant-sim.js` emits `icon` **keys**, never emoji. The client owns the artwork; a
server that shipped glyphs would be deciding the brand's visual language.

---

## The journey

Eight stages: `seed → sprout → seedling → vegetative → budding → flowering →
fruiting → mature`.

Each stage has a `growthNeeded` budget, a comfort band for moisture and
temperature, and a `passivePerHour` trickle that only accrues when the plant is
healthy and there is light to grow by. Species (`Bean`, `Carrot`, `Corn`,
`FirePepper`, `SunFlower`, `Tomato`) override the stage *labels* where the
biology differs — a carrot swells a root where a sunflower opens a head, and
calling both "kết trái" would teach the wrong thing.

Measured pacing, with a gardener who follows the on-screen recommendation:

| How the customer plays | Reaches harvest |
| --- | --- |
| 2–3 visits a day | ~14–15 days |
| Once a day, automation on | ~18 days, plant stays at full health |
| Once a day, no automation | ~19 days, but the plant is visibly stressed |
| Never cares, automation on | Stalls at `seedling` — the pump handles water, not food or pests |
| Never cares at all | Stalls at `seed` |

A plant **never dies.** Health floors at 5. This is a children's product, and a
plant that died while its owner was at school would be a punishment, not a
lesson.

### Care actions and cooldowns

The cooldown is the "hồi chiêu" — a child cannot grow the plant in one sitting,
which is the point: they come back tomorrow.

| Action | Cooldown | From stage |
| --- | --- | --- |
| Phun sương | 1.5h | seed |
| Tưới nước | 4h | seed |
| Đưa ra nắng | 6h | sprout (no effect at night) |
| Soi sâu bệnh | 8h | sprout |
| Thụ phấn | 10h | flowering only |
| Tỉa lá | 14h | seedling |
| Bón phân | 20h | seedling |
| Xới đất | 24h | vegetative |
| Thu hoạch | — | mature, once |

Cooldowns are derived from the newest `PlantCareLog` row for that action, so
there is no per-action timestamp column that could disagree with the log.

### Devices

Eight simulated devices unlock by stage, so the dashboard starts readable for a
child and earns its complexity: two sensors at `seed`, the light sensor and
camera at `sprout`, the EC sensor and pump at `seedling`, the grow light at
`vegetative`, the fan at `budding`.

A device **never re-locks** — a stage cannot go backwards, and a dashboard that
lost a sensor would read as a bug rather than a rule.

Actuators can be switched to automatic. The pump waters to the **current
stage's** comfort band, not to a fixed number: a single threshold meant a
seedling whose ideal is 55–80% was topped up to 58% and left to fall again, so
its average sat below the band and it was permanently stressed however long the
pump ran — the opposite of what the device promises.

Batteries are solar: charged from each slice's light and drained steadily,
balanced so a device left on automatic breaks even over a full day. They are
flavour. Charging them from a single reading taken at `now` meant a plant opened
in the evening only ever drained, and an automatic pump the customer had
switched on would quietly stop working once it hit empty.

### Species are chosen, not guessed

Species used to be keyed by `Product.name`, so naming a kit "Đậu Hà Lan" instead
of "Bean" silently produced a generic plant — right stages, wrong words, wrong
colours — and nothing in the admin screens hinted that the name was load
bearing.

`Product.speciesKey` is now an explicit choice, made in the product editor from
a catalogue the server serves (`GET /admin/products/species`). An admin can name
a product whatever sells. Products that predate the column are matched by name
through `LEGACY_NAME_TO_KEY`, and the migration backfilled the seeded ones.

Each species declares what the simulation needs (harvest, pollination, stage
label overrides) **and what the drawing needs** (`form`, `fruitShape`, colours),
so the two cannot drift:

| Species | Form | Drawn as |
| --- | --- | --- |
| `bean` | `vine` | Climbs a cane, hangs long pods |
| `carrot` | `root` | Feathery fronds; root swelling in a soil cutaway |
| `corn` | `stalk` | One thick stalk, arching blades, cob with silk |
| `sunflower` | `head` | One heavy head that nods as seeds fill in |
| `pepper` | `bush` | Pointed chillies hanging down |
| `tomato` | `bush` | Round fruit with a green calyx |
| `herb` | `leafy` | Low clump, flowers rather than fruits |

The forms live in `frontend/src/components/PlantForms.tsx`. A colour swap was
not enough: a child who knows what a carrot looks like can tell.

The shop filters by species (`GET /products/species`), which counts published
kits per species. Kits with no species resolve to the generic fallback and get
their own bucket — without one they would be present in "Tất cả" but in no
species, which reads as the shop losing products.

### Standard vs Smart

The Smart variant (`Product.smartPriceDelta`) used to be IoT hardware in the box.
Nothing ships now, so what the customer pays the upgrade for is **the full sensor
set from day one** instead of unlocking it stage by stage. It is read from the
paid order inside `createPlantForProduct`, because the activation code is per
product, not per variant.

---

## The memory album

`/tree?id=<productId>` was a bare-branch tree PNG with 28 fixed leaf-shaped
slots. It fit no species in particular, and the control for adding a photo was
one of those slots — something a child had to find inside an illustration.

It is now a journey record:

- `UserProductImage.stage` is stamped **at upload** from the plant's current
  stage. Derived later it would be wrong, because the plant moves on — a photo
  of a seedling filed under "Ra hoa" makes the album lie about the thing it
  exists to record.
- Photos group by stage, newest stage first, using that species' stage names —
  so a carrot's album reads "Phình củ" where a tomato's reads "Ra nụ".
- The page draws the live plant in its own species' form, and adding is one
  wide button that says which stage the photo will be filed under.
- Photos uploaded before a plant existed carry no stage and collect in a
  trailing "Chưa rõ chặng" group rather than being guessed into one.

Access: `canAccessProductFeature` now accepts **owning a plant** as proof of
owning the kit. A plant only exists because a code was redeemed, which makes it
stronger evidence than the order lookup (which misses a gifted kit) or the
entitlement rows (which an admin grant can leave out of step).

## Written for a six-year-old

The dashboard shows five dials, a line chart and eight devices. None of that
tells a child what to **do**, and a child who does not know what to do leaves.

- **A first-run guide** (`PlantGuide`) opens once, four cards, one idea each:
  read the colours, press the orange box, the plant needs rest, raise it to
  harvest. A "?" button brings it back; it does not reappear by itself, because
  a popup that returns every visit teaches people to dismiss things unread.
- **Readings lead with meaning.** "Độ ẩm đất 88%" requires knowing the comfort
  band for the current stage and comparing against it. "Hơi ướt" is the same
  fact, already interpreted — the number stays underneath, smaller, for the
  parent reading over their shoulder.
- **Plain labels**: "Dinh dưỡng" became "Thức ăn của cây", "Nguy cơ sâu bệnh"
  became "Sâu bệnh".
- **One activation screen.** There were two — a standalone `/redeem` page and
  the form on "Cây của tôi". The code and the plant it produces belong on the
  same screen, so `/redeem` now redirects.

## The AI coach

`POST /me/plants/:id/coach` builds its own system prompt from the plant's real
numbers **and the step the dashboard has already chosen**, and tells the model to
explain that step rather than invent its own. An AI that recommended something
other than the highlighted button would read as the site arguing with itself.

`POST /chat` takes an optional `plantId` for the same context in the general
assistant. The id is scoped to the caller's own plants inside the lookup, so a
guessed id simply finds nothing.

Provider plumbing lives in `backend/src/services/ai.js` — one place, shared by
both. The client never supplies a system prompt (finding F-07).

---

## "Mua 3 tặng 1 workshop"

Earned rewards are **rows**, not a computed count. A customer who claims a free
seat and then buys three more kits must not have the first reward silently
returned to them, and staff need to see which booking each free seat was spent
on — neither of which a derived number can express.

- `syncWorkshopRewards()` is idempotent: it only ever inserts the milestones a
  customer has reached but has no row for. It runs after a payment **and** on
  every read of `/me/rewards`, which is what makes a missed webhook self-heal.
- Counted in **units**, not orders — three kits in one basket is the promotion
  working as advertised, and three separate orders must count the same. Only
  `category: 'kit'` qualifies; a VIP membership is not a planting product.
- A reward covers **one child's seat**. Booking three children with one reward
  still leaves two to pay for, and the response says so.
- Claiming happens inside the registration transaction, guarded by
  `updateMany({ where: { id, status: 'available' } })`. Two bookings submitted at
  once both read the same available row; only one can win, and the loser is told
  to reload rather than being silently charged.
- Cancelling a rewarded booking **returns** the reward. Without that, cancelling
  would burn it and the customer would have nothing to show for three kits.

Threshold: `WORKSHOP_REWARD_THRESHOLD` (default 3).

---

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/me/plants/activate` | `{ code, nickname? }`. 422 when the code carries no kit. |
| `GET` | `/me/plants` | List + warnings. Ticks every plant. |
| `GET` | `/me/plants/:id` | Dashboard payload. **Advances the simulation.** |
| `POST` | `/me/plants/:id/care` | `{ action }`. 429 on cooldown, 409 on wrong stage. |
| `PATCH` | `/me/plants/:id/devices` | `{ type, autoMode }`. |
| `PATCH` | `/me/plants/:id` | `{ nickname }`. |
| `POST` | `/me/plants/:id/coach` | `{ question? }`. |
| `GET` | `/me/rewards` | Progress; syncs on read. |
| `GET` | `/plants/guide` | Public reference for the stage/care/device rules. |
| `GET` | `/products/species` | Public. Species with a count of published kits, for the shop filter. |
| `GET` | `/admin/products/species` | The catalogue the product editor's species picker offers. |
| `POST` | `/orders/:id/simulate-payment` | Dev/demo only; see **Simulated payments**. |

Everything under `/me/plants` scopes by `userId` **inside the query**, so another
account gets the same 404 whether the plant exists or not — it cannot be used to
probe for other people's plants.

---

## Simulated payments

The real payment flow cannot be exercised without a live SePay account: an order
sits at "chờ thanh toán" forever, so nothing downstream — the activation code,
the plant, the workshop reward — can be tested or demonstrated at all.

`POST /orders/:id/simulate-payment` credits an order with no bank transaction
behind it. It is refused unless **both** `NODE_ENV` is non-production **and**
`ALLOW_FAKE_PAYMENTS=true`: either condition alone would be enough if it were
never got wrong, and getting it wrong gives away the shop. On a production host
it answers 404 rather than 403, so the route does not advertise itself.

Every use writes a `payment.simulated` audit row marked `fake: true`, and it runs
the same downstream work the webhook does rather than a shortcut through it.
`GET /orders/:id` returns `canSimulatePayment`, so the button cannot appear
against a server that would refuse it.

The payment page polls at 1.5s for the first 90 seconds — the customer is
watching the screen with their banking app open, and four seconds of nothing
reads as failure — then backs off to 5s.

## Demo data

```bash
docker compose exec backend node scripts/seed-demo-plants.js <email> [password]
```

Builds one plant per growth stage on one account, each a different species, with
care logs, 40 sensor readings and devices unlocked exactly as far as that stage
would have unlocked them. Walking a plant to harvest honestly takes about two
weeks, which makes the later stages impossible to look at while building.
Refuses to run in production: it fabricates paid orders.

## Environment

```bash
# 1 = real time, so a 4-hour watering cooldown really is 4 hours.
# 24 makes an hour pass in a minute — useful for walking a plant from seed to
# harvest in a demo. MUST be 1 in production or every cooldown collapses.
PLANT_TIME_SCALE=1

# Timezone for the day/night curve and the care streak, as a UTC offset.
PLANT_TZ_OFFSET=7

WORKSHOP_REWARD_THRESHOLD=3

# Credits an order with no bank transaction behind it, for local testing and
# demos. Also requires NODE_ENV to not be "production", so setting this on the
# real server has no effect.
ALLOW_FAKE_PAYMENTS=false

# Product categories that must be physically delivered. Empty: everything is
# digital, so checkout never asks for an address. Setting e.g. "kit" brings the
# address form and its validation back — see requiresShipping() in
# backend/src/routes/orders.js and needsAddress in CartPage.tsx.
PHYSICAL_CATEGORIES=
```

---

## What this change touched elsewhere

- **Checkout no longer asks for a delivery address.** `requiresShipping()` is the
  single switch. An order edit that sends no address keeps whatever the order
  already had, so historic orders placed when Sprouty did ship keep their real
  delivery record.
- **`/my-products` → `/my-plants`.** The old URL redirects.
- **Product copy and the FAQ** were rewritten: `includes` listed a clay pot and
  acrylic paint, and the FAQ promised nationwide delivery with GHTK tracking
  numbers. Both now describe what the customer actually receives.

### Still describing a physical product

`frontend/src/pages/public/Returns.tsx` is a returns/refund policy that still
talks about damage in transit and shipping fees, and `About.tsx` opens with
"Gieo hạt thật". These were left alone on purpose — a refund policy is a
commercial and legal document, not developer copy, and it needs a decision from
the business rather than a sensible-looking rewrite.
