// SPDX-License-Identifier: Apache-2.0
// Memory in a browser: one IndexedDB database for each memory, one record
// for each place, holding its entries and its version. Versions come from
// one counter for the whole memory, so a place removed and written again
// never shows a version it showed before. A write reads and writes every
// place in one readwrite transaction, so it lands whole or not at all.
import type { Memory, PlaceRead } from '../foundation.ts';

interface Place {
  readonly entries: Record<string, Uint8Array>;
  readonly version: number;
}

const PLACES = 'places';
const COUNT = 'count';

const done = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB refused the request'));
  });

const copied = (entries: Record<string, Uint8Array>): Record<string, Uint8Array> => Object.fromEntries(Object.entries(entries).map(([name, bytes]) => [name, bytes.slice()]));

export class IndexedDbMemory implements Memory {
  readonly #db: IDBDatabase;

  private constructor(db: IDBDatabase) {
    this.#db = db;
  }

  /** The memory named `name`, its database made on first use. `factory` is the engine's `indexedDB` where omitted. */
  static async open(name: string, factory: IDBFactory = indexedDB): Promise<IndexedDbMemory> {
    const opening = factory.open(name, 1);
    opening.onupgradeneeded = () => {
      opening.result.createObjectStore(PLACES);
      opening.result.createObjectStore(COUNT);
    };
    return new IndexedDbMemory(await done(opening));
  }

  async read({ place }: { place: string }): Promise<PlaceRead> {
    const held = (await done(this.#db.transaction(PLACES, 'readonly').objectStore(PLACES).get(place))) as Place | undefined;
    if (held === undefined) return { entries: {}, version: null };
    return { entries: copied(held.entries), version: String(held.version) };
  }

  async list(): Promise<readonly string[]> {
    const keys = await done(this.#db.transaction(PLACES, 'readonly').objectStore(PLACES).getAllKeys());
    return keys.map(String);
  }

  write({
    writes,
    expect,
  }: {
    writes: Readonly<Record<string, Readonly<Record<string, Uint8Array | null>>>>;
    expect: Readonly<Record<string, string | null>>;
  }): Promise<Readonly<Record<string, string | null>> | null> {
    const places = [...new Set([...Object.keys(writes), ...Object.keys(expect)])];
    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction([PLACES, COUNT], 'readwrite');
      const store = transaction.objectStore(PLACES);
      const count = transaction.objectStore(COUNT);
      const held = new Map<string, Place | undefined>();
      let versions: Record<string, string | null> | null = null;
      let refused = false;
      transaction.oncomplete = () => resolve(versions);
      transaction.onabort = () => (refused ? resolve(null) : reject(transaction.error ?? new Error('IndexedDB aborted the write')));
      // Every place and the counter are read inside the transaction, and the writes follow in the same one.
      const counted = count.get(COUNT);
      const land = () => {
        if (held.size < places.length || counted.readyState !== 'done') return;
        for (const name of places) {
          const version = held.get(name) === undefined ? null : String(held.get(name)!.version);
          if (!(name in expect) || expect[name] !== version) {
            refused = true;
            transaction.abort();
            return;
          }
        }
        let next = (counted.result as number | undefined) ?? 0;
        const landed: Record<string, string | null> = {};
        for (const [name, entries] of Object.entries(writes)) {
          const kept: Record<string, Uint8Array> = { ...(held.get(name)?.entries ?? {}) };
          for (const [entry, bytes] of Object.entries(entries)) {
            if (bytes === null) delete kept[entry];
            else kept[entry] = bytes.slice();
          }
          next += 1;
          if (Object.keys(kept).length === 0) {
            store.delete(name);
            landed[name] = null;
          } else {
            store.put({ entries: kept, version: next } satisfies Place, name);
            landed[name] = String(next);
          }
        }
        count.put(next, COUNT);
        versions = landed;
      };
      counted.onsuccess = land;
      for (const place of places) {
        const request = store.get(place);
        request.onsuccess = () => {
          held.set(place, request.result as Place | undefined);
          land();
        };
      }
      if (places.length === 0) counted.onsuccess = () => {
        versions = {};
      };
    });
  }

  /** The database let go. */
  close(): void {
    this.#db.close();
  }
}
