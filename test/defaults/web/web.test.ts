// SPDX-License-Identifier: Apache-2.0
// The web faculty, on the core and nothing else of the defaults: harbors
// on folders speak Quo over the web, by a post and on a held line, through
// Node's HTTP server, and again after a restart; and the faculty refuses
// what it cannot listen at.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CryptoEntropy, Harbor, PointerTerrain, type JsonObject } from '../../core/kit.ts';
import { TEST } from '../../core/classes.ts';
import { FolderCustody, FolderMemory } from '../../../src/core/folder/index.ts';
import { webServe } from '../../../src/core/http/index.ts';
import { WebFaculty } from '../../../src/defaults/index.ts';
import { holds } from '../../claims.ts';
import { scratch } from '../../core/contract/suites.ts';
import { add, being, census, root } from '../../core/harbor/asks.ts';
import { shop } from '../../core/harbor/shop.ts';

// The core's test classes, and the web faculty.
const WITH_WEB = { ...TEST, classes: [...TEST.classes, WebFaculty] };

const open = async (dir: string, first = true): Promise<Harbor> => {
  const entropy = new CryptoEntropy();
  const harbor = await Harbor.open(new PointerTerrain({ entropy, memory: new FolderMemory(dir), custody: new FolderCustody(dir, entropy), defaults: WITH_WEB, web: webServe }));
  await root(harbor, 'stand');
  if (first) await add(harbor, shop.source);
  return harbor;
};
const web = (harbor: Harbor, method: string, args: JsonObject = {}) => being(harbor, 'web', method, args) as Promise<JsonObject>;

test(holds('carrier.web', 'web: two harbors speak by post and on a held line, and again after the listening one restarts'), async () => {
  const dirs = { acme: scratch(), home: scratch() };
  let acme = await open(dirs.acme);
  const home = await open(dirs.home);
  assert.deepEqual(await root(acme, 'open', { key: 'web', class: 'org.nervur.web' }), { opened: 'web' });
  const at = (await web(acme, 'listen', { path: '/quo' })).at as string[];
  const [post, held] = at as [string, string];
  assert.match(post, /^http:\/\/127\.0\.0\.1:\d+\/quo$/);
  assert.match(held, /^ws:\/\/127\.0\.0\.1:\d+\/quo$/);
  await root(acme, 'reach', { at: [post] });
  await root(acme, 'host', { ward: 'shop' });
  await root(acme, 'boot', { key: 'shop', class: 'org.example.shop' }, 'shop');
  await root(home, 'host', { ward: 'alice' });
  await root(home, 'boot', { key: 'me', class: 'org.example.customer' }, 'alice');
  const me = (method: string, args: JsonObject = {}) => being(home, 'me', method, args, 'alice');

  const invitation = await root(acme, 'invite', { being: 'shop', id: 'alice' }, 'shop');
  assert.deepEqual(await me('join', { invitation }), { joined: null }, 'a harbor with no web carrier dials no post');
  assert.deepEqual((await census(home)).routes, {}, 'and keeps no route it cannot dial');
  assert.deepEqual(await root(home, 'open', { key: 'web', class: 'org.nervur.web' }), { opened: 'web' });
  assert.deepEqual(await me('join', { invitation: await root(acme, 'invite', { being: 'shop', id: 'again' }, 'shop') }), { joined: 'shop' }, 'over a post');
  assert.deepEqual(await me('buy', { item: 'tea' }), { said: { bought: 'tea' } });

  const shopPk = (await census(acme, 'shop')).pk;
  assert.deepEqual(await root(home, 'route', { ward: shopPk, at: [held] }), { routed: shopPk });
  assert.deepEqual(await me('buy', { item: 'cake' }), { said: { bought: 'cake' } }, 'on the held line');
  assert.deepEqual(await me('buy', { item: 'pie' }), { said: { bought: 'pie' } }, 'the same line again');

  await acme.close();
  assert.deepEqual(await me('buy', { item: 'gone' }), { said: 'unreached' });
  acme = await open(dirs.acme, false);
  assert.deepEqual((await census(acme)).listening, at, 'the web listener woke where it listened');
  assert.deepEqual(await me('buy', { item: 'back' }), { said: { bought: 'back' } }, 'a new held line');
  assert.deepEqual(await web(acme, 'deaf'), { deaf: true });
  assert.deepEqual(await me('buy', { item: 'deaf' }), { said: 'unreached' });
  await acme.close();
  await home.close();
});

test('[web] the web faculty refuses what it cannot listen at, and a ground with no listener listens nowhere', async () => {
  const harbor = await open(scratch());
  await root(harbor, 'open', { key: 'web', class: 'org.nervur.web' });
  assert.deepEqual(await web(harbor, 'listen', { path: 'no-slash' }), { error: 'host is text, port a port, path a path and origins a list' });
  const taken = await web(harbor, 'listen');
  const port = Number(new URL((taken.at as string[])[0]!).port);
  const other = await open(scratch());
  await root(other, 'open', { key: 'web', class: 'org.nervur.web' });
  assert.match((await web(other, 'listen', { port })).error as string, /EADDRINUSE/);
  await other.close();
  await harbor.close();
  const bare = await Harbor.open(new PointerTerrain({ defaults: WITH_WEB }));
  await root(bare, 'open', { key: 'web', class: 'org.nervur.web' });
  assert.deepEqual(await web(bare, 'listen'), { error: 'this ground listens nowhere on the web' });
  await bare.close();
});
