// SPDX-License-Identifier: Apache-2.0
// The bench: two houses on one BenchGround, reached as any owner reaches
// hers. The author's house holds her classes and the fakes she hands it,
// as faculties granted to it alone. The bench's own house holds a caller,
// who asks her through a standing or as a stranger, so every ask crosses a
// door as it would in production. Nothing here reaches inside a house: a
// role is played by whoever an owner could have play it, and who holds a
// role is read from what the house shows, judged in her runner.
import { tableOf, type Json, type need, type Table } from '../being/index.ts';
import { dockSteward, Faculty, NobleCrypto, StrictTools, type ClassList, type FacultyClass, type FacultyContext, type FacultyExample, type Made, type Offer, type Status } from '../index.ts';
import { BenchGround, Machine } from './bench-ground.ts';
import { FakeMemory } from './fake-memory.ts';
import { FakeNetwork } from './fake-network.ts';
import { STAND_IN } from './stand-in.ts';
import { BenchCaller, BenchSteward, STEWARDS } from './stewards.ts';

type BeingClass = ConstructorParameters<typeof ClassList>[0]['steward'];
type Entry = Table['asks'][string];
type Position = 'normal' | 'steward' | 'public';
type Need = ReturnType<typeof need>;

/** What an ask answered. */
export type Answer = { readonly result: Json } | { readonly error: { readonly message: string } };

const STEWARD = 'steward';
const PUBLIC = 'public';
const AUTHOR = 'author';
const TESTER = 'bench';
const HOST = 'bench';
/** The being of the author's house that plays a being introduced to her. */
const NEIGHBOUR = 'bench-neighbour';
/** The name the owner's dock classes stand under on the bench's `module` body. */
const DOCK_MODULE = 'dock';
/** The value of the secret a dock check stands, which no answer or cells of her code may carry. */
const DOCK_SECRET = 'bench-secret-no-code-reaches';
/** The bound no wait passes: past it, every awaited call of a chain has given up. */
const WAIT_BOUND = 300_000;

/** A stand-in: the far side of a standing she holds, answering the need she declares for it with her author's handlers. */
export interface StandIn {
  /** The need she matches the standing to. */
  readonly need: Need;
  /** The module file of the handlers, by its URL: one function for each method of the need, by its name. They run in the house's runner. */
  readonly module: URL | string;
}

export interface BenchOptions {
  /**
   * The module file of her classes, by its URL: every class of `Being.of`
   * it exports, hers and any other her beings meet. They load in the
   * house's own runner, never in the test's process.
   */
  readonly module: URL | string;
  /** Fakes of the faculties her needs name. */
  readonly offers?: readonly Offer[];
  /** Stand-ins by id, each borne beside her by the bench's steward and introduced to every being it places. */
  readonly standIns?: Readonly<Record<string, StandIn>>;
  /** One seed, so a bench runs the same each time. */
  readonly seed?: string;
  /** Her steward, placed as the author's house's steward; the bench's own where none is given. */
  readonly steward?: BeingClass;
  /** Her public being, placed as the author's house's public being. */
  readonly public?: BeingClass;
}

/**
 * Where a check places her: a normal being, the steward, the public being,
 * or the steward of a ground's dock, whose `module` is the owner's dock
 * classes as `classesSet` names them.
 */
export interface CheckOptions {
  /** The module file that exports her class, and any other her beings meet; at the dock, her steward and her `beings`. */
  readonly module: URL | string;
  readonly seed?: string;
  readonly position?: Position | 'dock';
  /** The steward beside her, where she is not it. */
  readonly steward?: BeingClass;
}

/** What a faculty is checked on: its terrain, where the test hands it, so the real body is walked beside its fake. */
export interface FacultyCheckOptions {
  readonly made?: Partial<Made>;
}

/** A house module walked as one household, under the bench's steward in the place of the house's own. */
export interface HouseholdOptions {
  /** The house module file: its `beings` and its `public`, as a folder's index exports them. */
  readonly module: URL | string;
  /** Her beings by the ids the house's steward bears them under; every being the module lists, under its kind, where none is given. */
  readonly beings?: Readonly<Record<string, BeingClass>>;
  /** Each introduction the house's steward makes, from one being to another, by id. */
  readonly introduce?: readonly (readonly [string, string])[];
  /** The ids walked, `public` for her public being, each still beside every other; every being where none is given, so a large house is walked in parts a runner spreads. */
  readonly walk?: readonly string[];
  readonly seed?: string;
}

/** One thing the bench checked: what, and why it failed where it did. */
export interface Finding {
  readonly ok: boolean;
  readonly what: string;
  readonly why?: string;
}

/** One ask of an example's history, before the ask it shows. */
interface Step {
  readonly ask: string;
  readonly args?: Json;
  readonly role?: string;
}

interface Example {
  readonly description?: string;
  readonly given?: readonly Step[];
  readonly role?: string;
  readonly args?: Json;
  readonly fakes?: Record<string, Record<string, Json>>;
  readonly gives?: Json;
}

/** What a being shows one asker. */
interface Described {
  readonly state: string;
  readonly asks: readonly { readonly method: string }[];
}

/** A reply her table refused, as her steward reads it. */
interface Letter {
  readonly ask: string;
  readonly why: string;
}

/**
 * Who plays a role: the hand, a stranger, her steward, a being introduced
 * to her, or an occupant whose steward notes hold the role.
 */
type Played = 'hand' | 'stranger' | 'steward' | 'neighbour' | { readonly notes: string };
type Player = Played | { readonly unplayed: string };

/** The roles the house names for an edge out of her: her alarms, her steward's powers, and her standings answering. */
const EDGES: ReadonlySet<string> = new Set(['house', 'powers', 'standing']);

/** A fresh bench, her placed on it and brought through a history. */
interface Staged {
  readonly bench: Bench;
  readonly placed: Placed;
  /** Lets the staging go: the bench closed, or kept where the walk shares it. */
  readonly close: () => Promise<void>;
}

/** One walk: her table, her position, how a fresh bench is staged, and what names her in a finding. */
interface Walking {
  readonly table: Table;
  readonly position: Position;
  /** A fresh bench brought through a history, or `null` where the history stops. */
  readonly stage: (given: readonly Step[]) => Promise<Staged | null>;
  /** What opens each finding's `what`: her id in a household, and nothing alone. */
  readonly name: string;
  /** The beings she stands on in a household, which an awaited call that answered nothing names. */
  readonly partners: readonly string[];
}

/** A being the bench placed, asked and described as any role the bench can play. */
export class Placed {
  readonly id: string;
  readonly position: Position;
  readonly #bench: Bench;
  readonly #table: Table;

  constructor(bench: Bench, id: string, position: Position, table: Table) {
    this.#bench = bench;
    this.id = id;
    this.position = position;
    this.#table = table;
  }

  /** The role an ask's entry names first; `root` where it names every occupant. */
  roleFor(method: string): string {
    return this.#table.asks[method]?.for?.[0] ?? 'root';
  }

  /**
   * One ask, as whoever plays `role`. An effect's answer is the reply it
   * brings once it lands, and `null` is silence.
   */
  ask(method: string, args: Json = {}, { role = this.roleFor(method) }: { role?: string } = {}): Promise<Answer | null> {
    return this.#bench.asked(this, this.#table, role, method, args);
  }

  /** Her describe as `role` sees it: her state and the asks it shows. */
  describe({ role = 'root' }: { role?: string } = {}): Promise<Described | null> {
    return this.#bench.described(this, this.#table, role);
  }

  /** Her cells as last landed, read through the hand, as her owner reads them. */
  cells(): Promise<Record<string, Json>> {
    return this.#bench.cellsOf(this);
  }
}

export class Bench {
  readonly #network: FakeNetwork;
  readonly #ground: BenchGround;
  /** The author's house's ward, which a stranger's card names. */
  readonly #ward: string;
  /** The author's house is kept by the bench's own steward. */
  readonly #own: boolean;
  readonly #steward: BeingClass | undefined;
  readonly #public: BeingClass | undefined;
  /** The stand-ins beside her, by id. */
  readonly #standIns: readonly string[];
  /** The caller's standing on each being, by the role it plays. */
  readonly #doors = new Map<string, string>();
  /** The beings the neighbour stands on. */
  readonly #introduced = new Set<string>();
  /** The invitations to stand-ins the bench minted, which her steward carries unopened. */
  readonly #minted = new Set<string>();
  #count = 0;
  /** Whether an ask that waits on the clock is let run out, as a walk plays it. */
  #timing = false;
  /** Whether an ask answered only once the clock ran past every wait. */
  #waited = false;

  private constructor(network: FakeNetwork, ground: BenchGround, ward: string, placed: { steward: BeingClass | undefined; public: BeingClass | undefined; standIns: readonly string[] }) {
    this.#network = network;
    this.#ground = ground;
    this.#ward = ward;
    this.#own = placed.steward === undefined;
    this.#steward = placed.steward;
    this.#public = placed.public;
    this.#standIns = placed.standIns;
  }

  static async open({ module, offers = [], standIns = {}, seed = 'bench', steward, public: open }: BenchOptions): Promise<Bench> {
    const standing = Object.entries(standIns);
    if (standing.length > 0 && steward !== undefined) throw new Error('the bench bears a stand-in beside its own steward alone');
    // Each stand-in is this bench's module named with a query: its kind, her need, and her handlers' module.
    const kinds = standing.map((_, index) => `org.nervur.bench.stand-in-${index + 1}`);
    const named = standing.map(([, { need: wanted, module: handlers }], index) => `${STAND_IN}?${new URLSearchParams({ kind: kinds[index], need: JSON.stringify(wanted), handlers: hrefOf(handlers) }).toString()}`);
    const network = new FakeNetwork({ seed });
    // Her fakes, each a faculty of the ground granted to her house alone.
    const faculties = Object.fromEntries(offers.map((offer, index) => [`offer-${index}`, offer]));
    const ground = await BenchGround.open({
      network,
      host: HOST,
      names: [HOST],
      machine: new Machine(seed),
      faculties,
      modules: {
        [AUTHOR]: { modules: [hrefOf(module), STEWARDS, ...named], steward: tableOf(steward ?? BenchSteward).kind, ...(open === undefined ? {} : { public: tableOf(open).kind }) },
        [TESTER]: { modules: [STEWARDS], steward: tableOf(BenchCaller).kind },
      },
    });
    const author = await ground.add(AUTHOR, AUTHOR, { faculties: Object.keys(faculties) });
    const tester = await ground.add(TESTER, TESTER);
    for (const house of [author, tester]) if (house.ward === undefined) throw new Error(`the bench's house did not open: ${house.why}`);
    const bench = new Bench(network, ground, author.ward!, { steward, public: open, standIns: standing.map(([id]) => id) });
    for (const [index, [id]] of standing.entries()) await bench.#rooted(AUTHOR, STEWARD, 'bear', { kind: kinds[index], id });
    return bench;
  }

  /**
   * Her class here: the steward or the public being where the bench opened
   * with her there, and otherwise borne by the bench's own steward, from
   * her `born`, and introduced to every stand-in.
   */
  async place(Class: BeingClass, { id, born }: { id?: string; born?: Record<string, Json> } = {}): Promise<Placed> {
    const table = tableOf(Class);
    if (Class === this.#steward) return new Placed(this, STEWARD, 'steward', table);
    if (Class === this.#public) return new Placed(this, PUBLIC, 'public', table);
    if (!this.#own) throw new Error('the bench bears a being beside its own steward alone');
    const name = id ?? `placed-${++this.#count}`;
    await this.#rooted(AUTHOR, STEWARD, 'bear', { kind: table.kind, id: name, ...(born === undefined ? {} : { args: born }) });
    for (const standIn of this.#standIns) await this.#rooted(AUTHOR, STEWARD, 'introduce', { from: name, to: standIn });
    await this.settle();
    return new Placed(this, name, 'normal', table);
  }

  /**
   * One being introduced to another, as a steward's `introduce` does: `from`
   * stands on `to`, under `to`'s id, and `to` holds `from` as a being. Each
   * is a placed being or a stand-in, by id. The bench's own steward makes it,
   * and writes `notes` as her steward's notes on both sides.
   */
  async introduce(from: Placed | string, to: Placed | string, { notes }: { notes?: Json } = {}): Promise<void> {
    if (!this.#own) throw new Error('the bench introduces beside its own steward alone');
    await this.#rooted(AUTHOR, STEWARD, 'introduce', { from: idOf(from), to: idOf(to), ...(notes === undefined ? {} : { notes }) });
    await this.settle();
  }

  /** An invitation to a stand-in, which her ask takes under `s.handle` as a standing of her own. */
  async invitation(standIn: string): Promise<string> {
    const { door } = (await this.#rooted(AUTHOR, STEWARD, 'door', { id: standIn, occupant: `bench-invited-${++this.#count}` })) as { door: string };
    this.#minted.add(door);
    return door;
  }

  /** What a stand-in heard, in order: each method and its args, where its handler answered. */
  async heard(standIn: string): Promise<{ method: string; args: Json }[]> {
    return (await this.#cells(standIn)).asked as { method: string; args: Json }[];
  }

  /** Both houses closed and the bench's ground down, so their runners are free for the next bench. */
  close(): Promise<void> {
    return this.#ground.down();
  }

  /** Lets every ask, effect and reply the houses started run to its end. */
  settle(): Promise<void> {
    return this.#network.settle();
  }

  /** The clock moved on, and what came due run. */
  advance(ms: number): Promise<void> {
    return this.#network.advance(ms);
  }

  /** A placed being's cells, read through the hand. */
  cellsOf(placed: Placed): Promise<Record<string, Json>> {
    return this.#cells(placed.id);
  }

  async #cells(id: string): Promise<Record<string, Json>> {
    const read = await this.#ground.ask({ house: AUTHOR, id, cells: true });
    if (!('result' in read)) throw new Error(`the bench could not read the cells of ${id}: ${JSON.stringify(read)}`);
    return read.result as Record<string, Json>;
  }

  // Who plays a role on her, judged on her cells as they stand. `root` is
  // the hand's, on any being. A role of hers the hand holds is the hand's,
  // and on the public being `stranger` and a role a stranger holds are a
  // stranger's. The rest need the bench's own steward: hers for `steward`,
  // a neighbour it introduces for `being`, and an occupant it invites, the
  // role true in its steward notes, for any other her table names and that
  // occupant holds. An asker holds a role of hers where she shows it every
  // ask naming the role, so her role runs in her runner, as the house runs it.
  async #player(placed: Placed, table: Table, role: string): Promise<Player> {
    if (role === 'root') return 'hand';
    const hers = Object.hasOwn(table.roles, role);
    const naming = Object.values(table.asks).filter((entry) => entry.for?.includes(role));
    // Only an ask naming no role the player holds already decides whether it holds this one; with none to decide, it does not.
    const holds = async (player: Played, already?: string) => {
      const deciding = naming.filter((entry) => already === undefined || !entry.for!.includes(already)).map((entry) => entry.method);
      if (deciding.length === 0) return false;
      const described = await this.#read(placed, player);
      return described !== null && deciding.every((method) => described.asks.some((shown) => shown.method === method));
    };
    if (placed.position === 'public' && role === 'stranger') return 'stranger';
    if (hers) {
      // The occupant the role is written for first, so an ask naming a second role root holds never hands the role to the hand.
      if (this.#own && (await holds({ notes: role }))) return { notes: role };
      if (await holds('hand', 'root')) return 'hand';
      if (placed.position === 'public' && (await holds('stranger', 'stranger'))) return 'stranger';
      return { unplayed: this.#own ? `no one it makes holds ${role} here` : `the bench plays ${role} beside its own steward alone` };
    }
    if (role === 'handle') return { unplayed: 'a handle is minted by her own ask' };
    // An edge out of her asks only the replies and alarms that name it, and reads no describe.
    if (EDGES.has(role) || role in table.needs) return { unplayed: `${role} is an edge out of her, which answers her and asks nothing else` };
    if (!this.#own) return { unplayed: `the bench plays ${role} beside its own steward alone` };
    if (role === STEWARD) return placed.position === 'steward' ? { unplayed: 'the steward has no steward' } : 'steward';
    return role === 'being' ? 'neighbour' : { unplayed: `no one it makes holds ${role} here` };
  }

  // The player of a role, or an error naming why no one plays it.
  async #played(placed: Placed, table: Table, role: string): Promise<Played> {
    const player = await this.#player(placed, table, role);
    if (typeof player === 'object' && 'unplayed' in player) throw new Error(`the bench cannot play ${role} on ${placed.id}: ${player.unplayed}`);
    return player;
  }

  /** One ask of a placed being, as whoever plays the role. */
  async asked(placed: Placed, table: Table, role: string, method: string, args: Json): Promise<Answer | null> {
    return this.#call(placed, await this.#played(placed, table, role), method, args);
  }

  /** What a placed being shows whoever plays the role. */
  async described(placed: Placed, table: Table, role: string): Promise<Described | null> {
    return this.#read(placed, await this.#played(placed, table, role));
  }

  async #call(placed: Placed, player: Played, method: string, args: Json): Promise<Answer | null> {
    if (player === 'hand') {
      const answered = await this.#asking({ house: AUTHOR, id: placed.id, method, args });
      await this.settle();
      return 'describe' in answered ? null : answered;
    }
    if (player === 'stranger') return this.#outcome(TESTER, STEWARD, 'visit', { ward: this.#ward, at: [`bench://${HOST}`], method, args });
    if (player === 'steward') {
      // An invitation the bench minted is carried unopened, as an owner's steward carries one for her to take.
      const at = Object.entries(args as Record<string, Json>).flatMap(([name, value]) => (typeof value === 'string' && this.#minted.has(value) ? [name] : []));
      const rest = Object.fromEntries(Object.entries(args as Record<string, Json>).filter(([name]) => !at.includes(name)));
      return this.#outcome(AUTHOR, STEWARD, 'ask', { id: placed.id, method, args: rest, ...(at.length === 0 ? {} : { at, invitations: at.map((name) => (args as Record<string, Json>)[name]) }) });
    }
    if (player === 'neighbour') return this.#outcome(AUTHOR, NEIGHBOUR, 'ask', { standing: await this.#neighbour(placed.id), method, args });
    return this.#outcome(TESTER, STEWARD, 'ask', { standing: await this.#door(placed.id, player.notes), method, args });
  }

  async #read(placed: Placed, player: Played): Promise<Described | null> {
    let read: Json;
    if (player === 'hand') {
      const answered = await this.#ground.ask({ house: AUTHOR, id: placed.id });
      if (!('describe' in answered)) return null;
      read = answered.describe;
    } else if (player === 'stranger') read = await this.#rooted(TESTER, STEWARD, 'looks', { ward: this.#ward, at: [`bench://${HOST}`] });
    else if (player === 'steward') read = await this.#rooted(AUTHOR, STEWARD, 'shows', { id: placed.id });
    else if (player === 'neighbour') read = await this.#rooted(AUTHOR, NEIGHBOUR, 'describe', { standing: await this.#neighbour(placed.id) });
    else read = await this.#rooted(TESTER, STEWARD, 'describe', { standing: await this.#door(placed.id, player.notes) });
    const described = read as unknown as Described;
    return typeof described?.state === 'string' && Array.isArray(described.asks) ? described : null;
  }

  // One ask through the hand. As a walk plays it, an ask that still waits
  // once the bench is idle waits on the clock alone: the clock runs past
  // every wait, so each awaited call of its chain gives up, and the bench
  // marks that it waited.
  async #asking(request: Parameters<BenchGround['ask']>[0]): ReturnType<BenchGround['ask']> {
    const asking = this.#ground.ask(request);
    if (!this.#timing) return asking;
    let done = false;
    const held = asking.finally(() => {
      done = true;
    });
    held.catch(() => undefined);
    await this.settle();
    if (!done) {
      this.#waited = true;
      await this.advance(WAIT_BOUND);
    }
    return held;
  }

  // One of the bench's own beings asked through the hand, which fails the test where she answers an error.
  async #rooted(house: string, id: string, method: string, args: Json): Promise<Json> {
    const answered = await this.#asking({ house, id, method, args });
    await this.settle();
    if (!('result' in answered)) throw new Error(`the bench's ${id} could not ${method}: ${JSON.stringify(answered)}`);
    return answered.result;
  }

  // One ask through one of the bench's beings: its answer, or the reply its effect brought once it landed, or silence.
  async #outcome(house: string, id: string, method: string, args: Json): Promise<Answer | null> {
    const replies = async () => (await this.#rooted(house, id, 'replies', {})) as Answer[];
    const before = (await replies()).length;
    const answered = await this.#asking({ house, id, method, args });
    await this.settle();
    // Args her ask refuses at the call fail the bench's own ask, as they would fail any asker's: that refusal is the answer.
    if ('error' in answered) return answered;
    const read = ('result' in answered ? answered.result : {}) as { answer?: Answer; queued?: true };
    if (read.answer !== undefined) return read.answer;
    return (await replies())[before] ?? null;
  }

  // The caller's standing on her as an occupant whose steward notes hold the role.
  async #door(being: string, role: string): Promise<string> {
    const key = `${being}\n${role}`;
    const held = this.#doors.get(key);
    if (held !== undefined) return held;
    const { door } = (await this.#rooted(AUTHOR, STEWARD, 'door', { id: being, occupant: `bench-${role}`, role })) as { door: string };
    const standing = (await this.#rooted(TESTER, STEWARD, 'adopt', { invitation: door })) as string;
    this.#doors.set(key, standing);
    return standing;
  }

  // The neighbour, borne once and introduced to her; its standing on her is named for her.
  async #neighbour(being: string): Promise<string> {
    if (this.#introduced.size === 0) await this.#rooted(AUTHOR, STEWARD, 'bear', { kind: 'org.nervur.bench.caller', id: NEIGHBOUR });
    if (being !== STEWARD && !this.#introduced.has(being)) await this.#rooted(AUTHOR, STEWARD, 'introduce', { from: NEIGHBOUR, to: being });
    this.#introduced.add(being);
    return being;
  }

  // The replies her table refused, where the bench's own steward keeps her house and reads them.
  async #dead(placed: Placed, table: Table): Promise<readonly Letter[]> {
    // Only a reply is kept as a dead letter, and only an edge out of her asks one.
    const replies = Object.values(table.asks).some((entry) => entry.for?.some((role) => EDGES.has(role) || role in table.needs));
    if (!this.#own || !replies) return [];
    return (await this.#rooted(AUTHOR, STEWARD, 'dead', { id: placed.id })) as unknown as Letter[];
  }

  /** Every example of her class run, twice, on two fresh benches. */
  static async examples(Class: BeingClass, options: CheckOptions): Promise<Finding[]> {
    if (options.position === 'dock') return Bench.#docked(Class, options);
    const table = tableOf(Class);
    const where = { ...options, seed: options.seed ?? 'examples' };
    const findings: Finding[] = [];
    for (const entry of Object.values(table.asks)) {
      for (const [index, raw] of entry.examples.entries()) {
        const example = raw as Example;
        const what = `${entry.method}, example ${index + 1}${example.description === undefined ? '' : `: ${example.description}`}`;
        try {
          const first = await Bench.#run(Class, table, entry, example, where);
          const second = await Bench.#run(Class, table, entry, example, where);
          if (example.gives !== undefined && canonical(first.answer) !== canonical(example.gives)) {
            findings.push({ ok: false, what, why: `it gives ${JSON.stringify(first.answer)}, and the example says ${JSON.stringify(example.gives)}` });
          } else if (canonical(first.answer) !== canonical(second.answer)) {
            findings.push({ ok: false, what, why: 'a re-run of the same history answered differently' });
          } else if (canonical(first.cells) !== canonical(second.cells)) {
            findings.push({ ok: false, what, why: 'a re-run of the same history left her cells differently' });
          } else findings.push({ ok: true, what });
        } catch (error) {
          findings.push({ ok: false, what, why: error instanceof Error ? error.message : String(error) });
        }
      }
    }
    return findings;
  }

  /**
   * An owner's dock steward alone, on bench grounds whose ladder stands a
   * fake of every need of hers and her beings'. A secret stands before
   * `classesSet` names her classes. Her classes load, and the hand is shown
   * the library's asks beside hers. Each ask of hers is played once, and
   * each example runs twice on fresh grounds, through the hand. No answer
   * and no cells of her steward carry the secret.
   */
  static async #docked(Class: BeingClass, { module, seed = 'dock' }: CheckOptions): Promise<Finding[]> {
    const table = tableOf(Class);
    // The library's steward as an adopter reaches her: extended by nothing.
    const library = tableOf(dockSteward({}));
    // Her beings, as the dock reads her classes: the module's `beings`, or every other class of `Being.of` it exports.
    const exported = (await import(hrefOf(module))) as Record<string, unknown> & { beings?: readonly BeingClass[] };
    const beings = exported.beings ?? Object.values(exported).filter((value): value is BeingClass => typeof value === 'function' && value !== Class && tableable(value));
    const hers = Object.values(table.asks).filter((entry) => !Object.hasOwn(library.asks, entry.method));
    const findings: Finding[] = [];
    const found = (what: string, why?: string) => findings.push(why === undefined ? { ok: true, what } : { ok: false, what, why });
    // A secret's value in what her code answered or kept is a road the seal left open.
    const leaks = (value: unknown) => (JSON.stringify(value) ?? '').includes(DOCK_SECRET);
    const stand = async (example: Example) => {
      const own = { ...table, needs: Object.fromEntries(Object.entries(table.needs).filter(([member]) => !Object.hasOwn(library.needs, member))) };
      const offers = [own, ...beings.map((Being) => tableOf(Being))].flatMap((each) => fakes(each, example));
      const network = new FakeNetwork({ seed });
      const ground = await BenchGround.open({ network, host: HOST, modules: { [DOCK_MODULE]: module }, faculties: Object.fromEntries(offers.map((offer, index) => [`offer-${index}`, offer])) });
      const hand = async (method: string, args: Json = {}): Promise<Answer> => {
        const answered = (await ground.hand({ method, args })) as Answer;
        await network.settle();
        return answered;
      };
      try {
        for (const [method, args] of [
          ['secretsSet', { name: 'bench', value: DOCK_SECRET }],
          ['classesSet', { classes: { faculty: 'module', name: DOCK_MODULE } }],
        ] as const) {
          const answered = await hand(method, args);
          if (!('result' in answered)) throw new Error(`the bench’s ${method} answered ${JSON.stringify(answered)}`);
        }
      } catch (error) {
        await ground.down();
        throw error;
      }
      const cells = async () => ((await ground.hand({ cells: true })) as { result?: Json }).result ?? null;
      return { ground, hand, cells };
    };
    // Her classes loaded, the library's asks and hers shown to the hand, and each ask of hers played once.
    const { ground, hand, cells } = await stand({});
    try {
      const { why } = ((await hand('classesShow')) as { result: { why?: string } }).result;
      found('her classes load in the dock', why);
      const shown = ((await ground.hand({ describe: true })) as unknown as { result: { dock: Described | null } }).result.dock ?? { state: '', asks: [] };
      const owed = Object.values(table.asks)
        .filter((entry) => (entry.for === null || entry.for.includes('root')) && (entry.in === null || entry.in.includes(shown.state)))
        .map((entry) => entry.method)
        .sort();
      const listed = shown.asks.map((entry) => entry.method).sort();
      found('the hand is shown the library’s asks beside hers', listed.join() === owed.join() ? undefined : `it is shown ${listed.join(', ')}, and her table owes ${owed.join(', ')}`);
      for (const entry of hers) {
        const answer = await hand(entry.method, argsOf(entry));
        const refused = 'error' in answer ? breach(answer.error.message) : undefined;
        found(`${entry.method}, played`, refused ?? (leaks(answer) || leaks(await cells()) ? 'her code reached a secret' : undefined));
      }
    } finally {
      await ground.down();
    }
    for (const entry of hers) {
      for (const [index, raw] of entry.examples.entries()) {
        const example = raw as Example;
        const what = `${entry.method}, example ${index + 1}${example.description === undefined ? '' : `: ${example.description}`}`;
        const run = async () => {
          const standing = await stand(example);
          try {
            for (const [at, step] of [...(example.given ?? []), { ask: entry.method, args: example.args, role: example.role }].entries()) {
              if (step.role !== undefined && step.role !== 'root') throw new Error(`the bench plays root alone at the dock, and step ${at + 1} names ${step.role}`);
            }
            for (const [at, step] of (example.given ?? []).entries()) {
              const answered = await standing.hand(step.ask, step.args ?? {});
              if ('error' in answered) throw new Error(`given ${at + 1}, ${step.ask}, answered ${JSON.stringify(answered)}`);
            }
            return { answer: await standing.hand(entry.method, example.args ?? {}), cells: await standing.cells() };
          } finally {
            await standing.ground.down();
          }
        };
        try {
          const first = await run();
          const second = await run();
          if (example.gives !== undefined && canonical(first.answer) !== canonical(example.gives)) found(what, `it gives ${JSON.stringify(first.answer)}, and the example says ${JSON.stringify(example.gives)}`);
          else if (canonical(first) !== canonical(second)) found(what, 'a re-run of the same history answered or kept differently');
          else found(what, leaks(first) ? 'her code reached a secret' : undefined);
        } catch (error) {
          found(what, error instanceof Error ? error.message : String(error));
        }
      }
    }
    return findings;
  }

  // A fresh bench with her in the position the check names, and the steward beside her where one is given.
  static #opening(Class: BeingClass, table: Table, example: Example, { module, seed, position = 'normal', steward }: CheckOptions): Promise<Bench> {
    return Bench.open({
      module,
      offers: fakes(table, example),
      ...(seed === undefined ? {} : { seed }),
      ...(position === 'steward' ? { steward: Class } : steward === undefined ? {} : { steward }),
      ...(position === 'public' ? { public: Class } : {}),
    });
  }

  // Her history asked in its order: each ask of it must answer, or the example names where it stopped.
  static async #replay(placed: Placed, given: readonly Step[]): Promise<void> {
    for (const [index, step] of given.entries()) {
      const answered = await placed.ask(step.ask, step.args ?? {}, step.role === undefined ? {} : { role: step.role });
      if (answered === null || 'error' in answered) throw new Error(`given ${index + 1}, ${step.ask}, answered ${JSON.stringify(answered)}`);
    }
  }

  // Her placed afresh and brought through a history; `null`, the staging let go, where the history stops.
  static async #staging(bench: Bench, placing: () => Promise<Placed>, given: readonly Step[], close = () => bench.close()): Promise<Staged | null> {
    let placed: Placed;
    try {
      placed = await placing();
    } catch (error) {
      await close();
      throw error;
    }
    try {
      await Bench.#replay(placed, given);
    } catch {
      // A history that stops is its example's finding, and reaches no state here.
      await close();
      return null;
    }
    return { bench, placed, close };
  }

  static async #run(Class: BeingClass, table: Table, entry: Entry, example: Example, options: CheckOptions) {
    const bench = await Bench.#opening(Class, table, example, options);
    try {
      const placed = await bench.place(Class);
      await Bench.#replay(placed, example.given ?? []);
      const answer = await placed.ask(entry.method, example.args ?? {}, example.role === undefined ? {} : { role: example.role });
      return { answer: answer ?? { nothing: true }, cells: await placed.cells() };
    } finally {
      await bench.close();
    }
  }

  /**
   * Every state her `born` and her examples' histories reach, described to
   * every role the bench can play: what each is shown is what her table
   * owes. There every ask she holds in that state is played by every role
   * its `for` names, and by every occupant where it names none, each on a
   * fresh bench. An edge out of her is played where her own asks reach it.
   */
  static async walk(Class: BeingClass, options: CheckOptions): Promise<Finding[]> {
    // The dock's walk is the library's, proven in its own suites; a check of her there runs her asks and her examples.
    if (options.position === 'dock') return [];
    const table = tableOf(Class);
    const where = { ...options, seed: options.seed ?? 'walk' } as CheckOptions & { position?: Position };
    const position: Position = options.position ?? 'normal';
    // A normal being is borne afresh for each staging on one bench; the steward and the public being are one a house, so each stands on a bench of its own.
    let shared: Bench | undefined;
    try {
      return await Bench.#walked({
        table,
        position,
        stage: async (given) => {
          if (position !== 'normal') {
            const bench = await Bench.#opening(Class, table, {}, where);
            return Bench.#staging(bench, () => bench.place(Class), given);
          }
          shared ??= await Bench.#opening(Class, table, {}, where);
          const bench = shared;
          return Bench.#staging(bench, () => bench.place(Class), given, async () => undefined);
        },
        name: '',
        partners: [],
      });
    } finally {
      await shared?.close();
    }
  }

  static async #walked(walking: Walking): Promise<Finding[]> {
    const { table, position } = walking;
    const findings: Finding[] = [];
    // Each history once: a bench runs the same each time, so a history staged again reaches the state it reached before.
    const asked: (readonly Step[])[] = [[], ...Object.values(table.asks).flatMap((entry) => entry.examples.map((example) => (example as Example).given ?? []))];
    const histories = [...new Map(asked.map((steps) => [canonical(steps), steps])).values()];
    const seen = new Set<string>();
    const played = new Set<string>();
    // Each role her position lets someone hold: the steward has no steward, and only the public being has strangers.
    const roles = [...new Set([STEWARD, ...Object.keys(table.roles), ...Object.values(table.asks).flatMap((entry) => entry.for ?? [])])].filter(
      (role) => role !== 'handle' && (role !== 'stranger' || position === 'public') && (role !== STEWARD || position !== 'steward'),
    );
    for (const given of histories) {
      const staged = await walking.stage(given);
      if (staged === null) continue;
      let state: string | undefined;
      // The roles no one plays in this state, read where she is shown, so no ask is staged afresh for a role no one could play on it.
      const unplayed = new Set<string>();
      try {
        // One visit a state, from the first history that reaches it.
        const reached = (await staged.placed.describe())?.state;
        if (reached !== undefined && !seen.has(reached)) {
          seen.add(reached);
          state = reached;
          for (const role of roles) if (!(await Bench.#shows(staged, walking, role, reached, findings))) unplayed.add(role);
        }
      } finally {
        await staged.close();
      }
      if (state !== undefined) await Bench.#plays(walking, given, state, findings, played, unplayed);
    }
    return findings;
  }

  // What one role is shown in one state, against what her table owes it. False where no one plays the role here.
  static async #shows({ bench, placed }: Staged, { table, name }: Walking, role: string, state: string, findings: Finding[]): Promise<boolean> {
    const player = await bench.#player(placed, table, role);
    if (typeof player === 'object' && 'unplayed' in player) return false;
    const what = `${name}${state}, as ${role}`;
    const described = await bench.#read(placed, player);
    const shown = (described?.asks ?? []).map((entry) => entry.method).sort();
    const reached = Object.values(table.asks).filter((entry) => (entry.for === null ? true : entry.for.includes(role)));
    const owed = reached.map((entry) => entry.method).sort();
    // A stranger may repeat what she asks, so an ask that changes the world is her author's word, never an accident.
    if (player === 'stranger') {
      for (const entry of reached) {
        if (!entry.idempotent && !entry.replayable) findings.push({ ok: false, what: `${name}${state}, ${entry.method} as ${role}`, why: 'a stranger may repeat it: make it idempotent, or mark it replayable' });
      }
    }
    if (described === null) findings.push({ ok: false, what, why: 'she answered nothing' });
    else if (described.state !== state) findings.push({ ok: false, what, why: `she says ${described.state}` });
    else if (shown.join() !== owed.join()) findings.push({ ok: false, what, why: `she shows ${shown.join(', ') || 'nothing'}, and her table owes ${owed.join(', ') || 'nothing'}` });
    else findings.push({ ok: true, what });
    return true;
  }

  // Every ask she holds in a state, played by every role and occupant its `for` gives it, each on a fresh bench.
  // Each ask and role is played once, in the first state that holds the ask where the role is played, so a walk stays within a proof's budget.
  static async #plays(walking: Walking, given: readonly Step[], state: string, findings: Finding[], played: Set<string>, unplayed: ReadonlySet<string>): Promise<void> {
    const { table, position } = walking;
    // An ask that names no role is every occupant's: the hand, her steward, a being introduced to her, and a stranger at the public being.
    const occupants = ['root', STEWARD, 'being', 'stranger'];
    for (const entry of Object.values(table.asks)) {
      if (entry.in !== null && !entry.in.includes(state)) continue;
      for (const role of entry.for ?? occupants) {
        // An edge out of her is never an occupant: it is played where her own asks reach it, and its refused replies are read after each play.
        if (role === 'handle' || EDGES.has(role) || role in table.needs) continue;
        if ((role === 'stranger' && position !== 'public') || (role === STEWARD && position === 'steward')) continue;
        const key = `${entry.method}\n${role}`;
        if (played.has(key) || unplayed.has(role)) continue;
        const staged = await walking.stage(given);
        if (staged === null) continue;
        try {
          if (await Bench.#play(staged, walking, entry, role, state, findings)) played.add(key);
        } finally {
          await staged.close();
        }
      }
    }
  }

  // One ask played once, as one role: what her house answered, and every reply her table refused after it. False where no one plays the role here.
  static async #play({ bench, placed }: Staged, { table, name, partners }: Walking, entry: Entry, role: string, state: string, findings: Finding[]): Promise<boolean> {
    const player = await bench.#player(placed, table, role);
    if (typeof player === 'object' && 'unplayed' in player) return false;
    const what = `${name}${state}, ${entry.method} as ${role}`;
    const before = (await bench.#dead(placed, table)).length;
    bench.#timing = true;
    bench.#waited = false;
    let answer: Answer | null;
    try {
      answer = await bench.#call(placed, player, entry.method, argsOf(entry));
    } finally {
      bench.#timing = false;
    }
    if (bench.#waited) {
      const between = partners.length === 0 ? '' : ` between ${name.slice(0, -2)} and ${partners.join(' or ')}`;
      findings.push({ ok: false, what, why: `an awaited call${between} answered nothing: a call came back to a being in its own chain` });
      return true;
    }
    const message = answer !== null && 'error' in answer ? answer.error.message : undefined;
    const why = message === 'no such ask' ? `she refuses it to ${role}, and her table gives it` : message === undefined ? undefined : breach(message);
    findings.push(why === undefined ? { ok: true, what } : { ok: false, what, why });
    for (const letter of (await bench.#dead(placed, table)).slice(before)) {
      const refused = breach(letter.why);
      if (refused !== undefined) findings.push({ ok: false, what: `${name}${state}, ${letter.ask} as ${(table.asks[letter.ask]?.for ?? []).join(', ')}`, why: refused });
    }
    return true;
  }

  /** Her examples and her walk, and an error naming every finding that failed. */
  static async check(Class: BeingClass, options: CheckOptions): Promise<Finding[]>;
  static async check(Class: FacultyClass, options?: FacultyCheckOptions): Promise<Finding[]>;
  static async check(Class: BeingClass | FacultyClass, options?: CheckOptions | FacultyCheckOptions): Promise<Finding[]> {
    if (Class.prototype instanceof Faculty) return Bench.#faculty(Class as FacultyClass, (options ?? {}) as FacultyCheckOptions);
    return failing([...(await Bench.examples(Class as BeingClass, options as CheckOptions)), ...(await Bench.walk(Class as BeingClass, options as CheckOptions))]);
  }

  /**
   * Every being of a house module in one house, borne under the ids it
   * names by the bench's steward, which stands in the place of the house's
   * own and introduces them as the author asks. Each is walked in place,
   * with the others beside her, and an error names every finding that
   * failed. An awaited call that answered nothing between two of them is a
   * finding naming both.
   */
  static async household({ module, beings, introduce = [], walk, seed = 'household' }: HouseholdOptions): Promise<Finding[]> {
    const exported = (await import(hrefOf(module))) as { public?: BeingClass; beings?: readonly BeingClass[] };
    const members = beings ?? Object.fromEntries((exported.beings ?? []).map((Class) => [tableOf(Class).kind, Class]));
    const open = exported.public;
    const offers = [...Object.values(members), ...(open === undefined ? [] : [open])].flatMap((Class) => fakes(tableOf(Class), {}));
    // The household stood afresh: every being borne, the public being placed, and every introduction made.
    const stand = async (): Promise<Bench> => {
      const bench = await Bench.open({ module, offers, seed, ...(open === undefined ? {} : { public: open }) });
      try {
        for (const [id, Class] of Object.entries(members)) await bench.place(Class, { id });
        for (const [from, to] of introduce) await bench.introduce(from, to);
        return bench;
      } catch (error) {
        await bench.close();
        throw error;
      }
    };
    const all = [...Object.entries(members).map(([id, Class]) => ({ id, Class, position: 'normal' as const })), ...(open === undefined ? [] : [{ id: PUBLIC, Class: open, position: 'public' as const }])];
    const unknown = (walk ?? []).filter((id) => !all.some((member) => member.id === id));
    if (unknown.length > 0) throw new Error(`the household holds no ${unknown.join(', ')} to walk`);
    const walked = walk === undefined ? all : all.filter(({ id }) => walk.includes(id));
    const findings: Finding[] = [];
    for (const { id, Class, position } of walked) {
      const table = tableOf(Class);
      findings.push(
        ...(await Bench.#walked({
          table,
          position,
          stage: async (given) => {
            const bench = await stand();
            return Bench.#staging(bench, async () => new Placed(bench, id, position, table), given);
          },
          name: `${id}: `,
          partners: introduce.filter(([from]) => from === id).map(([, to]) => to),
        })),
      );
    }
    return failing(findings);
  }

  /**
   * One faculty alone, as a ground would stand it: its shape, its hooks,
   * its lifecycle, its examples and its answers, on its fake and on the
   * real body. The real body is held where the test hands its terrain in
   * `made`, or where it has no fake and so stands in for itself. Each
   * raise gets a fresh memory where `made` names none. An error names
   * every finding that failed.
   */
  static async #faculty(Class: FacultyClass, { made }: FacultyCheckOptions): Promise<Finding[]> {
    const findings: Finding[] = [];
    const found = (what: string, why?: string) => findings.push(why === undefined ? { ok: true, what } : { ok: false, what, why });
    const blueprint = Class.blueprint as Record<string, unknown> | undefined;
    found('its blueprint', typeof blueprint === 'object' && blueprint !== null ? undefined : 'it offers no blueprint: a need of its own, or a contract of the foundation');
    found('its needs', plain(Class.needs) ? undefined : 'what it needs of its terrain is plain data');
    const Fake = Class.fake;
    if (Fake === undefined) found('its fake', Object.keys(Class.needs ?? {}).length > 0 ? 'it needs its terrain, and has no fake to stand in its place' : undefined);
    else found('its fake', Fake.blueprint === Class.blueprint ? undefined : 'its fake offers another blueprint');
    // The faculty and its fake derive from one key drawn for this check, so a key either signs with is the other's too.
    const derive = deriving(made ?? {}, 'check');
    const bodies: [string, FacultyClass][] = [...(Fake === undefined ? [] : [['its fake', Fake] as [string, FacultyClass]]), ...(Fake === undefined || made !== undefined ? [['the faculty', Class] as [string, FacultyClass]] : [])];
    for (const [who, One] of bodies) findings.push(...(await walked(who, One, Class, { ...made, derive })));
    return failing(findings);
  }

  /**
   * One faculty raised as a ground raises it, on `made`: installed, then
   * up, and its body answered, or an error naming why it stood down. A
   * test calls the body's methods as a house would, and lets it go with
   * its `down`.
   */
  static async raise(Class: FacultyClass, made: Partial<Made> = {}): Promise<Faculty> {
    const body = new Class(madeOf({ ...made, derive: deriving(made, 'raised') }));
    const why = (await hook(() => body.install())) ?? (await hook(() => body.up()));
    if (why === undefined) return body;
    await body.down();
    throw new Error(`the faculty did not stand: ${why}`);
  }
}

// A being by its id, where a placed one is given.
const idOf = (being: Placed | string): string => (typeof being === 'string' ? being : being.id);

// Whether a value is a class of `Being.of`, whose table the bench reads.
const tableable = (value: unknown): boolean => {
  try {
    tableOf(value);
    return true;
  } catch {
    return false;
  }
};

// A module file by its URL, as a runner loads it.
const hrefOf = (module: URL | string): string => (typeof module === 'string' ? module : module.href);

// The args an ask is played with: those of its first example that names any, and the empty object otherwise.
const argsOf = (entry: Entry): Json => entry.examples.map((example) => (example as Example).args).find((args) => args !== undefined) ?? {};

// Why an answer of her house is a breach of her table or her house, or nothing where it is her own answer or refusal.
const breach = (message: string): string | undefined => {
  if (message === 'the ask failed') return 'it fails her house: it throws past fail';
  if (message === 'a readOnly ask wrote' || message === 'the house answered nothing' || /^she landed in .+, which its to does not name$/.test(message)) return message;
  return undefined;
};

// Keys derived as a ground derives a faculty's, from one key drawn for this raise, where `made` names no derivation.
const deriving = (made: Partial<Made>, name: string): Made['derive'] => {
  if (made.derive !== undefined) return made.derive;
  const crypto = new NobleCrypto();
  const key = crypto.random(32);
  return (label: string, length: number) => crypto.hkdf(key, `nervur-derive:faculty-key:${made.name ?? name}:${label}`, length);
};

// What a faculty raised alone is handed: what `made` names, a fresh memory where it names none, calls that reach nothing, and a listener that answers nothing.
const madeOf = (made: Partial<Made> & Pick<Made, 'derive'>): Made => ({
  name: made.name ?? 'raised',
  args: made.args ?? {},
  secrets: made.secrets ?? {},
  memory: made.memory ?? new FakeMemory(),
  derive: made.derive,
  met: made.met ?? {},
  faculties: made.faculties ?? [],
  call: made.call ?? (({ faculty }) => Promise.resolve({ error: { message: `no faculty ${faculty} stands beside it on the bench` } })),
  listener: made.listener ?? { fetch: () => Promise.resolve(null) },
});

// What a hook came to: nothing where it holds, or why not, a throw read the same way.
const hook = async (run: () => Status | void | Promise<Status | void>): Promise<string | undefined> => {
  try {
    const status = await run();
    return typeof status === 'object' && status !== null && !status.ok ? (status.why ?? 'it answered not ok') : undefined;
  } catch (error) {
    return `it threw: ${error instanceof Error ? error.message : String(error)}`;
  }
};

// Whether a value is plain JSON: what an installer can read.
const plain = (value: unknown): boolean => {
  try {
    return value === undefined || canonical(JSON.parse(JSON.stringify(value))) === canonical(value);
  } catch {
    return false;
  }
};

const isAnswer = (value: unknown): value is Answer =>
  typeof value === 'object' && value !== null && (('result' in value && !('error' in value)) || ('error' in value && typeof (value as { error?: { message?: unknown } }).error?.message === 'string'));

/**
 * One body walked as a ground walks it, and asked as a house asks it:
 * install and up, each example asked and asked again with its call id,
 * down, up again on the same memory with each example asked once more,
 * then down and uninstall. Every hook answers a status and never throws,
 * every method answers an answer held to its schema, and a call id acts
 * once across the restart.
 */
const walked = async (who: string, One: FacultyClass, Class: FacultyClass, made: Partial<Made> & Pick<Made, 'derive'>): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const found = (what: string, why?: string) => findings.push(why === undefined ? { ok: true, what: `${who}: ${what}` } : { ok: false, what: `${who}: ${what}`, why });
  const given = madeOf(made);
  const needs = (Class.blueprint ?? {}) as Record<string, { result?: unknown } | undefined>;
  const tools = new StrictTools();
  const ask = async (body: Faculty, example: FacultyExample, round: string): Promise<void> => {
    const what = `${example.method} ${example.id}, ${round}`;
    const run = (body as unknown as Record<string, unknown>)[example.method];
    if (typeof run !== 'function') return void found(what, `it has no method ${example.method}`);
    let answered: unknown;
    try {
      answered = await (run as (args: Json, context: FacultyContext) => unknown).call(body, example.args ?? {}, { id: example.id, call: () => Promise.resolve({ error: { message: 'the bench holds no token' } }), describe: () => Promise.resolve({ error: { message: 'the bench holds no token' } }) });
    } catch (error) {
      return void found(what, `it threw: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!isAnswer(answered)) return void found(what, 'it answered no answer: { result } or { error: { message } }');
    const result = needs[example.method]?.result;
    const mismatch = 'result' in answered && result !== undefined ? tools.check(result, answered.result) : null;
    if (mismatch !== null) return void found(what, `its result: ${mismatch}`);
    found(what, canonical(answered) === canonical(example.gives) ? undefined : `it gave ${canonical(answered)}, and its example gives ${canonical(example.gives)}`);
  };
  const life = async (round: string, first: boolean): Promise<Faculty | undefined> => {
    let body: Faculty;
    try {
      body = new One(given);
    } catch (error) {
      found(`${round}: made`, `it threw: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
    if (first) found(`${round}: install`, await hook(() => body.install()));
    const up = await hook(() => body.up());
    found(`${round}: up`, up);
    if (up !== undefined) return undefined;
    found(`${round}: health`, await hook(() => body.health()));
    for (const example of Class.examples ?? []) {
      await ask(body, example, round);
      if (first) await ask(body, example, `${round}, asked again`);
    }
    if (Class.contract !== undefined) {
      try {
        await Class.contract(body);
        found(`${round}: its contract`);
      } catch (error) {
        found(`${round}: its contract`, error instanceof Error ? error.message : String(error));
      }
    }
    found(`${round}: down`, await hook(() => body.down()));
    return body;
  };
  const lived = await life('first life', true);
  if (lived === undefined) return findings;
  const again = await life('after a restart', false);
  if (again !== undefined) found('uninstall', await hook(() => again.uninstall()));
  return findings;
};

// The findings, or an error naming every one that failed.
const failing = (findings: Finding[]): Finding[] => {
  const failed = findings.filter((finding) => !finding.ok);
  if (failed.length > 0) throw new Error(`the bench found ${failed.length}:\n${failed.map((finding) => `- ${finding.what}: ${finding.why}`).join('\n')}`);
  return findings;
};

// One JSON value as text with its keys in order, so two answers compare by what they hold.
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, held: unknown) =>
    typeof held === 'object' && held !== null && !Array.isArray(held) ? Object.fromEntries(Object.entries(held).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : held,
  );

// A fake of each faculty her needs name, answering what an example says,
// and `{ result: null }` where it says nothing.
const fakes = (table: Table, example: Example): Offer[] =>
  Object.entries(table.needs).map(([member, blueprint]) => {
    const said = example.fakes?.[member] ?? {};
    const object = Object.fromEntries(Object.keys(blueprint.methods).map((method) => [method, async () => said[method] ?? { result: null }]));
    return { blueprint, object, kinds: [table.kind] };
  });
