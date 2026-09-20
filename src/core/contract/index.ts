// SPDX-License-Identifier: Apache-2.0
// The contracts: what the onion cannot unpack from cells, a module's code
// among them, each an abstract class, so a registry can tell at run time
// which class fulfils which. The class differs by terrain, and the
// contract does not.
import type { Draw } from '../quo/index.ts';

// Drawn bytes.
export abstract class Entropy {
  abstract draw(length: number): Uint8Array;
  // The same source, as the function `quo/` takes.
  get drawer(): Draw {
    return (length) => this.draw(length);
  }
}

// The moment, and a wait that ends.
export abstract class Clock {
  abstract now(): number;
  // Resolves after `ms`, unless cancelled first.
  abstract wait(ms: number): { done: Promise<void>; cancel(): void };
}

// One ward's partition, as the harbor's package opens it: the rows the
// ward writes into directly, told after every write, and kept once at the
// end of an arrival.
export interface Rows {
  readonly rows: Record<string, unknown>;
  told(row: string): void;
  kept(): Promise<boolean>;
}

// A harbor's memory as a terrain keeps it: sealed entries it cannot read,
// in places, each entry by name. Every name is lowercase hex the kit
// chose, so a body may use it as a file name as it stands.
export abstract class Memory {
  // Every entry kept in a place; a place nothing was kept in is empty.
  abstract read(place: string): Promise<Map<string, Uint8Array>>;
  // One keep, whole: every entry written and every null removed together,
  // or none of them. A read after a keep that did not finish, in this run
  // or in the run before it, holds the place as it was or as the keep
  // leaves it, and never half of each.
  abstract write(place: string, entries: ReadonlyMap<string, Uint8Array | null>): Promise<void>;
  // Every place this memory holds something in, in any order.
  abstract places(): Promise<string[]>;
  // A place and everything in it, gone.
  abstract forget(place: string): Promise<void>;
}

// The harbor's seed: thirty-two bytes, the same every time. It is the one
// secret a terrain holds.
export abstract class Custody {
  abstract seed(): Promise<Uint8Array>;
}

// A module: the code a harbor's classes come from. It declares its own
// name, a reversed domain as a kind is, and its version.
export type Module = { readonly module: string; readonly version: string; readonly classes: readonly unknown[] };

// Bytes become a module. A module's source is one self-contained ES
// module that imports nothing but `'nervur'`, and `id` is the git id of
// its blob, the one name a bundle finds it by. What does not load throws,
// saying why. How code runs differs by ground, an import of a data: URL,
// of a Blob URL, or a lookup in the bundle an edge was deployed with, so
// the loader is the one body beside the seed a terrain hands in that code
// passes through.
export abstract class Loader {
  abstract load(source: string, id: string): Promise<Module>;
}

// A module a bundle carries: its source, whose blob's id names it, and the
// module the bundler built from that source.
export type Bundled = { readonly source: string; readonly module: Module };

export { bindKit, linked, moduleOf } from './link.ts';

// Bytes to a ward pk in; bytes, or null for nothing, out. A harbor hands a
// terrain's carrier what it holds no route for; what it routes goes to its
// carrier faculties.
export abstract class Carrier {
  abstract carry(pk: string, bytes: Uint8Array): Promise<Uint8Array | null>;
}
