// EdgeGround's object in Node, on a Durable Object's storage kept in the
// process, reached as its owner reaches it: through its hand, with the
// key its Worker holds. A house added, the object evicted and made again
// on the same storage, which opens nothing until the hand reaches the
// house, and a wake by alarm. `deep/edge-ground` runs the same object on
// workerd, a watch held across the eviction.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EdgeGround } from 'nervur/edge';
import { Host } from '../../fixtures/world/host.ts';
import { Steward } from '../../fixtures/world/steward.ts';
import { MapStorage } from '../fixtures/durable.ts';

const Ground = EdgeGround.object({ code: { shop: { steward: Steward, beings: [Host] } } });
const KEY = 'a1'.repeat(32);
const env = { NERVUR_SECRET: '5e'.repeat(32), NERVUR_HAND: KEY };
const shop = { name: 'shop', memory: { body: 'durable' }, classes: { body: 'bundle', at: 'shop' } };

type Edge = InstanceType<typeof Ground>;
const handOf = (edge: Edge, key = KEY) => async (request: object) => {
  const response = await edge.fetch(new Request('https://edge.example/nervur/hand', { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: JSON.stringify(request) }));
  return response.status === 200 ? ((await response.json()) as unknown) : response.status;
};

test('An edge keeps its houses across an eviction, and opens one when the hand reaches it', async (t) => {
  const storage = new MapStorage();
  t.after(() => storage.stop());
  const state = { storage, acceptWebSocket: () => undefined };
  const first = handOf(new Ground(state, env));
  const added = (await first({ faculty: 'houses', method: 'add', args: shop })) as { result: { ward: string } };
  assert.ok('result' in added, JSON.stringify(added));
  assert.ok('result' in ((await first({ house: 'shop', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } })) as object));

  // Evicted: a new object on the same storage, as the platform makes one on the next event.
  const second = handOf(new Ground(state, env));
  assert.deepEqual(await second({ faculty: 'houses', method: 'list' }), { result: [{ name: 'shop', ward: added.result.ward }] }, 'the same ward, from storage');
  assert.deepEqual(await second({ house: 'shop', id: 'bob', method: 'greet' }), { result: 'bob greets root' });

  // An alarm wakes a third, which opens every house so each arms its times again.
  const woken = new Ground(state, env);
  await woken.alarm();
  assert.deepEqual(await handOf(woken)({ house: 'shop', id: 'bob', method: 'greet' }), { result: 'bob greets root' });
});

test('An edge’s hand answers its key alone, and an edge that sets none serves no hand', async (t) => {
  const storage = new MapStorage();
  t.after(() => storage.stop());
  const state = { storage, acceptWebSocket: () => undefined };
  const edge = new Ground(state, env);
  assert.equal(await handOf(edge, 'b2'.repeat(32))({ describe: true }), 404, 'another key finds nothing here');
  const bare = await edge.fetch(new Request('https://edge.example/nervur/hand', { method: 'POST', body: '{}' }));
  assert.equal(bare.status, 404, 'no key finds nothing here');
  const { NERVUR_HAND: _unset, ...keyless } = env;
  assert.equal(await handOf(new Ground(state, keyless))({ describe: true }), 404, 'an edge with no key serves no hand');
  assert.ok(typeof (await handOf(edge)({ describe: true })) === 'object');
});

test('An edge refuses to boot without its secret, and answers what no handler takes with 404', async () => {
  const state = { storage: new MapStorage(), acceptWebSocket: () => undefined };
  await assert.rejects(new Ground(state, { NERVUR_HAND: KEY }).fetch(new Request('https://edge.example/')), /the edge’s secret is sixty-four lowercase hex digits/);
  const response = await new Ground(state, env).fetch(new Request('https://edge.example/nowhere'));
  assert.equal(response.status, 404);
});
