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

  /** Its shelf let go, where the shelf holds a connection. */
  close(): void {
    (this.#shelf as { close?: () => void }).close?.();
  }

  keys({ house }: { house: string }): Promise<Keys> {
    return this.#inTurn(house, (named) => this.#keys(named));
  }

  // One custody step at a time, so two first uses of a house never draw two seeds.
  #inTurn<T>(house: string, step: (house: string) => Promise<T>): Promise<T> {
    if (!NAME.test(house)) return Promise.reject(new TypeError(`no house is named ${house}`));
    const turn = this.#turn.then(() => step(house));
    this.#turn = turn.catch(() => undefined);
    return turn;
  }

  /** A house's seed as hex, drawn where none is kept, for the hand's `moves` alone. */
  seed({ house }: { house: string }): Promise<string> {
    return this.#inTurn(house, (named) => this.#seed(named));
  }

  /** A seed kept for a house, as a move brings it in; a house holding another is refused. */
  keep({ house, seed }: { house: string; seed: string }): Promise<void> {
    return this.#inTurn(house, async (named) => {
      if (!/^[0-9a-f]{64}$/.test(seed)) throw new TypeError('a seed is sixty-four lowercase hex digits');
      if ((await this.#seed(named, seed)) !== seed) throw new Error(`the house ${named} holds another seed`);
    });
  }

  async #keys(house: string): Promise<Keys> {
    return new SeedKeys(await this.#seed(house));
  }

  // The house's seed as hex: the one sealed on the shelf, or `given`, or a fresh one, sealed there first.
  async #seed(house: string, given?: string): Promise<string> {
    const key = await this.#key();
    // The house's name is sealed in, so one house's seed never opens as another's.
    const additionalData = new TextEncoder().encode(house);
    let sealed = (await this.#shelf.get(`seed:${house}`)) as Sealed | undefined;
    if (sealed === undefined) {
      const seed = given === undefined ? crypto.getRandomValues(new Uint8Array(32)) : new Uint8Array(given.match(/../g)!.map((pair) => parseInt(pair, 16)));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      sealed = { iv, data: new Uint8Array(await this.#subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, seed)) };
      seed.fill(0);
      await this.#shelf.set(`seed:${house}`, sealed);
    }
    const seed = new Uint8Array(await this.#subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData }, key, sealed.data));
    const text = hex(seed);
    seed.fill(0);
    return text;
  }

  async #key(): Promise<CryptoKey> {
    const kept = (await this.#shelf.get(KEY)) as CryptoKey | undefined;
    if (kept !== undefined) return kept;
    const made = await this.#subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await this.#shelf.set(KEY, made);
    return made;
  }
}
