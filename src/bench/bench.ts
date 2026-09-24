// SPDX-License-Identifier: Apache-2.0
// The bench: two houses on one BenchGround, reached as any owner reaches
// hers. The author's house holds her classes and the fakes she hands it,
// as faculties granted to it alone. The bench's own house holds a caller,
// who asks her through a standing or as a stranger, so every ask crosses a
// door as it would in production. Nothing here reaches inside a house: a
// role is played by whoever an owner could have play it.
import { tableOf, type Json, type Table } from '../being/index.ts';
import type { ClassList, Offer } from '../index.ts';
import { BenchGround, Machine } from './bench-ground.ts';
import { FakeNetwork } from './fake-network.ts';
import { BenchCaller, BenchSteward } from './stewards.ts';

type BeingClass = ConstructorParameters<typeof ClassList>[0]['steward'];
type Entry = Table['asks'][string];
type Position = 'normal' | 'steward' | 'public';

/** What an ask answered. */
export type Answer = { readonly result: Json } | { readonly error: { readonly message: string } };

const STEWARD = 'steward';
const PUBLIC = 'public';
const AUTHOR = 'author';
const TESTER = 'bench';
const HOST = 'bench';
/** The being of the author's house that plays a being introduced to her. */
const NEIGHBOUR = 'bench-neighbour';

export interface BenchOptions {
  /** Her classes, and any other class her beings meet. */
  readonly classes: readonly BeingClass[];
  /** Fakes of the faculties her needs name. */
  readonly offers?: readonly Offer[];
  /** One seed, so a bench runs the same each time. */
  readonly seed?: string;
  /** Her steward, placed as the author's house's steward; the bench's own where none is given. */
  readonly steward?: BeingClass;
  /** Her public being, placed as the author's house's public being. */
  readonly public?: BeingClass;
}

/** Where a check places her: a normal being, the steward, or the public being. */
export interface CheckOptions {
  readonly classes?: readonly BeingClass[];
  readonly seed?: string;
  readonly position?: Position;
  /** The steward beside her, where she is not it. */
  readonly steward?: BeingClass;
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

/**
 * Who plays a role: the hand, a stranger, her steward, a being introduced
 * to her, or an occupant whose steward notes hold the role.
 */
type Player = 'hand' | 'stranger' | 'steward' | 'neighbour' | { readonly notes: string } | { readonly unplayed: string };

/** An asker as her roles read one. */
interface Asker {
  readonly id: string;
  readonly notes: Readonly<Record<string, Json>>;
  readonly steward: Readonly<Record<string, Json>>;
}

/** Who an asker the house makes is to her roles. */
const ROOT: Asker = Object.freeze({ id: 'root', notes: {}, steward: {} });
const STRANGER: Asker = Object.freeze({ id: 'stranger', notes: {}, steward: {} });

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
  /** The caller's standing on each being, by the role it plays. */
  readonly #doors = new Map<string, string>();
  /** The beings the neighbour stands on. */
  readonly #introduced = new Set<string>();
  #count = 0;

  private constructor(network: FakeNetwork, ground: BenchGround, ward: string, placed: { steward: BeingClass | undefined; public: BeingClass | undefined }) {
    this.#network = network;
    this.#ground = ground;
    this.#ward = ward;
    this.#own = placed.steward === undefined;
    this.#steward = placed.steward;
    this.#public = placed.public;
  }

  static async open({ classes, offers = [], seed = 'bench', steward, public: open }: BenchOptions): Promise<Bench> {
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
        [AUTHOR]: { steward: steward ?? BenchSteward, ...(open === undefined ? {} : { public: open }), beings: [...classes, BenchCaller] },
        [TESTER]: { steward: BenchCaller },
      },
    });
    const author = await ground.add(AUTHOR, AUTHOR, { faculties: Object.keys(faculties) });
    const tester = await ground.add(TESTER, TESTER);
    for (const standing of [author, tester]) if (standing.ward === undefined) throw new Error(`the bench's house did not open: ${standing.why}`);
    return new Bench(network, ground, author.ward!, { steward, public: open });
  }

  /**
   * Her class here: the steward or the public being where the bench opened
   * with her there, and otherwise borne by the bench's own steward, from
   * her `born`.
   */
  async place(Class: BeingClass, { id, born }: { id?: string; born?: Record<string, Json> } = {}): Promise<Placed> {
    const table = tableOf(Class);
    if (Class === this.#steward) return new Placed(this, STEWARD, 'steward', table);
    if (Class === this.#public) return new Placed(this, PUBLIC, 'public', table);
    if (!this.#own) throw new Error('the bench bears a being beside its own steward alone');
    const name = id ?? `placed-${++this.#count}`;
    await this.#rooted(AUTHOR, STEWARD, 'bear', { kind: table.kind, id: name, ...(born === undefined ? {} : { args: born }) });
    await this.settle();
    return new Placed(this, name, 'normal', table);
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
  async cellsOf(placed: Placed): Promise<Record<string, Json>> {
    const read = await this.#ground.ask({ house: AUTHOR, id: placed.id, cells: true });
    if (!('result' in read)) throw new Error(`the bench could not read the cells of ${placed.id}: ${JSON.stringify(read)}`);
    return read.result as Record<string, Json>;
  }

  // Who plays a role on her, judged on her cells as they stand. `root` and
  // a role root holds are the hand's, on any being. On the public being,
  // `stranger` and a role a stranger holds are a stranger's. The rest need
  // the bench's own steward: hers for `steward`, a neighbour it introduces
  // for `being`, and an occupant it invites, the role true in its steward
  // notes, for any other her table names and that occupant holds.
  async #player(placed: Placed, table: Table, role: string): Promise<Player> {
    const me = { id: placed.id, position: placed.position, cells: await this.cellsOf(placed) };
    const holds = (asker: Asker) => {
      const test = table.roles[role] as ((asker: Asker, me: unknown) => boolean) | undefined;
      try {
        return test?.(asker, me) === true;
      } catch {
        return false;
      }
    };
    if (role === 'root' || holds(ROOT)) return 'hand';
    if (placed.position === 'public' && (role === 'stranger' || holds(STRANGER))) return 'stranger';
    if (role === 'handle') return { unplayed: 'a handle is minted by her own ask' };
    if (!this.#own) return { unplayed: `the bench plays ${role} beside its own steward alone` };
    if (role === STEWARD) return placed.position === 'steward' ? { unplayed: 'the steward has no steward' } : 'steward';
    if (role === 'being') return 'neighbour';
    if (role in table.roles && !holds({ id: `bench-${role}`, notes: {}, steward: { [role]: true } })) return { unplayed: `no one it makes holds ${role} here` };
    return { notes: role };
  }

  /** One ask of a placed being, as whoever plays the role. */
  async asked(placed: Placed, table: Table, role: string, method: string, args: Json): Promise<Answer | null> {
    const player = await this.#player(placed, table, role);
    if (typeof player === 'object' && 'unplayed' in player) throw new Error(`the bench cannot play ${role} on ${placed.id}: ${player.unplayed}`);
    if (player === 'hand') {
      const answered = await this.#ground.ask({ house: AUTHOR, id: placed.id, method, args });
      await this.settle();
      return 'describe' in answered ? null : answered;
    }
    if (player === 'stranger') return this.#outcome(TESTER, STEWARD, 'visit', { ward: this.#ward, at: [`bench://${HOST}`], method, args });
    if (player === 'steward') return this.#outcome(AUTHOR, STEWARD, 'ask', { id: placed.id, method, args });
    if (player === 'neighbour') return this.#outcome(AUTHOR, NEIGHBOUR, 'ask', { standing: await this.#neighbour(placed.id), method, args });
    return this.#outcome(TESTER, STEWARD, 'ask', { standing: await this.#door(placed.id, player.notes), method, args });
  }

  /** What a placed being shows whoever plays the role. */
  async described(placed: Placed, table: Table, role: string): Promise<Described | null> {
    const player = await this.#player(placed, table, role);
    if (typeof player === 'object' && 'unplayed' in player) throw new Error(`the bench cannot play ${role} on ${placed.id}: ${player.unplayed}`);
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

  // One of the bench's own beings asked through the hand, which fails the test where she answers an error.
  async #rooted(house: string, id: string, method: string, args: Json): Promise<Json> {
    const answered = await this.#ground.ask({ house, id, method, args });
    await this.settle();
    if (!('result' in answered)) throw new Error(`the bench's ${id} could not ${method}: ${JSON.stringify(answered)}`);
    return answered.result;
  }

  // One ask through one of the bench's beings: its answer, or the reply its effect brought once it landed, or silence.
  async #outcome(house: string, id: string, method: string, args: Json): Promise<Answer | null> {
    const replies = async () => (await this.#rooted(house, id, 'replies', {})) as Answer[];
    const before = (await replies()).length;
    const read = (await this.#rooted(house, id, method, args)) as { answer?: Answer; queued?: true };
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

  /** Every example of her class run, twice, on two fresh benches. */
  static async examples(Class: BeingClass, options: CheckOptions = {}): Promise<Finding[]> {
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

  // A fresh bench with her in the position the check names, and the steward beside her where one is given.
  static #opening(Class: BeingClass, table: Table, example: Example, { classes = [], seed, position = 'normal', steward }: CheckOptions): Promise<Bench> {
    return Bench.open({
      classes: position === 'normal' ? [Class, ...classes] : classes,
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

  static async #run(Class: BeingClass, table: Table, entry: Entry, example: Example, options: CheckOptions) {
    const bench = await Bench.#opening(Class, table, example, options);
    const placed = await bench.place(Class);
    await Bench.#replay(placed, example.given ?? []);
    const answer = await placed.ask(entry.method, example.args ?? {}, example.role === undefined ? {} : { role: example.role });
    return { answer: answer ?? { nothing: true }, cells: await placed.cells() };
  }

  /**
   * Every state her `born` and her examples' histories reach, described to
   * every role the bench can play: what each is shown is what her table owes.
   */
  static async walk(Class: BeingClass, options: CheckOptions = {}): Promise<Finding[]> {
    const table = tableOf(Class);
    const where = { ...options, seed: options.seed ?? 'walk' };
    const position = options.position ?? 'normal';
    const findings: Finding[] = [];
    const histories = [[], ...Object.values(table.asks).flatMap((entry) => entry.examples.map((example) => (example as Example).given ?? []))];
    const seen = new Set<string>();
    // Each role her position lets someone hold: the steward has no steward, and only the public being has strangers.
    const roles = [...new Set([STEWARD, ...Object.keys(table.roles), ...Object.values(table.asks).flatMap((entry) => entry.for ?? [])])].filter(
      (role) => role !== 'handle' && (role !== 'stranger' || position === 'public') && (role !== STEWARD || position !== 'steward'),
    );
    for (const given of histories) {
      const bench = await Bench.#opening(Class, table, {}, where);
      const placed = await bench.place(Class);
      try {
        await Bench.#replay(placed, given);
      } catch {
        // A history that stops is its example's finding, and reaches no state here.
        continue;
      }
      // One visit a state, from the first history that reaches it.
      const state = (await placed.describe())?.state;
      if (state === undefined || seen.has(state)) continue;
      seen.add(state);
      for (const role of roles) {
        const player = await bench.#player(placed, table, role);
        if (typeof player === 'object' && 'unplayed' in player) continue;
        const what = `${state}, as ${role}`;
        const described = await placed.describe({ role });
        const shown = (described?.asks ?? []).map((entry) => entry.method).sort();
        // A stranger is never shown an effect.
        const owed = Object.values(table.asks)
          .filter((entry) => !(entry.effect && player === 'stranger'))
          .filter((entry) => (entry.for === null ? true : entry.for.includes(role)))
          .map((entry) => entry.method)
          .sort();
        if (described === null) findings.push({ ok: false, what, why: 'she answered nothing' });
        else if (described.state !== state) findings.push({ ok: false, what, why: `she says ${described.state}` });
        else if (shown.join() !== owed.join()) findings.push({ ok: false, what, why: `she shows ${shown.join(', ') || 'nothing'}, and her table owes ${owed.join(', ') || 'nothing'}` });
        else findings.push({ ok: true, what });
      }
    }
    return findings;
  }

  /** Her examples and her walk, and an error naming every finding that failed. */
  static async check(Class: BeingClass, options: CheckOptions = {}): Promise<Finding[]> {
    const findings = [...(await Bench.examples(Class, options)), ...(await Bench.walk(Class, options))];
    const failed = findings.filter((finding) => !finding.ok);
    if (failed.length > 0) throw new Error(`the bench found ${failed.length}:\n${failed.map((finding) => `- ${finding.what}: ${finding.why}`).join('\n')}`);
    return findings;
  }
}

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
