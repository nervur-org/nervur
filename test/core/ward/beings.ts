// SPDX-License-Identifier: Apache-2.0
// The beings the scenarios stand, and a world of wards reached by pk.
import { Being, Faculty, isSilence, isWord, told, word, type Answer, type Asker, type BeingClass, type Invitation, type JsonObject, type Stance } from '../../../src/core/being/index.ts';
import { Carrier, Clock, Memory, type Rows } from '../../../src/core/contract/index.ts';
import { CryptoEntropy, SystemClock, VolatileMemory } from '../../../src/core/pointer/bodies.ts';
import { House, Ward, type Classes as Resolving, type WardClass } from '../../../src/core/ward/index.ts';
import { TestWard } from '../classes.ts';

// Any ward, and the test ward at genesis.
const ANY: WardClass = { genesis: TestWard.kind, contract: 'ward', fits: (C) => Ward.fulfils(C) };

// What came back, as a test reads it.
export const said = (x: Answer | undefined): unknown => (isSilence(x) ? 'silence' : isWord(x) ? told(x) : x);

// Greets whoever is at her door, and writes the name down.
export class Host extends Being {
  static override kind = 'org.example.host';
  static override cells = { greeted: [] as string[] };
  static override asks = {
    greet: { description: 'say hello' },
    slow: {},
    broken: {},
    odd: {},
    keep: {},
    told: {},
  };
  told(): JsonObject {
    return word('late') as unknown as JsonObject;
  }
  keep(): JsonObject {
    (this.cells.greeted as string[]).push('kept');
    this.cells.when = new Date() as unknown as string;
    return { kept: true };
  }
  greet(args: JsonObject, asker: Asker): JsonObject {
    (this.cells.greeted as string[]).push(asker.id ?? 'nobody');
    return { hello: asker.id ?? null, args };
  }
  // Never answers, and tells a test it was asked.
  static entered: (() => void) | undefined;
  slow(): Promise<JsonObject> {
    Host.entered?.();
    return new Promise(() => {});
  }
  broken(): JsonObject {
    throw new Error('broken');
  }
  odd(): JsonObject {
    return { when: new Date() } as unknown as JsonObject;
  }
}

// A contract a guest borrows, which no faculty here fulfils.
export class Borrowed extends Faculty {
  static override kind = 'org.example.borrowed';
}

// Takes one relation and asks through it.
export class Guest extends Being {
  static override kind = 'org.example.guest';
  static override asks = { join: {}, go: {}, make: {}, drop: {}, race: {}, borrow: {} };
  async borrow(): Promise<JsonObject> {
    return { lent: await this.stance.lend(Borrowed, 'borrowed') };
  }
  async join(args: JsonObject): Promise<JsonObject> {
    const id = await this.stance.standings.take('host', args.invitation as Invitation);
    return { joined: id };
  }
  async go(args: JsonObject): Promise<JsonObject> {
    const standing = this.stance.standings.get('host');
    if (!standing) return { said: 'no host' };
    const method = typeof args.method === 'string' ? args.method : 'greet';
    const out = await standing.ask(method, (args.args as JsonObject | undefined) ?? {}, args.time === undefined ? undefined : { time: args.time as number });
    return { said: said(out) as JsonObject };
  }
  async make(args: JsonObject): Promise<JsonObject> {
    return { made: await this.stance.boot('org.example.host', args.key as string, 'host') };
  }
  drop(): JsonObject {
    return { dropped: this.stance.standings.remove('host'), again: this.stance.standings.remove('host') };
  }
  async race(): Promise<JsonObject> {
    const both = await Promise.all([this.stance.occupants.invite('same'), this.stance.occupants.invite('same')]);
    return { invited: both.filter((i) => i !== null).length, ids: this.stance.occupants.ids(), removed: this.stance.occupants.remove('same'), again: this.stance.occupants.remove('same') };
  }
}

// A class that cannot be born.
export class Thrower extends Being {
  static override kind = 'org.example.thrower';
  constructor(stance: Stance) {
    super(stance);
    throw new Error('no birth');
  }
}

// The classes named, and the test ward every house takes at genesis.
export class Classes implements Resolving {
  readonly #classes = new Map<string, BeingClass>();
  constructor(...classes: BeingClass[]) {
    for (const C of [TestWard, ...classes]) this.#classes.set(C.kind, C);
  }
  classOf(kind: string): BeingClass | undefined {
    return this.#classes.get(kind);
  }
}

// A memory around another, so a scene bends one of its four ways alone.
export class Around extends Memory {
  readonly inner: Memory;
  constructor(inner: Memory = new VolatileMemory()) {
    super();
    this.inner = inner;
  }
  read(place: string): Promise<Map<string, Uint8Array>> {
    return this.inner.read(place);
  }
  write(place: string, entries: ReadonlyMap<string, Uint8Array | null>): Promise<void> {
    return this.inner.write(place, entries);
  }
  places(): Promise<string[]> {
    return this.inner.places();
  }
  forget(place: string): Promise<void> {
    return this.inner.forget(place);
  }
}

// A memory that keeps, until it is refusing.
export class Refusing extends Around {
  refusing = false;
  override write(place: string, entries: ReadonlyMap<string, Uint8Array | null>): Promise<void> {
    return this.refusing ? Promise.reject(new Error('refused')) : super.write(place, entries);
  }
}

// A memory that reads nothing while it is unreadable.
export class Unreadable extends Around {
  unreadable = false;
  override read(place: string): Promise<Map<string, Uint8Array>> {
    return this.unreadable ? Promise.reject(new Error('unreadable')) : super.read(place);
  }
}

// Rows by ward name, living as long as this object, kept except for the
// wards named in `refused`.
export class Shelf {
  readonly refused = new Set<string>();
  readonly #rows = new Map<string, Record<string, unknown>>();
  open(name: string): Rows {
    let rows = this.#rows.get(name);
    if (!rows) this.#rows.set(name, (rows = {}));
    return { rows, told: () => {}, kept: () => Promise.resolve(!this.refused.has(name)) };
  }
}

// Wards reached by pk, in one process, each on its own rows.
// A clock the test turns: every wait ends when the test rings, and never
// before, so an allowance runs out on an event and not on the machine's
// speed.
export class HandClock extends Clock {
  #waiting = new Set<() => void>();
  now(): number {
    return 0;
  }
  wait(): { done: Promise<void>; cancel(): void } {
    let end = (): void => {};
    const done = new Promise<void>((resolve) => (end = resolve));
    this.#waiting.add(end);
    return { done, cancel: () => this.#waiting.delete(end) };
  }
  ring(): void {
    for (const end of this.#waiting) end();
    this.#waiting.clear();
  }
}

export class Wards extends Carrier {
  readonly clock: Clock;
  constructor(clock: Clock = new SystemClock()) {
    super();
    this.clock = clock;
  }
  readonly memory = new Shelf();
  readonly wards = new Map<string, House>();
  readonly #pks = new Map<string, string>();
  readonly cut = new Set<string>();
  // How many replies are lost after their ask arrived.
  lose = 0;
  catalogue: Resolving = new Classes(Host, Guest, Thrower);

  async carry(pk: string, bytes: Uint8Array): Promise<Uint8Array | null> {
    const ward = [...this.wards.values()].find((w) => w.pk === pk);
    if (!ward || this.cut.has(pk)) return null;
    const { bytes: reply } = await ward.door.arrive(bytes);
    if (this.lose === 0) return reply;
    this.lose -= 1;
    return null;
  }

  async stand(name: string): Promise<House> {
    const memory = this.memory.open(name);
    const ward = await House.unpack({ seed: name, memory, classes: this.catalogue, entropy: new CryptoEntropy(), clock: this.clock, carrier: this, ward: ANY });
    await ward.standWard();
    this.wards.set(name, ward);
    this.#pks.set(name, ward.pk);
    return ward;
  }

  house(name: string): House {
    return this.wards.get(name)!;
  }
}
