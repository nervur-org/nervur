// BrowserGround on the engine's own Web Locks and BroadcastChannel, which
// Node gives as a page does: two grounds opened in one process are two tabs
// of one origin. Storage is the test's own, shared by both, as an origin's
// IndexedDB is; the browser's own run proves IndexedDB itself.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { Memory } from 'nervur';
import { FakeMemory } from 'nervur/bench';
import { BrowserGround, LockedCustody, type BrowserGroundOptions, type Shelf } from 'nervur/browser';

const origin = pathToFileURL(new URL('../fixtures/', import.meta.url).pathname).href;

// One origin's storage: its custody's shelf and its memories, by name.
const originStorage = () => {
  const kept = new Map<string, unknown>();
  const shelf: Shelf = {
    get: async (key) => kept.get(key),
    set: async (key, value) => {
      kept.set(key, value);
    },
  };
  const memories = new Map<string, Memory>();
  return {
    kept,
    platform: {
      custody: async () => new LockedCustody(shelf),
      memory: async (name: string) => {
        if (!memories.has(name)) memories.set(name, new FakeMemory());
        return memories.get(name)!;
      },
      origin,
      persist: async () => true,
    },
  };
};

const tab = (name: string, platform: BrowserGroundOptions['platform']) => BrowserGround.open({ name, platform });

const shop = { memory: { body: 'indexeddb' }, classes: { body: 'origin', at: 'world/shop.ts' } };

test('The first tab runs the ground, and a second reaches its hand', async (t) => {
  const { platform } = originStorage();
  const first = await tab('two-tabs', platform);
  const second = await tab('two-tabs', platform);
  t.after(async () => {
    await second.close();
    await first.close();
  });
  await first.led();
  assert.equal(first.leading, true);
  assert.equal(second.leading, false);
  const added = await second.hand({ faculty: 'houses', method: 'add', args: { name: 'shop', ...shop } });
  assert.ok('result' in added, JSON.stringify(added));
  await second.hand({ house: 'shop', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } });
  assert.deepEqual(await first.hand({ house: 'shop', id: 'bob', method: 'greet' }), { result: 'bob greets root' });
  assert.deepEqual(await second.hand({ house: 'shop', id: 'bob', method: 'greet' }), { result: 'bob greets root' }, 'both tabs reach one ground');
});

test('When the tab that runs it closes, the next opens the same ground', async (t) => {
  const { platform } = originStorage();
  const first = await tab('handover', platform);
  await first.led();
  const second = await tab('handover', platform);
  t.after(() => second.close());
  const { ward } = ((await first.hand({ faculty: 'houses', method: 'add', args: { name: 'shop', ...shop } })) as { result: { ward: string } }).result;
  await first.hand({ house: 'shop', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } });
  await first.close();
  await second.led();
  assert.equal(second.leading, true);
  const listed = (await second.hand({ faculty: 'houses', method: 'list' })) as { result: { name: string; ward?: string }[] };
  assert.deepEqual(
    listed.result.map(({ name, ward: held }) => ({ name, ward: held })),
    [{ name: 'shop', ward }],
    'the same house, on the same seed',
  );
  assert.deepEqual(await second.hand({ house: 'shop', id: 'bob', method: 'greet' }), { result: 'bob greets root' }, 'her row stood in the origin’s memory');
});

test('Its describe says whether the browser keeps its storage', async (t) => {
  const { platform } = originStorage();
  const only = await tab('persisted', { ...platform, persist: async () => false });
  t.after(() => only.close());
  await only.led();
  const described = (await only.hand({ describe: true })) as { result: { persisted: boolean } };
  assert.equal(described.result.persisted, false);
});

test('Its classes come from its origin, and a path off it is refused', async (t) => {
  const { platform } = originStorage();
  const only = await tab('off-origin', platform);
  t.after(() => only.close());
  await only.led();
  const off = await only.hand({ faculty: 'houses', method: 'add', args: { name: 'stray', memory: { body: 'indexeddb' }, classes: { body: 'origin', at: '../../src/index.ts' } } });
  assert.deepEqual(off, { error: { message: `the house stray did not open: the code at ../../src/index.ts stands off ${origin}` } });
});

test('Custody keeps each seed sealed, and never as bytes a script could read', async (t) => {
  const { platform, kept } = originStorage();
  const only = await tab('sealed', platform);
  t.after(() => only.close());
  await only.led();
  await only.hand({ faculty: 'houses', method: 'add', args: { name: 'shop', ...shop } });
  const key = kept.get('key') as CryptoKey;
  assert.equal(key.extractable, false, 'the key is the browser’s alone');
  const sealed = kept.get('seed:shop') as { iv: Uint8Array; data: Uint8Array };
  assert.equal(sealed.data.length, 48, 'thirty-two bytes of seed and a tag, sealed');
});
