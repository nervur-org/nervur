// A test sets up its world as an author would: its own custom faculties
// beside the bench's, here one serving a house's code, which the owner
// moves to a new version by updating its entry, as a git road or a deploy
// would.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassList, type Faculty } from 'nervur';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import * as next from '../fixtures/world/host-next.ts';
import * as shop from '../fixtures/world/shop.ts';

test('A custom faculty brings new code to a house by an update, installed once for each entry, and the house keeps its ward and its rows', async () => {
  const versions: Record<string, typeof shop | typeof next> = { v1: shop, v2: next };
  const installed: string[] = [];
  const ups: string[] = [];
  const downs: string[] = [];
  const code: Faculty = {
    install: ({ args }) => void installed.push(String(args.version)),
    up: ({ args }) => {
      const version = String(args.version);
      ups.push(version);
      const module = versions[version];
      return { serves: 'classes', house: () => new ClassList({ steward: module.steward, beings: module.beings }), down: () => void downs.push(version) };
    },
  };
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'shop', names: ['shop.example'], registry: { faculties: { code } } });
  const faculty = (method: string, args: Record<string, unknown>) => ground.hand({ faculty: 'faculties', method, args: args as never });
  assert.deepEqual(await faculty('add', { name: 'code', make: 'code', args: { version: 'v1' } }), { result: null });
  const first = await ground.add('store', { classes: { faculty: 'code' } });
  await ground.ask({ house: 'store', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } });
  assert.deepEqual(await ground.ask({ house: 'store', id: 'bob', method: 'greet' }), { result: 'bob greets root' });

  assert.match(JSON.stringify(await faculty('add', { name: 'code', make: 'code', args: { version: 'v2' } })), /stands with another entry; update it/, 'another entry is an update');
  assert.deepEqual(await faculty('update', { name: 'code', make: 'code', args: { version: 'v2' } }), { result: null });
  assert.deepEqual(downs, ['v1'], 'the body went down');
  assert.deepEqual(ups, ['v1', 'v2'], 'and up on its new entry');
  const second = ground.list().find(({ name }) => name === 'store');
  assert.equal(second?.ward, first.ward, 'the house opened again, as the same ward');
  assert.deepEqual(await ground.ask({ house: 'store', id: 'bob', method: 'greet' }), { result: 'bob welcomes root' }, 'new code over the same row');

  assert.deepEqual(await faculty('restart', { name: 'code' }), { result: null });
  assert.deepEqual(ups, ['v1', 'v2', 'v2'], 'a restart takes it down and up on its entry');
  assert.deepEqual(installed, ['v1', 'v2'], 'installed once for each entry, and never on a restart');
  assert.equal(ground.list().find(({ name }) => name === 'store')?.ward, first.ward);
  assert.deepEqual(await ground.ask({ house: 'store', id: 'bob', method: 'greet' }), { result: 'bob welcomes root' });
});

test('A custom faculty never takes the place of the bench’s own', async () => {
  await assert.rejects(BenchGround.open({ network: new FakeNetwork(), host: 'x', registry: { faculties: { fake: { up: () => ({}) } } } }), /the faculty fake is the bench's own/);
});
