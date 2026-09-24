// SPDX-License-Identifier: Apache-2.0
// A BrowserGround's custody: one seed for each house, sealed with AES-GCM
// under a key the browser keeps and never hands out. The key is made once,
// unextractable, and kept on a shelf beside the sealed seeds, since
// IndexedDB keeps a key as it is and never as bytes. A script on the
// origin may use the key and can never copy it: a lock, not a wall.
import { SeedKeys } from '../bodies/seed-keys.ts';
import type { Keys } from '../foundation.ts';
import type { Custody } from '../ground/ground.ts';

/** Where custody keeps its key and its sealed seeds: values kept as they are. */
export interface Shelf {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

interface Sealed {
  readonly iv: Uint8Array<ArrayBuffer>;
  readonly data: Uint8Array<ArrayBuffer>;
}

const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const KEY = 'key';
const STORE = 'shelf';

const done = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB refused the request'));
  });

/** A shelf in IndexedDB, which keeps a `CryptoKey` whole. */
export class IndexedDbShelf implements Shelf {
  readonly #db: IDBDatabase;

  private constructor(db: IDBDatabase) {
    this.#db = db;
  }

  static async open(name: string, factory: IDBFactory = indexedDB): Promise<IndexedDbShelf> {
    const opening = factory.open(name, 1);
    opening.onupgradeneeded = () => {
      opening.result.createObjectStore(STORE);
    };
    return new IndexedDbShelf(await done(opening));
  }

  get(key: string): Promise<unknown> {
    return done(this.#db.transaction(STORE, 'readonly').objectStore(STORE).get(key));
  }

  async set(key: string, value: unknown): Promise<void> {
    const transaction = this.#db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(value, key);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB aborted the write'));
    });
  }

  close(): void {
    this.#db.close();
  }
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

export class LockedCustody implements Custody {
  readonly #shelf: Shelf;
  readonly #subtle: SubtleCrypto;
  // One seed is drawn at a time, so two first uses of a house never draw two.
  #turn: Promise<unknown> = Promise.resolve();

  constructor(shelf: Shelf, subtle: SubtleCrypto = crypto.subtle) {
    this.#shelf = shelf;
    this.#subtle = subtle;
  }

  /** The custody of the origin, on a shelf in IndexedDB named `name`. */
  static async open(name = 'nervur-custody', factory: IDBFactory = indexedDB): Promise<LockedCustody> {
    return new LockedCustody(await IndexedDbShelf.open(name, factory));
  }

  keys({ house }: { house: string }): Promise<Keys> {
    if (!NAME.test(house)) return Promise.reject(new TypeError(`no house is named ${house}`));
    const turn = this.#turn.then(() => this.#keys(house));
    this.#turn = turn.catch(() => undefined);
    return turn;
  }

  async #keys(house: string): Promise<Keys> {
    const key = await this.#key();
    // The house's name is sealed in, so one house's seed never opens as another's.
    const additionalData = new TextEncoder().encode(house);
    let sealed = (await this.#shelf.get(`seed:${house}`)) as Sealed | undefined;
    if (sealed === undefined) {
      const seed = crypto.getRandomValues(new Uint8Array(32));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      sealed = { iv, data: new Uint8Array(await this.#subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, seed)) };
      seed.fill(0);
      await this.#shelf.set(`seed:${house}`, sealed);
    }
    const seed = new Uint8Array(await this.#subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData }, key, sealed.data));
    const keys = new SeedKeys(hex(seed));
    seed.fill(0);
    return keys;
  }

  async #key(): Promise<CryptoKey> {
    const kept = (await this.#shelf.get(KEY)) as CryptoKey | undefined;
    if (kept !== undefined) return kept;
    const made = await this.#subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await this.#shelf.set(KEY, made);
    return made;
  }
}
