// Where a relation between two beings is carried: never past the carry
// inside one house, by pointer between two houses on one ground, and over
// TCP between two grounds.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { being, groundOne, hand } from '../fixtures/node/grounds.ts';
import { ground, stop } from '../fixtures/node/spawned.ts';
import { Counter } from '../fixtures/world/counter.ts';
import { Reader } from '../fixtures/world/reader.ts';

const script = new URL('../fixtures/node/ground.ts', import.meta.url).pathname;

test('Same house: a standing between two beings never reaches the carry', async (t) => {
  const one = await groundOne(t, { dials: true });
  const house = await one.open('a', { beings: [Counter, Reader] });
  await hand(house.ask, 'bear', { kind: 'org.example.counter', id: 'c', args: { start: 3 } });
  await hand(house.ask, 'bear', { kind: 'org.example.reader', id: 'r' });
  await hand(house.ask, 'introduce', { from: 'r', to: 'c', trusted: true });
  assert.equal(await being(house.ask, 'r', 'look', { at: 'c' }), 3, 'r read c’s cells through the standing');
  assert.equal(one.carry.sends, 0, 'a standing inside one house never leaves it');
});

test('Same ground, two houses: a standing between two beings on one ground is carried by pointer, not the network', async (t) => {
  // The ground dials no loopback address, and its own are loopback: whatever
  // answers this ask does not do it by sending a box to an address.
  const one = await groundOne(t);
  const a = await one.open('a');
  const b = await one.open('b');
  const { handle } = (await hand(a.ask, 'offer')) as { handle: string };
  const standing = (await hand(b.ask, 'adopt', { invitation: handle })) as string;
  assert.deepEqual(await b.ask({ method: 'relay', args: { standing } }), { result: 'far' }, 'two houses on one ground answer each other by pointer, with no address to dial');
});

test('Two grounds over TCP: a being on ground one asks a being on ground two, over the carry', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'nervur-where-'));
  const far = await ground(script, { env: { NERVUR_KEY: 'c'.repeat(64), GROUND_MEMORY: join(folder, 'far.memory'), GROUND_OFFER: '1' }, conditions: ['nervur-source'] });
  t.after(async () => {
    await stop(far.child);
    rmSync(folder, { recursive: true, force: true });
  });
  const one = await groundOne(t, { dials: true });
  const near = await one.open('d');
  const standing = (await hand(near.ask, 'adopt', { invitation: far.line.offered!.result.handle })) as string;
  assert.deepEqual(await near.ask({ method: 'relay', args: { standing } }), { result: 'far' }, 'the far ground, in its own process, answered over TCP');
  assert.ok(one.carry.sends >= 1, 'the ask crossed the carry to reach the other ground');
});
