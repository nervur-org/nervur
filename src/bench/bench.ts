// SPDX-License-Identifier: Apache-2.0
// The bench: a terrain of two houses in one process. The author's house
// holds her classes and the fakes she hands it. The bench's own house
// holds a handle to each being she places and asks through it, so every
// ask crosses as a box, on fake bodies and one clock the test moves.
import type { Json, Position } from '../being/being.ts';
import { resolve, type Table, type TableEntry } from '../being/table.ts';
import { blueprintOf, type Blueprint } from '../being/need.ts';
import { StrictTools } from '../bodies/strict-tools.ts';
import { ClassList } from '../bodies/class-list.ts';
import type { BeingClass } from '../foundation.ts';
import { openForBench, type Answer, type BenchAccess, type Offer, type Opened } from '../house/house.ts';
import { Room } from '../quo/room.ts';
import { FakeCarry, type Door } from './fake-carry.ts';
import { FakeClock } from './fake-clock.ts';
import { FakeKeys } from './fake-keys.ts';
import { FakeMemory } from './fake-memory.ts';
import { SeededCrypto } from './seeded.ts';
import { settle } from './settle.ts';
import { BenchSteward, BenchTester } from './stewards.ts';

const STEWARD = 'steward';
const PUBLIC = 'public';
const tools = new StrictTools();

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

interface Example {
  readonly description?: string;
  readonly cells?: Record<string, Json>;
  readonly role?: string;
  readonly args?: Record<string, Json>;
  readonly fakes?: Record<string, Record<string, Json>>;
  readonly gives?: Json;
}

/** A being the bench placed, asked through a handle as any role. */
export class Placed {
  readonly id: string;
  readonly #bench: Bench;
  readonly #table: Table;

  constructor(bench: Bench, id: string, table: Table) {
    this.#bench = bench;
    this.id = id;
    this.#table = table;
  }

  /** The role an ask's entry names first; `steward` where it names every occupant. */
  roleFor(method: string): string {
    const entry = this.#table.asks[method];
    return entry?.for?.[0] ?? STEWARD;
  }

  /** One ask, crossing as a box, as the occupant who plays `role`. `null` is silence or nothing. */
  async ask(method: string, args: Json = {}, { role = this.roleFor(method) }: { role?: string } = {}): Promise<Answer | null> {
    const answered = await this.#bench.through(this.id, role, method, method, args);
    return answered === null || 'describe' in answered ? null : answered;
  }

  /** Her describe as `role` sees it: `root` where she is the steward, her steward otherwise. */
  async describe({ role = this.id === STEWARD ? 'root' : STEWARD }: { role?: string } = {}): Promise<{ state: string; asks: { method: string }[] } | null> {
    const answered = await this.#bench.through(this.id, role, undefined, undefined, {});
    return answered !== null && 'describe' in answered ? (answered.describe as { state: string; asks: { method: string }[] }) : null;
  }

  /** Her cells as they stand. */
  cells(): Promise<Record<string, Json> | null> {
    return this.#bench.cellsOf(this.id);
  }
}

export class Bench {
  readonly clock: FakeClock;
  readonly #author: { opened: Opened; access: BenchAccess };
  readonly #tester: { opened: Opened; access: BenchAccess };
  readonly #standings = new Map<string, string>();
  readonly #steward: BeingClass | undefined;
  readonly #public: BeingClass | undefined;
  readonly #stranger: { room: Room; secret: string };
  #count = 0;

  private constructor(
    clock: FakeClock,
    author: { opened: Opened; access: BenchAccess },
    tester: { opened: Opened; access: BenchAccess },
    placed: { steward: BeingClass | undefined; public: BeingClass | undefined },
    stranger: { room: Room; secret: string },
  ) {
    this.clock = clock;
    this.#author = author;
    this.#tester = tester;
    this.#steward = placed.steward;
    this.#public = placed.public;
    this.#stranger = stranger;
  }

  static async open({ classes, offers = [], seed = 'bench', steward, public: open }: BenchOptions): Promise<Bench> {
    const clock = new FakeClock();
    const network = new Map<string, Door>();
    const house = async (name: string, list: ClassList, handed: readonly Offer[]) => {
      const crypto = new SeededCrypto(`${seed}:${name}`);
      const carry = new FakeCarry({ network, address: `bench://${name}` });
      const opened = await openForBench({ keys: new FakeKeys(`${seed}:${name}`, crypto), memory: new FakeMemory(), classes: list, carry, clock, crypto, tools }, handed);
      carry.listen(opened.opened);
      return opened;
    };
    const author = await house('author', new ClassList({ steward: steward ?? BenchSteward, ...(open === undefined ? {} : { public: open }), beings: classes }), offers);
    const tester = await house('bench', new ClassList({ steward: BenchTester }), []);
    // The stranger's key, drawn from the seed, so a re-run signs as the first run did.
    const crypto = new SeededCrypto(`${seed}:stranger`);
    const stranger = { room: new Room(new FakeKeys(`${seed}:stranger`, crypto), crypto, tools), secret: tools.hex(crypto.random(32)) };
    return new Bench(clock, author, tester, { steward, public: open }, stranger);
  }

  /**
   * Her class here: the steward or the public being where the bench opened
   * with her there, and otherwise borne, from her `born` or from the cells
   * an example starts from.
   */
  async place(Class: BeingClass, { id, cells, born }: { id?: string; cells?: Record<string, Json>; born?: Record<string, Json> } = {}): Promise<Placed> {
    const table = resolve(Class);
    const position = Class === this.#steward ? STEWARD : Class === this.#public ? PUBLIC : undefined;
    const name = position ?? id ?? `placed-${++this.#count}`;
    if (position === undefined) await this.#author.access.bear(table.kind, name, born);
    await this.settle();
    if (cells !== undefined) {
      const patched = await this.#author.access.patch(name, (row) => {
        row.cells = { ...row.cells, ...cells };
      });
      if (!patched) throw new Error('memory refused the example’s cells');
    }
    return new Placed(this, name, table);
  }

  /** Lets every ask, effect and reply the houses started run to its end. */
  async settle(): Promise<void> {
    await settle();
  }

  /** The clock moved on, and what came due run. */
  async advance(ms: number): Promise<void> {
    this.clock.advance(ms);
    await this.settle();
  }

  cellsOf(being: string): Promise<Record<string, Json> | null> {
    return this.#author.access.cells(being);
  }

  // Who plays a role. On the public being, a role `stranger` holds is played
  // by a box with the zero head. A role `root` holds is played through the
  // hand, on any being. Otherwise an occupant named for it plays it, the
  // role true in both sets of notes. A handle is admitted to one ask;
  // `being` is introduced; `steward` is hers.
  async through(being: string, role: string, ask: string | undefined, method: string | undefined, args: Json): Promise<Answer | { describe: Json } | null> {
    const holds = async (asker: 'root' | 'stranger') => role === asker || (await this.#author.access.roles(being, asker)).includes(role);
    const played = being === PUBLIC && (await holds('stranger')) ? this.#zero(method, args) : (await holds('root')) ? this.#hand(being, method, args) : undefined;
    if (played !== undefined) {
      const answered = await played;
      await this.settle();
      return answered;
    }
    const occupant = role === 'handle' ? `handle:bench-${ask}` : role === 'being' ? 'being:bench' : role;
    const key = `${being}\n${occupant}`;
    let standing = this.#standings.get(key);
    if (standing === undefined) {
      const notes = role === STEWARD || role === 'being' || role === 'handle' ? {} : { [role]: true };
      const invitation = await this.#author.access.occupant(being, occupant, { notes, steward: notes, ...(role === 'handle' ? { ask: ask! } : {}) });
      const adopted = await this.#tester.opened.ask({ method: 'adopt', args: { invitation } });
      if (!('result' in adopted)) throw new Error(`the bench could not hold ${role}: ${JSON.stringify(adopted)}`);
      standing = adopted.result as string;
      this.#standings.set(key, standing);
    }
    const answered = await this.#tester.access.far(STEWARD, standing, method, args);
    await this.settle();
    return answered;
  }

  // A being asked by the holder of the house's hand, which no box carries.
  #hand(being: string, method: string | undefined, args: Json): Promise<Answer | { describe: Json }> {
    return this.#author.opened.ask({ id: being, ...(method === undefined ? {} : { method, args }) });
  }

  // The public being asked by a stranger: a box with the zero head, signed with the bench's stranger key.
  async #zero(method: string | undefined, args: Json): Promise<Answer | { describe: Json } | null> {
    const { room, secret } = this.#stranger;
    const ward = this.#author.opened.ward;
    const sealed = await room.stranger(ward, secret, { ...(method === undefined ? {} : { method }), args: tools.canonical(args) });
    const read = await room.strangerRead(ward, sealed.lid, await this.#author.opened.door(sealed.box));
    if (!('object' in read)) return null;
    return method === undefined ? { describe: read.object as Json } : (read.object as Answer);
  }

  /** Every example of her class run, twice, on two fresh benches. */
  static async examples(Class: BeingClass, options: CheckOptions = {}): Promise<Finding[]> {
    const table = resolve(Class);
    const where = { ...options, seed: options.seed ?? 'examples' };
    const findings: Finding[] = [];
    for (const entry of Object.values(table.asks)) {
      for (const [index, raw] of entry.examples.entries()) {
        const example = raw as Example;
        const what = `${entry.method}, example ${index + 1}${example.description === undefined ? '' : `: ${example.description}`}`;
        try {
          const first = await Bench.#run(Class, table, entry, example, where);
          const second = await Bench.#run(Class, table, entry, example, where);
          if (example.gives !== undefined && tools.canonical(first.answer) !== tools.canonical(example.gives)) {
            findings.push({ ok: false, what, why: `it gives ${JSON.stringify(first.answer)}, and the example says ${JSON.stringify(example.gives)}` });
          } else if (tools.canonical(first) !== tools.canonical(second)) {
            findings.push({ ok: false, what, why: 'a re-run on the same cells answered differently' });
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

  static async #run(Class: BeingClass, table: Table, entry: TableEntry, example: Example, options: CheckOptions) {
    const bench = await Bench.#opening(Class, table, example, options);
    const placed = await bench.place(Class, example.cells === undefined ? {} : { cells: example.cells });
    const answer = await placed.ask(entry.method, example.args ?? {}, example.role === undefined ? {} : { role: example.role });
    return { answer: answer ?? { nothing: true }, cells: await placed.cells() };
  }

  /**
   * Every state her default cells and her examples reach, described to
   * every role she names: what each is shown is what her table says.
   */
  static async walk(Class: BeingClass, options: CheckOptions = {}): Promise<Finding[]> {
    const table = resolve(Class);
    const where = { ...options, seed: options.seed ?? 'walk' };
    const position = options.position ?? 'normal';
    const findings: Finding[] = [];
    const starts = [undefined, ...Object.values(table.asks).flatMap((entry) => entry.examples.map((example) => (example as Example).cells))];
    const seen = new Set<string>();
    // Each role her position lets someone hold: the steward has no steward, and only the public being has strangers.
    const roles = [...new Set([STEWARD, ...Object.keys(table.roles), ...Object.values(table.asks).flatMap((entry) => entry.for ?? [])])].filter(
      (role) => role !== 'handle' && (role !== 'stranger' || position === 'public') && (role !== STEWARD || position !== 'steward'),
    );
    for (const cells of starts) {
      // One visit a state, from the first cells that reach it.
      const state = table.state({ id: '', position, cells: { ...table.cells, ...cells } });
      if (seen.has(state)) continue;
      seen.add(state);
      const bench = await Bench.#opening(Class, table, {}, where);
      const placed = await bench.place(Class, cells === undefined ? {} : { cells });
      // The roles a stranger holds, to whom a public being never shows an effect.
      const strange = position === 'public' ? await bench.#author.access.roles(PUBLIC, 'stranger') : [];
      for (const role of roles) {
        const what = `${state}, as ${role}`;
        const described = await placed.describe({ role });
        const shown = (described?.asks ?? []).map((entry) => entry.method).sort();
        const owed = Object.values(table.asks)
          .filter((entry) => !(entry.effect && (role === 'stranger' || strange.includes(role))))
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

// A fake of each faculty her needs name, answering what an example says,
// and `{ result: null }` where it says nothing.
const fakes = (table: Table, example: Example): Offer[] =>
  Object.entries(table.needs).map(([member, blueprint]: [string, Blueprint]) => {
    const said = example.fakes?.[member] ?? {};
    const object = Object.fromEntries(Object.keys(blueprint.methods).map((method) => [method, async () => said[method] ?? { result: null }]));
    return { blueprint: blueprintOf(blueprint) ?? blueprint, object, kinds: [table.kind] };
  });
