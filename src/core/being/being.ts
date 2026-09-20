// SPDX-License-Identifier: Apache-2.0
// The base class most beings extend. It writes `answer`: the empty ask is
// her blueprint for this asker, a named ask calls her method of that name,
// and an ask she did not declare, or hides from this asker, is an error
// object. A class that writes `answer` by hand is a being just the same.
// What she acts through is `this.stance`.
import { ships } from './kind.ts';
import type { Ask, Asker, Blueprint, JsonObject, Reply, Schema, Stance } from './types.ts';

// One declared ask. `for` decides whether this asker sees it, and so
// whether this asker may call it.
export type AskSpec = {
  readonly description?: string;
  readonly input?: Schema;
  readonly for?: (asker: Asker, notes: JsonObject | undefined) => boolean;
};

// Names a subclass may not declare as an ask, because they are the base's.
const RESERVED = new Set(['answer', 'describe', 'stance', 'cells', 'notes', 'constructor']);

// Whether she wrote a method of that name, below Object's prototype.
const wrote = (self: object, name: string): boolean => {
  for (let p = Object.getPrototypeOf(self); p !== null && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
    if (Object.hasOwn(p, name)) return typeof (p as Record<string, unknown>)[name] === 'function';
  }
  return false;
};

type Method = (args: JsonObject, asker: Asker) => Reply | Promise<Reply>;

// A subclass's statics replace its parent's and never merge: her blueprint
// is what the class in front of you declares, in its order. Her kind is
// never inherited: see `kind.ts`.
export class Being {
  // The name her row keeps for this class. Every class that stands declares
  // its own.
  static readonly kind: string = 'org.nervur.being';
  static {
    ships(this);
  }
  // Her cells' defaults, written at birth only where a key is missing.
  static cells: JsonObject = {};
  static asks: Record<string, AskSpec> = {};

  readonly stance: Stance;

  constructor(stance: Stance) {
    this.stance = stance;
    const C = this.constructor as typeof Being;
    for (const name of Object.keys(C.asks)) {
      if (RESERVED.has(name)) throw new Error(`ask '${name}' is a reserved name`);
      if (!wrote(this, name)) throw new Error(`ask '${name}' has no method`);
    }
    for (const [k, v] of Object.entries(C.cells)) if (!Object.hasOwn(stance.cells, k)) stance.cells[k] = structuredClone(v);
  }

  get cells(): JsonObject {
    return this.stance.cells;
  }

  // The notes she invited this asker under.
  notes(asker: Asker): JsonObject | undefined {
    return asker.id === undefined ? undefined : this.stance.occupants.notes(asker.id);
  }

  describe(asker: Asker): Blueprint {
    const C = this.constructor as typeof Being;
    const notes = this.notes(asker);
    const asks: Ask[] = [];
    for (const [name, spec] of Object.entries(C.asks)) {
      if (spec.for && !spec.for(asker, notes)) continue;
      asks.push({ name, ...(spec.description === undefined ? {} : { description: spec.description }), input: spec.input ?? { type: 'object' } });
    }
    return { asks, notes: {} };
  }

  async answer(asker: Asker, method: string | undefined, args: JsonObject): Promise<Reply> {
    if (method === undefined) return this.describe(asker);
    const C = this.constructor as typeof Being;
    const spec = Object.hasOwn(C.asks, method) ? C.asks[method] : undefined;
    if (!spec || (spec.for && !spec.for(asker, this.notes(asker)))) return { error: 'unknown ask' };
    return ((this as unknown as Record<string, Method>)[method] as Method).call(this, args, asker);
  }
}
