// BrowserGround's own run: a page on localhost in Chromium, on the origin's
// real IndexedDB, Web Locks and BroadcastChannel. The memory contract's one
// suite runs against IndexedDbMemory through the page, two tabs share one
// ground, which passes to the second when the first closes, and a push
// wakes the service worker. The page, the worker and the house module are
// built with a shared chunk, so the classes the origin faculty loads and the
// house that runs them share one `nervur/being`. With NERVUR_BROWSER_ORIGIN
// set, the same scenes run against that origin, its real device, where the
// same files were deployed.
import assert from 'node:assert/strict';
import { Resolver } from 'node:dns/promises';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { Memory } from 'nervur';
import { memorySuite } from '../test/suites/memory.ts';
import { buildOrigin } from './fixtures/browser/build.ts';

const out = mkdtempSync(join(tmpdir(), 'nervur-browser-'));
let server: Server | undefined;
let browser: Browser;
let context: BrowserContext;
let origin: string;
let page: Page;

const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript' };

// The files on localhost, where no real origin is named.
const serve = async (): Promise<string> => {
  await buildOrigin(out);
  const served = createServer((request, response) => {
    const path = request.url === '/' ? '/index.html' : (request.url ?? '/');
    try {
      const body = readFileSync(join(out, path.replace(/^\/+/, '')));
      response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  server = served;
  await new Promise<void>((resolve) => served.listen(0, '127.0.0.1', resolve));
  const address = served.address();
  return `http://localhost:${typeof address === 'object' && address !== null ? address.port : 0}`;
};

// A real origin is resolved through a public resolver, so a stale answer
// this machine cached never stands between the run and the origin. TLS
// still holds the origin to its name.
const resolved = async (at: string): Promise<string[]> => {
  const host = new URL(at).hostname;
  const resolver = new Resolver();
  resolver.setServers(['1.1.1.1']);
  const [address] = await resolver.resolve4(host);
  return [`--host-resolver-rules=MAP ${host} ${address}`];
};

before(async () => {
  const real = process.env.NERVUR_BROWSER_ORIGIN;
  origin = real ?? (await serve());
  browser = await chromium.launch({ args: real === undefined ? [] : await resolved(real) });
  context = await browser.newContext();
  page = await tabAt();
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
  rmSync(out, { recursive: true, force: true });
});

const tabAt = async (): Promise<Page> => {
  const opened = await context.newPage();
  await opened.goto(origin);
  await opened.waitForFunction(() => 'nervur' in globalThis);
  return opened;
};

// One of the page's `nervur` members, called in the page with JSON args.
type Member = 'open' | 'led' | 'close' | 'heard' | 'register' | 'leading' | 'hand' | 'memory';
const on = (tab: Page, member: Member, ...args: unknown[]): Promise<unknown> =>
  tab.evaluate(([name, given]) => (globalThis as unknown as { nervur: Record<string, (...values: unknown[]) => unknown> }).nervur[name](...given), [member, args] as const);

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const bytes = (text: string) => new Uint8Array(text.match(/../g)?.map((pair) => parseInt(pair, 16)) ?? []);

// IndexedDbMemory in the page, reached as a Memory from here.
let made = 0;
const remote = (): Memory => {
  const name = `suite-${made++}`;
  const call = (op: string, args: object) => on(page, 'memory', name, op, args);
  return {
    list: () => call('list', {}) as Promise<readonly string[]>,
    read: async ({ place }) => {
      const read = (await call('read', { place })) as { entries: Record<string, string>; version: string | null };
      return { entries: Object.fromEntries(Object.entries(read.entries).map(([entry, value]) => [entry, bytes(value)])), version: read.version };
    },
    write: ({ writes, expect }) =>
      call('write', {
        writes: Object.fromEntries(Object.entries(writes).map(([place, entries]) => [place, Object.fromEntries(Object.entries(entries).map(([entry, value]) => [entry, value === null ? null : hex(value)]))])),
        expect,
      }) as Promise<Readonly<Record<string, string | null>> | null>,
  };
};

memorySuite('IndexedDbMemory', remote);

const shop = { name: 'shop', classes: { faculty: 'origin', at: '/houses/shop.js' } };
const greet = { house: 'shop', id: 'bob', method: 'greet' };

void test('Two tabs share one ground, and the second runs it when the first closes', async () => {
  const first = await tabAt();
  const second = await tabAt();
  await on(first, 'open', 'tabs');
  await on(first, 'led');
  await on(second, 'open', 'tabs');
  assert.equal(await on(first, 'leading'), true);
  assert.equal(await on(second, 'leading'), false);

  const added = (await on(second, 'hand', { faculty: 'houses', method: 'add', args: shop })) as { result?: { ward: string } };
  assert.ok(added.result !== undefined, JSON.stringify(added));
  await on(second, 'hand', { house: 'shop', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } });
  assert.deepEqual(await on(first, 'hand', greet), { result: 'bob greets root' });

  await first.close();
  await on(second, 'led');
  assert.equal(await on(second, 'leading'), true);
  const listed = (await on(second, 'hand', { faculty: 'houses', method: 'list' })) as { result: { name: string; ward?: string }[] };
  assert.deepEqual(
    listed.result.map(({ name, ward }) => ({ name, ward })),
    [{ name: 'shop', ward: added.result.ward }],
    'the same house on the same sealed seed',
  );
  assert.deepEqual(await on(second, 'hand', greet), { result: 'bob greets root' }, 'her row stood in IndexedDB');
  const described = (await on(second, 'hand', { describe: true })) as { result: { persisted: boolean } };
  assert.equal(typeof described.result.persisted, 'boolean');
  await second.close();
});

void test('A push wakes the service worker, which reaches the ground a tab runs, or runs it where none does', async () => {
  const tab = await tabAt();
  await on(tab, 'register');
  // A push delivered as the push service would, through Chromium's own protocol.
  const cdp = await context.newCDPSession(tab);
  const registration = new Promise<string>((resolve) =>
    cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
      const ours = registrations.find((one) => one.scopeURL.startsWith(origin) && !one.isDeleted);
      if (ours !== undefined) resolve(ours.registrationId);
    }),
  );
  await cdp.send('ServiceWorker.enable');
  const registrationId = await registration;
  const push = async (name: string) => {
    const heard = on(tab, 'heard', name);
    await cdp.send('ServiceWorker.deliverPushMessage', { origin, registrationId, data: JSON.stringify({ name }) });
    return heard;
  };

  await on(tab, 'open', 'woken');
  await on(tab, 'led');
  await on(tab, 'hand', { faculty: 'houses', method: 'add', args: shop });
  await on(tab, 'hand', { house: 'shop', method: 'bear', args: { kind: 'org.example.host', id: 'bob' } });
  assert.deepEqual(await push('woken'), { answer: { result: 'bob greets root' }, leading: false }, 'the worker reached the tab’s ground');

  await on(tab, 'close');
  assert.deepEqual(await push('woken'), { answer: { result: 'bob greets root' }, leading: true }, 'the worker ran the ground from the origin’s storage');
  await cdp.detach();
  await tab.close();
});
