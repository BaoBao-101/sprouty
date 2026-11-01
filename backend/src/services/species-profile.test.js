import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, speciesCatalog } from './plant-sim.js';
import { SPECIES_PROFILE, speciesProfile } from './species-profile.js';

test('every species an admin can pick comes with a complete profile', () => {
  for (const key of Object.keys(SPECIES)) {
    const p = SPECIES_PROFILE[key];
    assert.ok(p, `${key} has no profile`);
    for (const field of ['scientificName', 'family', 'origin', 'story']) {
      assert.ok(typeof p[field] === 'string' && p[field].length > 3, `${key}.${field}`);
    }
    assert.ok(p.traits.length >= 2 && p.funFacts.length >= 2, `${key} needs traits and fun facts`);
  }
});

test('the generic fallback has no profile, and the catalogue carries each one', () => {
  assert.equal(speciesProfile('generic'), null);
  for (const entry of speciesCatalog()) assert.deepEqual(entry.profile, SPECIES_PROFILE[entry.key]);
});
