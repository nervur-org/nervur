// EdgeGround on the Cloudflare account: the family's station deployed as a
// Worker, and the garage Pi a NodeGround here that only dials it across the
// internet. The Pi's twin watches the door's mirror over a held line. Then
// the Worker is deployed again, a new version that evicts its object: the
// watch it held is gone, the Pi's line drops and its watch goes again, and
// the next opening still pulses the relay once. The Worker stands between
// runs, and each run opens a house of its own there and removes it after.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { NodeGround } from 'nervur/node';
import { loopbackGround } from '../test/fixtures/node/spawned.ts';
import { deployed, named, secret } from './fixtures/edge/cloudflare.ts';
import { pulses } from './fixtures/edge/pi/recipe.ts';
import { built } from './fixtures/edge/workerd.ts';

const folder = fileURLToPath(new URL('./fixtures/edge/pi/', import.meta.url));
const NAME = 'nervur-deep-station';

type Answer = { result?: unknown; error?: { message: string } };

void test('An edge on the Cloudflare account answers a watch held across a new version', { skip: !named, timeout: 300_000 }, async (t) => {
  const out = mkdtempSync(join(tmpdir(), 'nervur-station-'));
  const state = mkdtempSync(join(tmpdir(), 'nervur-pi-'));
  const secrets = { NERVUR_SECRET: secret('secret'), NERVUR_HAND: secret('hand') };
  const family = `family-${randomBytes(4).toString('hex')}`;
  let ground: NodeGround | undefined;
  t.after(async () => {
    await ground?.close();
    if (origin !== '') await hand({ method: 'housesRemove', args: { name: family } });
    rmSync(out, { recursive: true, force: true });
    rmSync(state, { recursive: true, force: true });
  });

  // The owner, through the edge's hand, with the key its Worker holds as a secret.
  let origin = '';
  const hand = async (request: object): Promise<unknown> => {
    const response = await fetch(`${origin}/nervur/hand`, { method: 'POST', headers: { authorization: `Bearer ${secrets.NERVUR_HAND}` }, body: JSON.stringify(request) });
    const answer = (await response.json()) as Answer;
    assert.ok('result' in answer, `${JSON.stringify(request)}: ${JSON.stringify(answer)}`);
    return answer.result;
  };

  await built(out, 'station', 'station.capnp');
  origin = await deployed(out, NAME, 'station', secrets);
  const host = new URL(origin).host;
  await hand({ method: 'facultiesUpdate', args: { name: 'web', make: 'web', args: { addresses: [`wss://${host}/quo`, `https://${host}/quo`] } } });
  await hand({ method: 'housesAdd', args: { name: family, classes: { faculty: 'bundle', at: 'station' } } });
  await hand({ house: family, method: 'bear', args: { kind: 'org.example.garage-mirror', id: 'door' } });
  const { handle } = (await hand({ house: family, method: 'offerFor', args: { being: 'door', occupant: 'pi' } })) as { handle: string };

  // The Pi names no address and listens on nothing another reaches: it only dials the station, across the internet.
  ground = await loopbackGround(folder, state, { web: true });
  assert.deepEqual(await ground.ground.stand('recipe', { from: 'folder', make: 'module', args: { at: 'recipe.ts' } }), {});
  assert.deepEqual(await ground.ground.stand('relay', { from: 'recipe', make: 'relay', kinds: ['org.example.garage-twin'] }), {});
  const added = await ground.ground.add('pi', { classes: { faculty: 'folder', at: 'twin' }, faculties: ['relay'] });
  assert.ok(added.ward !== undefined, added.why ?? 'the Pi’s house did not open');
  const pi = ground;
  const twin = (method: string, args = {}) => pi.ground.ask({ house: 'pi', ...(method === 'bear' ? {} : { id: 'door' }), method, args });
  assert.ok('result' in (await twin('bear', { kind: 'org.example.garage-twin', id: 'door' })));
  assert.deepEqual(await twin('accept', { invitation: handle }), { result: null });
  assert.deepEqual(await twin('watch'), { result: null });

  const before = pulses.count;
  await hand({ house: family, id: 'door', method: 'open' });
  await pulses.reached(before + 1);

  // A new version: the object's memory, its held line and the watch on it are gone; its storage stays.
  await deployed(out, NAME, 'station', secrets);
  await hand({ house: family, id: 'door', method: 'open' });
  await pulses.reached(before + 2);
  assert.equal(pulses.count, before + 2, 'two openings, two pulses, never three');
});
