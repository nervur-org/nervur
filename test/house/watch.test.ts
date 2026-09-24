// A watch: a readOnly ask asked with the answer the caller holds, answered
// once that answer moves, or as it stands when the wait runs out. Asked
// through the hand, and by a device's being across a door on a handle.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeClock, FakeNetwork, settle } from 'nervur/bench';
import * as watch from '../fixtures/watch/index.ts';

const modules = { watch };

const station = async (clock = new FakeClock(), network = new FakeNetwork()) => {
  const ground = await BenchGround.open({ network, clock, host: 'acme', names: ['acme.com'], modules });
  await ground.add('chat', 'watch');
  await ground.ask({ house: 'chat', method: 'bear', args: { kind: 'org.example.room', id: 'lobby' } });
  return { ground, clock, network };
};

// A promise and whether it has answered yet.
const watched = <T>(promise: Promise<T>) => {
  const seen = { answered: false, value: promise };
  void promise.then(() => {
    seen.answered = true;
  });
  return seen;
};

const ask = (ground: BenchGround, method: string, args?: object, after?: object) =>
  ground.ask({ house: 'chat', id: 'lobby', method, ...(args === undefined ? {} : { args }), ...(after === undefined ? {} : { after }) } as Parameters<BenchGround['ask']>[0]);

test('A watch holds while the answer stands, and answers when it moves', async (t) => {
  const { ground } = await station();
  t.after(() => ground.down());
  const now = await ask(ground, 'messages');
  assert.deepEqual(now, { result: [] });
  const held = watched(ask(ground, 'messages', {}, now));
  // A write that leaves her messages as they stand wakes the watch, which looks and holds.
  assert.deepEqual(await ask(ground, 'retitle', { topic: 'news' }), { result: null });
  assert.deepEqual(await ask(ground, 'messages'), { result: [] });
  assert.equal(held.answered, false, 'the watch holds over a change it cannot read');
  await ask(ground, 'post', { text: 'hello' });
  assert.deepEqual(await held.value, { result: [{ from: 'root', text: 'hello' }] });
});

test('A watch whose answer already moved answers at once', async (t) => {
  const { ground } = await station();
  t.after(() => ground.down());
  await ask(ground, 'post', { text: 'first' });
  assert.deepEqual(await ask(ground, 'messages', {}, { result: [] }), { result: [{ from: 'root', text: 'first' }] });
});

test('A watch answers as it stands when its wait runs out', async (t) => {
  const { ground, clock } = await station();
  t.after(() => ground.down());
  const held = watched(ask(ground, 'messages', {}, { result: [] }));
  await ask(ground, 'retitle', { topic: 'quiet' });
  // The watch runs to where it waits on the clock before the clock moves.
  await settle();
  assert.equal(held.answered, false);
  clock.advance(30_000);
  assert.deepEqual(await held.value, { result: [] });
});

test('A second watch from one asker answers the first at once', async (t) => {
  const { ground } = await station();
  t.after(() => ground.down());
  // Whichever reaches the house second ends the other, so the test holds either order.
  const one = ask(ground, 'messages', {}, { result: [] }).then((answer) => ({ answer, which: 'one' }));
  const two = ask(ground, 'messages', {}, { result: [] }).then((answer) => ({ answer, which: 'two' }));
  const ended = await Promise.race([one, two]);
  assert.deepEqual(ended.answer, { result: [] }, 'the watch ended at once, with what it held');
  const held = ended.which === 'one' ? watched(two) : watched(one);
  await ask(ground, 'retitle', { topic: 'still' });
  assert.equal(held.answered, false, 'the other watch holds');
  await ask(ground, 'post', { text: 'late' });
  assert.deepEqual((await held.value).answer, { result: [{ from: 'root', text: 'late' }] });
});

test('A device watches across a door on a handle, a relation of its own', async (t) => {
  const { ground: acme, clock, network } = await station();
  const phone = await BenchGround.open({ network, clock, host: 'alice-phone', modules });
  t.after(async () => {
    await phone.down();
    await acme.down();
  });
  await phone.add('pocket', 'watch');
  await phone.ask({ house: 'pocket', method: 'bear', args: { kind: 'org.example.reader', id: 'reader' } });
  const door = await ask(acme, 'door');
  assert.ok('result' in door, JSON.stringify(door));
  const { handle } = door.result as { handle: string };
  assert.deepEqual(await phone.ask({ house: 'pocket', id: 'reader', method: 'take', args: { invitation: handle } }), { result: null });
  const follow = watched(phone.ask({ house: 'pocket', id: 'reader', method: 'follow', args: { after: [] } }));
  await ask(acme, 'retitle', { topic: 'still' });
  assert.equal(follow.answered, false, 'the far watch holds');
  await ask(acme, 'post', { text: 'to the phone' });
  assert.deepEqual(await follow.value, { result: [{ from: 'root', text: 'to the phone' }] });
});

test('A being watches only a readOnly ask', async (t) => {
  const { ground: acme, clock, network } = await station();
  const phone = await BenchGround.open({ network, clock, host: 'alice-phone', modules });
  t.after(async () => {
    await phone.down();
    await acme.down();
  });
  await phone.add('pocket', 'watch');
  await phone.ask({ house: 'pocket', method: 'bear', args: { kind: 'org.example.reader', id: 'reader' } });
  const { handle } = ((await ask(acme, 'door')) as { result: { handle: string } }).result;
  await phone.ask({ house: 'pocket', id: 'reader', method: 'take', args: { invitation: handle } });
  const pushed = await phone.ask({ house: 'pocket', id: 'reader', method: 'push', args: { text: 'no' } });
  assert.deepEqual(pushed, { error: { message: 'post is not readOnly, so it is never watched' } });
});

test('Her view travels in her describe, to every asker', async (t) => {
  const { ground } = await station();
  t.after(() => ground.down());
  const described = await ground.ask({ house: 'chat', id: 'lobby' });
  assert.ok('describe' in described);
  assert.equal((described.describe as { view?: string }).view, '<nv-feed ask="messages"></nv-feed><form ask="post"></form>');
});
