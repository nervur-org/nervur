// A device hears its station through a watch that lands as a reply. The
// Pi only dials, so the family's station never reaches it: its twin keeps
// a watch on the door's mirror, and pulses once for each opening it hears.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { outpost, Pulses, Relay, station } from '../fixtures/world/outpost.ts';

test('A device hears its station through a watch, and pulses once for each opening, across a lost reply', async (t) => {
  const network = new FakeNetwork();
  const pulses = new Pulses();
  const family = await BenchGround.open({ network, host: 'family', names: ['family.example'], modules: { station } });
  t.after(() => family.down());
  await family.add('family', 'station');
  await family.ask({ house: 'family', method: 'bear', args: { kind: 'org.example.garage-mirror', id: 'door' } });
  // The Pi names no address: nothing dials it.
  const pi = await BenchGround.open({ network, host: 'pi', modules: { outpost }, faculties: { relay: { blueprint: Relay, object: pulses, kinds: ['org.example.garage-twin'] } } });
  t.after(() => pi.down());
  await pi.add('pi', 'outpost', { faculties: ['relay'] });
  await pi.ask({ house: 'pi', method: 'bear', args: { kind: 'org.example.garage-twin', id: 'door' } });
  const paper = await family.ask({ house: 'family', method: 'offerFor', args: { being: 'door', occupant: 'pi' } });
  assert.ok('result' in paper, JSON.stringify(paper));
  await pi.ask({ house: 'pi', id: 'door', method: 'accept', args: { invitation: (paper.result as { handle: string }).handle } });
  assert.deepEqual(await pi.ask({ house: 'pi', id: 'door', method: 'watch' }), { result: null });
  const open = () => family.ask({ house: 'family', id: 'door', method: 'open' });

  assert.deepEqual(await open(), { result: null });
  await pulses.reached(1);

  // The answer to the Pi's watch is lost on its way back, so the watch goes again, due in a second.
  network.loseNext();
  assert.deepEqual(await open(), { result: null });
  await network.settle();
  assert.ok(network.crossings.some(({ outcome }) => outcome === 'lost'), 'the watch’s answer was lost');
  await network.advance(1_000);
  await pulses.reached(2);

  assert.deepEqual(await open(), { result: null });
  await pulses.reached(3);
  await network.settle();
  assert.equal(pulses.count, 3, 'three openings, three pulses, never four');
});
