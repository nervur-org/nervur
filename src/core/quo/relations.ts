// SPDX-License-Identifier: Apache-2.0
// What a door keeps: its lock, and for each heir it holds the keys and the
// count of the spec's relation chapter. Keys are written as hex, so a record
// is a value any memory can keep.
import type { Lock } from '../crypto/index.ts';
import { hex, unhex } from '../crypto/index.ts';

export type Keys = { readonly held: string; readonly vouched: string | null; readonly open: string; readonly offered: string };

export type HeirRecord =
  | { readonly state: 'fresh' }
  | ({ readonly state: 'spent'; readonly highest: number; readonly honoured: readonly number[] } & Keys)
  | ({ readonly state: 'kept' } & Keys);

export type KeptLock = { readonly ek: string; readonly dk: string };

// The door's memory. A ward stands it on its partition; `MemoryRelations`
// is the one that lives in an object.
export interface Relations {
  lock(): Lock | undefined;
  setLock(lock: Lock): void;
  get(heir: string): HeirRecord | undefined;
  set(heir: string, record: HeirRecord): void;
  delete(heir: string): void;
  // Whether what was written during an arrival is kept, asked once before
  // the reply is sealed.
  kept(): Promise<boolean>;
}

export const lockOf = (kept: KeptLock | undefined): Lock | undefined => (kept ? { ek: unhex(kept.ek), dk: unhex(kept.dk) } : undefined);
export const keptLock = (lock: Lock): KeptLock => ({ ek: hex(lock.ek), dk: hex(lock.dk) });

// A bound on the kept records of removed relations, oldest out.
export const GONE = 256;

export class MemoryRelations implements Relations {
  #lock: KeptLock | undefined;
  readonly #heirs = new Map<string, HeirRecord>();
  readonly #gone: string[] = [];

  lock(): Lock | undefined {
    return lockOf(this.#lock);
  }
  setLock(lock: Lock): void {
    this.#lock = keptLock(lock);
  }
  get(heir: string): HeirRecord | undefined {
    return this.#heirs.get(heir);
  }
  set(heir: string, record: HeirRecord): void {
    this.#heirs.set(heir, record);
    if (record.state !== 'kept') return;
    this.#gone.push(heir);
    while (this.#gone.length > GONE) this.#heirs.delete(this.#gone.shift()!);
  }
  delete(heir: string): void {
    this.#heirs.delete(heir);
  }
  kept(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
