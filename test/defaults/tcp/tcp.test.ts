// SPDX-License-Identifier: Apache-2.0
// The TCP faculty, on the core and nothing else of the defaults: two
// harbors over real TCP, each a terrain with the sockets of Node under its
// carrier, as two processes would be. A relation and a lend speak across
// them, and speak again after both restart from their folders, the route
// waking from the dock's cells into the carrier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { CryptoEntropy, Harbor, PointerTerrain, type JsonObject } from '../../core/kit.ts';
import { TEST } from '../../core/classes.ts';
import { FolderCustody, FolderMemory } from '../../../src/core/folder/index.ts';
import { tcpAddress } from '../../../src/core/quo/index.ts';
import { NodeSockets } from '../../../src/core/tcp/index.ts';
import { TcpFaculty } from '../../../src/defaults/index.ts';
import { holds } from '../../claims.ts';
import { scratch } from '../../core/contract/suites.ts';
import { add, being, census, root } from '../../core/harbor/asks.ts';
import { shop } from '../../core/harbor/shop.ts';

// The core's test classes, and the TCP faculty.
const WITH_TCP = { ...TEST, classes: [...TEST.classes, TcpFaculty] };

// A harbor on its folder, TCP its carrier faculty. The first time, its
// catalogue is told to run the shop module and its carrier to listen on
// `port`; after that it wakes with both.
const open = async (dir: string, port = 0, first = true): Promise<{ harbor: Harbor; at: string }> => {
  const entropy = new CryptoEntropy();
  const harbor = await Harbor.open(new PointerTerrain({ entropy, memory: new FolderMemory(dir), custody: new FolderCustody(dir, entropy), defaults: WITH_TCP, tcp: () => new NodeSockets() }));
  await root(harbor, 'stand');
  if (first) {
    await root(harbor, 'open', { key: TcpFaculty.carries, class: TcpFaculty.kind });
    await add(harbor, shop.source);
    await being(harbor, 'tcp', 'listen', { port });
  }
  return { harbor, at: (await census(harbor)).listening![0]! };
};
const port = (at: string): number => tcpAddress(at)!.port;
const me = (harbor: Harbor, method: string, args: JsonObject = {}) => being(harbor, 'me', method, args, 'alice');
const sold = async (harbor: Harbor): Promise<unknown> => ((await being(harbor, 'shop', 'sold', {}, 'shop')) as { sold: unknown }).sold;
const shopOf = async (harbor: Harbor): Promise<void> => {
  await root(harbor, 'host', { ward: 'shop' });
  await root(harbor, 'boot', { key: 'shop', class: 'org.example.shop' }, 'shop');
};
const aliceOf = async (harbor: Harbor): Promise<void> => {
  await root(harbor, 'host', { ward: 'alice' });
  await root(harbor, 'boot', { key: 'me', class: 'org.example.customer' }, 'alice');
};

test(holds('carrier.tcp', 'tcp: two harbors speak over TCP, and again after both restart'), async () => {
  const dirs = { acme: scratch(), home: scratch() };
  let acme = await open(dirs.acme);
  let home = await open(dirs.home);
  assert.deepEqual(await root(home.harbor, 'open', { key: 'echo', class: 'org.example.echo' }), { opened: 'echo' });
  await aliceOf(home.harbor);
  await shopOf(acme.harbor);
  const shopPk = (await census(acme.harbor, 'shop')).pk;
  // Handed on with its `at` left off, as another kit may hand it, so only
  // a route the root sets reaches the shop.
  const { at, ...invitation } = await root(acme.harbor, 'invite', { being: 'shop', id: 'alice' }, 'shop');
  assert.deepEqual(at, [acme.at], 'a harbor that set no reach names where it listens');

  assert.deepEqual(await me(home.harbor, 'join', { invitation }), { joined: null }, 'no route yet: the knock is not delivered');
  assert.deepEqual(await root(home.harbor, 'route', { ward: shopPk, at: 'nowhere' }), { error: 'not routed' });
  assert.deepEqual(await root(home.harbor, 'route', { ward: shopPk, at: acme.at }), { routed: shopPk });
  assert.deepEqual(await me(home.harbor, 'join', { invitation }), { joined: 'shop' });
  assert.deepEqual(await me(home.harbor, 'buy', { item: 'tea' }), { said: { bought: 'tea' } });
  assert.deepEqual(await me(home.harbor, 'echo', { text: 'local' }), { said: { echoed: 'local', to: 'lent:1' } });

  const acmePort = port(acme.at);
  await acme.harbor.close();
  assert.deepEqual(await me(home.harbor, 'buy', { item: 'late' }), { said: 'unreached' }, 'the listener is gone');
  await home.harbor.close();
  acme = await open(dirs.acme, acmePort, false);
  home = await open(dirs.home, 0, false);
  assert.equal((await census(acme.harbor, 'shop')).pk, shopPk);
  assert.deepEqual((await census(home.harbor)).routes, { [shopPk]: [acme.at] }, 'the route woke from the package');
  assert.deepEqual(await me(home.harbor, 'buy', { item: 'cake' }), { said: { bought: 'cake' } });
  assert.deepEqual(await sold(acme.harbor), ['tea to alice', 'cake to alice']);
  assert.deepEqual(await root(home.harbor, 'route', { ward: shopPk, at: null }), { routed: shopPk });
  assert.deepEqual(await me(home.harbor, 'buy', { item: 'forgotten' }), { said: 'unreached' });
  assert.deepEqual(await root(acme.harbor, 'route', { ward: shopPk, at: 7 }), { error: 'not routed' });
  await acme.harbor.close();
  await home.harbor.close();
});

test(holds('invitation.carries-reach', 'tcp: an invitation carries where its harbor is reached, and the take learns the route with nobody routing it'), async () => {
  const acme = await open(scratch());
  const home = await open(scratch());
  assert.deepEqual(await root(acme.harbor, 'reach', { at: ['https://acme.example/quo', acme.at] }), { reach: ['https://acme.example/quo', acme.at] });
  for (const at of [[], 'tcp://a:1', ['no scheme'], null]) assert.deepEqual(await root(acme.harbor, 'reach', { at }), { error: 'at is a list of addresses' });
  await shopOf(acme.harbor);
  const invitation = await root(acme.harbor, 'invite', { being: 'shop', id: 'alice' }, 'shop');
  assert.deepEqual(invitation.at, ['https://acme.example/quo', acme.at]);
  await aliceOf(home.harbor);
  assert.deepEqual(await me(home.harbor, 'join', { invitation }), { joined: 'shop' });
  const shopPk = (await census(acme.harbor, 'shop')).pk;
  assert.deepEqual((await census(home.harbor)).routes, { [shopPk]: ['https://acme.example/quo', acme.at] }, 'kept as the invitation named it');
  assert.deepEqual(await me(home.harbor, 'buy', { item: 'tea' }), { said: { bought: 'tea' } });
  const other = await root(acme.harbor, 'invite', { being: 'shop', id: 'again' }, 'shop');
  assert.deepEqual(await root(home.harbor, 'route', { ward: shopPk, at: ['tcp://127.0.0.1:9'] }), { routed: shopPk });
  assert.deepEqual(await me(home.harbor, 'join', { invitation: other }), { joined: null }, 'a route the root set is trusted before an invitation');
  assert.deepEqual((await census(home.harbor)).routes, { [shopPk]: ['tcp://127.0.0.1:9'] });
  const local = await root(home.harbor, 'invite', { being: 'me', id: 'self' }, 'alice');
  assert.deepEqual(local.at, [home.at], 'a harbor that set no reach names where it listens');
  await being(home.harbor, 'tcp', 'listen', { host: '0.0.0.0' });
  assert.equal((await root(home.harbor, 'invite', { being: 'me', id: 'wide' }, 'alice')).at, undefined, 'and never the unspecified host');
  await being(home.harbor, 'tcp', 'deaf');
  assert.equal((await root(home.harbor, 'invite', { being: 'me', id: 'deaf' }, 'alice')).at, undefined, 'a harbor listening nowhere names none');

  // A caller learns the route from where the harbor listens, with no reach
  // and no route set.
  const plain = await open(scratch());
  const caller = await open(scratch());
  await shopOf(plain.harbor);
  await aliceOf(caller.harbor);
  const found = await root(plain.harbor, 'invite', { being: 'shop', id: 'alice' }, 'shop');
  assert.deepEqual(found.at, [plain.at]);
  assert.deepEqual(await me(caller.harbor, 'join', { invitation: found }), { joined: 'shop' });
  assert.deepEqual(await me(caller.harbor, 'buy', { item: 'tea' }), { said: { bought: 'tea' } });
  for (const place of [acme, home, plain, caller]) await place.harbor.close();
});

const freePort = async (): Promise<number> => {
  const listener = createServer();
  await new Promise<void>((done) => listener.listen(0, '127.0.0.1', done));
  const { port: free } = listener.address() as { port: number };
  await new Promise((done) => listener.close(done));
  return free;
};

test(holds('carrier.is-faculty', 'tcp: the tcp carrier is a faculty: it listens and stops, goes when unbooted, and only a ground with sockets opens it'), async () => {
  const place = await open(scratch());
  const tcp = (method: string, args: JsonObject = {}) => being(place.harbor, 'tcp', method, args);
  assert.deepEqual(await tcp('listen', { port: 'x' }), { error: 'host is text and port a port' });
  const other = await open(scratch());
  assert.match(((await being(other.harbor, 'tcp', 'listen', { port: port(place.at) })) as { error: string }).error, /EADDRINUSE/);
  await other.harbor.close();
  assert.deepEqual(await tcp('deaf'), { deaf: true });
  assert.deepEqual((await census(place.harbor)).listening, []);
  const { at } = (await tcp('listen')) as { at: string };
  assert.deepEqual((await census(place.harbor)).listening, [at]);
  assert.deepEqual(await root(place.harbor, 'open', { key: 'tcp2', class: 'org.nervur.tcp' }), { opened: 'tcp2' }, 'a second carrier of the ground');
  assert.deepEqual(await root(place.harbor, 'unboot', { being: 'tcp' }), { unbooted: 'tcp' });
  assert.deepEqual(Object.keys((await census(place.harbor)).beings), ['catalogue', 'tcp2']);
  const far = '00'.repeat(64);
  assert.deepEqual(await root(place.harbor, 'route', { ward: far, at: ['https://h/q'] }), { error: 'not routed' }, 'no carrier dials https');
  assert.deepEqual(await root(place.harbor, 'route', { ward: far, at: ['https://h/q', `tcp://127.0.0.1:${await freePort()}`] }), { routed: far });
  await place.harbor.close();
  const pointer = await Harbor.open(new PointerTerrain({ defaults: WITH_TCP }));
  assert.deepEqual(await root(pointer, 'open', { key: 'tcp', class: 'org.nervur.tcp' }), { error: 'not opened' }, 'a ground that has no sockets opens none');
});

test(holds('route.fails-alone', 'tcp: a route kept for a carrier that does not dial fails alone, and a carrier that dials takes it again'), async () => {
  const dir = scratch();
  const first = await open(dir);
  const far = '00'.repeat(64);
  assert.deepEqual(await root(first.harbor, 'route', { ward: far, at: ['tcp://127.0.0.1:9'] }), { routed: far });
  assert.deepEqual(await root(first.harbor, 'host', { ward: 'w' }), { hosted: 'w' });
  await first.harbor.close();
  const entropy = new CryptoEntropy();
  const alone = await Harbor.open(new PointerTerrain({ entropy, memory: new FolderMemory(dir), custody: new FolderCustody(dir, entropy), defaults: WITH_TCP }));
  assert.deepEqual(await root(alone, undefined, undefined, 'w'), { error: 'no such ward' }, 'the boot stands no hosted ward');
  assert.deepEqual(await root(alone, 'stand'), { stood: [], wards: ['w'] }, 'the dock stands it once asked');
  assert.deepEqual(await root(alone, 'stand'), { silence: true }, 'and answers silence where everything stands');
  assert.deepEqual((await census(alone)).failed, { wards: {}, routes: { [far]: 'no carrier dials it' } });
  const again = await open(dir, 0, false);
  assert.deepEqual((await census(again.harbor)).failed, { wards: {}, routes: {} });
  assert.deepEqual(await root(again.harbor, 'route', { ward: far, at: null }), { routed: far });
  await again.harbor.close();
});
