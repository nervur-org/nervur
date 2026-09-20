// SPDX-License-Identifier: Apache-2.0
// The partition: everything one ward keeps, as rows of values in the memory
// its terrain opened for it.
//
//   rows.ward           the door's lock, heirs and gone, which being and id
//                       each heir belongs to and whether a being of this
//                       ward took it, and the public being
//   rows.beings[key]    one being: her class and the registry it resolves
//                       through, cells, occupants and standings
//
// The ward writes into the rows directly and tells the memory which row it
// wrote: the head as the empty name, which no being's key is, or the
// being's key.
import type { Lock } from '../crypto/index.ts';
import { GONE, keptLock, lockOf, type HeirRecord, type Invitation, type KeptLock, type Relations, type StandingState } from '../quo/index.ts';
import type { Rows } from '../contract/index.ts';
import type { JsonObject } from '../being/index.ts';

export const HEAD_ROW = '';

export type Head = {
  lock?: KeptLock;
  heirs: Record<string, HeirRecord>;
  gone: string[];
  // `inside` where a being of this ward took the heir: its relation lives
  // here alone and no door holds it.
  bind: Record<string, { being: string; id: string; inside?: true }>;
  public: string | null;
};

export type StandingRow = { invitation: Invitation; state: StandingState; seen: string | null };
export type BeingRow = {
  class: string;
  // The key of the box ward's registry faculty her class resolves through,
  // where it is not the catalogue.
  registry?: string;
  cells: JsonObject;
  occupants: Record<string, { heir: string; notes: JsonObject }>;
  standings: Record<string, StandingRow>;
};

export class Partition {
  readonly memory: Rows;

  constructor(memory: Rows) {
    this.memory = memory;
    const rows = memory.rows as { ward?: Head; beings?: Record<string, BeingRow> };
    rows.ward ??= { heirs: {}, gone: [], bind: {}, public: null };
    rows.beings ??= {};
  }

  get head(): Head {
    return this.memory.rows.ward as Head;
  }

  get beings(): Record<string, BeingRow> {
    return this.memory.rows.beings as Record<string, BeingRow>;
  }

  being(key: string): BeingRow | undefined {
    return Object.hasOwn(this.beings, key) ? this.beings[key] : undefined;
  }

  told(key: string): void {
    this.memory.told(key);
  }

  toldHead(): void {
    this.memory.told(HEAD_ROW);
  }

  kept(): Promise<boolean> {
    return this.memory.kept().catch(() => false);
  }
}

// The door's memory, written into the head.
export class PartitionRelations implements Relations {
  readonly #partition: Partition;

  constructor(partition: Partition) {
    this.#partition = partition;
  }

  get #head(): Head {
    return this.#partition.head;
  }

  lock(): Lock | undefined {
    return lockOf(this.#head.lock);
  }

  setLock(lock: Lock): void {
    this.#head.lock = keptLock(lock);
    this.#partition.toldHead();
  }

  get(heir: string): HeirRecord | undefined {
    return Object.hasOwn(this.#head.heirs, heir) ? this.#head.heirs[heir] : undefined;
  }

  set(heir: string, record: HeirRecord): void {
    const head = this.#head;
    head.heirs[heir] = record;
    if (record.state === 'kept') {
      head.gone.push(heir);
      while (head.gone.length > GONE) delete head.heirs[head.gone.shift()!];
    }
    this.#partition.toldHead();
  }

  delete(heir: string): void {
    delete this.#head.heirs[heir];
    this.#partition.toldHead();
  }

  kept(): Promise<boolean> {
    return this.#partition.kept();
  }
}
