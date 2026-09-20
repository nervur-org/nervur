// SPDX-License-Identifier: Apache-2.0
// `nervur/browser`: the browser ground, in a page or a worker. A harbor
// keeps its sealed memory and its seed in one IndexedDB database, named
// by `where`, speaks the web, and holds its database to one run with a
// Web Lock of the same name. It imports a module's source from a Blob
// URL, or, handed a bundle, runs the bundle alone.
//
//   entries   one sealed entry per key [place, name]
//   custody   the seed, sealed under an AES-GCM key the engine never
//             hands out, itself kept as the engine keeps a CryptoKey
//
// A keep is one transaction, so it is whole or nothing by IndexedDB's own
// rule.
import { Custody, Memory, type Bundled, type Entropy } from '../contract/index.ts';
import type { Defaults, GroundProbe } from '../harbor/index.ts';
import { BundleLoader, CryptoEntropy, PointerTerrain, SourceLoader } from '../pointer/index.ts';

export { rootOf, serveWorker, type Reaching } from './worker.ts';

export const BROWSER = 'browser';
// The database a harbor keeps itself in unless named.
export const BROWSER_HARBOR = 'nervur';

const ENTRIES = 'entries';
const CUSTODY = 'custody';
const SEED = 'seed';
// Past every lowercase hex name, so [place, END] bounds a place's keys.
const END = '￿';

type Sealed = { key: CryptoKey; iv: Uint8Array<ArrayBuffer>; sealed: ArrayBuffer };

const done = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB refused'));
  });

// A transaction's end. A request that fails aborts it, and the abort
// carries that request's error.
const finished = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('the keep was aborted'));
  });

// One database, opened once per body and made on first open.
class Database {
  readonly name: string;
  #open: Promise<IDBDatabase> | undefined;
  constructor(name: string) {
    this.name = name;
  }
  get(): Promise<IDBDatabase> {
    this.#open ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(ENTRIES);
        request.result.createObjectStore(CUSTODY);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error(`${this.name} did not open`));
    });
    return this.#open;
  }
  async close(): Promise<void> {
    const open = this.#open;
    this.#open = undefined;
    if (open) (await open).close();
  }
}

export class IdbMemory extends Memory {
  readonly #db: Database;
  constructor(name: string = BROWSER_HARBOR) {
    super();
    this.#db = new Database(name);
  }

  // The database it keeps in.
  get name(): string {
    return this.#db.name;
  }

  async read(place: string): Promise<Map<string, Uint8Array>> {
    const store = (await this.#db.get()).transaction(ENTRIES).objectStore(ENTRIES);
    const range = IDBKeyRange.bound([place, ''], [place, END]);
    const [keys, values] = await Promise.all([done(store.getAllKeys(range)), done(store.getAll(range))]);
    return new Map(keys.map((key, i) => [(key as [string, string])[1], new Uint8Array(values[i] as ArrayBuffer)]));
  }

  async write(place: string, entries: ReadonlyMap<string, Uint8Array | null>): Promise<void> {
    const tx = (await this.#db.get()).transaction(ENTRIES, 'readwrite');
    const kept = finished(tx);
    const store = tx.objectStore(ENTRIES);
    try {
      for (const [name, bytes] of entries) this.put(store, [place, name], bytes === null ? null : bytes.slice().buffer);
    } catch (e) {
      tx.abort();
      await kept.catch(() => undefined);
      throw e;
    }
    await kept;
  }

  // One entry of a keep: its bytes, or null where it goes.
  protected put(store: IDBObjectStore, key: [string, string], bytes: ArrayBuffer | null): void {
    if (bytes === null) store.delete(key);
    else store.put(bytes, key);
  }

  async places(): Promise<string[]> {
    const keys = await done((await this.#db.get()).transaction(ENTRIES).objectStore(ENTRIES).getAllKeys());
    return [...new Set(keys.map((key) => (key as [string, string])[0]))];
  }

  async forget(place: string): Promise<void> {
    const tx = (await this.#db.get()).transaction(ENTRIES, 'readwrite');
    tx.objectStore(ENTRIES).delete(IDBKeyRange.bound([place, ''], [place, END]));
    await finished(tx);
  }

  close(): Promise<void> {
    return this.#db.close();
  }
}

export class IdbCustody extends Custody {
  readonly #db: Database;
  readonly #entropy: Entropy;
  constructor(name: string = BROWSER_HARBOR, entropy: Entropy = new CryptoEntropy()) {
    super();
    this.#db = new Database(name);
    this.#entropy = entropy;
  }

  // The seed the database holds, or a drawn one sealed there the first
  // time. Two first asks at once keep the one added first.
  async seed(): Promise<Uint8Array> {
    const db = await this.#db.get();
    const kept = (await done(db.transaction(CUSTODY).objectStore(CUSTODY).get(SEED))) as Sealed | undefined;
    if (kept) return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: kept.iv }, kept.key, kept.sealed));
    const seed = this.#entropy.draw(32);
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const iv = new Uint8Array(this.#entropy.draw(12));
    const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new Uint8Array(seed));
    const tx = db.transaction(CUSTODY, 'readwrite');
    tx.objectStore(CUSTODY).add({ key, iv, sealed } satisfies Sealed, SEED);
    try {
      await finished(tx);
    } catch (e) {
      if ((e as { name?: string }).name === 'ConstraintError') return this.seed();
      throw e;
    }
    return seed;
  }

  close(): Promise<void> {
    return this.#db.close();
  }
}

// A service worker imports no script once it runs, so a harbor there is
// handed the bundle its script carries, and finds its modules there by
// their blobs, as an edge does.
export type BrowserParts = { readonly where?: string; readonly bundle?: readonly Bundled[]; readonly defaults: Defaults };

// A harbor of the browser: its database, and one run to a database, held
// by a Web Lock where the engine has them. It listens nowhere and has no
// sockets, so the web carrier dials from it and nothing else carries.
export class BrowserTerrain extends PointerTerrain {
  readonly where: string;
  #release: (() => void) | undefined;

  constructor(parts: BrowserParts) {
    const where = parts.where ?? BROWSER_HARBOR;
    const entropy = new CryptoEntropy();
    super({ entropy, loader: parts.bundle ? new BundleLoader(parts.bundle) : new SourceLoader(), custody: new IdbCustody(where, entropy), memory: new IdbMemory(where), defaults: parts.defaults });
    this.where = where;
  }

  // A shared or a service worker outlives any one tab, and a service
  // worker is woken for a push with none open. Anywhere else, a page or a
  // worker a tab made, the harbor lives with that tab.
  override get foreground(): boolean {
    const scope = globalThis as unknown as Record<string, unknown>;
    const is = (name: string): boolean => typeof scope[name] === 'function' && globalThis instanceof (scope[name] as new () => unknown);
    return !is('SharedWorkerGlobalScope') && !is('ServiceWorkerGlobalScope');
  }

  override async claim(): Promise<void> {
    const locks = (globalThis as { navigator?: { locks?: LockManager } }).navigator?.locks;
    if (!locks) return;
    const held = await new Promise<boolean>((granted) => {
      void locks.request(`nervur:${this.where}`, { ifAvailable: true }, (lock) => {
        if (lock === null) {
          granted(false);
          return undefined;
        }
        granted(true);
        return new Promise<void>((release) => (this.#release = release));
      });
    });
    if (!held) throw new Error(`a harbor is already open on ${this.where}`);
  }

  override async release(): Promise<void> {
    this.#release?.();
    this.#release = undefined;
    await (this.memory as IdbMemory).close();
    await (this.custody as IdbCustody).close();
  }
}

// A page or a worker with IndexedDB and Web Crypto.
export const browserGround: GroundProbe = {
  name: BROWSER,
  fits: () => typeof indexedDB !== 'undefined' && typeof crypto?.subtle !== 'undefined',
  terrain: ({ where, bundle }, defaults) => new BrowserTerrain({ ...(where ? { where } : {}), ...(bundle ? { bundle } : {}), defaults }),
};
