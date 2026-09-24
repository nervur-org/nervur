// A chain of awaited asks ends together. Each ask carries the time its
// chain has left, near or far, and a being waits only while her caller
// listens. An entry's `wait` bounds every ask of its house.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { Endless, endless, Link } from '../fixtures/world/link.ts';
import { Steward } from '../fixtures/world/steward.ts';

type Json = NonNullable<Parameters<BenchGround['ask']>[0]['args']>;

const modules = { chain: { steward: Steward, beings: [Link] } };
const faculties = { endless: { blueprint: Endless, object: endless } };

// What a link did, once every ask, effect and reply has run to its end.
const landed = async (network: FakeNetwork, read: () => Promise<string>) => {
  await network.settle();
  return read();
};

/** A house on a ground: the ground's hand on it, by the house's name. */
interface Placed {
  readonly ground: BenchGround;
  readonly house: string;
}

// Grounds on one network, and so one clock. Each house's chain link is granted the endless faculty.
const world = () => {
  const network = new FakeNetwork();
  const open = async (host: string, house: string, wait?: number): Promise<Placed> => {
    const ground = await BenchGround.open({ network, host, names: [`${host}.example`], modules, faculties });
    await ground.add(house, 'chain', { faculties: ['endless'], ...(wait === undefined ? {} : { wait }) });
    return { ground, house };
  };
  // A second house on a ground already open.
  const beside = async ({ ground }: Placed, house: string, wait?: number): Promise<Placed> => {
    await ground.add(house, 'chain', { faculties: ['endless'], ...(wait === undefined ? {} : { wait }) });
    return { ground, house };
  };
  return { network, open, beside };
};

const ask = ({ ground, house }: Placed, request: { id?: string; method: string; args?: Json }) => ground.ask({ house, ...request });
const hand = async (placed: Placed, method: string, args: Json = {}, id?: string) => {
  const answer = await ask(placed, { ...(id === undefined ? {} : { id }), method, args });
  assert.ok('result' in answer, `${method}: ${JSON.stringify(answer)}`);
  return answer.result;
};
const outcome = async (placed: Placed, id: string) => JSON.parse(((await hand(placed, 'forward', { id, method: 'outcome' })) as { answered: string }).answered) as string;

// A link in each house given, each passing to the next.
const chain = async (links: readonly { at: Placed; id: string }[]) => {
  for (const { at, id } of links) await hand(at, 'bear', { kind: 'org.example.link', id });
  for (let index = 0; index + 1 < links.length; index++) {
    const next = links[index + 1];
    const { handle } = (await hand(next.at, 'offerFor', { being: next.id, occupant: `from-${links[index].id}` })) as { handle: string };
    await hand(links[index].at, 'accept', { invitation: handle }, links[index].id);
  }
};

for (const placement of ['far', 'near'] as const) {
  test(`A chain of three ends when its first ask does, the last link giving up with it (${placement === 'far' ? 'three grounds' : 'two links in one house'})`, async () => {
    const { network, open } = world();
    // The first house bounds its asks at thirty seconds; every link names a minute.
    const a = await open('a', 'a', 30_000);
    const b = placement === 'far' ? await open('b', 'b') : a;
    const c = await open('c', 'c');
    await chain([
      { at: a, id: 'first' },
      { at: b, id: 'second' },
      { at: c, id: 'third' },
    ]);
    const start = network.now();
    const passed = ask(a, { method: 'forward', args: { id: 'first', method: 'pass' } });
    await network.settle();
    await network.advance(30_000);
    assert.deepEqual(await passed, { error: { message: 'pass answered nothing' } });
    assert.equal(await landed(network, () => outcome(c, 'third')), `gave up at ${start + 30_000}`, 'the last link stopped when the first ask did, not at her own minute');
  });
}

test('A chain between two houses of one ground ends when its first ask does', async () => {
  const { network, open, beside } = world();
  const a = await open('a', 'a', 30_000);
  const b = await beside(a, 'b');
  await chain([
    { at: a, id: 'first' },
    { at: b, id: 'second' },
  ]);
  const start = network.now();
  const passed = ask(a, { method: 'forward', args: { id: 'first', method: 'pass' } });
  await network.settle();
  await network.advance(30_000);
  assert.deepEqual(await passed, { error: { message: 'pass answered nothing' } });
  assert.equal(await landed(network, () => outcome(b, 'second')), `gave up at ${start + 30_000}`, 'by pointer, the second link stopped with the first ask');
});

test('An ask whose chain is spent while it waits its turn runs nothing', async () => {
  const { network, open } = world();
  const a = await open('a', 'a', 30_000);
  const b = await open('b', 'b');
  await chain([
    { at: a, id: 'first' },
    { at: b, id: 'second' },
  ]);
  // The second link is busy for a minute of her own.
  const blocked = ask(b, { method: 'forward', args: { id: 'second', method: 'block' } });
  await network.settle();
  const passed = ask(a, { method: 'forward', args: { id: 'first', method: 'pass' } });
  await network.settle();
  await network.advance(30_000);
  assert.deepEqual(await passed, { error: { message: 'pass answered nothing' } }, 'the first link stopped listening');
  await network.advance(30_000);
  await blocked;
  // Had it run, it would have hung its own minute and landed what it did.
  await network.advance(60_000);
  assert.equal(await outcome(b, 'second'), '', 'her turn came after its chain was spent, and it ran nothing');
});

test('An entry’s wait bounds an ask asked by the hand', async () => {
  const { network, open } = world();
  const a = await open('a', 'a', 1000);
  await chain([{ at: a, id: 'only' }]);
  const start = network.now();
  const passed = ask(a, { method: 'forward', args: { id: 'only', method: 'pass' } });
  await network.settle();
  await network.advance(1000);
  // Caller and callee share one end, so the hand stops listening as she gives up.
  assert.deepEqual(await passed, { error: { message: 'pass answered nothing' } });
  assert.equal(await landed(network, () => outcome(a, 'only')), `gave up at ${start + 1000}`, 'a second, the entry’s bound, and not her own minute');
});
