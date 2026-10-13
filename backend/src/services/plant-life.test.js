import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CRITICAL_HEALTH,
  DEATH_HOURS,
  KEEPER_HEALTH_FLOOR,
  PASSIVE_CAP,
  applyCare,
  healthLabel,
  nextStepFor,
  stageMeta,
  stageTasks,
  taskProgress,
  tick,
} from './plant-sim.js';

const START = new Date('2026-10-12T02:00:00Z');
const HOUR = 3_600_000;
/** VIP's care kit, wired and switched on. */
const KIT = { auto_care: { unlocked: true, autoMode: true, battery: 100 } };

function freshPlant(stage = 'vegetative', extra = {}) {
  const meta = stageMeta(stage);
  return {
    id: 'plant-life-test',
    moisture: meta.idealMoisture[1] - 2,
    nutrient: 60,
    health: 90,
    pestRisk: 5,
    stage,
    stageProgress: 10,
    growthPoints: 0,
    wiltHours: 0,
    diedAt: null,
    lastTickAt: START,
    ...extra,
  };
}

/** Leaves the plant alone, reading it once an hour, for `hours`. */
function neglect(plant, hours, options = {}) {
  let p = plant;
  let at = new Date(p.lastTickAt);
  for (let h = 0; h < hours; h += 1) {
    at = new Date(at.getTime() + HOUR);
    const result = tick(p, { now: at, ...options });
    p = { ...p, ...result.state, lastTickAt: at };
    if (p.diedAt) break;
  }
  return p;
}

test('a plant left alone dies after five to seven days, not before', () => {
  for (const stage of ['seed', 'seedling', 'vegetative', 'flowering']) {
    const atFiveDays = neglect(freshPlant(stage), 5 * 24);
    assert.equal(atFiveDays.diedAt, null, `${stage} must survive five days`);
    const dead = neglect(freshPlant(stage), 7 * 24);
    assert.ok(dead.diedAt, `${stage} must not survive a week`);
    const days = (new Date(dead.diedAt).getTime() - START.getTime()) / (24 * HOUR);
    assert.ok(days >= 5 && days <= 7, `${stage} died after ${days.toFixed(1)} days`);
  }
});

test('watering a plant at "héo nặng" resets the countdown', () => {
  let plant = neglect(freshPlant('vegetative'), 70);
  assert.ok(plant.wiltHours > 0, 'should be wilting badly by now');
  const env = { temperature: 26, light: 60, humidity: 60 };
  const care = applyCare('water', plant, env, null, { tasksDoneAfter: false });
  plant = { ...plant, ...care.state };
  plant = neglect(plant, 6);
  assert.equal(plant.wiltHours, 0);
  assert.equal(plant.diedAt, null);
});

test("VIP's care kit keeps the plant alive, tired, and does not grow it", () => {
  const until = new Date(START.getTime() + 30 * 24 * HOUR);
  const plant = neglect(freshPlant('vegetative'), 14 * 24, { keeperUntil: until, devices: KIT });
  assert.equal(plant.diedAt, null);
  assert.ok(plant.health >= KEEPER_HEALTH_FLOOR);
  // It rescues rather than tends: left to it, a plant looks tired, not thriving.
  assert.ok(plant.health < 65, `health ${plant.health}`);
  assert.equal(plant.stage, 'vegetative', 'no stage gained without the child');
  assert.ok(plant.stageProgress <= PASSIVE_CAP);
});

test('the care kit protects only while it is switched on', () => {
  const until = new Date(START.getTime() + 30 * 24 * HOUR);
  const off = { auto_care: { unlocked: true, autoMode: false, battery: 100 } };
  const plant = neglect(freshPlant('vegetative'), 10 * 24, { keeperUntil: until, devices: off });
  assert.ok(plant.diedAt, 'a VIP plant whose kit is off is not looked after');
});

test('the care kit stops when VIP runs out', () => {
  const until = new Date(START.getTime() + 24 * HOUR);
  const plant = neglect(freshPlant('vegetative'), 10 * 24, { keeperUntil: until, devices: KIT });
  assert.ok(plant.diedAt, 'protection ended after a day, the plant was then left for nine');
});

test('a plant left alone grows only halfway through its stage', () => {
  const until = new Date(START.getTime() + 60 * 24 * HOUR);
  const plant = neglect(freshPlant('seed', { stageProgress: 0 }), 20 * 24, { keeperUntil: until, devices: KIT, tasksDone: true });
  assert.equal(plant.stage, 'seed');
  assert.ok(plant.stageProgress <= PASSIVE_CAP + 0.01, `got ${plant.stageProgress}`);
});

test('full points without the tasks hold the plant; the last task moves it on', () => {
  const env = { temperature: 26, light: 80, humidity: 60 };
  const nearlyDone = { ...freshPlant('seedling'), stageProgress: 98, moisture: 40 };
  const held = applyCare('water', nearlyDone, env, null, { tasksDoneAfter: false });
  assert.equal(held.state.stage, 'seedling');
  assert.equal(held.state.stageProgress, 100);
  assert.ok(held.messages.some((m) => /nhiệm vụ/.test(m.text)));

  const moved = applyCare('water', nearlyDone, env, null, { tasksDoneAfter: true });
  assert.equal(moved.state.stage, 'vegetative');
  assert.equal(moved.state.stageProgress, 0);
});

test('a dead plant stays as it was left', () => {
  const dead = { ...freshPlant('vegetative'), diedAt: START, health: 5 };
  const result = tick(dead, { now: new Date(START.getTime() + 48 * HOUR) });
  assert.equal(result.state.health, 5);
  assert.equal(result.state.moisture, dead.moisture);
});

test('stage tasks only ask for what the species and stage allow', () => {
  const pepper = stageTasks('flowering', { speciesKey: 'pepper' }).map(([a]) => a);
  const herb = stageTasks('flowering', { speciesKey: 'herb' }).map(([a]) => a);
  assert.ok(pepper.includes('pollinate'));
  assert.ok(!herb.includes('pollinate'));
  // "Đưa ra nắng" only works by day; as a task it would strand an after-school child.
  for (const stage of ['seed', 'sprout', 'seedling', 'vegetative', 'budding', 'flowering', 'fruiting']) {
    assert.ok(!stageTasks(stage, { speciesKey: 'herb' }).some(([a]) => a === 'sunlight'), stage);
  }
  const progress = taskProgress('seed', { water: 2, mist: 5 });
  assert.equal(progress.done, true);
  assert.deepEqual(progress.tasks.map((t) => t.done), [2, 2]);
});

test('the next step points at an unfinished task once the points are in', () => {
  const availability = { water: { ready: false }, mist: { ready: true } };
  const { tasks } = taskProgress('seed', { water: 2 });
  const step = nextStepFor({ moisture: 70, nutrient: 60, health: 90, pestRisk: 5, stage: 'seed' }, { light: 0 }, availability, null, { tasks, pointsFull: true });
  assert.equal(step.action, 'mist');
  assert.match(step.why, /Đủ điểm/);
});

test('the health label says when a plant is in danger', () => {
  assert.equal(healthLabel(CRITICAL_HEALTH).id, 'critical');
  assert.equal(healthLabel(30).id, 'wilting');
  assert.ok(DEATH_HOURS >= 72, 'a long weekend away must stay survivable');
});
