// SPDX-License-Identifier: Apache-2.0
// Memory in the process: places in a map, each with a version that moves
// on every write that touches it.
import type { Memory, PlaceRead } from '../foundation.ts';

interface Place {
  readonly entries: Map<string, Uint8Array>;
  version: number;
}

export class FakeMemory implements Memory {
  readonly #places = new Map<string, Place>();
  #refuse = 0;

  /** The next `count` writes are refused, as a memory another writer moved. */
  refuseNext(count = 1): void {
    this.#refuse += count;
  }

  async read({ place }: { place: string }): Promise<PlaceRead> {
    const held = this.#places.get(place);
    if (held === undefined) return { entries: {}, version: null };
    return { entries: Object.fromEntries([...held.entries].map(([name, bytes]) => [name, bytes.slice()])), version: String(held.version) };
  }

  async list(): Promise<readonly string[]> {
    return [...this.#places.keys()];
  }

  async write({
    writes,
    expect,
  }: {
    writes: Readonly<Record<string, Readonly<Record<string, Uint8Array | null>>>>;
    expect: Readonly<Record<string, string | null>>;
  }): Promise<Readonly<Record<string, string | null>> | null> {
    if (this.#refuse > 0) {
      this.#refuse--;
      return null;
    }
    for (const place of new Set([...Object.keys(writes), ...Object.keys(expect)])) {
      const held = this.#places.get(place);
      const version = held === undefined ? null : String(held.version);
      if (!(place in expect) || expect[place] !== version) return null;
    }
    const versions: Record<string, string | null> = {};
    for (const [place, entries] of Object.entries(writes)) {
      const held = this.#places.get(place) ?? { entries: new Map<string, Uint8Array>(), version: 0 };
      for (const [name, bytes] of Object.entries(entries)) {
        if (bytes === null) held.entries.delete(name);
        else held.entries.set(name, bytes.slice());
      }
      held.version++;
      if (held.entries.size === 0) this.#places.delete(place);
      else this.#places.set(place, held);
      versions[place] = held.entries.size === 0 ? null : String(held.version);
    }
    return versions;
  }
}
