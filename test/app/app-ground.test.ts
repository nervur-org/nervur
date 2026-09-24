// AppGround on a phone's shell: its seeds in the shell's secret store, its
// memory in the shell's native store, and the same ground at every launch.
// Two launches are two opens over one phone's stores.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { AppGround } from 'nervur/app';
import { phone } from '../fixtures/app/shell.ts';

const origin = pathToFileURL(new URL('../fixtures/', import.meta.url).pathname).href;
const shop = { name: 'shop', memory: { body: 'indexeddb' }, classes: { body: 'origin', at: 'world/shop.ts' } };

const launch = async (device: ReturnType<typeof phone>, name: string) => {
  const ground = await AppGround.open({ name, shell: device, origin });
  await ground.led();
  return ground;
};

test('The app opens its ground on the shell’s own stores, and every launch finds it again', async (t) => {
  const device = phone();
  const first = await launch(device, 'phone-launches');
  const added = (await first.hand({ faculty: 'houses', method: 'add', args: shop })) as { result: { ward: string } };
  await first.hand({ house: 'shop', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } });
  await first.close();

  const second = await launch(device, 'phone-launches');
  t.after(() => second.close());
  const listed = (await second.hand({ faculty: 'houses', method: 'list' })) as { result: { name: string; ward?: string }[] };
  assert.deepEqual(listed.result.map(({ name, ward }) => ({ name, ward })), [{ name: 'shop', ward: added.result.ward }], 'the same house on the same seed');
  assert.deepEqual(await second.hand({ house: 'shop', id: 'bob', method: 'greet' }), { result: 'bob greets root' });
});

test('Its seeds rest in the secret store, and its memory in the native store', async (t) => {
  const device = phone();
  const ground = await launch(device, 'phone-stores');
  t.after(() => ground.close());
  await ground.hand({ faculty: 'houses', method: 'add', args: shop });
  assert.match(device.secrets.held.get('nervur.seed.shop') ?? '', /^[0-9a-f]{64}$/);
  assert.ok([...device.store.held.keys()].some((key) => key.startsWith('nervur/phone-stores-house-shop/p/')), 'the house’s rows');
  assert.ok([...device.store.held.keys()].some((key) => key.startsWith('nervur/phone-stores-ground/p/')), 'the ground’s record');
  const described = (await ground.hand({ describe: true })) as { result: { persisted: boolean } };
  assert.equal(described.result.persisted, true, 'an app’s own store is kept');
});
