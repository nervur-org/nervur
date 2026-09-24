// A test sets up its world as an author would: its own custom bodies
// beside the bench's, here a registry of code the test moves to a new
// version, as a git road or a deploy would.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassList, type Classes } from 'nervur';
import { BenchGround, FakeClock, FakeNetwork } from 'nervur/bench';
import * as next from '../fixtures/world/host-next.ts';
import * as shop from '../fixtures/world/shop.ts';

test('A custom registry brings new code to a house, which keeps its rows', async () => {
  // The registry: each house's live version, and the code at each version.
  const versions: Record<string, typeof shop | typeof next> = { v1: shop, v2: next };
  let live = 'v1';
  const registry = (): Classes => {
    const module = versions[live];
    return new ClassList({ steward: module.steward, beings: module.beings });
  };
  const clock = new FakeClock();
  const ground = await BenchGround.open({ network: new FakeNetwork({ clock }), clock, host: 'shop', names: ['shop.example'], bodies: { classes: { registry } } });
  const entry = { memory: { body: 'fake' }, classes: { body: 'registry' } };
  const first = await ground.add('store', entry);
  await ground.ask({ house: 'store', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } });
  assert.deepEqual(await ground.ask({ house: 'store', id: 'bob', method: 'greet' }), { result: 'bob greets root' });

  live = 'v2';
  await ground.remove('store');
  const second = await ground.add('store', entry);
  assert.equal(second.ward, first.ward);
  assert.deepEqual(await ground.ask({ house: 'store', id: 'bob', method: 'greet' }), { result: 'bob welcomes root' }, 'new code over the same row');
});

test('A custom body never takes the place of the bench’s own', async () => {
  const clock = new FakeClock();
  await assert.rejects(
    BenchGround.open({ network: new FakeNetwork({ clock }), clock, host: 'x', bodies: { memory: { fake: () => { throw new Error('never made'); } } } }),
    /the body fake is the bench's own/,
  );
});
