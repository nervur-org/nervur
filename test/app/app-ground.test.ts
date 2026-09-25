// AppGround on a phone's shell: its key in the shell's secret store, its
// memory in the shell's native store, and the same ground at every launch.
// Two launches are two opens over one phone's stores.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { AppGround } from 'nervur/app';
import { phone } from '../fixtures/app/shell.ts';

const origin = pathToFileURL(new URL('../fixtures/', import.meta.url).pathname).href;
const shop = { name: 'shop', classes: { faculty: 'origin', at: 'world/shop.ts' } };

const launch = async (device: ReturnType<typeof phone>, name: string) => {
  const ground = await AppGround.open({ name, shell: device, origin });
  await ground.led();
  return ground;
};

test('The app opens its ground on the shell’s own stores, and every launch finds it again', async (t) => {
  const device = phone();
  const first = await launch(device, 'phone-launches');
  const added = (await first.hand({ method: 'housesAdd', args: shop })) as { result: { ward: string } };
  await first.hand({ house: 'shop', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } });
  await first.close();

  const second = await launch(device, 'phone-launches');
  t.after(() => second.close());
  const listed = (await second.hand({ method: 'housesList' })) as { result: { name: string; ward?: string }[] };
  assert.deepEqual(listed.result.map(({ name, ward }) => ({ name, ward })), [{ name: 'shop', ward: added.result.ward }], 'the same house on the same seed');
  assert.deepEqual(await second.hand({ house: 'shop', id: 'bob', method: 'greet' }), { result: 'bob greets root' });
});

test('Its key rests in the secret store, and its memory in the native store', async (t) => {
  const device = phone();
  const ground = await launch(device, 'phone-stores');
  t.after(() => ground.close());
  await ground.hand({ method: 'housesAdd', args: shop });
  assert.deepEqual([...device.secrets.held.keys()], ['nervur.key'], 'one key, and no seed beside it');
  assert.match(device.secrets.held.get('nervur.key') ?? '', /^[0-9a-f]{64}$/);
  const places = [...device.store.held.keys()].filter((key) => key.startsWith('nervur/phone-stores-ground/p/'));
  assert.ok(
    places.every((key) => /\/p\/[0-9a-f]{16}\//.test(key)),
    'every place in a view of the ground’s memory',
  );
  const views = new Set(places.map((key) => /\/p\/([0-9a-f]{16})\//.exec(key)?.[1]));
  assert.equal(views.size, 2, 'the dock’s rows, which are its drawer, and the house’s, each in a view of its own');
  const described = (await ground.hand({ describe: true })) as { result: { persisted: boolean } };
  assert.equal(described.result.persisted, true, 'an app’s own store is kept');
});
