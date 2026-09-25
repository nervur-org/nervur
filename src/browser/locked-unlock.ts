// SPDX-License-Identifier: Apache-2.0
// A BrowserGround's unlock: the ground's key, drawn once and sealed with
// AES-GCM under a key the browser keeps and never hands out. That AES key
// is made once, unextractable, and kept on a shelf beside the sealed key,
// since IndexedDB keeps a key as it is and never as bytes. A script on the
// origin may use the AES key and can never copy it: a lock, not a wall.
import type { Unlock } from '../ground/ground.ts';

/** Where the unlock keeps its AES key and the sealed key: values kept as they are. */
export interface Shelf {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

interface Sealed {
  readonly iv: Uint8Array<ArrayBuffer>;
  readonly data: Uint8Array<ArrayBuffer>;
}

const LOCK = 'lock';
const SEALED = 'key';
const STORE = 'shelf';
// The words sealed in beside the key, so no other sealed value on the shelf opens as it.
const BOUND = new TextEncoder().encode('nervur-key');

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

export class LockedUnlock implements Unlock {
  readonly #shelf: Shelf;
  readonly #subtle: SubtleCrypto;
  #drawn: Promise<string> | undefined;

  constructor(shelf: Shelf, subtle: SubtleCrypto = crypto.subtle) {
    this.#shelf = shelf;
    this.#subtle = subtle;
  }

  /** The unlock of the origin, on a shelf in IndexedDB named `name`. */
  static async open(name = 'nervur-unlock', factory: IDBFactory = indexedDB): Promise<LockedUnlock> {
    return new LockedUnlock(await IndexedDbShelf.open(name, factory));
  }

  /** Its shelf let go, where the shelf holds a connection. */
  close(): void {
    (this.#shelf as { close?: () => void }).close?.();
  }

  key(): Promise<string> {
    // One key is drawn at a time, so two first uses never draw two.
    this.#drawn ??= this.#key();
    this.#drawn.catch(() => (this.#drawn = undefined));
    return this.#drawn;
  }

  // The key sealed on the shelf, or a fresh one sealed there first.
  async #key(): Promise<string> {
    const lock = await this.#lock();
    let sealed = (await this.#shelf.get(SEALED)) as Sealed | undefined;
    if (sealed === undefined) {
      const key = crypto.getRandomValues(new Uint8Array(32));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      sealed = { iv, data: new Uint8Array(await this.#subtle.encrypt({ name: 'AES-GCM', iv, additionalData: BOUND }, lock, key)) };
      key.fill(0);
      await this.#shelf.set(SEALED, sealed);
    }
    const key = new Uint8Array(await this.#subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData: BOUND }, lock, sealed.data));
    const text = hex(key);
    key.fill(0);
    return text;
  }

  async #lock(): Promise<CryptoKey> {
    const kept = (await this.#shelf.get(LOCK)) as CryptoKey | undefined;
    if (kept !== undefined) return kept;
    const made = await this.#subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await this.#shelf.set(LOCK, made);
    return made;
  }
}
