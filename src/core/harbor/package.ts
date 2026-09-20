// SPDX-License-Identifier: Apache-2.0
// The package: a harbor's memory, sealed under the harbor's seed. The
// terrain keeps its bytes and reads neither a ward's name, nor a being's
// key, nor anything a row holds.
//
//   key            HKDF-SHA-256 of the seed under `nervur-package`
//   place          16 bytes under ["place", ward], as hex
//   entry          16 bytes under ["entry", ward, row], as hex
//   seal           32 bytes under ["seal", ward]
//   entry bytes    nonce (12) || AES-256-GCM( JSON { row, value } ),
//                  the entry's name as additional data
//
// A row is the head, under the empty name, or one being, under her key. An
// entry that does not open refuses the whole ward, so nothing unpacks from
// bytes the package did not seal.
import { concat, decrypt, encrypt, hex, hkdf, isHex, unhex, utf8 } from '../crypto/index.ts';
import type { Entropy, Memory, Rows } from '../contract/index.ts';
import { HEAD_ROW } from '../ward/index.ts';

// Every place of one memory, written into another, and the places
// carried. The bytes are the package's own, sealed under a seed neither
// memory holds, so a harbor opened on the second memory under that seed
// stands what the first one stood. A place the second memory already
// holds is written over.
export const copyPackage = async (from: Memory, to: Memory): Promise<string[]> => {
  const places = await from.places();
  for (const place of places) await to.write(place, await from.read(place));
  return places;
};

// A harbor as one JSON value, for carrying it to another ground: every
// place of its memory with its sealed entries as hex, its DNA among them,
// and its seed only where the one who carries it says so.
export type Carried = { seed?: string; places: Record<string, Record<string, string>> };

// A carried harbor as JSON reads, or null for anything else.
export const readCarried = (value: unknown): Carried | null => {
  if (typeof value !== 'object' || value === null) return null;
  const { seed, places } = value as { seed?: unknown; places?: unknown };
  if (seed !== undefined && !isHex(seed, 32)) return null;
  if (typeof places !== 'object' || places === null || Array.isArray(places)) return null;
  for (const entries of Object.values(places)) {
    if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) return null;
    for (const bytes of Object.values(entries)) if (!isHex(bytes)) return null;
  }
  return { ...(seed === undefined ? {} : { seed }), places: places as Carried['places'] };
};

// Every place of a memory, as a carried harbor holds it.
export const carryPlaces = async (memory: Memory): Promise<Carried['places']> => {
  const places: Carried['places'] = {};
  for (const place of await memory.places()) {
    places[place] = Object.fromEntries([...(await memory.read(place))].map(([name, bytes]) => [name, hex(bytes)]));
  }
  return places;
};

// A carried harbor's places, written into a memory, and their names.
export const landPlaces = async (memory: Memory, carried: Carried): Promise<string[]> => {
  for (const [place, entries] of Object.entries(carried.places)) {
    await memory.write(place, new Map(Object.entries(entries).map(([name, bytes]) => [name, unhex(bytes)])));
  }
  return Object.keys(carried.places);
};

const NONCE = 12;
const LABEL = utf8('nervur-package');

type Sealed = { row: string; value: unknown };

class PackageRows implements Rows {
  readonly rows: Record<string, unknown>;
  readonly #ward: WardPlace;
  readonly #told = new Set<string>();
  #line: Promise<boolean> = Promise.resolve(true);

  constructor(ward: WardPlace, rows: Record<string, unknown>) {
    this.#ward = ward;
    this.rows = rows;
  }

  told(row: string): void {
    this.#told.add(row);
  }

  // Every row told since the last keep, sealed and written as one keep, one
  // keep at a time. Where nothing was told, nothing is written, so an ask
  // that only reads keeps even where the keeper refuses every write.
  kept(): Promise<boolean> {
    const rows = [...this.#told];
    this.#told.clear();
    this.#line = this.#line.then(() => this.#write(rows)).catch(() => false);
    return this.#line;
  }

  async #write(told: string[]): Promise<boolean> {
    if (told.length === 0) return true;
    const beings = (this.rows.beings ?? {}) as Record<string, unknown>;
    const entries = new Map<string, Uint8Array | null>();
    for (const row of told) {
      const value = row === HEAD_ROW ? (this.rows.ward ?? null) : Object.hasOwn(beings, row) ? beings[row] : undefined;
      entries.set(await this.#ward.entry(row), value === undefined ? null : await this.#ward.seal(row, value));
    }
    await this.#ward.write(entries);
    return true;
  }
}

// What keeps a ward's place: the root memory, or a memory faculty the dock
// lends.
export type Keeper = Pick<Memory, 'read' | 'write' | 'places' | 'forget'>;

class WardPlace {
  readonly #pack: Package;
  readonly #name: string;
  readonly #seal: Uint8Array;
  readonly #keeper: Keeper;
  readonly place: string;

  constructor(pack: Package, name: string, seal: Uint8Array, place: string, keeper: Keeper) {
    this.#pack = pack;
    this.#name = name;
    this.#seal = seal;
    this.place = place;
    this.#keeper = keeper;
  }

  read(): Promise<Map<string, Uint8Array>> {
    return this.#keeper.read(this.place);
  }

  entry(row: string): Promise<string> {
    return this.#pack.derive(['entry', this.#name, row], 16).then(hex);
  }

  async seal(row: string, value: unknown): Promise<Uint8Array> {
    const nonce = this.#pack.entropy.draw(NONCE);
    const text = utf8(JSON.stringify({ row, value } satisfies Sealed));
    return concat(nonce, await encrypt(this.#seal, nonce, utf8(await this.entry(row)), text));
  }

  // The name is the additional data, so an entry moved under another name
  // does not open either.
  async open(name: string, bytes: Uint8Array): Promise<Sealed> {
    const text = bytes.length > NONCE ? await decrypt(this.#seal, bytes.subarray(0, NONCE), utf8(name), bytes.subarray(NONCE)) : null;
    if (text === null) throw new Error('an entry the package did not seal');
    return JSON.parse(new TextDecoder().decode(text)) as Sealed;
  }

  write(entries: ReadonlyMap<string, Uint8Array | null>): Promise<void> {
    return this.#keeper.write(this.place, entries);
  }
}

export class Package {
  readonly memory: Memory;
  readonly entropy: Entropy;
  readonly #key: Uint8Array;

  private constructor(memory: Memory, entropy: Entropy, key: Uint8Array) {
    this.memory = memory;
    this.entropy = entropy;
    this.#key = key;
  }

  static async open(memory: Memory, entropy: Entropy, seed: Uint8Array): Promise<Package> {
    return new Package(memory, entropy, await hkdf(seed, LABEL, 32));
  }

  derive(info: string[], length: number): Promise<Uint8Array> {
    return hkdf(this.#key, utf8(JSON.stringify(info)), length);
  }

  // The place a ward's rows live in.
  place(name: string): Promise<string> {
    return this.derive(['place', name], 16).then(hex);
  }

  // One ward's rows, as its keeper kept them: the root memory unless a
  // memory faculty is named.
  async rows(name: string, keeper: Keeper = this.memory): Promise<Rows> {
    const ward = new WardPlace(this, name, await this.derive(['seal', name], 32), await this.place(name), keeper);
    const rows: Record<string, unknown> = {};
    const beings: Record<string, unknown> = {};
    let any = false;
    for (const [entry, bytes] of await ward.read()) {
      const { row, value } = await ward.open(entry, bytes);
      any = true;
      if (row === HEAD_ROW) rows.ward = value;
      else beings[row] = value;
    }
    if (any) rows.beings = beings;
    return new PackageRows(ward, rows);
  }
}
