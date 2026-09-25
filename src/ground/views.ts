// SPDX-License-Identifier: Apache-2.0
// The views a ground hands out of what it holds whole. A house sees the
// ground's clock and carry as its own, and closing them ends every ask in
// flight on it. The dock sees the ladder's carry as it comes to stand. A
// house and a faculty each keep their places under a prefix of the
// ground's one memory, and a faculty's are sealed by the ground. No entry
// exports these; each contract's suite runs against them.
import type { Carry, Clock, Crypto, Memory, PlaceRead, Sent, Tools } from '../foundation.ts';

// The ground's clock as one house sees it: its waits named apart from every
// other house's. When the ground closes it, every wait runs out, and each
// wait asked after runs out once, so every ask in flight on the house ends
// and none waits again.
export class HouseClock implements Clock {
  readonly #clock: Clock;
  readonly #prefix: string;
  readonly #waits = new Map<string, { readonly turn: number; readonly run: (fired: boolean) => void }>();
  /** The waits that ran out after the close, each once. */
  readonly #spent = new Set<string>();
  #turn = 0;
  #closed = false;

  constructor(clock: Clock, house: string) {
    this.#clock = clock;
    this.#prefix = `${house}\n`;
  }

  now(): number {
    return this.#clock.now();
  }

  wait({ id, ms }: { id: string; ms: number }): Promise<boolean> {
    if (this.#closed) {
      if (this.#spent.has(id)) return Promise.resolve(false);
      this.#spent.add(id);
      return Promise.resolve(true);
    }
    const turn = ++this.#turn;
    return new Promise((run) => {
      this.#waits.get(id)?.run(false);
      this.#waits.set(id, { turn, run });
      void this.#clock.wait({ id: this.#prefix + id, ms }).then((fired) => {
        if (this.#waits.get(id)?.turn === turn) this.#waits.delete(id);
        run(fired);
      });
    });
  }

  cancel({ id }: { id: string }): void {
    this.#clock.cancel({ id: this.#prefix + id });
  }

  close(): void {
    this.#closed = true;
    for (const [id, { run }] of this.#waits) {
      this.#spent.add(id);
      run(true);
      this.#clock.cancel({ id: this.#prefix + id });
    }
    this.#waits.clear();
  }
}

// The ground's carry as one house sees it: silent once the ground closes it.
export class HouseCarry implements Carry {
  readonly #carry: Carry;
  #closed = false;

  constructor(carry: Carry) {
    this.#carry = carry;
  }

  send(options: { ward: string; at: readonly string[]; box: Uint8Array; wait?: number }): Promise<Sent> {
    return this.#closed ? Promise.resolve({ reply: null, heard: false }) : this.#carry.send(options);
  }

  at(options: { toward?: string } = {}): readonly string[] {
    return this.#carry.at(options);
  }

  vouched(options: { ward: string; at: readonly string[] }): Promise<readonly string[]> {
    return this.#closed ? Promise.resolve([]) : this.#carry.vouched(options);
  }

  close(): void {
    this.#closed = true;
  }
}

// The carry the dock holds from before the ladder stands: each send goes by
// the carries standing when it is made, and where none stands it is unheard.
export class LadderCarry implements Carry {
  readonly #carry: () => Carry | string;

  constructor(carry: () => Carry | string) {
    this.#carry = carry;
  }

  send(options: { ward: string; at: readonly string[]; box: Uint8Array; wait?: number }): Promise<Sent> {
    const carry = this.#carry();
    return typeof carry === 'string' ? Promise.resolve({ reply: null, heard: false }) : carry.send(options);
  }

  at(options: { toward?: string } = {}): readonly string[] {
    const carry = this.#carry();
    return typeof carry === 'string' ? [] : carry.at(options);
  }

  vouched(options: { ward: string; at: readonly string[] }): Promise<readonly string[]> {
    const carry = this.#carry();
    return typeof carry === 'string' ? Promise.resolve([]) : carry.vouched(options);
  }
}


type Writes = Readonly<Record<string, Readonly<Record<string, Uint8Array | null>>>>;
type Expect = Readonly<Record<string, string | null>>;

// The places of one memory under a prefix, named without it: a view lists
// its own places alone, so one memory holds a ground's every house and
// faculty, and each reads as a memory of its own.
export class ViewMemory implements Memory {
  readonly #memory: Memory;
  readonly #prefix: string;

  constructor(memory: Memory, prefix: string) {
    if (prefix === '') throw new TypeError('a view names a prefix');
    this.#memory = memory;
    this.#prefix = prefix;
  }

  read({ place }: { place: string }): Promise<PlaceRead> {
    return this.#memory.read({ place: this.#prefix + place });
  }

  async list(): Promise<readonly string[]> {
    return (await this.#memory.list()).filter((place) => place.startsWith(this.#prefix)).map((place) => place.slice(this.#prefix.length));
  }

  async write({ writes, expect }: { writes: Writes; expect: Expect }): Promise<Readonly<Record<string, string | null>> | null> {
    const inner = (named: Readonly<Record<string, unknown>>) => Object.fromEntries(Object.entries(named).map(([place, value]) => [this.#prefix + place, value]));
    const landed = await this.#memory.write({ writes: inner(writes) as Writes, expect: inner(expect) as Expect });
    if (landed === null) return null;
    return Object.fromEntries(Object.keys(writes).map((place) => [place, landed[this.#prefix + place] ?? null]));
  }
}

const NONCE = 12;

// A memory whose every entry is sealed under one key. A place and an entry
// are kept under digests that say nothing, and each sealed entry carries
// its place's name and its own, so the view reads back what was written.
// Versions pass through, so `expect` guards one writer as it does below.
export class SealedMemory implements Memory {
  readonly #memory: Memory;
  readonly #key: Uint8Array;
  readonly #crypto: Crypto;
  readonly #tools: Tools;

  constructor(memory: Memory, key: Uint8Array, crypto: Crypto, tools: Tools) {
    if (key.length !== 32) throw new TypeError('a sealed memory takes a key of thirty-two bytes');
    this.#memory = memory;
    this.#key = key;
    this.#crypto = crypto;
    this.#tools = tools;
  }

  async #digest(text: string): Promise<string> {
    return this.#tools.hex((await this.#crypto.sha256(new Uint8Array([...this.#key, ...this.#tools.utf8(text)]))).subarray(0, 16));
  }

  #place(place: string): Promise<string> {
    return this.#digest(`place\n${place}`);
  }

  #entry(place: string, entry: string): Promise<string> {
    return this.#digest(`entry\n${place}\n${entry}`);
  }

  // One entry opened: its place, its name and its bytes, or `null` where it does not open under this key.
  async #open(stored: string, name: string, sealed: Uint8Array): Promise<{ place: string; entry: string; bytes: Uint8Array } | null> {
    const opened = await this.#crypto.open(this.#key, sealed.subarray(0, NONCE), sealed.subarray(NONCE), this.#tools.utf8(`${stored}\n${name}`));
    if (opened === null || opened.length < 4) return null;
    const length = new DataView(opened.buffer, opened.byteOffset, opened.byteLength).getUint32(0);
    const header = this.#tools.text(opened.subarray(4, 4 + length));
    const parsed = header === null ? null : this.#tools.parse(header);
    const names = parsed?.value;
    if (!Array.isArray(names) || names.length !== 2 || typeof names[0] !== 'string' || typeof names[1] !== 'string') return null;
    return { place: names[0], entry: names[1], bytes: opened.slice(4 + length) };
  }

  async read({ place }: { place: string }): Promise<PlaceRead> {
    const stored = await this.#place(place);
    const { entries, version } = await this.#memory.read({ place: stored });
    const read: Record<string, Uint8Array> = {};
    for (const [name, sealed] of Object.entries(entries)) {
      const opened = await this.#open(stored, name, sealed);
      if (opened === null || opened.place !== place) throw new Error('an entry does not open under this key');
      read[opened.entry] = opened.bytes;
    }
    return { entries: read, version };
  }

  async list(): Promise<readonly string[]> {
    const places: string[] = [];
    for (const stored of await this.#memory.list()) {
      const { entries } = await this.#memory.read({ place: stored });
      const [first] = Object.entries(entries);
      const opened = first === undefined ? null : await this.#open(stored, first[0], first[1]);
      if (opened !== null) places.push(opened.place);
    }
    return places;
  }

  async write({ writes, expect }: { writes: Writes; expect: Expect }): Promise<Readonly<Record<string, string | null>> | null> {
    const sealed: Record<string, Record<string, Uint8Array | null>> = {};
    const stored = new Map<string, string>();
    for (const place of new Set([...Object.keys(writes), ...Object.keys(expect)])) stored.set(place, await this.#place(place));
    for (const [place, entries] of Object.entries(writes)) {
      const at = stored.get(place)!;
      sealed[at] = {};
      for (const [entry, bytes] of Object.entries(entries)) {
        const name = await this.#entry(place, entry);
        if (bytes === null) {
          sealed[at][name] = null;
          continue;
        }
        const header = this.#tools.utf8(this.#tools.canonical([place, entry]));
        const plain = new Uint8Array(4 + header.length + bytes.length);
        new DataView(plain.buffer).setUint32(0, header.length);
        plain.set(header, 4);
        plain.set(bytes, 4 + header.length);
        const nonce = this.#crypto.random(NONCE);
        sealed[at][name] = new Uint8Array([...nonce, ...(await this.#crypto.seal(this.#key, nonce, plain, this.#tools.utf8(`${at}\n${name}`)))]);
      }
    }
    const landed = await this.#memory.write({ writes: sealed, expect: Object.fromEntries(Object.entries(expect).map(([place, version]) => [stored.get(place)!, version])) });
    if (landed === null) return null;
    return Object.fromEntries(Object.keys(writes).map((place) => [place, landed[stored.get(place)!] ?? null]));
  }
}
