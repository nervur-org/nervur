// SPDX-License-Identifier: Apache-2.0
// The house: the plumbing behind Quo's door. It keeps Quo's ward, its seed
// and keys, one door, one partition and its head, and the beings behind the
// door. It unpacks from its seed, its memory and the classes it resolves
// kinds through, and stands what is behind its door for `quo/`. It brings
// no being to life on its own: whoever unpacks it stands its ward. In the
// box ward the dock stands each faculty, and it stands from then on. In
// every other ward a being is born from her row when an ask reaches her,
// once for every ask in flight on her, and is dropped when the last one
// ends: her cells, occupants and standings are her ward's rows, kept by
// the ward's memory, so nothing of her lives between asks. No author sees
// or extends it.
import { readValue, writeValue } from '../crypto/index.ts';
import { Door, readInvitation, WardKey, type Behind, type Choice, type Invitation, type Payload } from '../quo/index.ts';
import type { Carrier, Clock, Entropy, Rows } from '../contract/index.ts';
import { digest, Faculty, isSilence, isWord, OWNER, ownKind, silence, WARD, word, type Answer, type Asker, type BeingClass, type BeingLike, type JsonObject, type Reply } from '../being/index.ts';
import { Partition, PartitionRelations, type BeingRow } from './partition.ts';
import { DEPTH, HouseStance, type Inside } from './stance.ts';
import { Ward, type Steward, type WardStance } from './ward.ts';

// Where a house finds a class by the kind a row keeps, through the registry
// the row names, or the house's own where it names none.
export interface Classes {
  classOf(kind: string, registry?: string): BeingClass | undefined;
}

export type HouseParts = {
  readonly seed: Uint8Array | string;
  readonly memory: Rows;
  readonly classes: Classes;
  readonly entropy: Entropy;
  readonly clock: Clock;
  readonly carrier: Carrier;
  // Which classes may be this house's ward, and the kind she takes at
  // genesis.
  readonly ward: WardClass;
  // What every stance of this house carries, for the classes born of it:
  // the box ward's carries its harbor as `ground`.
  readonly carries?: Readonly<Record<string, unknown>>;
  // An invitation on the dock, taken by the ward under `dock` when
  // she holds no such standing yet.
  readonly dock?: Invitation;
  // Where the ward is reached, and where a ward it takes an invitation of
  // is reached. A ward alone is reached nowhere and learns nothing.
  readonly routes?: Routes;
  // Whether its beings stand once stood, as the box ward's faculties do.
  // Where not, each is born for the asks that reach her.
  readonly stands?: boolean;
};

export interface Routes {
  reach(): readonly string[];
  learn(ward: string, at: readonly string[]): Promise<void>;
}

// The ward's class, as the WARD row's kind names it through the classes:
// the kind an empty row takes at genesis, the contract a class must fulfil
// here, and the class that stands while the row's kind does not resolve.
// With no fallback, a ward whose kind does not resolve does not unpack.
export type WardClass = {
  readonly genesis: string;
  readonly contract: string;
  fits(C: BeingClass): boolean;
  readonly fallback?: BeingClass;
};

// The standing every hosted ward holds on the dock.
export const DOCK = 'dock';

// A ward that lends to her own ward's beings, as the dock does.
export interface Lender {
  offer(contract: string): Promise<Invitation | null>;
  withdraw(contract: string, heir: string): Promise<void>;
}
const lends = (being: unknown): being is Lender => typeof (being as Partial<Lender>).offer === 'function';

type Birth = 'booted' | 'key taken' | 'no such class' | 'threw at birth';
type Resident = { being: BeingLike; row: BeingRow; stance: HouseStance };
// A being born for the asks in flight on her, and how many there are.
type Visit = Resident & { asks: number };

class RootStance extends HouseStance implements WardStance {
  readonly steward: Steward;
  constructor(inside: Inside, row: BeingRow, steward: Steward, carries: Readonly<Record<string, unknown>>) {
    super(inside, WARD, row, carries);
    this.steward = steward;
  }
}

export class House implements Behind, Inside {
  readonly key: WardKey;
  readonly partition: Partition;
  readonly door: Door;
  readonly clock: Clock;
  readonly #parts: HouseParts;
  readonly #residents = new Map<string, Resident>();
  readonly #visits = new Map<string, Visit>();
  readonly #birthing = new Set<string>();
  #fault: string | null = null;

  private constructor(parts: HouseParts, key: WardKey) {
    this.#parts = parts;
    this.key = key;
    this.clock = parts.clock;
    this.partition = new Partition(parts.memory);
    this.door = new Door(key, new PartitionRelations(this.partition), this, parts.entropy.drawer);
  }

  // The house of a seed and its memory, its ward's row written with the
  // genesis kind where the row is new. No being stands yet.
  static async unpack(parts: HouseParts): Promise<House> {
    const ward = new House(parts, await WardKey.from(parts.seed));
    if (!ward.partition.being(WARD)) {
      ward.partition.beings[WARD] = { class: ward.#class.genesis, cells: {}, occupants: {}, standings: {} };
      ward.partition.told(WARD);
      ward.partition.toldHead();
    }
    return ward;
  }

  // The ward, of the class her row's kind resolves. A ward class that does
  // not resolve or fits no ward here stands the fallback, with why, or the
  // ward does not stand and this throws. The ward stands once.
  async standWard(): Promise<void> {
    if (this.#residents.has(WARD)) return;
    const own = this.partition.being(WARD)!;
    const stance = new RootStance(this, own, this.#steward, this.#parts.carries ?? {});
    const found = this.#wardOf(own.class, own.registry);
    let being: BeingLike | undefined;
    if (typeof found === 'string') this.#fault = found;
    else {
      try {
        being = new found(stance);
      } catch (e) {
        this.#fault = `${own.class} threw at birth: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    if (!being) {
      const { fallback } = this.#class;
      if (!fallback) throw new Error(this.#fault!);
      being = new fallback(stance);
    }
    this.#residents.set(WARD, { being, row: own, stance });
    // The standing on the dock is kept at once: its heir is spent, so a
    // restart before the ward's first keep would find no way back.
    const { dock } = this.#parts;
    if (dock && !Object.hasOwn(own.standings, DOCK) && (await stance.standings.take(DOCK, dock)) !== null && !(await this.partition.kept())) {
      throw new Error('the standing on the dock was not kept');
    }
  }

  // One being of a house whose beings stand, from her row, where she does
  // not stand yet: a class nothing resolves, or one that throws, leaves her
  // absent and her row as it stands. In any other house no being stands.
  stand(key: string): 'booted' | 'stands' | 'no such being' | 'no such class' | 'threw at birth' {
    if (this.#residents.has(key)) return 'stands';
    const row = key === WARD || !this.#parts.stands ? undefined : this.partition.being(key);
    if (!row) return 'no such being';
    const C = this.#classOf(row);
    if (!C) return 'no such class';
    return this.#bear(key, row, C) ? 'booted' : 'threw at birth';
  }

  // A being of a kind the core ships, written and stood where her key holds
  // none: how the harbor stands the catalogue on empty memory, before any
  // ward being stands to boot her.
  make(key: string, className: string): Promise<Birth> {
    return this.#make(key, className);
  }

  #classOf(row: BeingRow): BeingClass | undefined {
    return this.#parts.classes.classOf(row.class, row.registry);
  }

  get pk(): string {
    return this.key.pk;
  }

  get draw() {
    return this.#parts.entropy.drawer;
  }

  get ward(): Ward {
    return this.#residents.get(WARD)!.being as Ward;
  }

  // Why the ward stands the fallback and not her row's class, or null.
  get fault(): string | null {
    return this.#fault;
  }

  get #class(): WardClass {
    return this.#parts.ward;
  }

  // The class of a ward kind, or why none may be this house's ward.
  #wardOf(kind: string, registry: string | undefined): BeingClass | string {
    const C = this.#parts.classes.classOf(kind, registry);
    if (!C) return `no class of kind ${kind} runs`;
    return this.#class.fits(C) ? C : `${kind} is no ${this.#class.contract}`;
  }

  // The ward born again of her row's class where it resolves now and is
  // not the class she stands as, on the stance she holds.
  #wardAnew(): void {
    const resident = this.#residents.get(WARD);
    if (!resident) return;
    const found = this.#wardOf(resident.row.class, resident.row.registry);
    if (typeof found === 'string') {
      if (ownKind(resident.being.constructor) !== resident.row.class) this.#fault = found;
      return;
    }
    if (resident.being.constructor === found) return;
    try {
      resident.being = new found(resident.stance);
      this.#fault = null;
    } catch (e) {
      this.#fault = `${resident.row.class} threw at birth: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // The being standing under a key, for the harbor's own faculties.
  being(key: string): BeingLike | undefined {
    return this.#residents.get(key)?.being;
  }

  // Every standing being whose kind now resolves to another class, born
  // again of it on the stance she holds, so her relations and their lanes
  // stay hers. A new class that throws at birth leaves her as she was. The
  // ward is one of them. A being born for an ask needs none of this: the
  // next ask that reaches her is born of the class that runs then.
  renew(): void {
    this.#wardAnew();
    for (const [key, resident] of this.#residents) {
      if (key === WARD) continue;
      const C = this.#classOf(resident.row);
      if (!C || resident.being.constructor === C) continue;
      try {
        resident.being = new C(resident.stance);
      } catch {
        continue;
      }
    }
  }

  // The unsealed ask: the ward, asked by whoever holds this house.
  // It reaches every being of the house through the ward, so every
  // row is put back where the memory refuses.
  async root(method?: string, args: JsonObject = {}): Promise<Answer> {
    return this.#kept(Object.keys(this.partition.beings), () => this.#answer(WARD, { id: OWNER }, method, args));
  }

  // An answer, kept. Where the memory refuses, what the beings wrote is put
  // back and the answer is silence. What their relations stand on is not
  // put back: a relation's keys move only as far as its standing follows.
  async #kept(keys: readonly string[], work: () => Promise<Answer>): Promise<Answer> {
    const before = keys.flatMap((key): [string, JsonObject, string][] => {
      const row = this.partition.being(key);
      return row ? [[key, row.cells, JSON.stringify(row.cells)]] : [];
    });
    const out = await work();
    if (await this.partition.kept()) return out;
    for (const [key, cells, was] of before) {
      if (JSON.stringify(cells) === was) continue;
      for (const k of Object.keys(cells)) delete cells[k];
      for (const [k, v] of Object.entries(JSON.parse(was) as JsonObject)) Object.defineProperty(cells, k, { value: v, enumerable: true, writable: true, configurable: true });
      this.partition.told(key);
    }
    return silence;
  }

  // Behind: the zero head reaches the public being, an heir the being that
  // invited it.
  get zero(): boolean {
    const key = this.partition.head.public;
    return key !== null && this.#reachable(key);
  }

  // Whether an ask reaches the being under a key: she stands, or she is
  // born for it, her class resolving.
  #reachable(key: string): boolean {
    if (this.#residents.has(key)) return true;
    const row = key === WARD || this.#parts.stands ? undefined : this.partition.being(key);
    return row !== undefined && this.#classOf(row) !== undefined;
  }

  answer(heir: string | null, p: Payload): Promise<Choice> {
    return this.#choose(heir, p.method, p.args);
  }

  // An ask on a relation between two beings of this ward, with no seal:
  // both ends are this house's, so a seal would prove nothing to it. A take
  // binds a fresh heir here and takes it from the door, so no box ever
  // speaks under it again; an ask speaks while the heir stays bound here,
  // and hears `removed` once its occupant is gone. A take that brings no
  // object leaves the heir fresh on the door, as it was.
  async within(heir: string, take: boolean, method?: string, args?: string): Promise<Choice | { readonly quo: 'removed' }> {
    const { bind } = this.partition.head;
    const bound = Object.hasOwn(bind, heir) ? bind[heir]! : undefined;
    if (!take) return bound?.inside ? this.#choose(heir, method, args) : { quo: 'removed' };
    if (!bound || bound.inside || this.door.relations.get(heir)?.state !== 'fresh') return { silence: true };
    const inside = { ...bound, inside: true as const };
    this.door.relations.delete(heir);
    bind[heir] = inside;
    this.partition.toldHead();
    const choice = await this.#choose(heir, method, args);
    if ('object' in choice || bind[heir] !== inside) return choice;
    bind[heir] = bound;
    this.door.relations.set(heir, { state: 'fresh' });
    return choice;
  }

  async #choose(heir: string | null, method: string | undefined, text: string | undefined): Promise<Choice> {
    const bound = heir === null ? undefined : this.partition.head.bind[heir];
    const key = heir === null ? this.partition.head.public : bound?.being;
    const asker: Asker = bound ? { id: bound.id } : {};
    const args = text === undefined ? {} : readValue(text, DEPTH + 1);
    if (key === null || key === undefined || typeof args !== 'object' || args === null || Array.isArray(args)) return { silence: true };
    let seen: string | null = null;
    const out = await this.#kept([key], () =>
      this.#with(key, silence, async (being) => {
        const reply = await this.#reply(being, asker, method, args);
        if (method !== undefined && !isSilence(reply) && !isWord(reply) && being.describe) seen = await digest(being.describe(asker));
        return reply;
      }),
    );
    const object = isSilence(out) || isWord(out) ? undefined : writeValue(out, DEPTH);
    return object === undefined ? { silence: true } : { object, seen };
  }

  // Every path that reaches a being's answer. A throw, a word out of her,
  // or nothing at all is silence.
  #answer(key: string, asker: Asker, method: string | undefined, args: JsonObject): Promise<Answer> {
    return this.#with(key, silence, (being) => this.#reply(being, asker, method, args));
  }

  async #reply(being: BeingLike, asker: Asker, method: string | undefined, args: JsonObject): Promise<Answer> {
    let out: Reply;
    try {
      out = await being.answer(asker, method, args);
    } catch {
      return silence;
    }
    return out === undefined || isWord(out) ? silence : out;
  }

  // The being under a key for the length of `work`: the one that stands,
  // or, in a house whose beings do not stand, one born from her row for
  // it, the same one for every ask in flight on her, so her relations keep
  // one lane each, dropped when the last ends. A being nothing resolves, or
  // one that throws at birth, is none.
  async #with<T>(key: string, none: T, work: (being: BeingLike) => Promise<T>): Promise<T> {
    const standing = this.#residents.get(key);
    if (standing) return work(standing.being);
    const visit = this.#visit(key);
    if (!visit) return none;
    try {
      return await work(visit.being);
    } finally {
      visit.asks -= 1;
      if (visit.asks === 0 && this.#visits.get(key) === visit) this.#visits.delete(key);
    }
  }

  #visit(key: string): Visit | undefined {
    const held = this.#visits.get(key);
    if (held) {
      held.asks += 1;
      return held;
    }
    const row = key === WARD || this.#parts.stands ? undefined : this.partition.being(key);
    const C = row && this.#classOf(row);
    if (!row || !C) return undefined;
    const stance = new HouseStance(this, key, row, this.#parts.carries ?? {});
    try {
      const visit = { being: new C(stance), row, stance, asks: 1 };
      this.#visits.set(key, visit);
      return visit;
    } catch {
      return undefined;
    }
  }

  // The stance a being of this house acts on: hers where she stands or is
  // in flight, else one made on her row for what her ward does with it.
  #stanceOf(key: string): HouseStance | undefined {
    const held = this.#residents.get(key) ?? this.#visits.get(key);
    if (held) return held.stance;
    const row = key === WARD ? undefined : this.partition.being(key);
    return row ? new HouseStance(this, key, row, this.#parts.carries ?? {}) : undefined;
  }

  // Inside: what every stance of this ward stands on.

  // A box to another ward's door, wherever it stands; this ward's own
  // relations speak `within`.
  send(pk: string, bytes: Uint8Array): Promise<Uint8Array | null> {
    return this.#parts.carrier.carry(pk, bytes);
  }

  // A lend: the ward lends herself, as the dock does, or asks the dock
  // through her standing.
  async offer(contract: string): Promise<Invitation | null> {
    const own = this.#residents.get(WARD)!;
    if (lends(own.being)) return own.being.offer(contract);
    const out = await own.stance.standings.get(DOCK)?.ask('lend', { contract });
    return readInvitation((out as { invitation?: unknown } | undefined)?.invitation);
  }

  async retract(contract: string, heir: string): Promise<void> {
    const own = this.#residents.get(WARD)!;
    if (lends(own.being)) return own.being.withdraw(contract, heir);
    await own.stance.standings.get(DOCK)?.ask('retract', { contract, heir });
  }

  reach(): readonly string[] {
    return this.#parts.routes?.reach() ?? [];
  }

  learn(ward: string, at: readonly string[]): Promise<void> {
    return this.#parts.routes?.learn(ward, at) ?? Promise.resolve();
  }

  // A stance speaks for a being while her row is the one her ward keeps.
  live(key: string, row: BeingRow): boolean {
    return this.partition.being(key) === row;
  }

  // A being boots another of this ward. With an id, the new being invites
  // her maker under the maker's key, and the maker takes it under id; a
  // relation that could not be made unmakes the new being.
  async boot(maker: string, className: string, key: string, id?: string): Promise<string | null> {
    if ((await this.#make(key, className)) !== 'booted') return null;
    if (id === undefined) return key;
    const invitation = await this.#stanceOf(key)!.occupants.invite(maker);
    const taken = invitation ? await this.#stanceOf(maker)?.standings.take(id, invitation) : null;
    if (taken) return key;
    this.#unboot(key);
    return null;
  }

  // A new row and her first birth, which writes her cells' defaults: she
  // stands from then on in a house whose beings stand, and is dropped at
  // once in any other, to be born again for the asks that reach her.
  async #make(key: string, className: string, registry?: string): Promise<Birth> {
    if (key === '' || key === WARD || this.partition.being(key) || this.#birthing.has(key)) return 'key taken';
    // A house whose beings stand, the box, holds faculties alone, and every
    // other house holds beings that are no faculty. A ward is no being of
    // any house.
    const C = this.#parts.classes.classOf(className, registry);
    if (!C || Ward.fulfils(C) || Faculty.fulfils(C) !== (this.#parts.stands === true)) return 'no such class';
    this.#birthing.add(key);
    try {
      const row: BeingRow = { class: className, ...(registry === undefined ? {} : { registry }), cells: {}, occupants: {}, standings: {} };
      this.partition.beings[key] = row;
      if (!(this.#parts.stands ? this.#bear(key, row, C) : this.#born(key, row, C) !== undefined)) {
        delete this.partition.beings[key];
        return 'threw at birth';
      }
      this.partition.told(key);
      return 'booted';
    } finally {
      this.#birthing.delete(key);
    }
  }

  #born(key: string, row: BeingRow, C: BeingClass): BeingLike | undefined {
    try {
      return new C(new HouseStance(this, key, row, this.#parts.carries ?? {}));
    } catch {
      return undefined;
    }
  }

  #bear(key: string, row: BeingRow, C: BeingClass): boolean {
    const stance = new HouseStance(this, key, row, this.#parts.carries ?? {});
    try {
      this.#residents.set(key, { being: new C(stance), row, stance });
      return true;
    } catch {
      this.#residents.delete(key);
      return false;
    }
  }

  #unboot(key: string): boolean {
    const row = key === WARD ? undefined : this.partition.being(key);
    if (!row) return false;
    for (const { heir } of Object.values(row.occupants)) {
      this.door.remove(heir);
      delete this.partition.head.bind[heir];
    }
    if (this.partition.head.public === key) this.partition.head.public = null;
    delete this.partition.beings[key];
    this.#residents.delete(key);
    this.partition.toldHead();
    this.partition.told(key);
    return true;
  }

  // What the ward asks of her house.
  readonly #steward: Steward = {
    pk: () => this.pk,
    classOf: (name, registry) => this.#parts.classes.classOf(name, registry),
    beings: () => {
      const out: ReturnType<Steward['beings']> = {};
      // A being is absent where no ask would reach her: in a house whose
      // beings stand, one that does not stand; in any other, one whose
      // class does not resolve.
      for (const [key, row] of Object.entries(this.partition.beings)) {
        if (key !== WARD) out[key] = { class: row.class, ...(row.registry === undefined ? {} : { registry: row.registry }), public: this.partition.head.public === key, absent: !this.#reachable(key) };
      }
      return out;
    },
    boot: (key, className, registry) => this.#make(key, className, registry),
    stand: (key) => this.stand(key),
    unboot: (key) => this.#unboot(key),
    publish: (key) => {
      if (key !== null && (key === WARD || !this.partition.being(key))) return false;
      this.partition.head.public = key;
      this.partition.toldHead();
      return true;
    },
    invite: (being, id, notes): Promise<Invitation | null> => {
      const stance = being === WARD || !this.#reachable(being) ? undefined : this.#stanceOf(being);
      return stance ? stance.occupants.invite(id, notes) : Promise.resolve(null);
    },
    ask: (being, method, args) => {
      const key = being ?? this.partition.head.public;
      if (key === null || key === WARD) return Promise.resolve(word('unreached'));
      return this.#answer(key, being === null ? {} : { id: OWNER }, method, args);
    },
    become: (kind, registry) => {
      const found = this.#wardOf(kind, registry);
      if (typeof found === 'string') return found;
      const resident = this.#residents.get(WARD)!;
      try {
        resident.being = new found(resident.stance);
      } catch {
        return `${kind} threw at birth`;
      }
      resident.row.class = kind;
      if (registry === undefined) delete resident.row.registry;
      else resident.row.registry = registry;
      this.partition.told(WARD);
      this.#fault = null;
      return null;
    },
  };
}
