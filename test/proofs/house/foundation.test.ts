// A foundation reference stays the house's own: offered to her beings as a
// custom faculty's object, it opens no house. On a ground a custom body
// reaches a house through its seat alone, so this is the house's own guard.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { need, s } from 'nervur/being';
import { FakeNetwork } from 'nervur/bench';
import { FakeClock } from '../../../src/bench/fake-clock.ts';
import { FakeMemory } from '../../../src/bench/fake-memory.ts';
import { ClassList } from '../../../src/bodies/class-list.ts';
import { NobleCrypto } from '../../../src/bodies/noble-crypto.ts';
import { SeedKeys } from '../../../src/bodies/seed-keys.ts';
import { StrictTools } from '../../../src/bodies/strict-tools.ts';
import { openHouse } from '../../../src/house/house.ts';
import { Steward } from '../../fixtures/world/steward.ts';

test('It refuses a foundation reference handed to a being, or offered as a custom faculty: the house names the offer, and opens not', async () => {
  const crypto = new NobleCrypto();
  const memory = new FakeMemory();
  const foundation = { keys: new SeedKeys('c'.repeat(64), crypto), memory, classes: new ClassList({ steward: Steward }), carry: new FakeNetwork().join('home'), clock: new FakeClock(), crypto, tools: new StrictTools() };
  const leak = { blueprint: need('leak', { read: { args: s.object({ place: s.string() }) } }), object: memory };
  await assert.rejects(openHouse(foundation, [leak]), /the offer leak is a reference of the house's foundation/);
});
