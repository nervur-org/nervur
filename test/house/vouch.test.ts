// A home takes a shop's paper, and shows the person which domains vouch
// for the ward behind it. The shop's site serves its vouch on its ground's
// listener. An impostor's paper names the impostor's domain, never the
// shop's. A ward that moves tells its holder where it is now, and the vouch
// is read again there.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { shop } from '../fixtures/world/booker.ts';
import { home, Site, SiteBlueprint } from '../fixtures/world/vouched.ts';

const entry = { memory: { faculty: 'fake' }, classes: { faculty: 'module', name: 'shop' } };

const open = async (t: { after(done: () => unknown): void }) => {
  const network = new FakeNetwork();
  const grounds: BenchGround[] = [];
  t.after(async () => {
    for (const ground of grounds.reverse()) await ground.down();
  });
  const shopAt = async (host: string, names: string[]) => {
    const site = new Site();
    const ground = await BenchGround.open({ network, host, names, modules: { shop }, faculties: { site: { blueprint: SiteBlueprint, object: site, handler: site.handler } } });
    grounds.push(ground);
    return { ground, site };
  };
  const homes = await BenchGround.open({ network, host: 'home', modules: { home } });
  grounds.push(homes);
  await homes.add('home');
  await homes.ask({ house: 'home', method: 'bear', args: { kind: 'org.example.holder', id: 'holder' } });
  const holder = (method: string, args?: { paper: string }) => homes.ask({ house: 'home', id: 'holder', method, ...(args === undefined ? {} : { args }) });
  // A shop's house with one being, and a paper on it for the home.
  const shopHouse = async (ground: BenchGround) => {
    const { ward } = await ground.add('shop', 'shop');
    await ground.ask({ house: 'shop', method: 'bear', args: { kind: 'org.example.booker', id: 'booker' } });
    const offered = await ground.ask({ house: 'shop', method: 'offerFor', args: { being: 'booker', occupant: 'home' } });
    return { ward: ward!, paper: (offered as { result: { handle: string } }).result.handle };
  };
  return { network, shopAt, shopHouse, holder };
};

test('A home shows the domain that vouches for a ward it took, and none where no domain does', async (t) => {
  const { network, shopAt, shopHouse, holder } = await open(t);
  const acme = await shopAt('acme', ['acme.shop']);
  const { ward, paper } = await shopHouse(acme.ground);
  acme.site.wards = [ward];
  assert.deepEqual(await holder('take', { paper }), { result: null });
  await network.settle();
  assert.deepEqual(await holder('vouched'), { result: [['acme.shop']] });

  const quiet = await shopAt('quiet', ['quiet.shop']);
  const other = await shopHouse(quiet.ground);
  assert.deepEqual(await holder('take', { paper: other.paper }), { result: null });
  await network.settle();
  // Her standings are listed by their ids, which say nothing of who took them first.
  const vouched = (await holder('vouched')) as { result: string[][] };
  assert.deepEqual(vouched.result.map((domains) => domains.join(',')).sort(), ['', 'acme.shop'], 'a domain that lists no ward vouches for none');
});

test('An impostor’s paper shows the impostor’s own domain, never the one it copies', async (t) => {
  const { network, shopAt, shopHouse, holder } = await open(t);
  const acme = await shopAt('acme', ['acme.shop']);
  const real = await shopHouse(acme.ground);
  acme.site.wards = [real.ward];
  const evil = await shopAt('evil', ['acme-shop.evil']);
  const fake = await shopHouse(evil.ground);
  // The impostor lists its own ward, and even claims the real one: its domain is still its own.
  evil.site.wards = [fake.ward, real.ward];
  assert.deepEqual(await holder('take', { paper: fake.paper }), { result: null });
  await network.settle();
  assert.deepEqual(await holder('vouched'), { result: [['acme-shop.evil']] });
});

test('A ward that moves is read again where it tells its holder it is reached now', async (t) => {
  const { network, shopAt, shopHouse, holder } = await open(t);
  const acme = await shopAt('acme', ['acme.shop']);
  const { ward, paper } = await shopHouse(acme.ground);
  assert.deepEqual(await holder('take', { paper }), { result: null });
  await network.settle();
  assert.deepEqual(await holder('vouched'), { result: [[]] }, 'nothing vouched yet');

  // The house moves to a ground at a new name, which vouches for it; the old name follows it.
  const out = await acme.ground.hand({ faculty: 'moves', method: 'out', args: { name: 'shop' } });
  const store = await shopAt('store', ['acme.store', 'acme.shop']);
  store.site.wards = [ward];
  assert.deepEqual(await store.ground.hand({ faculty: 'moves', method: 'in', args: { name: 'shop', ...entry, ...(out as { result: object }).result } }), { result: { ward } });
  assert.ok('result' in (await holder('look')));
  await network.settle();
  const [seen] = ((await holder('vouched')) as { result: string[][] }).result;
  assert.ok(seen.includes('acme.store'), JSON.stringify(seen));
});
