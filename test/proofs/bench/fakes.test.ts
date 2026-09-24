// Every fake the bench exports, held to its contract's suite.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FakeCarry, FakeClock, FakeKeys, FakeMemory } from 'nervur/bench';
import { NobleCrypto } from '../../../src/bodies/noble-crypto.ts';
import { carrySuite } from '../suites/carry.ts';
import { clockSuite } from '../suites/clock.ts';
import { keysSuite } from '../suites/keys.ts';
import { memorySuite } from '../suites/memory.ts';

const crypto = new NobleCrypto();

memorySuite('FakeMemory', () => new FakeMemory());

clockSuite('FakeClock', () => {
  const clock = new FakeClock();
  return { clock, advance: async (ms) => clock.advance(ms) };
});

keysSuite('FakeKeys', () => new FakeKeys('a ward', crypto), crypto);

carrySuite('FakeCarry', async () => {
  const network = new Map();
  const one = new FakeCarry({ network, address: 'fake://one' });
  const two = new FakeCarry({ network, address: 'fake://two' });
  return {
    one,
    two,
    listen: async (listened) => two.listen(listened),
    nowhere: 'fake://nowhere',
    cut: async () => {
      one.lose = 1;
    },
    spare: async () => {
      let reached = false;
      network.set('fake://spare', async () => {
        reached = true;
        return new Uint8Array([9]);
      });
      return { at: 'fake://spare', reached: () => reached };
    },
    close: async () => undefined,
  };
});

test('FakeKeys: one name, one ward; two names, two wards', async () => {
  assert.deepEqual(await new FakeKeys('x', crypto).ward(), await new FakeKeys('x', crypto).ward());
  assert.notDeepEqual((await new FakeKeys('x', crypto).ward()).signing, (await new FakeKeys('y', crypto).ward()).signing);
});
