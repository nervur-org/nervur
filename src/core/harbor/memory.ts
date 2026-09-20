// SPDX-License-Identifier: Apache-2.0
// The memory faculty: a faculty that keeps a hosted ward's place, where the
// root memory does not. It makes the same promise the Memory body makes,
// lent once the dock stands: sealed entries in places, each keep whole or
// not at all. The box ward never moves off the root memory, since the
// memory faculty itself stands from the box ward's cells.
//
// A ward is the unit a memory faculty holds: its head, its ward and every
// being of it are one place and one keep, so an answer's cells and the
// door's keys move together, whichever memory faculty keeps them. A memory
// faculty of a disk, a cloud, a database or a ledger is a class fulfilling
// `org.nervur.memory`.
import { Faculty, ships } from '../being/index.ts';

export const MEMORY = 'org.nervur.memory';

export abstract class MemoryFaculty extends Faculty {
  static override readonly kind: string = MEMORY;
  static {
    ships(this);
  }
  abstract read(place: string): Promise<Map<string, Uint8Array>>;
  abstract write(place: string, entries: ReadonlyMap<string, Uint8Array | null>): Promise<void>;
  abstract places(): Promise<string[]>;
  abstract forget(place: string): Promise<void>;
  // Whether a place of the root memory is this memory faculty's own, so the root's
  // sweep leaves it.
  occupies(_place: string): boolean {
    return false;
  }
}
