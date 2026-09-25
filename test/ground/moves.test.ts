// A house moves between grounds by its seed and its memory, through the
// hand alone. Its ward stays, every standing still answers, and no far
// house notices.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import * as shop from '../fixtures/world/shop.ts';

const modules = { shop };
const entry = { classes: { faculty: 'module', name: 'shop' } };

test('A house moved to another ground keeps its ward, and no far standing notices', async (t) => {
  const network = new FakeNetwork();
  const acme = await BenchGround.open({ network, host: 'acme', names: ['acme.com'], modules });
  t.after(() => acme.down());
  // Alice's home first stands on an edge, reached at her own name.
  const edge = await BenchGround.open({ network, host: 'alice-edge', names: ['alice.home'], modules });
  t.after(() => edge.down());
  await acme.add('store', 'shop');
  const { ward } = await edge.add('home', 'shop');
  await acme.ask({ house: 'store', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } });
  await acme.ask({ house: 'store', method: 'bear', args: { kind: 'org.example.guest', id: 'clerk' } });
  await edge.ask({ house: 'home', method: 'bear', args: { kind: 'org.example.guest', id: 'alice' } });
  await edge.ask({ house: 'home', method: 'bear', args: { kind: 'org.example.host', id: 'hal' } });
  const link = async (from: BenchGround, house: string, host: string, to: BenchGround, into: string, guest: string) => {
    const offered = await from.ask({ house, method: 'offerFor', args: { being: host, occupant: guest } });
    assert.ok('result' in offered, JSON.stringify(offered));
    assert.ok('result' in (await to.ask({ house: into, id: guest, method: 'accept', args: { invitation: (offered.result as { handle: string }).handle } })));
  };
  // Alice holds a standing on Bob at the shop, and the shop's clerk one on Hal at her home.
  await link(acme, 'store', 'bob', edge, 'home', 'alice');
  await link(edge, 'home', 'hal', acme, 'store', 'clerk');
  const greets = async (ground: BenchGround, house: string, guest: string) => ground.ask({ house, id: guest, method: 'greetHost' });
  assert.deepEqual(await greets(edge, 'home', 'alice'), { result: 'bob greets alice' });
  assert.deepEqual(await greets(acme, 'store', 'clerk'), { result: 'hal greets clerk' });

  // Out of the edge through its hand, and into her own ground; her name points there now.
  const out = await edge.hand({ method: 'movesOut', args: { name: 'home' } });
  assert.ok('result' in out, JSON.stringify(out));
  assert.deepEqual(edge.list(), [], 'the edge runs it no more');
  await edge.down();
  const own = await BenchGround.open({ network, host: 'alice-hetzner', names: ['alice.home'], modules });
  t.after(() => own.down());
  const moved = await own.hand({ method: 'movesIn', args: { name: 'home', ...entry, ...(out.result as { seed: string; places: Record<string, Record<string, string>> }) } });
  assert.deepEqual(moved, { result: { ward } }, 'the same ward');

  assert.deepEqual(await greets(own, 'home', 'alice'), { result: 'bob greets alice' }, 'her standing on the shop still answers');
  assert.deepEqual(await greets(acme, 'store', 'clerk'), { result: 'hal greets clerk' }, 'the shop’s standing on her house still answers');
});

test('A move answers its seed to the hand, remembered by its call id in the dock alone, and a house moves into no memory that holds rows', async (t) => {
  const network = new FakeNetwork();
  const ground = await BenchGround.open({ network, host: 'home', modules });
  t.after(() => ground.down());
  await ground.add('busy', 'shop');
  const out = await ground.hand({ method: 'movesOut', args: { name: 'busy' }, call: 'move-busy' });
  assert.ok('result' in out);
  assert.deepEqual(await ground.hand({ method: 'movesOut', args: { name: 'busy' }, call: 'move-busy' }), out, 'the same call answers the same seed, and moves nothing twice');
  assert.deepEqual(await ground.hand({ method: 'movesOut', args: { name: 'busy' } }), { error: { message: 'no house busy is here' } });
  await ground.add('taken', 'shop');
  const moveInto = (name: string) => ground.hand({ method: 'movesIn', args: { name, ...entry, ...(out.result as object) } });
  assert.deepEqual(await moveInto('taken'), { error: { message: 'the house taken stands here already' } });
  // Removed, a house leaves its seed and its rows behind, and nothing moves in over them.
  await ground.remove('taken');
  assert.deepEqual(await moveInto('taken'), { error: { message: 'the memory for taken holds places already' } });
  // A house whose places are on a memory body of their own leaves its seed in the drawer all the same.
  await ground.add('seeded', { memory: { faculty: 'fake' }, classes: { faculty: 'module', name: 'shop' } });
  await ground.remove('seeded');
  const seededInto = await ground.hand({ method: 'movesIn', args: { name: 'seeded', ...entry, ...(out.result as object) } });
  assert.deepEqual(seededInto, { error: { message: 'the drawer keeps another seed for seeded' } });
  assert.ok('result' in (await moveInto('again')), 'an empty memory takes it');
});
