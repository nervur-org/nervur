// SPDX-License-Identifier: Apache-2.0
// An unlock and a memory over a store of text a terrain keeps: a phone's
// Keychain and native store, or an edge's Durable Object storage. A
// terrain's body extends these and hands in its store; the logic of each
// contract stands here once.
import type { Memory, PlaceRead } from '../foundation.ts';
import type { Unlock } from '../ground/ground.ts';

/** Secrets as text by name, kept where the terrain keeps them. */
export interface Secrets {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
}

/** A store of text by key, with a swap that lands only where nothing moved. */
export interface Store {
  get(key: string): Promise<string | null>;
  /** Every key that begins with `prefix`. */
  keys(prefix: string): Promise<readonly string[]>;
  /**
   * Lands every write together, where every key in `expect` still holds
   * what it names, `null` for absent; otherwise lands nothing. A write of
   * `null` removes its key. Answers whether it landed.
   */
  swap(writes: Readonly<Record<string, string | null>>, expect: Readonly<Record<string, string | null>>): Promise<boolean>;
}

const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const KEY = /^[0-9a-f]{64}$/;
const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const bytes = (text: string) => new Uint8Array(text.match(/../g)?.map((pair) => parseInt(pair, 16)) ?? []);

/** The ground's key among a terrain's secrets, drawn on first use. */
export abstract class KeptUnlock implements Unlock {
  readonly #secrets: Secrets;
  #drawn: Promise<string> | undefined;

  constructor(secrets: Secrets) {
    this.#secrets = secrets;
  }

  key(): Promise<string> {
    // One key is drawn at a time, so two first uses never draw two.
    this.#drawn ??= (async () => {
      let key = await this.#secrets.get('nervur.key');
      if (key === null) {
        key = hex(crypto.getRandomValues(new Uint8Array(32)));
        await this.#secrets.set('nervur.key', key);
      }
      if (!KEY.test(key)) throw new Error('the kept key is not sixty-four lowercase hex digits');
      return key;
    })();
    this.#drawn.catch(() => (this.#drawn = undefined));
    return this.#drawn;
  }
}

interface Place {
  readonly v: number;
  readonly e: Record<string, string>;
}

/**
 * Memory over a store, one memory for each name. Each place is one key,
 * its entries as hex beside its version. Versions come from one counter
 * for the memory, so a place removed and written again never shows a
 * version it showed before. A write reads every place it names and swaps
 * them all against what it read.
 */
export abstract class KeptMemory implements Memory {
  readonly #store: Store;
  readonly #prefix: string;

  constructor(store: Store, name: string) {
    if (!NAME.test(name)) throw new TypeError(`no memory is named ${name}`);
    this.#store = store;
    this.#prefix = `nervur/${name}/`;
  }

  #key(place: string) {
    return `${this.#prefix}p/${place}`;
  }

  async read({ place }: { place: string }): Promise<PlaceRead> {
    const text = await this.#store.get(this.#key(place));
    if (text === null) return { entries: {}, version: null };
    const held = JSON.parse(text) as Place;
    return { entries: Object.fromEntries(Object.entries(held.e).map(([name, value]) => [name, bytes(value)])), version: String(held.v) };
  }

  async list(): Promise<readonly string[]> {
    const places = `${this.#prefix}p/`;
    return (await this.#store.keys(places)).map((key) => key.slice(places.length));
  }

  async write({
    writes,
    expect,
  }: {
    writes: Readonly<Record<string, Readonly<Record<string, Uint8Array | null>>>>;
    expect: Readonly<Record<string, string | null>>;
  }): Promise<Readonly<Record<string, string | null>> | null> {
    const places = [...new Set([...Object.keys(writes), ...Object.keys(expect)])];
    const count = `${this.#prefix}count`;
    const held: Record<string, string | null> = { [count]: await this.#store.get(count) };
    for (const place of places) held[this.#key(place)] = await this.#store.get(this.#key(place));
    for (const place of places) {
      const text = held[this.#key(place)];
      const version = text === null ? null : String((JSON.parse(text) as Place).v);
      if (!(place in expect) || expect[place] !== version) return null;
    }
    let next = held[count] === null ? 0 : Number(held[count]);
    const landing: Record<string, string | null> = {};
    const versions: Record<string, string | null> = {};
    for (const [place, entries] of Object.entries(writes)) {
      const text = held[this.#key(place)];
      const kept: Record<string, string> = { ...(text === null ? {} : (JSON.parse(text) as Place).e) };
      for (const [name, value] of Object.entries(entries)) {
        if (value === null) delete kept[name];
        else kept[name] = hex(value);
      }
      next += 1;
      const empty = Object.keys(kept).length === 0;
      landing[this.#key(place)] = empty ? null : JSON.stringify({ v: next, e: kept } satisfies Place);
      versions[place] = empty ? null : String(next);
    }
    landing[count] = String(next);
    // What another writer moved since the read refuses the swap, as it would the versions.
    return (await this.#store.swap(landing, held)) ? versions : null;
  }
}
