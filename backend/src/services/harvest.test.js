import test from 'node:test';
import assert from 'node:assert/strict';
import { REGROW_STAGE, SPECIES, harvestRating, harvestsFor } from './plant-sim.js';
import { SPECIES_RECIPE, speciesRecipe } from './species-recipes.js';

test('plants that crop again are picked three times, the rest once', () => {
  for (const key of ['bean', 'pepper', 'tomato', 'herb']) assert.equal(harvestsFor({ speciesKey: key }), 3, key);
  for (const key of ['carrot', 'corn', 'sunflower']) assert.equal(harvestsFor({ speciesKey: key }), 1, key);
  // A product with no species falls back to a single harvest.
  assert.equal(harvestsFor(null), 1);
  assert.equal(REGROW_STAGE, 'fruiting');
});

test('stars follow how well the plant was kept', () => {
  assert.equal(harvestRating({ avgHealth: 95, streak: 7, attempt: 1 }).stars, 3);
  assert.equal(harvestRating({ avgHealth: 75, streak: 3, attempt: 1 }).stars, 2);
  assert.equal(harvestRating({ avgHealth: 40, streak: 0, attempt: 1 }).stars, 1);
  // Dying and being replanted costs a star's worth.
  assert.ok(harvestRating({ avgHealth: 95, streak: 7, attempt: 2 }).stars < 3);
  // Out-of-range input is clamped, never more than three stars or fewer than one.
  assert.equal(harvestRating({ avgHealth: 400, streak: 99, attempt: 1 }).stars, 3);
  assert.equal(harvestRating({ avgHealth: -5, streak: -1, attempt: 9 }).stars, 1);
});

test('every species has a dish of three steps for after the harvest', () => {
  for (const key of Object.keys(SPECIES)) {
    const recipe = speciesRecipe(key);
    assert.ok(recipe, `${key} has a recipe`);
    assert.equal(recipe.steps.length, 3, `${key} has three steps`);
    assert.ok(recipe.title && recipe.note, `${key} has a title and a note`);
  }
  assert.equal(speciesRecipe('generic'), null);
  assert.deepEqual(Object.keys(SPECIES_RECIPE).sort(), Object.keys(SPECIES).sort());
});
