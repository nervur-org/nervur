// SPDX-License-Identifier: Apache-2.0
// The world the harbor's suites stand: Acme hosts a shop, home hosts Alice
// and opens an echo, and Alice takes an invitation on the shop. The shop's
// module is `test/fixtures/shop.js`, as its author writes it, and every
// harbor here runs it from its source, on the classes the world is handed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { World, type Defaults, type Harbor, type JsonObject, type WorldParts } from '../kit.ts';
import { TEST } from '../classes.ts';
import { add, being, root } from './asks.ts';

export const SHOP_FILE = fileURLToPath(new URL('../../fixtures/shop.js', import.meta.url));
export const module = 'org.example.shop';
export const version = '1';
export const shop = { module, version, source: readFileSync(SHOP_FILE, 'utf8') } as const;

// A harbor of the world whose catalogue runs the shop module.
export const stand = async (world: World, name: string, parts?: WorldParts): Promise<Harbor> => {
  const harbor = await world.harbor(name, parts);
  const { added, version: v } = (await add(harbor, shop.source)) as JsonObject;
  assert.deepEqual({ added, version: v }, { added: module, version });
  return harbor;
};

// Alice's customer, asked as her owner.
export const me = async (world: World, method: string, args: JsonObject = {}): Promise<JsonObject> => (await being(world.get('home'), 'me', method, args, 'alice')) as JsonObject;

// What the shop sold, as she says.
export const sold = async (world: World): Promise<unknown> => ((await being(world.get('acme'), 'shop', 'sold', {}, 'shop')) as { sold: unknown }).sold;

export const genesis = async (parts: { acme?: WorldParts; home?: WorldParts } = {}, defaults: Defaults = TEST): Promise<World> => {
  const world = new World(defaults);
  const acme = await stand(world, 'acme', parts.acme);
  const home = await stand(world, 'home', parts.home);
  assert.deepEqual(await root(home, 'open', { key: 'echo', class: 'org.example.echo' }), { opened: 'echo' });
  assert.deepEqual(await root(home, 'host', { ward: 'alice' }), { hosted: 'alice' });
  assert.deepEqual(await root(home, 'boot', { key: 'me', class: 'org.example.customer' }, 'alice'), { booted: 'me' });
  await root(acme, 'host', { ward: 'shop' });
  await root(acme, 'boot', { key: 'shop', class: 'org.example.shop' }, 'shop');
  const invitation = await root(acme, 'invite', { being: 'shop', id: 'alice' }, 'shop');
  assert.deepEqual(await me(world, 'join', { invitation }), { joined: 'shop' });
  return world;
};
