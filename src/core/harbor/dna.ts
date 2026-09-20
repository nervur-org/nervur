// SPDX-License-Identifier: Apache-2.0
// The DNA's objects, kept in the root memory under the catalogue's own
// places and sealed under the package as every row is, so the terrain
// reads no code and no object's id.
//
//   place     the hex of `catalogue`, then the first two digits of the
//             entry's name, git's fan-out
//   entry     16 bytes under ["dna", object id], as hex
//   bytes     nonce (12) || AES-256-GCM( the object deflated as git keeps
//             it loose ), under 32 bytes of ["seal", "dna"], the entry's
//             name as additional data
//
// An object read back is checked against its id, so a store that hands
// back other bytes hands back nothing.
import { concat, decrypt, encrypt, hex, utf8 } from '../crypto/index.ts';
import { deflated, idOf, inflated, type GitObject, type ObjectStore } from '../git/index.ts';
import type { Memory } from '../contract/index.ts';
import type { Package } from './package.ts';

const NONCE = 12;
const FAN = 2;

export class Dna implements ObjectStore {
  // The places under this prefix are the catalogue's, never a ward's: a
  // ward's place is 32 digits, and a memory faculty's is its key's hex and
  // 32 more, never fewer than 34.
  static readonly prefix = hex(utf8('catalogue'));
  readonly #memory: Memory;
  readonly #pack: Package;
  readonly #held = new Map<string, GitObject>();
  #seal: Promise<Uint8Array> | undefined;

  constructor(memory: Memory, pack: Package) {
    this.#memory = memory;
    this.#pack = pack;
  }

  static occupies(place: string): boolean {
    return place.length === Dna.prefix.length + FAN && place.startsWith(Dna.prefix);
  }

  #key(): Promise<Uint8Array> {
    return (this.#seal ??= this.#pack.derive(['seal', 'dna'], 32));
  }

  async #entry(id: string): Promise<{ place: string; name: string }> {
    const name = hex(await this.#pack.derive(['dna', id], 16));
    return { place: Dna.prefix + name.slice(0, FAN), name };
  }

  async get(id: string): Promise<GitObject | null> {
    const held = this.#held.get(id);
    if (held) return held;
    const { place, name } = await this.#entry(id);
    const bytes = (await this.#memory.read(place)).get(name);
    if (!bytes || bytes.length <= NONCE) return null;
    const open = await decrypt(await this.#key(), bytes.subarray(0, NONCE), utf8(name), bytes.subarray(NONCE));
    if (open === null) return null;
    const o = await inflated(open);
    if ((await idOf(o)) !== id) return null;
    this.#held.set(id, o);
    return o;
  }

  // Every object sealed and written, one keep for each place.
  async put(objects: readonly GitObject[]): Promise<string[]> {
    const ids: string[] = [];
    const places = new Map<string, Map<string, Uint8Array>>();
    const kept = new Map<string, GitObject>();
    for (const o of objects) {
      const id = await idOf(o);
      ids.push(id);
      if (this.#held.has(id) || kept.has(id)) continue;
      const { place, name } = await this.#entry(id);
      const nonce = this.#pack.entropy.draw(NONCE);
      const sealed = concat(nonce, await encrypt(await this.#key(), nonce, utf8(name), await deflated(o)));
      if (!places.has(place)) places.set(place, new Map());
      places.get(place)!.set(name, sealed);
      kept.set(id, o);
    }
    for (const [place, entries] of places) await this.#memory.write(place, entries);
    for (const [id, o] of kept) this.#held.set(id, o);
    return ids;
  }

  async #places(): Promise<string[]> {
    return (await this.#memory.places()).filter((place) => Dna.occupies(place));
  }

  // How many objects are kept.
  async count(): Promise<number> {
    let n = 0;
    for (const place of await this.#places()) n += (await this.#memory.read(place)).size;
    return n;
  }

  // Every object but those `keep` names forgotten, and how many were. The
  // names kept are drawn before any entry is touched, and a place is
  // written with only its forgotten entries, so a cut anywhere loses
  // nothing `keep` names.
  async collect(keep: Iterable<string>): Promise<number> {
    const ids = new Set(keep);
    const names = new Set<string>();
    for (const id of ids) names.add((await this.#entry(id)).name);
    let forgotten = 0;
    for (const place of await this.#places()) {
      const gone = new Map<string, null>();
      for (const name of (await this.#memory.read(place)).keys()) if (!names.has(name)) gone.set(name, null);
      if (gone.size === 0) continue;
      await this.#memory.write(place, gone);
      forgotten += gone.size;
    }
    for (const id of [...this.#held.keys()]) if (!ids.has(id)) this.#held.delete(id);
    return forgotten;
  }
}
