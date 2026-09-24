// SPDX-License-Identifier: Apache-2.0
// What an edge's bodies take of a Durable Object: its storage, as the
// platform gives it. The library names the few members it calls and no
// more, so it carries no platform's types and runs on any engine that
// hands it these.
import type { Store } from '../bodies/kept.ts';

/** A transaction on Durable Object storage: every write in it lands together, or none. */
export interface DurableTransaction {
  get(key: string): Promise<unknown>;
  put(entries: Record<string, unknown>): Promise<void>;
  delete(keys: string[]): Promise<number>;
}

/** A Durable Object's storage: `ctx.storage` in a Worker. */
export interface DurableStorage extends DurableTransaction {
  list(options: { prefix: string }): Promise<Map<string, unknown>>;
  transaction<T>(closure: (transaction: DurableTransaction) => Promise<T>): Promise<T>;
  getAlarm(): Promise<number | null>;
  setAlarm(at: number): Promise<void>;
}

const BATCH = 128;

/** A store of text over Durable Object storage, whose swap is one transaction. */
export const durableStore = (storage: DurableStorage): Store => ({
  get: async (key) => {
    const value = await storage.get(key);
    return typeof value === 'string' ? value : null;
  },
  keys: async (prefix) => [...(await storage.list({ prefix })).keys()],
  swap: (writes, expect) =>
    storage.transaction(async (transaction) => {
      for (const [key, value] of Object.entries(expect)) {
        const held = await transaction.get(key);
        if ((typeof held === 'string' ? held : null) !== value) return false;
      }
      const put = Object.entries(writes).filter((entry): entry is [string, string] => entry[1] !== null);
      const gone = Object.entries(writes).flatMap(([key, value]) => (value === null ? [key] : []));
      // The platform takes at most this many keys in one call; the transaction still lands them together.
      for (let at = 0; at < put.length; at += BATCH) await transaction.put(Object.fromEntries(put.slice(at, at + BATCH)));
      for (let at = 0; at < gone.length; at += BATCH) await transaction.delete(gone.slice(at, at + BATCH));
      return true;
    }),
});
