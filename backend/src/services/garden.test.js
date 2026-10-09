import test from 'node:test';
import assert from 'node:assert/strict';
import { usageDay, effectiveGarden } from './benefits.js';
import { stageMeta, SPECIES, applyCare, tick } from './plant-sim.js';

test('Vietnam midnight resets daily usage, independent of server timezone', () => {
  assert.equal(usageDay(new Date('2026-10-09T16:59:59Z')), '2026-10-09');
  assert.equal(usageDay(new Date('2026-10-09T17:00:00Z')), '2026-10-10');
});
test('expired VIP preferences remain stored but cannot be used', () => {
  const saved = { scene: 'night', decoration: 'ceramic' };
  assert.deepEqual(effectiveGarden(false, saved), { scene: 'natural', decoration: 'plain' });
  assert.deepEqual(effectiveGarden(true, saved), saved);
});
test('species have distinct growing needs and non-fruiting stories', () => {
  assert.notDeepEqual(stageMeta('vegetative', { speciesKey: 'carrot' }).idealTemp, stageMeta('vegetative', { speciesKey: 'pepper' }).idealTemp);
  assert.match(stageMeta('flowering', { speciesKey: 'carrot' }).story, /không cần/);
  assert.equal(SPECIES.herb.pollinate, false);
});
test('care and elapsed-time simulation stay finite for every species', () => {
  for (const speciesKey of Object.keys(SPECIES)) {
    const plant = { id: 'simulation-test', moisture: 50, nutrient: 60, health: 85, pestRisk: 5, stage: 'seedling', stageProgress: 20, growthPoints: 30, lastTickAt: new Date('2026-10-09T00:00:00Z') };
    const result = tick(plant, { now: new Date('2026-10-09T04:00:00Z'), product: { speciesKey } });
    for (const key of ['moisture', 'nutrient', 'health', 'pestRisk', 'stageProgress']) {
      assert.ok(Number.isFinite(result.state[key]), `${speciesKey}: ${key} must remain finite`);
      assert.ok(result.state[key] >= 0 && result.state[key] <= 100);
    }
    const care = applyCare('water', plant, { temperature: 25, light: 60, humidity: 60 }, { speciesKey });
    assert.ok(Number.isFinite(care.growth));
    assert.ok(care.state.moisture > plant.moisture);
  }
});
