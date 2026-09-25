// The views a ground hands out of what it holds whole are bodies of their
// contracts like any other, and held to the same suites: each house's
// clock and carry, and the prefixed and sealed memories a house and a
// faculty keep their places in.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FakeNetwork } from 'nervur/bench';
import { FakeClock } from '../../../src/bench/fake-clock.ts';
import { FakeMemory } from '../../../src/bench/fake-memory.ts';
import { NobleCrypto } from '../../../src/bodies/noble-crypto.ts';
import { StrictTools } from '../../../src/bodies/strict-tools.ts';
import { HouseCarry, HouseClock, LadderCarry, SealedMemory, ViewMemory } from '../../../src/ground/views.ts';
import { carrySuite } from '../../suites/carry.ts';
import { clockSuite } from '../../suites/clock.ts';
import { memorySuite } from '../../suites/memory.ts';

const crypto = new NobleCrypto();
const tools = new StrictTools();
const key = (fill: number) => new Uint8Array(32).fill(fill);

clockSuite('HouseClock', () => {
  const clock = new FakeClock();
  return { clock: new HouseClock(clock, 'shop'), advance: async (ms) => clock.advance(ms) };
});

carrySuite('HouseCarry', async () => {
  const network = new FakeNetwork();
  const two = network.join('two', { names: ['two.example'] });
  return {
    one: new HouseCarry(network.join('one')),
    two: new HouseCarry(two),
    listen: async (listened) => two.listen(listened),
    nowhere: 'bench://nowhere.example',
    cut: async () => network.loseNext(),
    spare: async () => {
      let reached = false;
      network.join('three', { names: ['three.example'] }).listen({
        ward: 'ab'.repeat(64),
        door: async () => {
          reached = true;
          return new Uint8Array([9]);
        },
      });
      return { at: 'bench://three.example', reached: () => reached };
    },
    // The box reaches its door first, and then the network's clock moves past its wait.
    pass: async (ms) => {
      await network.settle();
      await network.advance(ms);
    },
    close: async () => undefined,
  };
});

carrySuite('LadderCarry', async () => {
  const network = new FakeNetwork();
  const two = network.join('two', { names: ['two.example'] });
  const one = network.join('one');
  return {
    one: new LadderCarry(() => one),
    two: new LadderCarry(() => two),
    listen: async (listened) => two.listen(listened),
    nowhere: 'bench://nowhere.example',
    cut: async () => network.loseNext(),
    spare: async () => {
      let reached = false;
      network.join('three', { names: ['three.example'] }).listen({
        ward: 'ab'.repeat(64),
        door: async () => {
          reached = true;
          return new Uint8Array([9]);
        },
      });
      return { at: 'bench://three.example', reached: () => reached };
    },
    pass: async (ms) => {
      await network.settle();
      await network.advance(ms);
    },
    close: async () => undefined,
  };
});

test('The dock’s carry is unheard while no body of the ladder serves it', async () => {
  const carry = new LadderCarry(() => 'no body serves the carry');
  assert.deepEqual(await carry.send({ ward: 'ab'.repeat(64), at: ['bench://two.example'], box: new Uint8Array([1]) }), { reply: null, heard: false });
  assert.deepEqual(carry.at({}), []);
});

// Each run of the suite shares its memory with a neighbour's view, which it must never see.
memorySuite('ViewMemory', async () => {
  const whole = new FakeMemory();
  await new ViewMemory(whole, 'other/').write({ writes: { p: { a: new Uint8Array([7]) } }, expect: { p: null } });
  return new ViewMemory(whole, 'mine/');
});

memorySuite('SealedMemory', async () => {
  const whole = new FakeMemory();
  await new SealedMemory(whole, key(2), crypto, tools).write({ writes: { p: { a: new Uint8Array([7]) } }, expect: { p: null } });
  return new SealedMemory(new ViewMemory(whole, 'mine/'), key(1), crypto, tools);
});

test('A sealed memory keeps no place, no entry and no byte in the clear, and opens under its own key alone', async () => {
  const whole = new FakeMemory();
  const sealed = new SealedMemory(whole, key(1), crypto, tools);
  await sealed.write({ writes: { 'call-ids': { 'call-7': tools.utf8('pulsed') } }, expect: { 'call-ids': null } });
  const [stored] = await whole.list();
  assert.ok(!stored.includes('call'), 'the place is named by a digest');
  const { entries } = await whole.read({ place: stored });
  const [[name, bytes]] = Object.entries(entries);
  assert.ok(!name.includes('call') && !new TextDecoder().decode(bytes).includes('pulsed'), 'the entry is named by a digest and sealed');
  const thief = new SealedMemory(whole, key(9), crypto, tools);
  assert.deepEqual(await thief.list(), [], 'another key finds none of it');
  assert.deepEqual(await thief.read({ place: 'call-ids' }), { entries: {}, version: null });
  assert.deepEqual(new TextDecoder().decode((await sealed.read({ place: 'call-ids' })).entries['call-7']), 'pulsed', 'its own key reads it back');
});
