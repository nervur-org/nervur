// EdgeGround on workerd: the family's station is an edge, and the garage
// Pi is a NodeGround that only dials. The Pi's twin watches the door's
// mirror on the edge as a reply, over a held line. Then workerd is killed
// and started again on the same storage, as an evicted object is woken:
// nothing it held in memory survives, the watch it held among it. The Pi's
// line drops, its watch goes again, and the next opening still pulses the
// relay once.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { NodeGround } from 'nervur/node';
import { pulses } from './fixtures/edge/pi/recipe.ts';
import { built, freePort, started, type Running } from './fixtures/edge/workerd.ts';

const folder = fileURLToPath(new URL('./fixtures/edge/pi/', import.meta.url));

type Answer = { result?: unknown; error?: { message: string } };

// The owner, through the edge's hand, with the key its Worker holds as `NERVUR_HAND`.
const KEY = 'a1'.repeat(32);
const hand = async (at: Running, request: object): Promise<unknown> => {
  const response = await fetch(`${at.origin}/nervur/hand`, { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: JSON.stringify(request) });
  const answer = (await response.json()) as Answer;
  assert.ok('result' in answer, `${JSON.stringify(request)}: ${JSON.stringify(answer)}`);
  return answer.result;
};

void test('An edge answers a watch held across an eviction', { timeout: 60_000 }, async (t) => {
  const out = mkdtempSync(join(tmpdir(), 'nervur-station-'));
  const state = mkdtempSync(join(tmpdir(), 'nervur-pi-'));
  let edge: Running | undefined;
  let ground: NodeGround | undefined;
  t.after(async () => {
    await ground?.close();
    await edge?.kill();
    rmSync(out, { recursive: true, force: true });
    rmSync(state, { recursive: true, force: true });
  });

  // The station names where it is reached, as a deploy names its Worker's route: the held line first.
  await built(out, 'station', 'station.capnp');
  const port = await freePort();
  const named = { NERVUR_ADDRESSES: `ws://127.0.0.1:${port}/quo,http://127.0.0.1:${port}/quo` };
  edge = await started(out, port, named);
  await hand(edge, { faculty: 'houses', method: 'add', args: { name: 'family', classes: { body: 'bundle', at: 'station' } } });
  await hand(edge, { house: 'family', method: 'bear', args: { kind: 'org.example.garage-mirror', id: 'door' } });
  const { handle } = (await hand(edge, { house: 'family', method: 'offerFor', args: { being: 'door', occupant: 'pi' } })) as { handle: string };

  // The Pi names no address and listens on nothing another reaches: it only dials.
  ground = await NodeGround.open({ folder, state, env: { NERVUR_TCP_PORT: '0', NERVUR_BIND: '127.0.0.1', NERVUR_ALLOW_PRIVATE: '1' } });
  // Its ladder: the folder's registry, then the relay from it, granted to the twin alone.
  assert.deepEqual(await ground.ground.stand('recipe', { make: 'module', args: { at: 'recipe.ts' } }), {});
  assert.deepEqual(await ground.ground.stand('relay', { from: 'recipe', make: 'relay', kinds: ['org.example.garage-twin'] }), {});
  const added = await ground.ground.add('pi', { classes: { body: 'folder', at: 'twin' }, faculties: ['relay'] });
  assert.ok(added.ward !== undefined, added.why ?? 'the Pi’s house did not open');
  const pi = ground;
  const twin = (method: string, args = {}) => pi.ground.ask({ house: 'pi', ...(method === 'bear' ? {} : { id: 'door' }), method, args });
  assert.ok('result' in (await twin('bear', { kind: 'org.example.garage-twin', id: 'door' })));
  assert.deepEqual(await twin('accept', { invitation: handle }), { result: null });
  assert.deepEqual(await twin('watch'), { result: null });

  await hand(edge, { house: 'family', id: 'door', method: 'open' });
  await pulses.reached(1);

  // Evicted: the object's memory, its held line and the watch on it are gone; its storage stays.
  await edge.kill();
  edge = await started(out, port, named);
  await hand(edge, { house: 'family', id: 'door', method: 'open' });
  await pulses.reached(2);

  await hand(edge, { house: 'family', id: 'door', method: 'open' });
  await pulses.reached(3);
  assert.equal(pulses.count, 3, 'three openings, three pulses, never four');
});
