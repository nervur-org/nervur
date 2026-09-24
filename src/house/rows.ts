// SPDX-License-Identifier: Apache-2.0
// The house's rows: one sealed row a place, under names that say nothing.
// Every write is a transaction over drafts of the rows it touches, and
// lands whole or not at all.
import type { Crypto, Keys, Memory, Tools } from '../foundation.ts';
import { copy } from './rows-shape.ts';

const ENTRY = 'row';
// The runs a change gets where other writes keep moving the rows it read, before it counts as refused.
const RUNS = 64;

/** A transaction's view: rows read once, changed as drafts, written together. */
export interface Draft {
  get<T>(place: string): Promise<T | null>;
  set(place: string, row: unknown): void;
}

interface Held {
  readonly row: unknown;
  readonly text: string | null;
  readonly version: string | null;
}

export class Rows {
  readonly #memory: Memory;
  readonly #crypto: Crypto;
  readonly #tools: Tools;
  readonly #names: Uint8Array;
  readonly #key: Uint8Array;
  readonly #held = new Map<string, Held>();
  readonly #placeNames = new Map<string, string>();
  /** The last write holding each row, which the next one to hold it waits for. */
  readonly #holds = new Map<string, Promise<void>>();
  // How many times each row's cache has moved, so a read overtaken by a write never lands behind it.
  readonly #moves = new Map<string, number>();
  #landed: ((place: string, row: unknown) => void) | undefined;

  private constructor(memory: Memory, crypto: Crypto, tools: Tools, names: Uint8Array, key: Uint8Array) {
    this.#memory = memory;
    this.#crypto = crypto;
    this.#tools = tools;
    this.#names = names;
    this.#key = key;
  }

  static async open(memory: Memory, keys: Keys, crypto: Crypto, tools: Tools): Promise<Rows> {
    return new Rows(memory, crypto, tools, await keys.derive('place-names', 32), await keys.derive('rows', 32));
  }

  /** The place a name is kept at: a digest that says nothing of the name. */
  async place(name: string): Promise<string> {
    let place = this.#placeNames.get(name);
    if (place === undefined) {
      const digest = await this.#crypto.sha256(new Uint8Array([...this.#names, ...this.#tools.utf8(name)]));
      place = this.#tools.hex(digest.subarray(0, 16));
      this.#placeNames.set(name, place);
    }
    return place;
  }

  // A row's cache moved, by a write that landed or one refused: a read in flight across it is behind.
  #moved(place: string) {
    this.#moves.set(place, (this.#moves.get(place) ?? 0) + 1);
  }

  #forget(place: string) {
    this.#moved(place);
    this.#held.delete(place);
  }

  async #read(place: string): Promise<Held> {
    for (;;) {
      const cached = this.#held.get(place);
      if (cached !== undefined) return cached;
      const move = this.#moves.get(place) ?? 0;
      const { entries, version } = await this.#memory.read({ place });
      const sealed = entries[ENTRY];
      let held: Held = { row: null, text: null, version };
      if (sealed !== undefined) {
        const opened = await this.#crypto.open(this.#key, sealed.subarray(0, 12), sealed.subarray(12), this.#tools.utf8(place));
        const text = opened === null ? null : this.#tools.text(opened);
        if (text === null) throw new Error('a row does not open under these keys');
        held = { row: JSON.parse(text), text, version };
      }
      // A write that moved the row while this read was in flight wins, and this read looks again.
      if ((this.#moves.get(place) ?? 0) !== move) continue;
      this.#held.set(place, held);
      return held;
    }
  }

  /** A row as it stands, or `null`. */
  async get<T>(place: string): Promise<T | null> {
    return copy((await this.#read(place)).row) as T | null;
  }

  /** What is told each row as it lands: its place, and the row, or `null` where it went. */
  whenLanded(told: (place: string, row: unknown) => void): void {
    this.#landed = told;
  }

  /** Every place memory lists. */
  list(): Promise<readonly string[]> {
    return this.#memory.list();
  }

  /**
   * One transaction. Its change runs on drafts of the rows it reads, and it
   * lands holding those rows alone, so writes on other rows land beside it.
   * Where another write of this house landed on a row it read, its change
   * runs again on the rows as they stand. `false` where memory refused the
   * write or failed; the rows it read are read again next time.
   */
  async transact(change: (draft: Draft) => Promise<void> | void): Promise<boolean> {
    for (let run = 0; run < RUNS; run++) {
      const landed = await this.#transact(change);
      if (landed !== 'moved') return landed;
    }
    return false;
  }

  // The rows named, each held in the order of its place, so two writes never wait on each other.
  async #hold(places: readonly string[]): Promise<() => void> {
    const releases: (() => void)[] = [];
    for (const place of [...places].sort()) {
      const before = this.#holds.get(place) ?? Promise.resolve();
      let release!: () => void;
      const mine = new Promise<void>((resolve) => (release = resolve));
      const tail = before.then(() => mine);
      this.#holds.set(place, tail);
      await before;
      releases.push(() => {
        release();
        if (this.#holds.get(place) === tail) this.#holds.delete(place);
      });
    }
    return () => {
      for (const release of releases) release();
    };
  }

  async #transact(change: (draft: Draft) => Promise<void> | void): Promise<boolean | 'moved'> {
    const read = new Map<string, Held>();
    const drafts = new Map<string, unknown>();
    const draft: Draft = {
      get: async <T>(place: string) => {
        if (drafts.has(place)) return drafts.get(place) as T | null;
        const held = await this.#read(place);
        read.set(place, held);
        const drafted = copy(held.row);
        drafts.set(place, drafted);
        return drafted as T | null;
      },
      set: (place, row) => {
        drafts.set(place, row);
      },
    };
    await change(draft);

    const release = await this.#hold([...new Set([...read.keys(), ...drafts.keys()])]);
    try {
      // A row this change read moved since: it runs again on the row as it stands.
      for (const [place, held] of read) if (this.#held.get(place) !== held) return 'moved';
      const writes: Record<string, Record<string, Uint8Array | null>> = {};
      // Every row read is expected as it was read, so memory refuses a write on rows another writer moved.
      const expect: Record<string, string | null> = Object.fromEntries([...read].map(([place, held]) => [place, held.version]));
      const landed = new Map<string, Held>();
      for (const [place, row] of drafts) {
        const before = read.get(place) ?? (await this.#read(place));
        const text = row === null ? null : this.#tools.canonical(row);
        if (text === before.text) continue;
        expect[place] = before.version;
        if (text === null) writes[place] = { [ENTRY]: null };
        else {
          const nonce = this.#crypto.random(12);
          const sealed = await this.#crypto.seal(this.#key, nonce, this.#tools.utf8(text), this.#tools.utf8(place));
          writes[place] = { [ENTRY]: new Uint8Array([...nonce, ...sealed]) };
        }
        landed.set(place, { row: text === null ? null : JSON.parse(text), text, version: null });
      }
      if (Object.keys(writes).length === 0) return true;
      let versions: Readonly<Record<string, string | null>> | null = null;
      try {
        versions = await this.#memory.write({ writes, expect });
      } catch {
        versions = null;
      }
      if (versions === null) {
        for (const place of Object.keys(expect)) this.#forget(place);
        return false;
      }
      for (const [place, held] of landed) {
        this.#moved(place);
        this.#held.set(place, { ...held, version: versions[place] ?? null });
        this.#landed?.(place, held.row);
      }
      return true;
    } finally {
      release();
    }
  }
}
