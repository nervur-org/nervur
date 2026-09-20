// SPDX-License-Identifier: Apache-2.0
// One being's stance: her cells, the ids she invited, the relations she
// holds, and boot. A relation on another ward speaks through `quo/`'s
// standing, one on her own ward straight to her ward, each one send at a
// time, inside her allowance.
import { readValue, writeValue } from '../crypto/index.ts';
import { readInvitation, Standing as Wire, freshStanding, type Door, type Draw, type Invitation, type Read } from '../quo/index.ts';
import type { Clock } from '../contract/index.ts';
import { OWNER, ownKind, silence, word, type Answer, type JsonObject, type Occupants, type Stance, type Standing, type Standings, type Wanted } from '../being/index.ts';
import { allow, Bell, LATE } from './allowance.ts';
import type { BeingRow, Partition } from './partition.ts';
import { Cells, DEPTH } from './cells.ts';

export { DEPTH };

// What a stance needs from its ward.
export interface Inside {
  readonly partition: Partition;
  readonly door: Door;
  readonly draw: Draw;
  readonly clock: Clock;
  readonly pk: string;
  live(key: string, row: BeingRow): boolean;
  send(pk: string, bytes: Uint8Array): Promise<Uint8Array | null>;
  // A relation whose both ends are this ward's, taken or asked with no seal.
  within(heir: string, take: boolean, method?: string, args?: string): Promise<Read>;
  boot(maker: string, className: string, key: string, id?: string): Promise<string | null>;
  // An offer from the faculty the dock opened for a contract, and its
  // retraction when the offer was not taken.
  offer(contract: string): Promise<Invitation | null>;
  retract(contract: string, heir: string): Promise<void>;
  // Where this ward is reached, for the invitations it gives, and where a
  // ward it takes an invitation of is reached, learned from that `at`.
  reach(): readonly string[];
  learn(ward: string, at: readonly string[]): Promise<void>;
}

const RESERVED = new Set([OWNER]);

// How many times a take asks again after its knock brought no object.
const TAKES = 2;

// One relation, one send at a time.
class Lanes {
  readonly #tails = new Map<string, Promise<unknown>>();
  run<T>(name: string, work: () => Promise<T>): Promise<T> {
    const mine = (this.#tails.get(name) ?? Promise.resolve()).then(work, work);
    const tail = mine.catch(() => {});
    this.#tails.set(name, tail);
    void tail.then(() => {
      if (this.#tails.get(name) === tail) this.#tails.delete(name);
    });
    return mine;
  }
}

const answerOf = (read: Read): Answer => {
  if ('nothing' in read) return word('unreached');
  if ('silence' in read) return silence;
  if ('quo' in read) return word(read.quo);
  return readValue(read.object, DEPTH) ?? silence;
};

export class HouseStance implements Stance {
  readonly key: string;
  readonly occupants: Occupants;
  readonly standings: Standings;
  readonly #inside: Inside;
  readonly #row: BeingRow;
  readonly #lanes = new Lanes();
  readonly #cells = new Cells(() => this.#told());

  // `carries` is what every stance of the house holds beside her own, for
  // the class born of it.
  constructor(inside: Inside, key: string, row: BeingRow, carries: Readonly<Record<string, unknown>> = {}) {
    Object.assign(this, carries);
    this.key = key;
    this.#inside = inside;
    this.#row = row;
    this.occupants = {
      invite: (id, notes) => this.#invite(id, notes),
      notes: (id) => (Object.hasOwn(row.occupants, id) ? row.occupants[id]!.notes : undefined),
      ids: () => Object.keys(row.occupants),
      remove: (id) => this.#removeOccupant(id),
    };
    this.standings = {
      take: (id, invitation) => this.#take(id, invitation),
      get: (id) => this.#standing(id),
      ids: () => Object.keys(row.standings),
      remove: (id) => this.#removeStanding(id),
    };
  }

  get cells(): JsonObject {
    return this.#cells.guard(this.#row.cells);
  }

  get #live(): boolean {
    return this.#inside.live(this.key, this.#row);
  }

  boot(kind: string, key: string, id?: string): Promise<string | null> {
    return this.#live ? this.#inside.boot(this.key, kind, key, id) : Promise.resolve(null);
  }

  async lend(contract: abstract new (...args: never[]) => unknown, id: string): Promise<string | null> {
    const kind = ownKind(contract);
    if (kind === undefined || !this.#free(id, this.#row.standings)) return null;
    const invitation = await this.#inside.offer(kind);
    if (invitation === null) return null;
    const taken = await this.#take(id, invitation);
    if (taken === null) await this.#inside.retract(kind, invitation.heir);
    return taken;
  }

  #free(id: string, of: Record<string, unknown>): boolean {
    return this.#live && typeof id === 'string' && !RESERVED.has(id) && !Object.hasOwn(of, id);
  }

  async #invite(id: string, notes: JsonObject = {}): Promise<Invitation | null> {
    const kept = writeValue(notes, DEPTH);
    if (!this.#free(id, this.#row.occupants) || kept === undefined) return null;
    const { heir, invitation } = await this.#inside.door.invite(this.#inside.reach());
    if (!this.#free(id, this.#row.occupants)) {
      this.#inside.door.remove(heir);
      return null;
    }
    this.#row.occupants[id] = { heir, notes: JSON.parse(kept) as JsonObject };
    this.#inside.partition.head.bind[heir] = { being: this.key, id };
    this.#told();
    this.#inside.partition.toldHead();
    return invitation;
  }

  #removeOccupant(id: string): boolean {
    if (!this.#live || !Object.hasOwn(this.#row.occupants, id)) return false;
    const { heir } = this.#row.occupants[id]!;
    this.#inside.door.remove(heir);
    delete this.#row.occupants[id];
    delete this.#inside.partition.head.bind[heir];
    this.#told();
    this.#inside.partition.toldHead();
    return true;
  }

  async #take(id: string, value: Invitation): Promise<string | null> {
    const invitation = readInvitation(value);
    if (!invitation || !this.#free(id, this.#row.standings)) return null;
    if (invitation.at) await this.#inside.learn(invitation.ward, invitation.at);
    const wire = new Wire(invitation, freshStanding(), this.#inside.draw);
    const read = await this.#lanes.run(`take:${id}`, async () => {
      if (invitation.ward === this.#inside.pk) return this.#inside.within(invitation.heir, true);
      // A knock that brought nothing back may have bound: the standing asks
      // under its own key, then knocks again as the same bytes.
      let out = await this.#send(wire);
      for (let tries = 0; tries < TAKES && ('nothing' in out || 'silence' in out); tries += 1) out = await this.#send(wire);
      return out;
    });
    if (!('object' in read) || !this.#free(id, this.#row.standings)) return null;
    this.#row.standings[id] = { invitation, state: wire.state, seen: read.seen };
    this.#told();
    return id;
  }

  #removeStanding(id: string): boolean {
    if (!this.#live || !Object.hasOwn(this.#row.standings, id)) return false;
    delete this.#row.standings[id];
    this.#told();
    return true;
  }

  #standing(id: string): Standing | undefined {
    if (!Object.hasOwn(this.#row.standings, id)) return undefined;
    return { id, ask: (method, args, wanted) => this.#ask(id, method, args, wanted) };
  }

  async #ask(id: string, method: unknown, args: JsonObject = {}, wanted?: Wanted): Promise<Answer> {
    const text = writeValue(args, DEPTH + 1);
    if ((method !== undefined && typeof method !== 'string') || text === undefined || Array.isArray(args)) return word('unreached');
    const bell = new Bell(this.#inside.clock, allow(wanted));
    try {
      const out = await bell.race(
        this.#lanes.run(`ask:${id}`, async (): Promise<Answer> => {
          const row = Object.hasOwn(this.#row.standings, id) ? this.#row.standings[id] : undefined;
          if (!this.#live || row === undefined) return word('dropped');
          if (bell.rang) return word('late');
          // A relation inside this ward speaks with no seal, any other
          // through the far ward's door.
          const inside = row.invitation.ward === this.#inside.pk;
          const wire = inside ? null : new Wire(row.invitation, row.state, this.#inside.draw);
          const read = await bell.race(wire ? this.#send(wire, method as string | undefined, text) : this.#inside.within(row.invitation.heir, false, method as string | undefined, text));
          if (wire) row.state = wire.state;
          if (read === LATE) return word('late');
          if ('object' in read) row.seen = read.seen;
          this.#told();
          await this.#inside.partition.kept();
          return answerOf(read);
        }),
      );
      return out === LATE ? word('late') : out;
    } finally {
      bell.cancel();
    }
  }

  async #send(wire: Wire, method?: string, args?: string): Promise<Read> {
    const sent = await wire.ask(method, args);
    if (!sent) return { nothing: true };
    return wire.read(sent, await this.#inside.send(wire.invitation.ward, sent.bytes));
  }

  #told(): void {
    this.#inside.partition.told(this.key);
  }
}
