// SPDX-License-Identifier: Apache-2.0
// The two native bodies of a phone's ground, over what the shell hands in.
// The shell's secret store is the iOS Keychain or the Android Keystore, and
// its store is a native file or database the operating system never
// evicts. The library holds the contracts' logic here; a shell holds only
// the two small interfaces below, in its own native code.
import { SeedKeys } from '../bodies/seed-keys.ts';
import type { Keys, Memory, PlaceRead } from '../foundation.ts';
import type { Custody } from '../ground/ground.ts';

/** The platform's secret store: text by name, kept by the Keychain or the Keystore, on this device alone. */
export interface NativeSecrets {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
}

/** A native store of text by key, which the operating system never evicts. */
export interface NativeStore {
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
const SEED = /^[0-9a-f]{64}$/;
const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const bytes = (text: string) => new Uint8Array(text.match(/../g)?.map((pair) => parseInt(pair, 16)) ?? []);

/** One seed for each house in the platform's secret store, drawn on first use. */
export class NativeCustody implements Custody {
  readonly #secrets: NativeSecrets;
  #turn: Promise<unknown> = Promise.resolve();

  constructor(secrets: NativeSecrets) {
    this.#secrets = secrets;
  }

  keys({ house }: { house: string }): Promise<Keys> {
    if (!NAME.test(house)) return Promise.reject(new TypeError(`no house is named ${house}`));
    // One seed is drawn at a time, so two first uses of a house never draw two.
    const turn = this.#turn.then(async () => {
      const name = `nervur.seed.${house}`;
      let seed = await this.#secrets.get(name);
      if (seed === null) {
        seed = hex(crypto.getRandomValues(new Uint8Array(32)));
        await this.#secrets.set(name, seed);
      }
      if (!SEED.test(seed)) throw new Error(`the seed of ${house} is not sixty-four hex digits`);
      return new SeedKeys(seed);
    });
    this.#turn = turn.catch(() => undefined);
    return turn;
  }
}

interface Place {
  readonly v: number;
  readonly e: Record<string, string>;
}

/**
 * Memory over a native store, one memory for each name. Each place is one
 * key, its entries as hex beside its version. Versions come from one
 * counter for the memory, so a place removed and written again never
 * shows a version it showed before. A write reads every place it names
 * and swaps them all against what it read.
 */
export class NativeMemory implements Memory {
  readonly #store: NativeStore;
  readonly #prefix: string;

  constructor(store: NativeStore, name: string) {
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
