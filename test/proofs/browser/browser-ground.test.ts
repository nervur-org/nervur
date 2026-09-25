// BrowserGround on the engine's own Web Locks and BroadcastChannel, which
// Node gives as a page does: two grounds opened in one process are two tabs
// of one origin. Its stores are the test's own, in memory and shared by
// both, as an origin's IndexedDB is. That reaches past its entry, since a
// ground's unlock and memory are its terrain's alone, so this is a proof;
// the browser's own run proves IndexedDB itself.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { Memory, Registry } from 'nervur';
import { need } from 'nervur/being';
import { FakeMemory } from '../../../src/bench/fake-memory.ts';
import { LockedUnlock, type BrowserGround, type Shelf } from 'nervur/browser';
import { openOn, type BrowserPlatform, type Stores } from '../../../src/browser/browser-ground.ts';

const origin = pathToFileURL(new URL('../../fixtures/', import.meta.url).pathname).href;

// One origin's storage: its unlock's shelf and its memories, by name.
const originStorage = () => {
  const kept = new Map<string, unknown>();
  const shelf: Shelf = {
    get: async (key) => kept.get(key),
    set: async (key, value) => {
      kept.set(key, value);
    },
  };
  const memories = new Map<string, Memory>();
  const stores: Stores = {
    unlock: async () => new LockedUnlock(shelf),
    memory: async (name) => {
      if (!memories.has(name)) memories.set(name, new FakeMemory());
      return memories.get(name)!;
    },
  };
  return { kept, stores };
};

// A tab of the origin, closed when the test ends.
const tab = async (t: TestContext, name: string, stores: Stores, { platform = {}, registry }: { platform?: Partial<BrowserPlatform>; registry?: Registry } = {}): Promise<BrowserGround> => {
  const opened = await openOn({ name, platform: { origin, persist: async () => true, ...platform }, ...(registry === undefined ? {} : { registry }) }, stores);
  t.after(() => opened.close());
  return opened;
};

const shop = { classes: { body: 'origin', at: 'world/shop.ts' } };

test('The first tab runs the ground, and a second reaches its hand', async (t) => {
  const { stores } = originStorage();
  const first = await tab(t, 'two-tabs', stores);
  const second = await tab(t, 'two-tabs', stores);
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
  const { stores } = originStorage();
  const first = await tab(t, 'handover', stores);
  await first.led();
  const second = await tab(t, 'handover', stores);
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

test('An ask in flight when the tab running the ground closes is told to ask again', async (t) => {
  const { stores } = originStorage();
  // A faculty that never answers, standing for work the closing tab never finishes. It says when it is called.
  let called!: () => void;
  const reached = new Promise<void>((resolve) => (called = resolve));
  const slow = {
    blueprint: need('slow', { wait: { hints: { idempotent: true } } }),
    object: {
      wait: () => {
        called();
        return new Promise(() => undefined);
      },
    },
  };
  const registry: Registry = { faculties: { slow: () => slow } };
  const first = await tab(t, 'in-flight', stores, { registry });
  await first.led();
  await first.hand({ faculty: 'faculties', method: 'add', args: { name: 'slow', make: 'slow' } });
  const second = await tab(t, 'in-flight', stores, { registry });
  const asked = second.hand({ faculty: 'slow', method: 'wait' });
  // The first tab has the ask before it closes.
  await reached;
  await first.close();
  assert.deepEqual(await asked, { error: { message: 'the page that ran the ground closed; ask again' } });
  await second.led();
  assert.equal(second.leading, true, 'the second tab runs the ground now');
});

test('Closing lets go of every store its boot opened', async (t) => {
  const { stores } = originStorage();
  const closed: string[] = [];
  // Stores that say when they are let go, as IndexedDB's connections are.
  const only = await tab(t, 'closing', {
    unlock: async (name) => {
      const unlock = await stores.unlock(name);
      return { key: () => unlock.key(), close: () => closed.push(name) };
    },
    memory: async (name) => {
      const memory = await stores.memory(name);
      return { read: memory.read.bind(memory), list: memory.list.bind(memory), write: memory.write.bind(memory), close: () => closed.push(name) };
    },
  });
  await only.led();
  await only.hand({ faculty: 'houses', method: 'add', args: { name: 'shop', ...shop } });
  await only.close();
  assert.deepEqual(closed.sort(), ['closing-ground', 'closing-unlock'], 'its houses keep their places in the ground’s one memory');
});

test('Its describe says whether the browser keeps its storage', async (t) => {
  const { stores } = originStorage();
  const only = await tab(t, 'persisted', stores, { platform: { persist: async () => false } });
  await only.led();
  const described = (await only.hand({ describe: true })) as { result: { persisted: boolean } };
  assert.equal(described.result.persisted, false);
});

test('Its classes come from its origin, and a path off it is refused', async (t) => {
  const { stores } = originStorage();
  const only = await tab(t, 'off-origin', stores);
  await only.led();
  const off = await only.hand({ faculty: 'houses', method: 'add', args: { name: 'stray', classes: { body: 'origin', at: '../../src/index.ts' } } });
  assert.deepEqual(off, { error: { message: `the house stray did not open: the code at ../../src/index.ts stands off ${origin}` } });
});

test('The unlock keeps the ground’s key sealed, and never as bytes a script could read', async (t) => {
  const { stores, kept } = originStorage();
  const only = await tab(t, 'sealed', stores);
  await only.led();
  await only.hand({ faculty: 'houses', method: 'add', args: { name: 'shop', ...shop } });
  const lock = kept.get('lock') as CryptoKey;
  assert.equal(lock.extractable, false, 'the lock is the browser’s alone');
  const sealed = kept.get('key') as { iv: Uint8Array; data: Uint8Array };
  assert.equal(sealed.data.length, 48, 'thirty-two bytes of key and a tag, sealed');
});

test('A page’s registry stands beside the terrain’s own and never in its place', async (t) => {
  const { stores } = originStorage();
  await assert.rejects(
    (async () => {
      const only = await tab(t, 'replaced', stores, { registry: { classes: { origin: () => Promise.reject(new Error('never made')) } } });
      await only.led();
    })(),
    /the registry names a classes body origin, which is the ground's own/,
  );
});
