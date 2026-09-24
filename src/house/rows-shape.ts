// SPDX-License-Identifier: Apache-2.0
// The shapes of the house's rows, as JSON.
import type { Json, Notes } from '../being/being.ts';
import type { Occupant as QuoOccupant, Standing as QuoStanding } from '../quo/index.ts';

/** A JSON value copied, as every row and cell is JSON. */
export const copy = <T>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T));

export type Answer = { readonly result: Json } | { readonly error: { readonly message: string } };

/**
 * The ward's own place: the bound, and the index of its beings. Only the
 * steward writes it, so no other being's write waits on it.
 */
export interface WardRow {
  bound: string;
  beings: Record<string, { kind: string }>;
}

/**
 * An heir's place, or a token's, one a place: whose occupant it reaches. A
 * mint writes a place of its own, so no two beings' mints meet.
 */
export interface OwnerRow {
  being: string;
  occupant: string;
  /** A token's: the blueprint of the faculty it was handed to, which alone calls it. */
  faculty?: string;
}

export interface OccupantRow {
  notes: Notes;
  steward: Notes;
  /** A handle: the one ask it is admitted to. */
  ask?: string;
  bind?: Json;
  once?: boolean;
  /** The heirs minted for it, each the door's end of a relation. */
  quo?: Record<string, QuoOccupant>;
  /** The addresses each heir's holder last heard, in its invitation or in a reply. */
  told?: Record<string, readonly string[]>;
  /** Each heir still unspent that has a time, and the time after which it never binds. */
  until?: Record<string, number>;
  /** The tokens minted for it, which faculties call. */
  tokens?: string[];
}

export interface StandingRow {
  notes: Notes;
  steward: Notes;
  /** A standing on a being of this house, bound at once. */
  local?: { being: string; occupant: string };
  /** A standing on a far ward. */
  quo?: QuoStanding;
  /** The address of hers that last answered: where each ask goes first. */
  route?: string;
  /** The domains that vouch for a far standing's ward, read once its take landed and again when it moves. */
  vouched?: string[];
}

/** Where an effect goes. */
export type Target = { need: string } | { standing: string } | { being: string };

export interface OutboxEntry {
  id: string;
  to: Target;
  method: string;
  args: Json;
  reply?: string;
  /** A watch: the digest of the answer she holds, and how long the far side may hold it. */
  after?: string;
  wait?: number;
  queued: number;
  deadline: number;
  next: number;
  tries: number;
}

export interface DeadLetter {
  ask: string;
  args: Json;
  at: number;
  why: string;
}

export interface BeingRow {
  kind: string;
  cells: Record<string, Json>;
  /** The args of her `born`, until it has run. */
  born?: Json;
  occupants: Record<string, OccupantRow>;
  standings: Record<string, StandingRow>;
  outbox: OutboxEntry[];
  alarms: Record<string, { at: number; ask: string; args: Json }>;
  dead: DeadLetter[];
  calls: Record<string, { answer: Answer; at: number }>;
}

export const emptyRow = (kind: string, cells: Record<string, Json>): BeingRow => ({
  kind,
  cells,
  occupants: {},
  standings: {},
  outbox: [],
  alarms: {},
  dead: [],
  calls: {},
});
