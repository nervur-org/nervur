// SPDX-License-Identifier: Apache-2.0
// The house: Quo and beings over the references a ground hands it. It
// imports nothing but its own files, and keeps nothing outside memory.
import type { Asker, Json, Notes, Position } from '../being/being.ts';
import { covers } from '../being/covers.ts';
import { blueprintOf, WAIT, type Blueprint, type BlueprintMethod } from '../being/need.ts';
import { isJson, offered, resolve, type Table, type TableEntry } from '../being/table.ts';
import type { BeingClass, Carry, Classes, Clock, Crypto, Keys, Memory, Tools } from '../foundation.ts';
import { Room, type Admitted, type Choice } from '../quo/index.ts';
import { Crossing, Marks, inward, outward } from './crossing.ts';
import { Rows, type Draft } from './rows.ts';
import { copy, emptyRow, type Answer, type BeingRow, type DeadLetter, type OccupantRow, type OutboxEntry, type OwnerRow, type StandingRow, type Target, type WardRow } from './rows-shape.ts';

export type { Answer } from './rows-shape.ts';

/** The seven references a house calls. */
export interface Foundation {
  readonly keys: Keys;
  readonly memory: Memory;
  readonly classes: Classes;
  readonly carry: Carry;
  readonly clock: Clock;
  readonly crypto: Crypto;
  readonly tools: Tools;
}

/** A faculty the ground offers to beings. */
export interface Offer {
  readonly blueprint: unknown;
  readonly object: object;
  readonly kinds?: readonly string[];
  /** How long the faculty remembers a call id, in milliseconds. */
  readonly window?: number;
  /** Told once the house opens, with the house's context, so its tokens answer before any being calls it. */
  opened?(context: OpenedContext): void | Promise<void>;
}

/** What a faculty is handed when a house that offers it opens: the house's ward, and its tokens called as a method's context calls them. */
export interface OpenedContext {
  readonly ward: string;
  readonly call: FacultyContext['call'];
  readonly describe: FacultyContext['describe'];
}

/** What a faculty's method receives beside its args. */
export interface FacultyContext {
  readonly id: string;
  /**
   * A token it was handed, asked. A handle's token asks its one ask. An
   * occupant's token asks the `method` named, as that occupant, and
   * `after` makes a `readOnly` ask a watch. `home` carries the answer's
   * handles home: they leave as invitation bytes, which a house takes,
   * in place of tokens.
   */
  call(options: { token: string; method?: string; args?: Json; id: string; after?: Answer; home?: boolean }): Promise<Answer>;
  /** What the occupant behind a token may ask now, as her describe shows it. */
  describe(options: { token: string }): Promise<{ describe: Json } | { error: { message: string } }>;
}

/** What `House.open` gives. */
export interface Opened {
  readonly ward: string;
  door(box: Uint8Array): Promise<Uint8Array | null>;
  /**
   * The hand: a being asked by `id` as `root`, the steward where no id is
   * named. `after` is the answer the caller holds, which makes a `readOnly`
   * ask a watch. `cells` reads her cells and asks nothing, which no other
   * way into the house can. `call` is the ask's call id: asked again, it
   * answers what the first answered and runs nothing twice.
   */
  ask(request: { id?: string; method?: string; args?: Json; after?: Answer; cells?: true; call?: string }): Promise<Answer | { readonly describe: Json }>;
}

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const RETRY_BOUND = 300_000;
/** What a reply has to come home in, past the time its ask ran. */
const HOMEWARD = 5_000;
const STEWARD = 'steward';
const PUBLIC = 'public';
const RESERVED_BEINGS = new Set([STEWARD, PUBLIC, 'root', 'stranger']);
const RESERVED_OCCUPANTS = new Set(['root', 'stranger', STEWARD]);
const BEING_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const LANG = 'org.nervur.asks/1';
const REPLAY_WINDOW = 600_000;

/** A failure the asker reads: `fail`, a refused call, a mismatch. */
class Fail extends Error {}
/** Silence where a standing's describe was owed. She reads it as the call she made answering nothing. */
class Silent extends Fail {}

interface Resolved {
  readonly Class: BeingClass;
  readonly table: Table;
  /** Each need member's offer. */
  readonly faculties: Readonly<Record<string, Offer & { readonly bp: Blueprint }>>;
}

interface Request {
  readonly being: string;
  readonly occupant: string;
  readonly method?: string;
  readonly args?: Json;
  readonly call?: string;
  /** Asked by the house itself, as the occupant steward: replies, alarms, born. */
  readonly house?: boolean;
  /** Who reads the answer: a faculty is handed tokens it alone calls, a house invitations. */
  readonly reader?: Reader;
  /** Changes that land with the ask whatever its outcome. */
  readonly always?: { change(draft: Draft, outcome: Outcome): Promise<void> | void; landed?(): void };
  /** The key a stranger signed with. */
  readonly signer?: Uint8Array;
  /** When the chain that asks ends, on this house's clock: the caller's time left. */
  readonly until?: number;
  /** Its args repeat a key somewhere inside. */
  readonly strange?: boolean;
  /** The digest of the answer the asker holds: a `readOnly` ask asked with it is a watch. */
  readonly after?: string;
}

/** Who a handle leaves for: a far house, as an invitation, or one faculty, by its blueprint, as a token. */
type Reader = 'house' | { readonly faculty: string };

/** One ask as a describe shows it. */
interface DescribedAsk {
  readonly method: string;
  readonly args?: unknown;
  readonly result?: unknown;
  readonly hints?: { readonly readOnly?: boolean; readonly idempotent?: boolean };
  readonly wait?: unknown;
}

/** What a ground may set on a house beside its foundation and offers. */
export interface Options {
  /** The longest any ask here may take, in milliseconds. Each entry's own wait stands under it. */
  readonly wait?: number;
}

/** What an ask gave, with the mark of what its asker is shown now; `null` for silence or nothing. */
type Outcome = { readonly answer: Answer; readonly mark: string } | { readonly describe: Json; readonly mark: string } | null;

const answerOf = (outcome: Outcome): Answer | null => (outcome !== null && 'answer' in outcome ? outcome.answer : null);

const errorOf = (message: string): Answer => ({ error: { message } });

// The card a far public being is reached by: her ward, and her addresses in order.
const cardOf = (card: unknown): { ward: string; at: readonly string[] } => {
  const { ward, at } = (card ?? {}) as { ward?: unknown; at?: unknown };
  if (typeof ward !== 'string' || !/^[0-9a-f]{128}$/.test(ward) || !Array.isArray(at) || !at.every((address) => typeof address === 'string')) {
    throw new Fail('a public being is reached by its ward and its addresses');
  }
  return { ward, at };
};

// How long a handle's invitations may wait unspent: whole milliseconds above zero, or never.
const expiresOf = (expires: unknown): number | undefined => {
  if (expires === undefined) return undefined;
  if (!Number.isSafeInteger(expires) || (expires as number) <= 0) throw new Fail('expires is a whole number of milliseconds above zero');
  return expires as number;
};

const positionOf = (being: string): Position => (being === STEWARD ? 'steward' : being === PUBLIC ? 'public' : 'normal');

// A standing she holds. Her standing on her steward is the house's, and never a row.
const standingOf = (being: string, row: BeingRow, id: string): StandingRow | undefined =>
  id === STEWARD && being !== STEWARD ? { notes: {}, steward: {}, local: { being: STEWARD, occupant: `being:${being}` } } : row.standings[id];

/** An ask's args as a handle's holder sends them: what its bind fixes is the house's, and shown to no one. */
const unbound = <T extends object>(args: T, bound: Json | undefined): T => {
  if (typeof bound !== 'object' || bound === null || Array.isArray(bound)) return args;
  const schema = args as { properties?: Record<string, unknown>; required?: readonly string[] };
  if (schema.properties === undefined) return args;
  const fixed = new Set(Object.keys(bound));
  return {
    ...args,
    properties: Object.fromEntries(Object.entries(schema.properties).filter(([key]) => !fixed.has(key))),
    ...(schema.required === undefined ? {} : { required: schema.required.filter((key) => !fixed.has(key)) }),
  };
};

/** Whether an ask is awaited by its caller: a public being's are, unless her author said otherwise. */
const idempotentIn = (entry: TableEntry, position: Position): boolean => (position === 'public' ? !entry.effect : entry.hints.idempotent);
const names = (value: readonly string[] | null) => value;

/** A house opened on its foundation and its offers: its ward, its door and its hand, and nothing more. */
export const openHouse = async (foundation: Foundation, offers: readonly Offer[], options: Options = {}): Promise<Opened> => {
  const house = new House(foundation, offers, options);
  await house.open();
  await house.tellOpened();
  return {
    ward: house.ward,
    door: (box) => house.door(box),
    ask: (request) => house.hand(request),
  };
};

class House {
  /** The ground's bound on every ask here. */
  readonly #wait: number;
  readonly #keys: Keys;
  readonly #classes: Classes;
  readonly #carry: Carry;
  readonly #clock: Clock;
  readonly #crypto: Crypto;
  readonly #tools: Tools;
  readonly #memory: Memory;
  readonly #offers: readonly (Offer & { readonly bp: Blueprint })[];
  readonly #room: Room;
  /** Its marks on the handles and invitations it hands its beings, known to it alone. */
  readonly #marks = new Marks();
  /** The waits it raced against its clock, each named once. */
  #withins = 0;
  #rows!: Rows;
  #wardPlace = '';
  ward = '';
  readonly #tables = new Map<string, Promise<Resolved | { absent: string }>>();
  readonly #queues = new Map<string, Promise<unknown>>();
  /** What wakes each watch on a being, when an ask of hers lands. */
  readonly #changes = new Map<string, Set<() => void>>();
  /** The watch each asker holds, by being, ask and args, and what ends it. */
  readonly #watching = new Map<string, () => void>();
  /** Beings whose `born` has not run yet, and the run every other ask to her waits for. */
  readonly #borning = new Map<string, Promise<void>>();
  readonly #inFlight = new Set<string>();
  /** One send at a time on each standing to a far ward, so its count stays straight. */
  readonly #relations = new Map<string, Promise<unknown>>();
  /** One arrival at the door per heir at a time, so each is admitted on the record the last one left. */
  readonly #arriving = new Map<string, Promise<unknown>>();
  /** When each heir's record last moved, on a count of every arrival settled. */
  readonly #moved = new Map<string, number>();
  #settled = 0;
  /** Far describes by standing, kept until an answer carries another mark. */
  readonly #described = new Map<string, { mark: string | null; describe: Json }>();
  /** Answers on the zero head by the box's signature, for a window. */
  readonly #replays = new Map<string, { choice: Choice; at: number }>();
  /** Heirs minted by an ask not yet landed, so a being of this house may bind one at once. */
  readonly #minting = new Map<string, { being: string; occupant: string; until?: number }>();
  /** Tokens minted by an ask not yet landed, and its end, which a faculty's call through one waits for. */
  readonly #tokening = new Map<string, Promise<void>>();
  #armed = Number.POSITIVE_INFINITY;
  #waking = false;
  /** Beings whose due work is all in flight. */
  readonly #blocked = new Set<string>();
  /** The earliest time anything of each being is due, read from her row as it lands. */
  readonly #dueAt = new Map<string, number>();
  /** Which being each being's place is. */
  readonly #beingAt = new Map<string, string>();

  constructor(foundation: Foundation, offers: readonly Offer[], options: Options) {
    this.#wait = options.wait ?? Number.POSITIVE_INFINITY;
    this.#keys = foundation.keys;
    this.#memory = foundation.memory;
    this.#classes = foundation.classes;
    this.#carry = foundation.carry;
    this.#clock = foundation.clock;
    this.#crypto = foundation.crypto;
    this.#tools = foundation.tools;
    this.#room = new Room(foundation.keys, foundation.crypto, foundation.tools);
    const references = new Set<unknown>(Object.values(foundation));
    this.#offers = offers.map((offer) => {
      // Held to the rules a need is, where it arrives: a keyword outside the subset refuses it.
      const bp = offered(offer.blueprint);
      // What the ground hands the house is never a being's to call.
      if (references.has(offer.object)) throw new TypeError(`the offer ${bp.name} is a reference of the house's foundation`);
      for (const name of Object.keys(bp.methods)) {
        if (typeof (offer.object as Record<string, unknown>)[name] !== 'function') throw new TypeError(`the offer ${bp.name} has no method ${name}`);
      }
      return { ...offer, bp };
    });
    // Two offers of one blueprint serve two kinds side by side only where their kinds do not meet.
    for (const [index, one] of this.#offers.entries()) {
      for (const two of this.#offers.slice(index + 1)) {
        if (one.bp.name !== two.bp.name) continue;
        const meet = one.kinds === undefined || two.kinds === undefined || one.kinds.some((kind) => two.kinds!.includes(kind));
        if (meet) throw new TypeError(`two offers of ${one.bp.name} serve one kind`);
      }
    }
  }

  // ---- open ----

  async open(): Promise<void> {
    this.#rows = await Rows.open(this.#memory, this.#keys, this.#crypto, this.#tools);
    // A being's row that lands says when she is next due, and unblocks her.
    this.#rows.whenLanded((place, row) => {
      const being = this.#beingAt.get(place);
      if (being === undefined) return;
      this.#blocked.delete(being);
      this.#dueFrom(being, row as BeingRow | null);
    });
    this.#wardPlace = await this.#rows.place('ward');
    this.ward = await this.#room.ward();
    const bound = this.#tools.hex(await this.#keys.derive('bound', 32));
    const places = await this.#rows.list();
    if (places.length === 0) {
      const steward = await this.#resolve(this.#classes.steward());
      if ('absent' in steward) throw new TypeError(`the steward is absent: ${steward.absent}`);
      const open = this.#classes.public();
      const opened = await this.#rows.transact(async (draft) => {
        const ward: WardRow = { bound, beings: { [STEWARD]: { kind: steward.table.kind } } };
        draft.set(await this.#place(STEWARD), emptyRow(steward.table.kind, copy(steward.table.cells)));
        if (open !== undefined) {
          const resolved = await this.#resolve(open);
          if ('absent' in resolved) throw new TypeError(`the public being is absent: ${resolved.absent}`);
          ward.beings[PUBLIC] = { kind: open };
          draft.set(await this.#place(PUBLIC), emptyRow(open, copy(resolved.table.cells)));
        }
        draft.set(this.#wardPlace, ward);
      });
      if (!opened) throw new Error('memory refused the first write');
    } else {
      let ward: WardRow | null = null;
      try {
        ward = await this.#rows.get<WardRow>(this.#wardPlace);
      } catch {
        ward = null;
      }
      if (ward === null || ward.bound !== bound) throw new Error('this memory is bound to other keys');
      // What each being has due, read once from her row.
      for (const being of Object.keys(ward.beings)) this.#dueFrom(being, await this.#rows.get<BeingRow>(await this.#place(being)));
    }
    await this.#arm();
  }

  async #place(being: string): Promise<string> {
    const place = await this.#rows.place(`being:${being}`);
    this.#beingAt.set(place, being);
    return place;
  }

  async #heirPlace(heir: string): Promise<string> {
    return this.#rows.place(`heir:${heir}`);
  }

  async #tokenPlace(token: string): Promise<string> {
    return this.#rows.place(`token:${token}`);
  }

  // Her earliest due time: an alarm, or the head of her outbox to each receiver.
  #dueFrom(being: string, row: BeingRow | null) {
    const times: number[] = [];
    if (row !== null) {
      for (const alarm of Object.values(row.alarms)) times.push(alarm.at);
      const heads = new Map<string, OutboxEntry>();
      for (const entry of row.outbox) if (!heads.has(laneOf(entry))) heads.set(laneOf(entry), entry);
      for (const entry of heads.values()) times.push(Math.min(entry.next, entry.deadline));
    }
    if (times.length === 0) this.#dueAt.delete(being);
    else this.#dueAt.set(being, Math.min(...times));
  }

  // ---- classes ----

  #resolve(kind: string): Promise<Resolved | { absent: string }> {
    let found = this.#tables.get(kind);
    if (found === undefined) {
      found = (async () => {
        const Class = await this.#classes.resolve({ kind });
        if (Class === undefined) return { absent: `no class answers ${kind}` };
        let table: Table;
        try {
          table = resolve(Class);
        } catch (error) {
          return { absent: error instanceof Error ? error.message : String(error) };
        }
        if (table.kind !== kind) return { absent: `the class for ${kind} declares ${table.kind}` };
        const faculties: Record<string, Offer & { bp: Blueprint }> = {};
        for (const [member, want] of Object.entries(table.needs)) {
          const offer = this.#offers.find((one) => (one.kinds === undefined || one.kinds.includes(kind)) && covers(one.bp, want).covered);
          if (offer === undefined) return { absent: `no offer covers her need ${member}` };
          faculties[member] = offer;
        }
        return { Class, table, faculties };
      })();
      this.#tables.set(kind, found);
    }
    return found;
  }

  async #being(id: string): Promise<{ kind: string; resolved: Resolved } | null> {
    const ward = await this.#rows.get<WardRow>(this.#wardPlace);
    const entry = ward?.beings[id];
    if (entry === undefined) return null;
    const resolved = await this.#resolve(entry.kind);
    return 'absent' in resolved ? null : { kind: entry.kind, resolved };
  }

  // ---- asking ----

  /**
   * The hand: a being asked by id as the occupant root, the steward where
   * none is named. `cells` reads her cells as last landed, her defaults
   * under them, and asks nothing.
   */
  async hand({ id = STEWARD, method, args, after, cells, call }: { id?: string; method?: string; args?: Json; after?: Answer; cells?: true; call?: string }): Promise<Answer | { describe: Json }> {
    const found = await this.#being(id);
    if (found === null) return errorOf(`no being ${id} is here`);
    if (cells === true) {
      if (method !== undefined || args !== undefined || after !== undefined || call !== undefined) return errorOf('the hand reads her cells alone');
      await this.#born(id);
      const row = await this.#rows.get<BeingRow>(await this.#place(id));
      return { result: { ...(copy(found.resolved.table.cells) as Record<string, Json>), ...row?.cells } };
    }
    const watch = after === undefined ? {} : { after: await this.digest(after) };
    const outcome = await this.ask({ being: id, occupant: 'root', ...(method === undefined ? {} : { method }), args: args ?? {}, ...watch, ...(call === undefined ? {} : { call }) });
    if (outcome === null) return errorOf('the house answered nothing');
    if ('describe' in outcome) return { describe: outcome.describe };
    return outcome.answer;
  }

  /** One ask to one being. Asks run one at a time, and `readOnly` ones beside them. */
  async ask(request: Request): Promise<Outcome> {
    if (!(request.house === true && request.method === 'born')) await this.#born(request.being);
    const silent = async (): Promise<Outcome> => {
      if (request.always && (await this.#rows.transact((draft) => request.always!.change(draft, null)))) request.always.landed?.();
      return null;
    };
    // A chain whose time is spent runs nothing here, on arrival or at its turn: its caller has stopped listening.
    const spent = () => request.until !== undefined && request.until <= this.#clock.now();
    const found = spent() ? null : await this.#being(request.being);
    if (found === null) return silent();
    const entry = request.method === undefined ? undefined : found.resolved.table.asks[request.method];
    if (entry?.hints.readOnly === true && request.after !== undefined) return this.#watch(request as Request & { after: string }, found.resolved, entry);
    if (request.method === undefined || entry?.hints.readOnly === true) return this.#run(request, found.resolved);
    const before = this.#queues.get(request.being) ?? Promise.resolve();
    const run = before.then(() => (spent() ? silent() : this.#run(request, found.resolved)));
    this.#queues.set(
      request.being,
      run.catch(() => undefined),
    );
    return run;
  }

  /** The digest a watch compares: the first sixteen hex digits of the SHA-256 of the answer's canonical JSON. */
  async digest(answer: Answer): Promise<string> {
    const digest = await this.#crypto.sha256(this.#tools.utf8(this.#tools.canonical(answer)));
    return this.#tools.hex(digest.subarray(0, 8));
  }

  /**
   * A watch: her `readOnly` ask, answered once it differs from what the asker
   * holds, or as it stands when the wait runs out. It runs again each time an
   * ask of hers lands. One asker holds one watch on one ask with the same
   * args, and a second answers the first at once.
   */
  async #watch(request: Request & { after: string }, resolved: Resolved, entry: TableEntry): Promise<Outcome> {
    // Strangers share one occupant, so a stranger is told apart by the key she signed with.
    const asker = request.signer === undefined ? request.occupant : this.#tools.hex(request.signer);
    const key = `${request.being}\n${asker}\n${entry.method}\n${this.#tools.canonical(request.args ?? {})}`;
    this.#watching.get(key)?.();
    let ended = false;
    let wake = () => undefined as void;
    const end = () => {
      ended = true;
      wake();
    };
    this.#watching.set(key, end);
    const deadline = Math.min(this.#clock.now() + Math.min(entry.wait, this.#wait), request.until ?? Number.POSITIVE_INFINITY);
    // What lands with the answer, Quo's move and the call id, lands once, with the answer given.
    const { always: _always, call: _call, ...bare } = request;
    const probe: Request = bare;
    const give = (outcome: Outcome) => (request.always === undefined && request.call === undefined ? outcome : this.#run(request, resolved));
    try {
      for (;;) {
        const changed = new Promise<void>((woken) => {
          wake = woken;
        });
        const listening = wake;
        this.#listen(request.being, listening);
        try {
          const outcome = await this.#run(probe, resolved);
          const same = outcome !== null && 'answer' in outcome && (await this.digest(outcome.answer)) === request.after;
          const left = deadline - this.#clock.now();
          if (!same || ended || left <= 0) return await give(outcome);
          if ((await this.within(left, changed)) === null) return await give(outcome);
        } finally {
          this.#unlisten(request.being, listening);
        }
      }
    } finally {
      if (this.#watching.get(key) === end) this.#watching.delete(key);
    }
  }

  #listen(being: string, wake: () => void) {
    const waiting = this.#changes.get(being) ?? new Set();
    waiting.add(wake);
    this.#changes.set(being, waiting);
  }

  #unlisten(being: string, wake: () => void) {
    const waiting = this.#changes.get(being);
    waiting?.delete(wake);
    if (waiting?.size === 0) this.#changes.delete(being);
  }

  // An ask of hers landed, so every watch on her looks again. The steward's powers reach every being, so hers wake all.
  #touched(being: string) {
    const woken = being === STEWARD ? [...this.#changes.values()].flatMap((set) => [...set]) : [...(this.#changes.get(being) ?? [])];
    for (const wake of woken) wake();
  }

  #asker(being: string, row: BeingRow, occupant: string, house: boolean, signer?: Uint8Array): (Asker & { handle?: OccupantRow }) | undefined {
    const position = positionOf(being);
    if (house) return { id: STEWARD, notes: {}, steward: {} };
    // The holder of the house's hand, who reaches every being and never arrives in a box.
    if (occupant === 'root') return { id: 'root', notes: {}, steward: {} };
    if (occupant === STEWARD) return position === 'steward' ? undefined : { id: STEWARD, notes: {}, steward: {} };
    if (occupant === 'stranger') return position === 'public' ? { id: 'stranger', notes: {}, steward: {}, ...(signer === undefined ? {} : { signer }) } : undefined;
    const held = row.occupants[occupant];
    if (held !== undefined) return { id: occupant, notes: held.notes, steward: held.steward, ...(held.ask === undefined ? {} : { handle: held }) };
    if (occupant.startsWith('being:') && position === 'steward') return { id: occupant, notes: {}, steward: {} };
    return undefined;
  }

  #roles(table: Table, asker: Asker & { handle?: OccupantRow }, me: { id: string; position: Position; cells: Record<string, Json> }): Set<string> {
    const roles = new Set<string>();
    if (asker.handle !== undefined) return new Set(['handle']);
    if (asker.id === STEWARD) roles.add(STEWARD);
    if (asker.id === 'root') roles.add('root');
    if (asker.id === 'stranger') roles.add('stranger');
    if (asker.id.startsWith('being:')) roles.add('being');
    for (const [name, test] of Object.entries(table.roles)) {
      try {
        if ((test as (asker: Asker, me: unknown) => boolean)(asker, me)) roles.add(name);
      } catch {
        // A role that throws does not hold.
      }
    }
    return roles;
  }

  #shown(entry: TableEntry, asker: Asker & { handle?: OccupantRow }, roles: Set<string>, position: Position): boolean {
    if (asker.handle !== undefined) return asker.handle.ask === entry.method && (entry.for ?? []).includes('handle');
    if (position === 'public' && asker.id === 'stranger' && entry.effect) return false;
    if (entry.for === null) return true;
    return entry.for.some((role) => roles.has(role));
  }

  /**
   * Her describe for one asker, and its mark, which moves exactly when the
   * describe does. A stranger is not told her kind or her description.
   */
  async #describe(table: Table, state: string, shown: (entry: TableEntry) => boolean, position: Position, stranger: boolean, bound?: Json): Promise<{ describe: Json; mark: string }> {
    const asks = Object.values(table.asks)
      .filter(shown)
      .map((entry) => ({
        method: entry.method,
        in: names(entry.in) ?? table.states,
        to: names(entry.to) ?? names(entry.in) ?? table.states,
        ...(entry.description === undefined ? {} : { description: entry.description }),
        args: unbound(entry.args, bound),
        ...(entry.result === undefined ? {} : { result: entry.result }),
        hints: { ...entry.hints, idempotent: idempotentIn(entry, position) },
        wait: entry.wait,
      }));
    const told = stranger ? {} : { kind: table.kind, ...(table.description === undefined ? {} : { description: table.description }) };
    // Her view is shown to every asker, a stranger too, since a public page is drawn from it.
    const describe = { lang: LANG, ...told, ...(table.view === undefined ? {} : { view: table.view }), state, asks } as unknown as Json;
    const digest = await this.#crypto.sha256(this.#tools.utf8(this.#tools.canonical(describe)));
    return { describe, mark: this.#tools.hex(digest.subarray(0, 8)) };
  }

  /**
   * Her `born`, as her first ask, once the steward's write has landed. It is
   * marked before the steward's ask returns, so every ask to her waits for it.
   */
  bornOf(being: string): Promise<void> {
    const run = this.#bornOf(being);
    this.#borning.set(being, run);
    void run.finally(() => {
      if (this.#borning.get(being) === run) this.#borning.delete(being);
    });
    return run;
  }

  /**
   * Her `born` run first where it is pending: the one her steward's write
   * started, or one a stop left between that write and her first ask.
   */
  async #born(being: string): Promise<void> {
    const borning = this.#borning.get(being);
    if (borning !== undefined) return borning.catch(() => undefined);
    const row = await this.#rows.get<BeingRow>(await this.#place(being)).catch(() => null);
    if (row?.born !== undefined) await this.bornOf(being).catch(() => undefined);
  }

  async #bornOf(being: string): Promise<void> {
    const place = await this.#place(being);
    const row = await this.#rows.get<BeingRow>(place);
    if (row === null || row.born === undefined) return;
    await this.ask({
      being,
      occupant: STEWARD,
      house: true,
      method: 'born',
      args: row.born,
      always: {
        change: async (draft) => {
          const current = await draft.get<BeingRow>(place);
          if (current !== null) delete current.born;
        },
      },
    });
  }

  async #run(request: Request, resolved: Resolved): Promise<Outcome> {
    const { table, Class } = resolved;
    const place = await this.#place(request.being);
    const row = await this.#rows.get<BeingRow>(place);
    const callKey = request.call === undefined ? undefined : `${request.occupant}\n${request.call}`;
    // What lands whatever the ask's outcome: its answered call id, and the caller's own changes.
    const land = async (outcome: Outcome, record: boolean): Promise<Outcome | undefined> => {
      if (request.always === undefined && !(record && callKey !== undefined)) return outcome;
      const ok = await this.#rows.transact(async (draft) => {
        if (record && callKey !== undefined && outcome !== null && 'answer' in outcome) {
          const current = await draft.get<BeingRow>(place);
          if (current !== null) current.calls[callKey] = { answer: outcome.answer, at: this.#clock.now() };
        }
        await request.always?.change(draft, outcome);
      });
      if (!ok) return undefined;
      request.always?.landed?.();
      return outcome;
    };
    const silent = async () => (await land(null, false)) ?? null;
    if (row === null) return silent();
    const position = positionOf(request.being);
    const asker = this.#asker(request.being, row, request.occupant, request.house === true, request.signer);
    if (asker === undefined) return silent();
    const cells = { ...(copy(table.cells) as Record<string, Json>), ...row.cells };
    // What the house asks itself, her born, her alarms and her replies, it asks as her steward would, with the steward's roles alone.
    const shownFor = (now: Record<string, Json>) => {
      const roles = this.#roles(table, asker, { id: request.being, position, cells: now });
      return (entry: TableEntry) => this.#shown(entry, asker, roles, position);
    };
    const stranger = asker.id === 'stranger';
    // The mark of what this asker is shown on these cells.
    const bound = asker.handle?.bind;
    const markOf = async (now: Record<string, Json>) => (await this.#describe(table, table.state({ id: request.being, position, cells: now }), shownFor(now), position, stranger, bound)).mark;
    let state: string;
    try {
      state = table.state({ id: request.being, position, cells });
    } catch {
      return silent();
    }
    const shown = shownFor(cells);

    // Args that repeat a key are refused before anything runs, with the mark this asker is shown.
    if (request.strange === true) return (await land({ answer: errorOf('the args repeat a key'), mark: await markOf(cells) }, true)) ?? null;
    if (request.method === undefined) {
      const described = await this.#describe(table, state, shown, position, stranger, bound);
      return (await land(described, false)) ?? null;
    }
    const failed = async (message: string): Promise<Outcome> => (await land({ answer: errorOf(message), mark: await markOf(cells) }, true)) ?? null;
    const entry = table.asks[request.method];
    if (entry === undefined || !shown(entry)) return failed('no such ask');
    if (entry.in !== null && !entry.in.includes(state)) return failed('not in this state');
    if (callKey !== undefined) {
      const stored = row.calls[callKey];
      if (stored !== undefined) return (await land({ answer: stored.answer, mark: await markOf(cells) }, false)) ?? null;
    }
    const wire = typeof bound === 'object' && bound !== null && !Array.isArray(bound) ? { ...(request.args as object), ...bound } : (request.args ?? {});
    const why = this.#tools.check(entry.args, wire);
    if (why !== null) return failed(why);

    // Her own wait, never past the ground's bound, nor past the chain that asks.
    const now = this.#clock.now();
    const tx = new Tx(this, request.being, row, resolved, Math.min(now + Math.min(entry.wait, this.#wait), request.until ?? Number.POSITIVE_INFINITY));
    let answer: Answer;
    try {
      const args = await inward(this.#tools, this.#marks, entry.args, wire, (hex) => tx.accept(hex));
      const being = Reflect.construct(Class as unknown as new () => object, []) as Record<string, unknown>;
      tx.cells = copy(cells);
      Object.defineProperties(being, tx.reach(asker, position, table));
      const method = being[request.method] as (args: unknown) => unknown;
      // The ask has its own wait, and fails where the method runs past it.
      const ran = await this.within(
        entry.wait,
        (async () => {
          const value = await method.call(being, args);
          await tx.settle();
          return { value };
        })(),
      );
      if (ran === null) throw new Fail('the ask ran out of time');
      const returned = ran.value;
      const after = table.state({ id: request.being, position, cells: tx.cells });
      const to = entry.to ?? [state];
      if (!to.includes(after)) throw new Error(`she landed in ${after}`);
      if (!isJson(tx.cells)) throw new Fail('a handle, an invitation or a value that is not JSON stands in her cells');
      if (entry.hints.readOnly && (tx.ops.length > 0 || this.#tools.canonical(tx.cells) !== this.#tools.canonical(cells))) throw new Error('a readOnly ask wrote');
      const result = entry.result === undefined ? null : await outward(
              this.#tools,
              this.#marks,
              entry.result,
              returned,
              request.being,
              (handle) => tx.mint(handle, request.reader ?? 'house'),
              (hex) => tx.redeem(hex, request.reader ?? 'house'),
            );
      answer = { result: result as Json };
    } catch (error) {
      await tx.abandon();
      tx.untake();
      this.#dropMinting(tx);
      return failed(error instanceof Fail || error instanceof Crossing ? error.message : 'the ask failed');
    }

    const outcome = { answer, mark: await markOf(tx.cells) };
    // A read writes none of her cells: it ran on the cells last landed, and an ask may have landed beside it. It records no call id, since running it again writes nothing.
    // An ask that changed nothing and carries no call id writes nothing either.
    const changed = tx.ops.length > 0 || callKey !== undefined || this.#tools.canonical(tx.cells) !== this.#tools.canonical(cells);
    const writes = (!entry.hints.readOnly && changed) || request.always !== undefined || asker.handle?.once === true;
    let landed = true;
    try {
      if (writes) landed = await this.#rows.transact(async (draft) => {
        const current = await draft.get<BeingRow>(place);
        if (current === null) throw new Error('she was removed while she was asked');
        if (!entry.hints.readOnly) current.cells = tx.cells;
        if (callKey !== undefined && !entry.hints.readOnly) current.calls[callKey] = { answer, at: this.#clock.now() };
        if (asker.handle?.once === true) await this.#dismiss(draft, current, request.occupant);
        for (const op of tx.ops) await op(draft, current);
        await request.always?.change(draft, outcome);
        this.#prune(current);
      });
    } catch (error) {
      // A change her powers could not make, such as an occupant held already: nothing of her ask lands.
      tx.untake();
      this.#dropMinting(tx);
      return failed(error instanceof Fail ? error.message : 'the ask failed');
    }
    if (!landed) tx.untake();
    this.#dropMinting(tx);
    if (!landed) return null;
    request.always?.landed?.();
    await tx.landed();
    if (!entry.hints.readOnly) this.#touched(request.being);
    return outcome;
  }

  #dropMinting(tx: Tx) {
    for (const heir of tx.heirs) this.#minting.delete(heir);
    for (const token of tx.tokens) this.#tokening.delete(token);
    tx.end();
  }

  // Removes an occupant and every way to reach her through it: its heirs' places and its tokens'.
  async #dismiss(draft: Draft, row: BeingRow, occupant: string) {
    const held = row.occupants[occupant];
    delete row.occupants[occupant];
    if (held !== undefined) await this.#forget(draft, held);
  }

  // The places of an occupant's heirs and tokens, gone.
  async #forget(draft: Draft, held: OccupantRow) {
    for (const heir of Object.keys(held.quo ?? {})) draft.set(await this.#heirPlace(heir), null);
    for (const token of held.tokens ?? []) draft.set(await this.#tokenPlace(token), null);
  }

  /** Call ids and dead letters are kept seven days, and go at her next write after. */
  #prune(row: BeingRow | null) {
    if (row === null) return;
    const since = this.#clock.now() - WEEK;
    for (const [key, call] of Object.entries(row.calls)) if (call.at < since) delete row.calls[key];
    row.dead = row.dead.filter((letter) => letter.at >= since);
  }

  // ---- what is due ----

  /**
   * One wait for the earliest time anything is due. A being whose due work
   * is all in flight is left out until something of hers lands, so the
   * house never wakes for work it is already doing.
   */
  async #arm(): Promise<void> {
    // A wake arms again at its end.
    if (this.#waking) return;
    const times = [...this.#dueAt].filter(([being]) => !this.#blocked.has(being)).map(([, at]) => at);
    const earliest = times.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...times);
    const now = this.#clock.now();
    if (earliest <= now) {
      this.#waking = true;
      void this.#wake();
      return;
    }
    if (earliest === this.#armed) return;
    this.#armed = earliest;
    if (earliest === Number.POSITIVE_INFINITY) {
      this.#clock.cancel({ id: 'due' });
      return;
    }
    void this.#clock.wait({ id: 'due', ms: earliest - now }).then((fired) => {
      if (!fired) return;
      this.#armed = Number.POSITIVE_INFINITY;
      return this.#arm();
    });
  }

  async #wake(): Promise<void> {
    try {
      const now = this.#clock.now();
      const due = [...this.#dueAt].filter(([being, at]) => at <= now && !this.#blocked.has(being));
      await Promise.allSettled(due.map(([being]) => this.#fire(being).then(() => this.#pump(being))));
      for (const [being] of due) if ((this.#dueAt.get(being) ?? Number.POSITIVE_INFINITY) <= this.#clock.now()) this.#blocked.add(being);
    } finally {
      this.#waking = false;
    }
    await this.#arm();
  }

  // Her alarms whose time has come, each asked as the occupant steward.
  async #fire(being: string): Promise<void> {
    const place = await this.#place(being);
    const row = await this.#rows.get<BeingRow>(place);
    if (row === null) return;
    const now = this.#clock.now();
    for (const [key, alarm] of Object.entries(row.alarms)) {
      if (alarm.at > now) continue;
      await this.ask({
        being,
        occupant: STEWARD,
        house: true,
        method: alarm.ask,
        args: alarm.args,
        always: {
          change: async (draft) => {
            const current = await draft.get<BeingRow>(place);
            if (current === null || current.alarms[key]?.at !== alarm.at) return;
            delete current.alarms[key];
            this.#prune(current);
          },
        },
      });
    }
  }

  // ---- effects ----

  /** Sends what is due of her outbox, and waits for what comes due next. */
  async pump(being: string): Promise<void> {
    await this.#pump(being);
    await this.#arm();
  }

  // The first entry to each receiver, one at a time; each send is awaited.
  async #pump(being: string): Promise<void> {
    const place = await this.#place(being);
    const row = await this.#rows.get<BeingRow>(place);
    if (row === null) return;
    const now = this.#clock.now();
    const seen = new Set<string>();
    const sends: Promise<void>[] = [];
    for (const entry of row.outbox) {
      const key = laneOf(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      if (this.#inFlight.has(`${being}\n${entry.id}`)) continue;
      if (entry.deadline <= now) sends.push(this.#giveUp(being, place, entry));
      else if (entry.next <= now) sends.push(this.#send(being, place, row, entry));
    }
    // A send is started here and runs on; its own end pumps again.
    void Promise.allSettled(sends);
  }

  async #send(being: string, place: string, row: BeingRow, entry: OutboxEntry): Promise<void> {
    const flight = `${being}\n${entry.id}`;
    this.#inFlight.add(flight);
    // The entry stays in flight until what its answer changed has landed, so
    // it is never sent again while a call for it is pending.
    try {
      let answer: Answer | null;
      try {
        // A watch is held on the far side for its wait, and answers the same when it runs out.
        const watch = entry.after === undefined ? undefined : { until: this.#clock.now() + (entry.wait ?? WAIT), after: entry.after };
        answer = await this.deliver(being, row, entry.to, entry.method, entry.args, entry.id, watch?.until, watch?.after);
      } catch {
        answer = null;
      }
      if (answer === null) {
        // Transient: tried again after a wait that doubles, never past five minutes.
        const wait = Math.min(RETRY_BOUND, 1000 * 2 ** entry.tries);
        await this.#rows.transact(async (draft) => {
          const current = await draft.get<BeingRow>(place);
          const held = current?.outbox.find((one) => one.id === entry.id);
          if (current === null || held === undefined) return;
          held.tries++;
          held.next = this.#clock.now() + wait;
          this.#prune(current);
        });
        await this.#arm();
        return;
      }
      await this.#settle(being, place, entry, answer);
    } finally {
      this.#inFlight.delete(flight);
      this.#blocked.delete(being);
    }
    await this.pump(being);
  }

  // The answer lands with the entry's removal: through her reply, or alone.
  async #settle(being: string, place: string, entry: OutboxEntry, answer: Answer): Promise<void> {
    const remove = async (draft: Draft, replied: Answer | null) => {
      const current = await draft.get<BeingRow>(place);
      if (current === null) return;
      current.outbox = current.outbox.filter((one) => one.id !== entry.id);
      if (entry.reply !== undefined && (replied === null || 'error' in replied)) {
        current.dead.push({ ask: entry.reply, args: answer, at: this.#clock.now(), why: replied === null ? 'she answered nothing' : replied.error.message });
      }
      this.#prune(current);
    };
    if (entry.reply === undefined) {
      await this.#rows.transact((draft) => remove(draft, { result: null }));
      return;
    }
    await this.ask({ being, occupant: STEWARD, house: true, method: entry.reply, args: answer, always: { change: (draft, outcome) => remove(draft, answerOf(outcome)) } });
  }

  // Every entry to that receiver fails with the first. Each stays in flight
  // until its reply has landed, so no pump sends one while its turn comes.
  async #giveUp(being: string, place: string, entry: OutboxEntry): Promise<void> {
    const held = new Set([`${being}\n${entry.id}`]);
    this.#inFlight.add(`${being}\n${entry.id}`);
    try {
      const row = await this.#rows.get<BeingRow>(place);
      const behind = (row?.outbox ?? []).filter((one) => laneOf(one) === laneOf(entry));
      for (const one of behind) {
        held.add(`${being}\n${one.id}`);
        this.#inFlight.add(`${being}\n${one.id}`);
      }
      for (const one of behind) await this.#settle(being, place, one, errorOf('the call gave up at its deadline'));
    } finally {
      for (const flight of held) this.#inFlight.delete(flight);
      this.#blocked.delete(being);
    }
    await this.pump(being);
  }

  /**
   * One call to where a target points: a faculty, a being of this house, or a
   * far ward. `until` is when the chain that calls ends, near and far alike.
   * `null` is transient.
   */
  async deliver(being: string, row: BeingRow, to: Target, method: string, args: Json, id: string, until?: number, after?: string): Promise<Answer | null> {
    if ('need' in to) {
      const found = await this.#being(being);
      const offer = found?.resolved.faculties[to.need];
      if (offer === undefined) return null;
      return this.#faculty(offer, method, args, id, found!.resolved.table.needs[to.need].methods[method]);
    }
    const standing = 'standing' in to ? standingOf(being, row, to.standing) : undefined;
    if ('standing' in to && standing === undefined) return errorOf('the standing was dropped');
    if (standing?.quo !== undefined && 'standing' in to) {
      const far = await this.far(being, to.standing, method, args, id, until, after);
      return far === null || 'describe' in far ? null : far;
    }
    const local = 'being' in to ? { being: to.being, occupant: STEWARD } : standing?.local;
    if (local === undefined) return null;
    return answerOf(await this.ask({ being: local.being, occupant: local.occupant, method, args, call: id, ...(until === undefined ? {} : { until }), ...(after === undefined ? {} : { after }) }));
  }

  /**
   * One ask on a standing to a far ward, through the room and the carry. The
   * count and the knock land before the box leaves, and the move after the
   * reply. `null` is transient: silence, a word, or nothing.
   */
  far(being: string, standing: string, method: string | undefined, args: Json, call: string | undefined, until?: number, after?: string): Promise<Answer | { describe: Json } | null> {
    const key = `${being}\n${standing}`;
    const described = method === undefined ? this.#described.get(key) : undefined;
    if (described !== undefined) return Promise.resolve({ describe: described.describe });
    const turn = (this.#relations.get(key) ?? Promise.resolve()).then(() => this.#far(being, standing, method, args, call, until, after));
    this.#relations.set(
      key,
      turn.catch(() => undefined),
    );
    return turn;
  }

  /**
   * The domains that vouch for a far standing's ward, read by the carry and
   * kept on the standing. It runs after her ask lands, so a take never
   * waits on the web.
   */
  async vouch(being: string, standing: string): Promise<void> {
    const place = await this.#place(being);
    const held = (await this.#rows.get<BeingRow>(place))?.standings[standing]?.quo;
    if (held === undefined) return;
    let vouched: readonly string[];
    try {
      vouched = await this.#carry.vouched({ ward: held.invitation.ward, at: held.invitation.at ?? [] });
    } catch {
      vouched = [];
    }
    await this.#rows.transact(async (draft) => {
      const relation = (await draft.get<BeingRow>(place))?.standings[standing];
      if (relation !== undefined) relation.vouched = [...vouched];
    });
  }

  async #far(being: string, standing: string, method: string | undefined, args: Json, call: string | undefined, until: number | undefined, after: string | undefined): Promise<Answer | { describe: Json } | null> {
    const place = await this.#place(being);
    const row = await this.#rows.get<BeingRow>(place);
    const held = row?.standings[standing]?.quo;
    if (held === undefined) return errorOf('the standing was dropped');
    const moveTo = async (next: typeof held, route?: string) =>
      this.#rows.transact(async (draft) => {
        const current = await draft.get<BeingRow>(place);
        const relation = current?.standings[standing];
        if (relation === undefined) return;
        relation.quo = next;
        if (route !== undefined) relation.route = route;
      });
    // What is left of the chain goes with the ask, and a spent chain sends nothing.
    const left = until === undefined ? undefined : until - this.#clock.now();
    if (left !== undefined && left <= 0) return null;
    const sealed = await this.#room.seal(held, {
      ...(method === undefined ? {} : { method, args: this.#tools.canonical(args) }),
      ...(call === undefined ? {} : { call }),
      ...(left === undefined ? {} : { within: left }),
      ...(after === undefined ? {} : { after }),
    });
    if (!(await moveTo(sealed.standing))) return null;
    // The address that last answered goes first, then the invitation's in its order.
    const route = row!.standings[standing].route;
    const at = [...new Set([...(route === undefined ? [] : [route]), ...(held.invitation.at ?? [])])];
    let reply: Uint8Array | null = null;
    let via: string | undefined;
    // A carry that failed says nothing of where the box went, so it may have been heard.
    let heard = true;
    try {
      // An ask that runs its whole time, a watch above all, still has a margin for its reply to come home.
      const sent = await this.#carry.send({ ward: held.invitation.ward, at, box: sealed.box, ...(left === undefined ? {} : { wait: left + HOMEWARD }) });
      if (sent.reply !== null) ({ reply, via } = sent);
      else heard = sent.heard;
    } catch {
      reply = null;
    }
    const { read, standing: moved } = await this.#room.read(sealed.standing, sealed.pending, reply, heard);
    // Where the ward says it is reached now replaces where its invitation said.
    const told = 'object' in read && read.at !== undefined ? { ...moved, invitation: { ...moved.invitation, at: read.at } } : moved;
    // A route is pinned only by a reply that opened as the far ward's, an
    // object or a word. Silence may be bytes no key of hers sealed, and pins nothing.
    await moveTo(told, 'object' in read || 'quo' in read ? via : undefined);
    // A ward reached somewhere new may be vouched for by another domain.
    if (told !== moved) void this.vouch(being, standing);
    if (!('object' in read)) return null;
    const key = `${being}\n${standing}`;
    if (method === undefined) {
      this.#described.set(key, { mark: read.seen, describe: read.object as Json });
      return { describe: read.object as Json };
    }
    if (this.#described.get(key)?.mark !== read.seen) this.#described.delete(key);
    const object = read.object as { result?: Json; error?: { message?: unknown } } | null;
    if (object !== null && typeof object === 'object' && 'result' in object && Object.keys(object).length === 1) return { result: object.result as Json };
    if (object !== null && typeof object === 'object' && typeof object.error?.message === 'string') return errorOf(object.error.message);
    return errorOf('the far being answered no answer');
  }

  // What calls a faculty's tokens: the same for a method's context and for the one it is told the house opened with.
  #calls(offer: Offer & { bp: Blueprint }): Pick<FacultyContext, 'call' | 'describe'> {
    return {
      call: ({ token, method: asked, args: called, id: callId, after, home }) => this.#token(token, { method: asked, args: called ?? {}, id: callId, after, home }, offer),
      describe: ({ token }) => this.#tokenDescribe(token, offer),
    };
  }

  /** Each offer told the house opened, with the context that calls its tokens. */
  async tellOpened(): Promise<void> {
    for (const offer of this.#offers) await offer.opened?.({ ward: this.ward, ...this.#calls(offer) });
  }

  async #faculty(offer: Offer & { bp: Blueprint }, method: string, args: Json, id: string, want: BlueprintMethod | undefined): Promise<Answer | null> {
    const context: FacultyContext = { id, ...this.#calls(offer) };
    // Her need let the args pass, and the offer may be narrower: covering is decided on names, and types on each call.
    const spec = offer.bp.methods[method];
    const refused = spec === undefined ? `the offer ${offer.bp.name} has no method ${method}` : this.#tools.check(spec.args, args);
    if (refused !== null) return errorOf(refused);
    let answered: unknown;
    try {
      answered = await (offer.object as Record<string, (args: Json, context: FacultyContext) => Promise<unknown>>)[method](args, context);
    } catch {
      // A throw is a failure to answer, and transient: silence, which no cause is read from.
      return null;
    }
    if (typeof answered !== 'object' || answered === null) return errorOf('the faculty answered no answer');
    if ('error' in answered) {
      const message = (answered as { error?: { message?: unknown } }).error?.message;
      return errorOf(typeof message === 'string' ? message : 'the faculty failed');
    }
    if (!('result' in answered)) return errorOf('the faculty answered no answer');
    const result = (answered as { result: Json }).result;
    const why = want?.result === undefined ? null : this.#tools.check(want.result, result);
    return why === null ? { result } : errorOf(why);
  }

  // The occupant a faculty's token reaches, and the one ask a handle's
  // token is admitted to. A token answers the faculty it was handed to
  // alone: another holding the string is told there is no such token.
  async #tokenHolder(token: string, offer: Offer & { bp: Blueprint }): Promise<{ being: string; occupant: string; ask?: string } | null> {
    // A token her ask handed out before it landed answers once it has.
    await this.#tokening.get(token);
    const owner = await this.#rows.get<OwnerRow>(await this.#tokenPlace(token));
    if (owner === null || owner.faculty !== offer.bp.name) return null;
    const found = await this.#being(owner.being);
    if (found === null || !Object.values(found.resolved.faculties).includes(offer)) return null;
    const held = (await this.#rows.get<BeingRow>(await this.#place(owner.being)))?.occupants[owner.occupant];
    if (held === undefined) return null;
    return { being: owner.being, occupant: owner.occupant, ...(held.ask === undefined ? {} : { ask: held.ask }) };
  }

  // A faculty asks through a token it was handed: a handle's one ask, or
  // any ask its occupant may call, as that occupant.
  async #token(token: string, { method: asked, args, id, after, home }: { method?: string; args: Json; id: string; after?: Answer; home?: boolean }, offer: Offer & { bp: Blueprint }): Promise<Answer> {
    const holder = await this.#tokenHolder(token, offer);
    if (holder === null) return errorOf('no such token');
    const method = holder.ask ?? asked;
    if (method === undefined) return errorOf('a call on an occupant names its method');
    if (asked !== undefined && asked !== method) return errorOf('no such ask');
    const watch = after === undefined ? {} : { after: await this.digest(after) };
    // A door carried home leaves for a house, as an invitation; every other for this faculty, as a token.
    const reader: Reader = home === true ? 'house' : { faculty: offer.bp.name };
    const outcome = await this.ask({ being: holder.being, occupant: holder.occupant, method, args, call: `token:${id}`, reader, ...watch });
    return outcome !== null && 'answer' in outcome ? outcome.answer : errorOf('the house answered nothing');
  }

  // What the occupant behind a token may ask now: her describe, as that occupant sees it.
  async #tokenDescribe(token: string, offer: Offer & { bp: Blueprint }): Promise<{ describe: Json } | { error: { message: string } }> {
    const holder = await this.#tokenHolder(token, offer);
    if (holder === null) return errorOf('no such token') as { error: { message: string } };
    const outcome = await this.ask({ being: holder.being, occupant: holder.occupant, reader: { faculty: offer.bp.name } });
    if (outcome !== null && 'describe' in outcome) return { describe: outcome.describe };
    return errorOf('the house answered nothing') as { error: { message: string } };
  }

  // ---- what a transaction reaches ----

  get tools() {
    return this.#tools;
  }
  get marks() {
    return this.#marks;
  }

  /** A promise raced against the house's clock: `null` where the wait runs out first. */
  async within<T>(ms: number, promise: Promise<T>): Promise<T | null> {
    const id = `within:${++this.#withins}`;
    const timeout = this.#clock.wait({ id, ms }).then((fired) => (fired ? null : new Promise<never>(() => undefined)));
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      this.#clock.cancel({ id });
    }
  }
  get crypto() {
    return this.#crypto;
  }
  get clock() {
    return this.#clock;
  }
  get room() {
    return this.#room;
  }
  get carry() {
    return this.#carry;
  }

  /** The key this house signs with as a stranger to one far ward: its own for that ward, the same every time. */
  async strangerSecret(ward: string): Promise<string> {
    return this.#tools.hex(await this.#keys.derive(`stranger:${ward}`, 32));
  }
  get wardPlace() {
    return this.#wardPlace;
  }
  get minting() {
    return this.#minting;
  }
  get tokening() {
    return this.#tokening;
  }
  place(being: string) {
    return this.#place(being);
  }
  resolveKind(kind: string) {
    return this.#resolve(kind);
  }
  beingOf(id: string) {
    return this.#being(id);
  }
  rows() {
    return this.#rows;
  }
  heirPlace(heir: string) {
    return this.#heirPlace(heir);
  }
  tokenPlace(token: string) {
    return this.#tokenPlace(token);
  }
  dismissIn(draft: Draft, row: BeingRow, occupant: string) {
    return this.#dismiss(draft, row, occupant);
  }
  forget(draft: Draft, held: OccupantRow) {
    return this.#forget(draft, held);
  }

  /**
   * Every heir of hers left unspent past its time, let go. It runs where
   * she mints and where one of her heirs binds, so nothing waits on a clock
   * to clean, and it reads her row alone.
   */
  async sweep(draft: Draft, row: BeingRow): Promise<void> {
    const now = this.#clock.now();
    for (const held of Object.values(row.occupants)) {
      for (const [heir, until] of Object.entries(held.until ?? {})) {
        if (until > now) continue;
        delete held.until![heir];
        if (held.quo?.[heir]?.spent === true) continue;
        if (held.quo !== undefined) delete held.quo[heir];
        if (held.told !== undefined) delete held.told[heir];
        draft.set(await this.#heirPlace(heir), null);
      }
    }
  }

  // Whose occupant an heir reaches, and whether it may still bind now.
  async #heir(heir: string): Promise<{ owner: OwnerRow; row: BeingRow } | undefined> {
    const owner = await this.#rows.get<OwnerRow>(await this.#heirPlace(heir));
    if (owner === null) return undefined;
    const row = await this.#rows.get<BeingRow>(await this.#place(owner.being));
    const until = row?.occupants[owner.occupant]?.until?.[heir];
    // An heir left unspent past its time is one the door never held.
    if (row === null || (until !== undefined && until <= this.#clock.now())) return undefined;
    return { owner, row };
  }
  heir(heir: string) {
    return this.#heir(heir);
  }
  arm() {
    return this.#arm();
  }
  asker(being: string, row: BeingRow, occupant: string) {
    return this.#asker(being, row, occupant, false);
  }
  rolesFor(table: Table, asker: Asker & { handle?: OccupantRow }, me: { id: string; position: Position; cells: Record<string, Json> }) {
    return this.#roles(table, asker, me);
  }
  shownTo(entry: TableEntry, asker: Asker & { handle?: OccupantRow }, roles: Set<string>, position: Position) {
    return this.#shown(entry, asker, roles, position);
  }

  // ---- the door ----

  /** Sealed bytes in, sealed bytes or nothing out. It settles once what the ask caused is written. */
  async door(box: Uint8Array): Promise<Uint8Array | null> {
    const since = this.#settled;
    const ward = await this.#rows.get<WardRow>(this.#wardPlace);
    let found: OwnerRow | undefined;
    const arrival = await this.#room.arrive(box, {
      occupant: async (heir) => {
        const held = await this.#heir(heir);
        found = held?.owner;
        return held?.row.occupants[held.owner.occupant]?.quo?.[heir];
      },
      zero: ward?.beings[PUBLIC] !== undefined,
    });
    if (arrival.refused) return arrival.reply;
    const parsed = this.#tools.parse(arrival.args);
    const args = (parsed?.value ?? {}) as Json;
    if (arrival.heir === null) return this.#stranger(arrival, args);

    // Admitted on a record another arrival is moving, or moved since this
    // one read it: judged again, on the record as it stands.
    const heir = arrival.heir;
    const busy = this.#arriving.get(heir);
    if (busy !== undefined || (this.#moved.get(heir) ?? -1) >= since) {
      await busy?.catch(() => undefined);
      return this.door(box);
    }
    const owner = found!;
    let done!: () => void;
    this.#arriving.set(heir, new Promise<void>((settle) => (done = settle)));
    try {
      const place = await this.#place(owner.being);
      let reply: Uint8Array | null = null;
      let chosen: Uint8Array | null = null;
      // Quo's move and count land with the ask, whatever its outcome.
      const always = {
        change: async (draft: Draft, outcome: Outcome) => {
          const row = await draft.get<BeingRow>(place);
          const held = row?.occupants[owner.occupant];
          // Where the ward is reached now goes in a reply only when this holder last heard otherwise.
          const now = this.#carry.at({});
          const told = held?.told?.[heir];
          const moved = outcome !== null && (told === undefined || told.length !== now.length || told.some((address, at) => address !== now[at]));
          const { reply: sealed, occupant } = await arrival.choose(this.#choice(outcome, moved ? now : undefined));
          chosen = sealed;
          const binds = held?.quo?.[heir]?.spent === false && occupant?.spent === true;
          if (held?.quo !== undefined && occupant !== null) held.quo[heir] = occupant;
          if (held !== undefined && moved) held.told = { ...held.told, [heir]: now };
          // The knock that binds spends the heir, which never expires after, and lets go of every other past its time.
          if (binds && row !== null) {
            if (held?.until !== undefined) delete held.until[heir];
            await this.sweep(draft, row);
          }
        },
        landed: () => {
          reply = chosen;
        },
      };
      await this.ask({
        ...(arrival.strange ? { strange: true } : {}),
        being: owner.being,
        occupant: owner.occupant,
        ...(arrival.method === undefined ? {} : { method: arrival.method }),
        args,
        ...(arrival.call === undefined ? {} : { call: arrival.call }),
        ...(arrival.within === undefined ? {} : { until: this.#clock.now() + arrival.within }),
        ...(arrival.after === undefined ? {} : { after: arrival.after }),
        always,
      });
      return reply;
    } finally {
      this.#moved.set(heir, this.#settled++);
      this.#arriving.delete(heir);
      done();
    }
  }

  #choice(outcome: Outcome, at?: readonly string[]): Choice {
    if (outcome === null) return { silence: true };
    const object = 'describe' in outcome ? outcome.describe : outcome.answer;
    return { object: this.#tools.canonical(object), seen: outcome.mark, ...(at === undefined ? {} : { at }) };
  }

  // The zero head: a stranger asks the public being, and a replay within the window gets the same answer.
  async #stranger(arrival: Admitted, args: Json): Promise<Uint8Array | null> {
    const now = this.#clock.now();
    for (const [signature, kept] of this.#replays) if (kept.at + REPLAY_WINDOW <= now) this.#replays.delete(signature);
    const kept = this.#replays.get(arrival.signature);
    if (kept !== undefined) return (await arrival.choose(kept.choice)).reply;
    // Where memory refuses her write, the house answers nothing, so the stranger asks again.
    let landed = false;
    const outcome = await this.ask({
      being: PUBLIC,
      occupant: 'stranger',
      ...(arrival.strange ? { strange: true } : {}),
      signer: this.#tools.bytes(arrival.by)!,
      ...(arrival.method === undefined ? {} : { method: arrival.method }),
      args,
      ...(arrival.within === undefined ? {} : { until: now + arrival.within }),
      ...(arrival.after === undefined ? {} : { after: arrival.after }),
      always: {
        change: () => undefined,
        landed: () => {
          landed = true;
        },
      },
    });
    if (!landed) return null;
    const choice = this.#choice(outcome);
    this.#replays.set(arrival.signature, { choice, at: now });
    return (await arrival.choose(choice)).reply;
  }
}

const targetKey = (to: Target): string => ('need' in to ? `need:${to.need}` : 'standing' in to ? `standing:${to.standing}` : `being:${to.being}`);

// The lane an entry leaves in: its receiver's, one at a time and in order, or a watch's own beside it.
const laneOf = (entry: OutboxEntry): string => (entry.after === undefined ? targetKey(entry.to) : `${targetKey(entry.to)}\nwatch:${entry.method}`);

type Op = (draft: Draft, row: BeingRow) => Promise<void> | void;

/** One ask's work: her reach, and the changes that land with her cells. */
class Tx {
  readonly #house: House;
  readonly #being: string;
  readonly #row: BeingRow;
  readonly #resolved: Resolved;
  readonly ops: Op[] = [];
  readonly heirs: string[] = [];
  readonly tokens: string[] = [];
  #end!: () => void;
  /** Settles once her ask has landed or failed. */
  readonly ended = new Promise<void>((settle) => (this.#end = settle));
  /** Occupants her steward's powers minted on other beings in this ask. */
  readonly #invited = new Set<string>();
  readonly #pending: Promise<unknown>[] = [];
  readonly #after: (() => Promise<void>)[] = [];
  /** Invitations she took before their mint landed, each put back where her ask lands nothing. */
  readonly #untaken: (() => void)[] = [];
  /** Far standings she took in this ask, which she asks from the next. */
  readonly #taken = new Set<string>();
  cells: Record<string, Json> = {};
  #effects = false;

  /** When her ask's own wait runs out. */
  readonly #deadline: number;

  constructor(house: House, being: string, row: BeingRow, resolved: Resolved, deadline: number) {
    this.#house = house;
    this.#being = being;
    this.#row = copy(row);
    this.#resolved = resolved;
    this.#deadline = deadline;
  }

  #op(op: Op, mirror?: (row: BeingRow) => void) {
    this.ops.push(op);
    mirror?.(this.#row);
  }

  end(): void {
    this.#end();
  }

  /** Her ask landed nothing, so what she took was never taken. */
  untake(): void {
    for (const back of this.#untaken.splice(0)) back();
  }

  /** Waits for every call she made and did not await. */
  async settle(): Promise<void> {
    while (this.#pending.length > 0) await Promise.all(this.#pending.splice(0));
  }

  /** Her calls let go where her ask failed: nothing of them lands. */
  async abandon(): Promise<void> {
    await Promise.allSettled(this.#pending.splice(0));
  }

  /** What runs once her write has landed. */
  async landed(): Promise<void> {
    if (this.#effects) void this.#house.pump(this.#being);
    for (const after of this.#after) void after();
    await this.#house.arm();
  }

  // An invitation's hex made a standing: bound at once where it is this house's.
  async accept(hex: string): Promise<string> {
    const house = this.#house;
    const bytes = house.tools.bytes(hex);
    const text = bytes === null ? null : house.tools.text(bytes);
    const parsed = text === null ? null : house.tools.parse(text);
    const invitation = parsed === null ? null : await house.room.invitation(parsed.value);
    if (invitation === null) throw new Fail('an invitation was owed and none came');
    // Named by its heir, so a paper she took already answers the standing it made.
    const id = `standing:${house.tools.hex((await house.crypto.sha256(house.tools.utf8(invitation.heir))).subarray(0, 8))}`;
    if (this.#row.standings[id] !== undefined) return id;
    if (invitation.ward === (await house.room.ward())) {
      const minting = house.minting.get(invitation.heir);
      const landed = (await house.heir(invitation.heir))?.owner;
      const owner = landed ?? (minting !== undefined && (minting.until ?? Number.POSITIVE_INFINITY) > house.clock.now() ? minting : undefined);
      if (owner === undefined) throw new Fail('the invitation is spent or unknown');
      if (owner.being === this.#being) throw new Fail('she takes no invitation to herself');
      // Taken while its mint has not landed, it is spent before it lands: the mint writes nothing of it.
      // Where her ask fails, it was never taken, and goes back.
      house.minting.delete(invitation.heir);
      if (landed === undefined) this.#untaken.push(() => house.minting.set(invitation.heir, owner));
      const standing: StandingRow = { notes: {}, steward: {}, local: { being: owner.being, occupant: owner.occupant } };
      this.#op(
        async (draft, row) => {
          const heirPlace = await house.heirPlace(invitation.heir);
          // Read in her write, so a taker who landed first leaves this one nothing to bind.
          if (landed !== undefined && (await draft.get<OwnerRow>(heirPlace)) === null) throw new Fail('the invitation is spent or unknown');
          row.standings[id] = standing;
          const target = owner.being === this.#being ? row : await draft.get<BeingRow>(await house.place(owner.being));
          draft.set(heirPlace, null);
          const occupant = target?.occupants[owner.occupant];
          if (occupant?.quo !== undefined) delete occupant.quo[invitation.heir];
          if (occupant?.told !== undefined) delete occupant.told[invitation.heir];
          if (occupant?.until !== undefined) delete occupant.until[invitation.heir];
        },
        (row) => {
          row.standings[id] = standing;
        },
      );
      return id;
    }
    const standing: StandingRow = { notes: {}, steward: {}, quo: house.room.standing(invitation) };
    this.#taken.add(id);
    this.#after.push(() => house.vouch(this.#being, id));
    this.#op(
      (_draft, row) => {
        row.standings[id] = standing;
      },
      (row) => {
        row.standings[id] = standing;
      },
    );
    return id;
  }

  /** A handle she holds made what its reader can call: an invitation's hex, or a token. */
  async mint({ being, occupant, expires }: { being: string; occupant: string; expires?: number }, reader: Reader): Promise<string> {
    const house = this.#house;
    const own = being === this.#being;
    if (own ? this.#row.occupants[occupant] === undefined : !this.#invited.has(`${being}\n${occupant}`)) throw new Fail('the handle was let go');
    const target = async (draft: Draft, row: BeingRow) => (own ? row : draft.get<BeingRow>(await house.place(being)));
    if (reader !== 'house') return this.#token(being, occupant, reader);
    const { invitation, occupant: end } = await house.room.invite(house.carry.at({}));
    const until = expires === undefined ? undefined : house.clock.now() + expires;
    this.heirs.push(invitation.heir);
    house.minting.set(invitation.heir, { being, occupant, ...(until === undefined ? {} : { until }) });
    this.#op(async (draft, row) => {
      const minted = await target(draft, row);
      if (minted === null) return;
      await house.sweep(draft, minted);
      const held = minted.occupants[occupant];
      // A being of this house took it while this ask ran, so it lands spent.
      if (held === undefined || !house.minting.has(invitation.heir)) return;
      held.quo = { ...held.quo, [invitation.heir]: end };
      held.told = { ...held.told, [invitation.heir]: invitation.at ?? [] };
      if (until !== undefined) held.until = { ...held.until, [invitation.heir]: until };
      draft.set(await house.heirPlace(invitation.heir), { being, occupant } satisfies OwnerRow);
    });
    return house.tools.hex(house.tools.utf8(house.tools.canonical(invitation)));
  }

  // A token a faculty calls, for one occupant of a being of this house.
  #token(being: string, occupant: string, reader: { readonly faculty: string }): string {
    const house = this.#house;
    const token = house.tools.hex(house.crypto.random(16));
    this.tokens.push(token);
    house.tokening.set(token, this.ended);
    this.#op(async (draft, row) => {
      const held = (being === this.#being ? row : await draft.get<BeingRow>(await house.place(being)))?.occupants[occupant];
      if (held === undefined) return;
      held.tokens = [...(held.tokens ?? []), token];
      draft.set(await house.tokenPlace(token), { being, occupant, faculty: reader.faculty } satisfies OwnerRow);
    });
    return token;
  }

  /**
   * An invitation this house minted, carried unopened to a faculty, made a
   * token for its occupant there. Its heir is spent, so no house ever binds
   * it after. Any other invitation, or one bound already, stays itself.
   */
  async redeem(hex: string, reader: Reader): Promise<string | undefined> {
    if (reader === 'house') return undefined;
    const house = this.#house;
    const bytes = house.tools.bytes(hex);
    const text = bytes === null ? null : house.tools.text(bytes);
    if (text === null) return undefined;
    let read: unknown;
    try {
      read = JSON.parse(text);
    } catch {
      return undefined;
    }
    const { ward, heir } = (read ?? {}) as { ward?: unknown; heir?: unknown };
    if (ward !== house.ward || typeof heir !== 'string') return undefined;
    const minting = house.minting.get(heir);
    const owner = minting ?? (await house.heir(heir))?.owner;
    if (owner === undefined) return undefined;
    const { being, occupant } = owner;
    // An heir minted in an ask still running lands spent; one landed is let go here.
    if (minting !== undefined) house.minting.delete(heir);
    else {
      const bound = (await house.heir(heir))?.row.occupants[occupant]?.quo?.[heir];
      if (bound === undefined || bound.spent) return undefined;
    }
    this.#op(async (draft, row) => {
      const minted = being === this.#being ? row : await draft.get<BeingRow>(await house.place(being));
      const held = minted?.occupants[occupant];
      if (held !== undefined) {
        if (held.quo !== undefined) delete held.quo[heir];
        if (held.told !== undefined) delete held.told[heir];
        if (held.until !== undefined) delete held.until[heir];
      }
      draft.set(await house.heirPlace(heir), null);
    });
    return this.#token(being, occupant, reader);
  }

  #fresh(prefix: string): string {
    return `${prefix}${this.#house.tools.hex(this.#house.crypto.random(8))}`;
  }

  // A far standing she took in this ask: its knock would spend the heir on an ask that may land nothing.
  #untakenYet(standing: string) {
    if (this.#taken.has(standing)) throw new Fail(`${standing} was taken in this ask, and is asked from the next`);
  }

  #checkReply(reply: string | undefined) {
    if (reply !== undefined && this.#resolved.table.asks[reply] === undefined) throw new Fail(`she has no ask ${reply} to reply to`);
  }

  // A call out: awaited now, or an effect queued to leave once she lands.
  #call(to: Target, method: string, args: unknown, awaited: boolean, reply: string | undefined, schema: { args?: unknown; result?: unknown; wait?: number } | undefined, watch?: { readonly held: unknown }): Promise<unknown> | undefined {
    const house = this.#house;
    const reader: Reader = 'need' in to ? { faculty: this.#resolved.faculties[to.need].bp.name } : 'house';
    const wire = async () => {
      try {
        return (await outward(house.tools, house.marks, schema?.args as never, args ?? {}, this.#being, (handle) => this.mint(handle, reader))) as Json;
      } catch (error) {
        if (error instanceof Crossing) throw new Fail(error.message);
        throw error;
      }
    };
    // A watch given a reply leaves after she lands, as an effect does, and its answer asks her reply.
    if (awaited && !(watch !== undefined && reply !== undefined)) {
      return (async () => {
        if ('standing' in to) this.#untakenYet(to.standing);
        const sent = await wire();
        const id = house.tools.hex(house.crypto.random(16));
        // A watch carries the digest of the result she holds.
        const after = watch === undefined ? undefined : await house.digest({ result: (watch.held ?? null) as Json });
        // The callee's wait, and never past what is left of her own.
        const wait = Math.min(schema?.wait ?? WAIT, this.#deadline - house.clock.now());
        // The callee has what she waits for, and not a moment more, near or far.
        const answer = wait <= 0 ? null : await house.within(wait, house.deliver(this.#being, this.#row, to, method, sent, id, house.clock.now() + wait, after));
        // Silence has no cause she may read: a dead address, a spent heir and a late reply are one.
        if (answer === null) throw new Fail(`${method} answered nothing`);
        if ('error' in answer) throw new Fail(answer.error.message);
        return inward(house.tools, house.marks, schema?.result as never, answer.result, (hex) => this.accept(hex));
      })();
    }
    this.#checkReply(reply);
    const queued = (async () => {
      const sent = await wire();
      const now = house.clock.now();
      const window = 'need' in to ? (this.#resolved.faculties[to.need]?.window ?? WEEK) : WEEK;
      const watching = watch === undefined ? {} : { after: await house.digest({ result: (watch.held ?? null) as Json }), wait: schema?.wait ?? WAIT };
      const entry: OutboxEntry = { id: house.tools.hex(house.crypto.random(16)), to, method, args: sent, ...(reply === undefined ? {} : { reply }), ...watching, queued: now, deadline: now + window, next: now, tries: 0 };
      this.#effects = true;
      this.#op((_draft, row) => {
        row.outbox.push(entry);
      });
    })();
    this.#pending.push(queued);
    return undefined;
  }

  // The face of one need, or of a standing matched to a need: its methods alone.
  #face(to: Target, blueprint: Blueprint): Readonly<Record<string, (args?: unknown, options?: { reply?: string; after?: unknown }) => unknown>> {
    const face: Record<string, (args?: unknown, options?: { reply?: string; after?: unknown }) => unknown> = {};
    for (const [method, spec] of Object.entries(blueprint.methods)) {
      face[method] = (args, options) => {
        const watching = options !== undefined && 'after' in options;
        // A watch asks a being's readOnly ask, and nothing else.
        if (watching && 'need' in to) throw new Fail(`${method} is a faculty's, and only a being is watched`);
        if (watching && !spec.hints.readOnly) throw new Fail(`${method} is not readOnly, so it is never watched`);
        return this.#call(to, method, args, spec.hints.idempotent, options?.reply, spec, watching ? { held: options.after } : undefined);
      };
    }
    return Object.freeze(face);
  }

  // What a standing shows her now: a far one's describe, kept until its mark moves, or a near one's.
  async #describeOf(standing: string): Promise<{ state: string; asks: readonly DescribedAsk[] }> {
    const house = this.#house;
    const held = standingOf(this.#being, this.#row, standing);
    if (held === undefined) throw new Fail(`she holds no standing ${standing}`);
    this.#untakenYet(standing);
    const left = this.#deadline - house.clock.now();
    const read =
      left <= 0
        ? null
        : await house.within(
            left,
            held.local === undefined
              ? house.far(this.#being, standing, undefined, {}, undefined, this.#deadline)
              : house.ask({ being: held.local.being, occupant: held.local.occupant, until: this.#deadline }).then((outcome) => (outcome !== null && 'describe' in outcome ? { describe: outcome.describe } : null)),
          );
    if (read === null || !('describe' in read)) throw new Fail(`${standing} answered nothing`);
    const describe = read.describe as { state?: unknown; asks?: unknown };
    // Data that holds no list of asks is data, and no describe.
    if (!Array.isArray(describe.asks) || typeof describe.state !== 'string') throw new Fail(`${standing} answered no describe`);
    return { state: describe.state, asks: describe.asks as DescribedAsk[] };
  }

  // A standing asked with no need: her describe first, then any ask it shows, awaited or an effect as it says.
  #undeclared(standing: string) {
    const shown = new Map<string, DescribedAsk>();
    return Object.freeze({
      describe: async () => {
        const described = await this.#describeOf(standing);
        for (const entry of described.asks) shown.set(entry.method, entry);
        return described;
      },
      ask: (method: string, args?: unknown, options?: { reply?: string; after?: unknown }) => {
        const entry = shown.get(method);
        if (entry === undefined) throw new Fail(`${method} is not in the describe she read of ${standing}`);
        const hints = { readOnly: entry.hints?.readOnly === true, idempotent: entry.hints?.readOnly === true || entry.hints?.idempotent === true };
        const watching = options !== undefined && 'after' in options;
        if (watching && !hints.readOnly) throw new Fail(`${method} is not readOnly, so it is never watched`);
        const spec = { args: entry.args, result: entry.result, wait: typeof entry.wait === 'number' ? entry.wait : WAIT };
        return this.#call({ standing }, method, args, hints.idempotent, options?.reply, spec, watching ? { held: options.after } : undefined);
      },
    });
  }

  // A far house's public being, asked as a stranger: every ask awaited, on the zero head, signed with this house's key for that ward.
  #stranger(card: unknown, need: unknown) {
    const blueprint = blueprintOf(need);
    if (blueprint === undefined) throw new Fail('stranger takes a need');
    const reached = cardOf(card);
    const face: Record<string, (args?: unknown) => Promise<unknown>> = {};
    for (const [method, spec] of Object.entries(blueprint.methods)) {
      face[method] = async (args) => {
        // A stranger's every ask is idempotent, so she awaits each one.
        if (!spec.hints.idempotent) throw new Fail(`${method} is no idempotent ask, and a stranger asks no other`);
        return this.#asStranger(reached, method, args, spec);
      };
    }
    return Object.freeze(face);
  }

  // A far public being asked as a stranger with no need declared: her describe first, then any ask it shows, each awaited.
  #strangerUndeclared(card: unknown) {
    const reached = cardOf(card);
    const shown = new Map<string, DescribedAsk>();
    return Object.freeze({
      describe: async () => {
        const described = (await this.#zero(reached, undefined, {}, WAIT, 'the public being')) as { state?: unknown; asks?: unknown } | null;
        // Data that holds no list of asks is data, and no describe.
        if (described === null || typeof described !== 'object' || !Array.isArray(described.asks) || typeof described.state !== 'string') throw new Fail('the public being answered no describe');
        for (const entry of described.asks as DescribedAsk[]) shown.set(entry.method, entry);
        return { state: described.state, asks: described.asks as DescribedAsk[] };
      },
      ask: async (method: string, args?: unknown) => {
        const entry = shown.get(method);
        if (entry === undefined) throw new Fail(`${method} is not in the describe she read of the public being`);
        return this.#asStranger(reached, method, args, { args: entry.args, result: entry.result, wait: typeof entry.wait === 'number' ? entry.wait : WAIT });
      },
    });
  }

  // One ask of a far public being as a stranger: her args out, and her result in.
  async #asStranger(card: { ward: string; at: readonly string[] }, method: string, args: unknown, spec: { args?: unknown; result?: unknown; wait?: number }): Promise<unknown> {
    const house = this.#house;
    let sent: Json;
    try {
      sent = (await outward(house.tools, house.marks, spec.args as never, args ?? {}, this.#being, (handle) => this.mint(handle, 'house'))) as Json;
    } catch (error) {
      throw error instanceof Crossing ? new Fail(error.message) : error;
    }
    const answer = (await this.#zero(card, method, sent, spec.wait ?? WAIT, method)) as { result?: Json; error?: { message?: unknown } } | null;
    if (answer !== null && typeof answer === 'object' && typeof answer.error?.message === 'string') throw new Fail(answer.error.message);
    if (answer === null || typeof answer !== 'object' || !('result' in answer)) throw new Fail(`${method} answered no answer`);
    return inward(house.tools, house.marks, spec.result as never, answer.result, (hex) => this.accept(hex));
  }

  // One box on the zero head, signed with this house's key for that ward, and what it answered: her describe where no method is named.
  async #zero({ ward, at }: { ward: string; at: readonly string[] }, method: string | undefined, sent: Json, wait: number, what: string): Promise<unknown> {
    const house = this.#house;
    const { box, lid } = await house.room.stranger(ward, await house.strangerSecret(ward), { ...(method === undefined ? {} : { method }), args: house.tools.canonical(sent) });
    const left = Math.min(wait, this.#deadline - house.clock.now());
    const carried = left <= 0 ? null : await house.within(left, house.carry.send({ ward, at, box, wait: left }));
    const reply = carried === null ? null : carried.reply;
    const read = reply === null ? null : await house.room.strangerRead(ward, lid, reply);
    // Silence has no cause she may read, near or far.
    if (read === null || !('object' in read)) throw new Fail(`${what} answered nothing`);
    return read.object;
  }

  // A standing of this house matched to a need through her describe.
  async #covered(standing: string, blueprint: Blueprint): Promise<void> {
    const house = this.#house;
    const held = standingOf(this.#being, this.#row, standing);
    if (held === undefined) throw new Fail(`she holds no standing ${standing}`);
    this.#untakenYet(standing);
    if (held.local === undefined) {
      // A far standing's describe, asked with the empty ask.
      // The describe is asked within what is left of her ask, as any call of hers is.
      const left = this.#deadline - house.clock.now();
      const described = left <= 0 ? null : await house.within(left, house.far(this.#being, standing, undefined, {}, undefined, this.#deadline));
      if (described === null || !('describe' in described)) throw new Silent(`${standing} answered nothing`);
      const asks = (described.describe as { asks?: unknown }).asks;
      // Data that holds no list of asks is data, and no describe.
      if (!Array.isArray(asks)) throw new Fail(`${standing} answered no describe`);
      const methods: Record<string, BlueprintMethod> = {};
      for (const entry of asks as { method: string; args?: unknown; result?: unknown; hints?: BlueprintMethod['hints']; wait?: unknown }[]) {
        methods[entry.method] = {
          wait: typeof entry.wait === 'number' ? entry.wait : WAIT,
          args: (entry.args ?? {}) as BlueprintMethod['args'],
          ...(entry.result === undefined ? {} : { result: entry.result as BlueprintMethod['args'] }),
          hints: { readOnly: entry.hints?.readOnly === true, idempotent: entry.hints?.idempotent === true, destructive: entry.hints?.destructive === true },
        };
      }
      const cover = covers({ name: blueprint.name, methods }, blueprint);
      if (!cover.covered) throw new Fail(`${standing} does not cover ${blueprint.name}: ${cover.why}`);
      return;
    }
    const target = await house.beingOf(held.local.being);
    if (target === null) throw new Fail(`${standing} is absent`);
    const row = await house.rows().get<BeingRow>(await house.place(held.local.being));
    const asker = row === null ? undefined : house.asker(held.local.being, row, held.local.occupant);
    if (row === null || asker === undefined) throw new Fail(`${standing} answers her nothing`);
    const table = target.resolved.table;
    const position = positionOf(held.local.being);
    const me = { id: held.local.being, position, cells: { ...(table.cells as Record<string, Json>), ...row.cells } };
    const roles = house.rolesFor(table, asker, me);
    const methods = Object.fromEntries(Object.values(table.asks).filter((entry) => house.shownTo(entry, asker, roles, position)).map((entry) => [entry.method, entry]));
    const cover = covers({ name: blueprint.name, methods }, blueprint);
    if (!cover.covered) throw new Fail(`${standing} does not cover ${blueprint.name}: ${cover.why}`);
  }

  /** Her reach, as property descriptors on the being. */
  reach(asker: Asker, position: Position, table: Table): PropertyDescriptorMap {
    const house = this.#house;
    const being = this.#being;
    const value = (v: unknown): PropertyDescriptor => ({ value: v, enumerable: false });
    const ownAsk = (ask: string) => {
      if (table.asks[ask] === undefined) throw new Fail(`she has no ask ${ask}`);
    };
    const relation = (id: string, held: { notes: Notes; steward: Notes }) => ({ id, notes: held.notes, steward: held.steward });

    const descriptors: PropertyDescriptorMap = {
      id: value(being),
      position: value(position),
      asker: value(Object.freeze({ ...asker, handle: undefined })),
      cells: {
        get: () => this.cells,
        set: (cells: Record<string, Json>) => {
          this.cells = cells;
        },
        enumerable: false,
      },
      house: value(
        Object.freeze({
          now: () => house.clock.now(),
          random: ({ length }: { length: number }) => house.crypto.random(length),
          alarm: ({ at, ask, args, key }: { at: number; ask: string; args?: Json; key: string }) => {
            ownAsk(ask);
            const alarm = { at, ask, args: args ?? {} };
            this.#op(
              (_draft, row) => {
                row.alarms[key] = alarm;
              },
              (row) => {
                row.alarms[key] = alarm;
              },
            );
          },
          cancelAlarm: ({ key }: { key: string }) =>
            this.#op(
              (_draft, row) => {
                delete row.alarms[key];
              },
              (row) => {
                delete row.alarms[key];
              },
            ),
        }),
      ),
      standings: value(
        Object.freeze({
          list: () => [
            ...(position === 'steward' ? [] : [{ ...relation(STEWARD, { notes: {}, steward: {} }), vouched: [] }]),
            ...Object.entries(this.#row.standings).map(([id, held]) => ({ ...relation(id, held), vouched: [...(held.vouched ?? [])] })),
          ],
          note: (id: string, notes: Notes) => {
            if (this.#row.standings[id] === undefined) throw new Fail(`she holds no standing ${id}`);
            this.#op(
              (_draft, row) => {
                if (row.standings[id]) row.standings[id].notes = notes;
              },
              (row) => {
                row.standings[id].notes = notes;
              },
            );
          },
          drop: (id: string) => {
            if (id === STEWARD) throw new Fail('she cannot drop her steward');
            this.#op(
              (_draft, row) => {
                delete row.standings[id];
              },
              (row) => {
                delete row.standings[id];
              },
            );
          },
        }),
      ),
      occupants: value(
        Object.freeze({
          list: () => Object.entries(this.#row.occupants).map(([id, held]) => relation(id, held)),
          note: (id: string, notes: Notes) => {
            if (this.#row.occupants[id] === undefined) throw new Fail(`she holds no occupant ${id}`);
            this.#op(
              (_draft, row) => {
                if (row.occupants[id]) row.occupants[id].notes = notes;
              },
              (row) => {
                row.occupants[id].notes = notes;
              },
            );
          },
          dismiss: (id: string) => {
            if (RESERVED_OCCUPANTS.has(id)) throw new Fail(`she cannot dismiss ${id}`);
            this.#op(
              (draft, row) => house.dismissIn(draft, row, id),
              (row) => {
                delete row.occupants[id];
              },
            );
          },
        }),
      ),
      held: value((id: string, need?: unknown) => {
        if (need === undefined) return this.#undeclared(id);
        const blueprint = blueprintOf(need);
        if (blueprint === undefined) throw new Fail('held takes a need');
        const face = this.#face({ standing: id }, blueprint);
        // An effect on a far standing is checked where it lands, so it never waits on the far side's describe.
        const standing = standingOf(this.#being, this.#row, id);
        const far = standing !== undefined && standing.local === undefined;
        let checked: Promise<void> | undefined;
        const check = () => {
          checked ??= this.#covered(id, blueprint);
          checked.catch(() => undefined);
          return checked;
        };
        return Object.freeze(
          Object.fromEntries(
            Object.entries(face).map(([method, call]) => [
              method,
              (args?: unknown, options?: { reply?: string; after?: unknown }) => {
                const spec = blueprint.methods[method];
                // Every silence reads as the call she made, whether it met the describe or the ask.
                const covered = () =>
                  check().catch((error: unknown) => {
                    throw error instanceof Silent ? new Fail(`${method} answered nothing`) : error;
                  });
                // A watch given a reply leaves as an effect does, so it too never waits on the far side.
                const effect = !spec.hints.idempotent || (options !== undefined && 'after' in options && options.reply !== undefined);
                if (!effect) return covered().then(() => call(args, options));
                if (far) return call(args, options);
                this.#pending.push(covered());
                return call(args, options);
              },
            ]),
          ),
        );
      }),
      stranger: value((card: unknown, need?: unknown) => (need === undefined ? this.#strangerUndeclared(card) : this.#stranger(card, need))),
      handle: value((ask: string, options: { bind?: Json; notes?: Notes; once?: boolean; expires?: number } = {}) => {
        if (position === 'public') throw new Fail('a public being holds no handle to her own asks');
        const expires = expiresOf(options.expires);
        ownAsk(ask);
        if (!(table.asks[ask].for ?? []).includes('handle')) throw new Fail(`her ask ${ask} is not for handle`);
        const id = this.#fresh('handle:');
        const held: OccupantRow = { notes: options.notes ?? {}, steward: {}, ask, ...(options.bind === undefined ? {} : { bind: options.bind }), ...(options.once ? { once: true } : {}) };
        this.#op(
          (_draft, row) => {
            row.occupants[id] = held;
          },
          (row) => {
            row.occupants[id] = held;
          },
        );
        return house.marks.handle(being, id, being, expires);
      }),
      invite: value((id: string, { notes = {}, expires: given }: { notes?: Notes; expires?: number } = {}) => {
        if (position === 'public') throw new Fail('a public being cannot invite');
        const expires = expiresOf(given);
        if (RESERVED_OCCUPANTS.has(id) || id.startsWith('handle:') || id.startsWith('being:')) throw new Fail(`the occupant id ${id} is the house's`);
        if (this.#row.occupants[id] !== undefined) throw new Fail(`she holds ${id} already`);
        const held: OccupantRow = { notes, steward: {} };
        this.#op(
          (_draft, row) => {
            row.occupants[id] = held;
          },
          (row) => {
            row.occupants[id] = held;
          },
        );
        return house.marks.handle(being, id, being, expires);
      }),
      fail: value((message: string) => {
        throw new Fail(message);
      }),
    };

    for (const member of Object.keys(table.needs)) {
      descriptors[member] = value(this.#face({ need: member }, table.needs[member]));
    }
    if (position !== 'steward') descriptors.steward = value(this.#untyped({ standing: STEWARD }, STEWARD));
    else descriptors.powers = value(this.#powers());
    return descriptors;
  }

  // Her steward, asked with the flag of the ask she calls.
  #untyped(to: Target, target: string): Readonly<Record<string, unknown>> {
    return new Proxy(
      {},
      {
        get: (_object, method) => {
          if (typeof method !== 'string') return undefined;
          return (args?: unknown, options?: { reply?: string }) => this.#byFlag(to, target, method, args, options?.reply);
        },
      },
    );
  }

  // A call whose flag the callee's own entry decides.
  #byFlag(to: Target, being: string, method: string, args: unknown, reply: string | undefined): Promise<unknown> {
    const decided = (async () => {
      const found = await this.#house.beingOf(being);
      const entry = found?.resolved.table.asks[method];
      if (entry === undefined) throw new Fail(`${being} has no ask ${method}`);
      return entry;
    })();
    const awaited = (entry: TableEntry) => idempotentIn(entry, positionOf(being));
    const result = decided.then((entry) => this.#call(to, method, args, awaited(entry), reply, entry));
    // An effect that cannot be queued fails her ask; an awaited call fails only where she awaits it.
    this.#pending.push(decided.then((entry) => (awaited(entry) ? undefined : result.then(() => undefined))));
    return result;
  }

  // A being of this house described to her steward, within what is left of the steward's ask.
  async #shownToSteward(id: string): Promise<{ state: string; asks: readonly DescribedAsk[] }> {
    const house = this.#house;
    const left = this.#deadline - house.clock.now();
    const outcome = left <= 0 ? null : await house.within(left, house.ask({ being: id, occupant: STEWARD, until: this.#deadline }));
    if (outcome === null || !('describe' in outcome)) throw new Fail(`${id} answered nothing`);
    const describe = outcome.describe as unknown as { state: string; asks: readonly DescribedAsk[] };
    return { state: describe.state, asks: describe.asks };
  }

  #powers() {
    const house = this.#house;
    const guard = (id: string) => {
      if (id === STEWARD || id === PUBLIC) throw new Fail(`${id} is the house's`);
    };
    return Object.freeze({
      bear: ({ kind, id, args }: { kind: string; id: string; args?: Json }) => {
        if (typeof id !== 'string' || !BEING_ID.test(id) || RESERVED_BEINGS.has(id)) throw new Fail(`${id} is no being id`);
        const resolving = house.resolveKind(kind);
        // The op stands in her order now, so an invite after it finds the new row.
        this.#op(async (draft) => {
          const resolved = await resolving;
          if ('absent' in resolved) return;
          const ward = await draft.get<WardRow>(house.wardPlace);
          if (ward === null || ward.beings[id] !== undefined) return;
          ward.beings[id] = { kind };
          const born = resolved.table.asks.born !== undefined;
          draft.set(await house.place(id), { ...emptyRow(kind, copy(resolved.table.cells)), ...(born ? { born: args ?? {} } : {}) });
        });
        this.#pending.push(
          resolving.then((resolved) => {
            if ('absent' in resolved) throw new Fail(resolved.absent);
            if (resolved.table.asks.born !== undefined) this.#after.push(() => house.bornOf(id));
          }),
        );
      },
      invite: ({ id, occupant, notes = {}, expires: given }: { id: string; occupant: string; notes?: Notes; expires?: number }) => {
        const expires = expiresOf(given);
        if (RESERVED_OCCUPANTS.has(occupant) || occupant.startsWith('handle:') || occupant.startsWith('being:')) throw new Fail(`the occupant id ${occupant} is the house's`);
        if (id === STEWARD) throw new Fail('the steward invites her own occupants with invite');
        this.#invited.add(`${id}\n${occupant}`);
        this.#op(async (draft) => {
          const row = await draft.get<BeingRow>(await house.place(id));
          if (row === null) throw new Fail(`${id} is not here`);
          if (row.occupants[occupant] !== undefined) throw new Fail(`${id} holds ${occupant} already`);
          row.occupants[occupant] = { notes: {}, steward: notes };
        });
        return house.marks.handle(id, occupant, this.#being, expires);
      },
      remove: ({ id }: { id: string }) => {
        guard(id);
        this.#op(async (draft) => {
          const ward = await draft.get<WardRow>(house.wardPlace);
          if (ward === null || ward.beings[id] === undefined) return;
          delete ward.beings[id];
          // Every heir and token of hers goes with her row.
          const place = await house.place(id);
          for (const held of Object.values((await draft.get<BeingRow>(place))?.occupants ?? {})) await house.forget(draft, held);
          draft.set(place, null);
        });
      },
      list: async () => {
        const ward = await house.rows().get<WardRow>(house.wardPlace);
        const out: { id: string; kind: string; absent: boolean; dead: readonly DeadLetter[] }[] = [];
        for (const [id, { kind }] of Object.entries(ward?.beings ?? {})) {
          const row = await house.rows().get<BeingRow>(await house.place(id));
          out.push({ id, kind, absent: 'absent' in (await house.resolveKind(kind)), dead: row?.dead ?? [] });
        }
        return out;
      },
      // With no method, the empty ask: what she shows her steward now.
      ask: ({ id, method, args }: { id: string; method?: string; args?: Json }, options?: { reply?: string }) => (method === undefined ? this.#shownToSteward(id) : this.#byFlag({ being: id }, id, method, args, options?.reply)),
      introduce: ({ from, to, notes = {} }: { from: string; to: string; notes?: Notes }) => {
        if (from === to) throw new Fail('no being stands on herself');
        this.#op(async (draft, row) => {
          const fromRow = from === STEWARD ? row : await draft.get<BeingRow>(await house.place(from));
          const toRow = to === STEWARD ? row : await draft.get<BeingRow>(await house.place(to));
          if (fromRow === null || toRow === null) throw new Error('introduce names a being that is not here');
          // Introduced again, each side keeps the notes she wrote: the steward writes only her own.
          fromRow.standings[to] = { notes: fromRow.standings[to]?.notes ?? {}, steward: notes, local: { being: to, occupant: `being:${from}` } };
          toRow.occupants[`being:${from}`] = { ...toRow.occupants[`being:${from}`], notes: toRow.occupants[`being:${from}`]?.notes ?? {}, steward: notes };
        });
      },
    });
  }
}

