// SPDX-License-Identifier: Apache-2.0
// Everything a being author holds, as types.
import type { Json } from '../crypto/index.ts';
import type { Invitation } from '../quo/index.ts';
import type { Silence, Word } from './words.ts';

export type { Invitation, Json };
export type JsonObject = { [key: string]: Json };

// Who is at the door: the id she filed the occupant under, `{}` for nobody,
// and `{ id: OWNER }` for whoever holds the ward's unsealed ask.
export type Asker = { readonly id: string } | { readonly id?: undefined };
export const OWNER = 'OWNER';

// The ward's key in her house, and so the id every being she makes
// knows her by.
export const WARD = 'ward';

// What comes back from an ask, and what a being answers.
export type Answer = Json | Silence | Word;
export type Reply = Json | Silence | undefined;

export type Wanted = { readonly time?: number };

// A blueprint: the asks a being can be asked, as an MCP tool list, and notes.
export type Schema = JsonObject;
export type Ask = { name: string; description?: string; input: Schema };
export type Blueprint = { asks: Ask[]; notes: Json };

export interface Standing {
  readonly id: string;
  ask(method?: string, args?: JsonObject, wanted?: Wanted): Promise<Answer>;
}

// Her side of the relations she holds.
export interface Standings {
  // Knocks with the empty ask and holds the relation under `id`: the id, or
  // null where the id is taken or reserved, or no object came back.
  take(id: string, invitation: Invitation): Promise<string | null>;
  get(id: string): Standing | undefined;
  ids(): string[];
  remove(id: string): boolean;
}

// The door's side: the ids she invited.
export interface Occupants {
  invite(id: string, notes?: JsonObject): Promise<Invitation | null>;
  notes(id: string): JsonObject | undefined;
  ids(): string[];
  remove(id: string): boolean;
}

// What every being is handed at birth.
export interface Stance {
  readonly key: string;
  readonly cells: JsonObject;
  readonly occupants: Occupants;
  readonly standings: Standings;
  // A new being of her ward, by kind, under a key she chooses. With an id,
  // the new being invites her under her key, and she takes it under id.
  boot(kind: string, key: string, id?: string): Promise<string | null>;
  // A standing under `id` at the faculty this harbor opened for a contract:
  // the id, or null where none is open, the contract declares no kind of
  // its own, or the relation was refused.
  lend(contract: abstract new (...args: never[]) => unknown, id: string): Promise<string | null>;
}

// Anything with `answer` is a being.
export interface BeingLike {
  answer(asker: Asker, method: string | undefined, args: JsonObject): Reply | Promise<Reply>;
  describe?(asker: Asker): Blueprint;
}
// A class that stands. Its kind is its own, as `kind.ts` says.
export type BeingClass = (new (stance: Stance) => BeingLike) & { readonly name: string; readonly kind: string };
