// SPDX-License-Identifier: Apache-2.0
// What a child worker runs as a facet of a Durable Object: the edge bodies
// under the contract and law scenes inside the storage the facet keeps,
// and a harbor opened there with no terrain asking the Node host over TCP.
// The shell's worker loads it as the terrain run's kit, with these scenes
// inside, the way it loads a harbor's child.
import * as built from 'nervur:law';
import { EdgeCustody, EdgeLoader, EdgeMemory, EdgeTerrain, sealSeed, type EdgeEnv, type EdgeState, type EdgeStorage } from '../../src/core/edge/index.ts';
import { blob, idOf } from '../../src/core/git/index.ts';
import { DEFAULTS, grounds, Harbor, told, type JsonObject } from '../../src/index.ts';
import { custodyScenes, expect, LAW, keeperScenes, lawBundle, lawScenes, memoryScenes, type Scene, type Terrain } from '../../src/core/proof/index.ts';
import type { Reach, Result } from './exercise.ts';
import { being, census, root as ask } from '../core/harbor/asks.ts';

let roots = 0;
const root = (): string => `r${String((roots += 1))}/`;

// A storage whose transactions fail at their first delete, as an object
// evicted inside a keep leaves it.
const cutting = (storage: EdgeStorage): EdgeStorage => ({
  ...storage,
  get: (key) => storage.get(key),
  put: (entries) => storage.put(entries),
  delete: (keys) => storage.delete(keys),
  list: (options) => storage.list(options),
  transaction: (work) =>
    storage.transaction((txn) =>
      work({
        get: (key) => txn.get(key),
        put: (entries) => txn.put(entries),
        list: (options) => txn.list(options),
        delete: () => Promise.reject(new Error('the object was evicted inside a keep')),
        transaction: (inner) => txn.transaction(inner),
      }),
    ),
});

const asked = async (harbor: Harbor, key: string, method: string, args: JsonObject = {}, ward?: string): Promise<JsonObject> => (await being(harbor, key, method, args, ward)) as JsonObject;

// The edge's loader finds a module it carries by its blob, and keeps a
// blob it does not carry, with its source, for the next child. From the
// miss the child is spent and its memory keeps nothing, so every call it
// refused can be asked again whole in the next child: here a harbor opened
// again on the same storage, as a shell loads the next child.
const carriedOnly = async (harbor: Harbor, terrain: EdgeTerrain, loader: EdgeLoader): Promise<Harbor> => {
  const other = `${LAW}\n// a module this child was not loaded with\n`;
  const live = await asked(harbor, 'catalogue', 'live');
  expect.same(await asked(harbor, 'catalogue', 'add', { source: other }), { error: `blob ${await idOf(blob(other))} is carried by the next child` }, 'a call that missed keeps nothing, and says why');
  expect.ok(loader.missing, 'the loader says the call missed');
  let refused = '';
  await terrain.memory.write('x', new Map([['y', new Uint8Array(1)]])).catch((e: Error) => (refused = e.message));
  expect.equal(refused, 'a module was missed, so this call keeps nothing');
  expect.same([...loader.missed().values()], [other], 'the miss is kept with its source');
  expect.same(await ask(harbor, 'ask', { being: 'catalogue', method: 'add', args: { source: LAW } }), { error: 'silence' }, 'the spent child keeps nothing more, even of a module it carries');
  await harbor.close();
  const next = await Harbor.open(new EdgeTerrain({ given: { state: terrain.given.state, env: terrain.given.env, loader: new EdgeLoader([{ blob: await idOf(blob(LAW)), module: built }]) }, defaults: DEFAULTS }));
  await ask(next, 'stand');
  expect.equal((await asked(next, 'catalogue', 'live')).live, live.live, 'the next child finds live where it was');
  expect.equal((await asked(next, 'catalogue', 'add', { source: LAW })).added, 'org.example.law', 'a module the child carries, by its blob');
  expect.ok((await asked(next, 'catalogue', 'live')).live !== live.live, 'live moved to it');
  return next;
};

const scenes = (state: EdgeState, env: EdgeEnv, reach: Reach): Scene[] => {
  const { storage } = state;
  const secret = env.NERVUR_SECRET;
  // Bodies under one root, and a restart's new bodies on the same secret.
  const bodies = (at: string) => Object.assign({ custody: new EdgeCustody(storage, secret, undefined, at), memory: new EdgeMemory(storage, at) }, { at });
  const edge: Terrain = {
    name: 'a durable object',
    make: () => bodies(root()),
    again: (kept) => bodies((kept as ReturnType<typeof bodies>).at),
    loader: () => lawBundle(built),
    defaults: DEFAULTS,
  };
  return [
    ...custodyScenes(
      'EdgeCustody',
      () => {
        const at = root();
        return [new EdgeCustody(storage, secret, undefined, at), new EdgeCustody(storage, secret, undefined, at)];
      },
      expect,
    ),
    [
      'edge: a drawn seed and a packed one open only under the secret they were sealed under',
      async () => {
        const at = root();
        await new EdgeCustody(storage, secret, undefined, at).seed();
        let refused = '';
        await new EdgeCustody(storage, `${String(secret)}x`, undefined, at).seed().catch((e: Error) => (refused = e.message));
        expect.ok(/does not open/.test(refused), refused);
        await new EdgeCustody(storage, undefined, undefined, root()).seed().catch((e: Error) => (refused = e.message));
        expect.ok(/no NERVUR_SECRET/.test(refused), refused);
        const packed = new EdgeCustody(storage, secret, undefined, root());
        expect.ok(!(await packed.kept()), 'no seed is kept before one lands');
        await packed.land(await sealSeed(String(secret), new Uint8Array(32).fill(7)));
        expect.ok(await packed.kept());
        expect.same([...(await packed.seed())], Array(32).fill(7), 'a packed seed opens under the secret it was sealed under');
        const other = new EdgeCustody(storage, secret, undefined, root());
        await other.land(await sealSeed(`${String(secret)}x`, new Uint8Array(32).fill(7)));
        refused = '';
        await other.seed().catch((e: Error) => (refused = e.message));
        expect.ok(/does not open/.test(refused), 'a seed packed under another secret does not open');
      },
    ],
    ...memoryScenes(
      'EdgeMemory',
      () => {
        const at = root();
        return [new EdgeMemory(storage, at), new EdgeMemory(storage, at)];
      },
      expect,
      () => {
        const at = root();
        return { cut: new EdgeMemory(cutting(storage), at), fresh: new EdgeMemory(storage, at) };
      },
    ),
    ...lawScenes(edge, expect),
    ...keeperScenes(edge, expect),
    [
      'edge: a harbor given the object stands on the edge ground and asks over TCP',
      async () => {
        expect.same(grounds()[0], 'edge');
        const loader = new EdgeLoader([{ blob: await idOf(blob(LAW)), module: built }]);
        const terrain = new EdgeTerrain({ given: { state, env, loader }, defaults: DEFAULTS });
        const first = await Harbor.open(terrain);
        let harbor = first;
        try {
          expect.same(Object.keys((await census(harbor)).beings), ['catalogue'], 'nothing opened unasked');
          expect.same(await ask(harbor, 'open', { key: 'tcp', class: 'org.nervur.tcp' }), { opened: 'tcp' });
          expect.same(await asked(harbor, 'tcp', 'listen'), { error: 'an edge takes no inbound TCP' });
          harbor = await carriedOnly(first, terrain, loader);
          await ask(harbor, 'host', { ward: 'alice' });
          await ask(harbor, 'boot', { key: 'me', class: 'org.example.customer' }, 'alice');
          const shop = reach.shop.ward as string;
          expect.same(await ask(harbor, 'route', { ward: shop, at: [reach.tcp] }), { routed: shop });
          expect.same(await asked(harbor, 'me', 'join', { invitation: reach.shop }, 'alice'), { joined: 'shop' }, 'over TCP');
          expect.same(await asked(harbor, 'me', 'buy', { item: 'salt' }, 'alice'), { said: { bought: 'salt' } });
          expect.same(await ask(harbor, 'route', { ward: shop, at: ['tcp://127.0.0.1:1'] }), { routed: shop });
          const nowhere = (await asked(harbor, 'me', 'buy', { item: 'none' }, 'alice')).said;
          expect.equal(told(nowhere as never), 'unreached', 'an address nothing answers is unreached at once');
        } finally {
          await harbor.close();
        }
      },
    ],
  ];
};

// The scenes, run in the child's facet on its own storage.
export class EdgeScenes {
  readonly #state: EdgeState;
  readonly #env: EdgeEnv;
  constructor(state: EdgeState, env: EdgeEnv) {
    this.#state = state;
    this.#env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const reach = (await request.json()) as Reach;
    const results: Result[] = [];
    for (const [name, scene] of scenes(this.#state, this.#env, reach)) {
      try {
        await scene();
        results.push({ name: `edge: ${name.replace(/^edge: /, '')}` });
      } catch (e) {
        results.push({ name: `edge: ${name.replace(/^edge: /, '')}`, error: String((e as Error)?.stack ?? e) });
      }
    }
    return Response.json(results);
  }
}
