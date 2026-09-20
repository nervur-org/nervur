// SPDX-License-Identifier: Apache-2.0
// A faculty: a being of the box ward that fulfils a contract. A contract is
// a class between `Faculty` and the class that stands, usually abstract:
//
//   abstract class Timer extends Faculty {           the contract
//     static override kind = 'com.acme.timer' }
//   class IntervalTimer extends Timer {              one class that fulfils it
//     static override kind = 'com.acme.interval-timer' }
//
// A being lends by the contract's kind and never learns the class. Every
// class between the faculty and `Faculty` is a contract and declares its
// own kind, and a faculty fulfils each of them and her own. Two asks are the
// faculty's own and answered to the ward that opened her alone:
// `offer`, an invitation on herself for a ward the dock vouches for, and
// `retract`, an offer that was not taken.
import { Being } from './being.ts';
import { kindOf, ships } from './kind.ts';
import { WARD, type Asker, type Blueprint, type JsonObject, type Reply } from './types.ts';

export class Faculty extends Being {
  static override readonly kind: string = 'org.nervur.faculty';
  static {
    ships(this);
  }

  // The contracts a class fulfils: itself and every class between it and
  // `Faculty`, by kind. A class among them with no kind of its own throws.
  static contracts(C: abstract new (...args: never[]) => unknown): string[] {
    const kinds: string[] = [];
    for (let c: unknown = C; typeof c === 'function' && c !== Faculty; c = Object.getPrototypeOf(c)) kinds.push(kindOf(c));
    return kinds;
  }

  static fulfils(C: unknown): C is typeof Faculty {
    return typeof C === 'function' && C.prototype instanceof Faculty;
  }

  #open(): Record<string, string> {
    if (this.cells.offers === undefined) this.cells.offers = {};
    return this.cells.offers as Record<string, string>;
  }

  async #offer(): Promise<JsonObject> {
    const n = ((this.cells.offered as number | undefined) ?? 0) + 1;
    this.cells.offered = n;
    const id = `lent:${n}`;
    const invitation = await this.stance.occupants.invite(id);
    if (invitation === null) return { error: 'not invited' };
    this.#open()[invitation.heir] = id;
    return { invitation };
  }

  #retract(args: JsonObject): JsonObject {
    const open = this.#open();
    const id = typeof args.heir === 'string' && Object.hasOwn(open, args.heir) ? open[args.heir] : undefined;
    if (id === undefined) return { retracted: null };
    this.stance.occupants.remove(id);
    delete open[args.heir as string];
    return { retracted: id };
  }

  override describe(asker: Asker): Blueprint {
    const blueprint = super.describe(asker);
    if (asker.id !== WARD) return blueprint;
    return { ...blueprint, asks: [...blueprint.asks, { name: 'offer', input: { type: 'object' } }, { name: 'retract', input: { type: 'object', required: ['heir'] } }] };
  }

  // An offer is closed by the first word from the occupant it was made for.
  override answer(asker: Asker, method: string | undefined, args: JsonObject): Promise<Reply> {
    if (asker.id === WARD && method === 'offer') return this.#offer();
    if (asker.id === WARD && method === 'retract') return Promise.resolve(this.#retract(args));
    const open = this.#open();
    for (const [heir, id] of Object.entries(open)) if (id === asker.id) delete open[heir];
    return super.answer(asker, method, args);
  }
}
