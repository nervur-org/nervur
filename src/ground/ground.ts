// SPDX-License-Identifier: Apache-2.0
// The ground: the process houses run in, on any engine. Every faculty has
// one lifecycle: a registry holds it by name, and its `up` raises it into
// a body. The primordial go up first on the host's entries: the memory,
// the unlock, crypto and tools, then the library's `ground`, whose body is
// the ground's work. The dock opens next on them alone, a house whose
// beings' cells hold its state: a twin for each faculty entry, a being for each
// house and one for each secret. Its steward stands the ladder and opens
// every house through the `ground` faculty, so a broken ladder is always
// mended. The hand goes up last and down first. The ground keeps nothing
// but the living bodies and the open houses, and closes a house through
// the views it handed it, never asking it.
import type { Json } from '../being/being.ts';
import { blueprintOf, type Blueprint } from '../being/need.ts';
import { s } from '../being/schema.ts';
import { offered } from '../being/table.ts';
import { JoinedCarry } from '../bodies/joined-carry.ts';
import { NobleCrypto } from '../bodies/noble-crypto.ts';
import { SeedKeys } from '../bodies/seed-keys.ts';
import { StrictTools } from '../bodies/strict-tools.ts';
import { WebClock } from '../bodies/web-clock.ts';
import type { Handler } from '../bodies/web-carry.ts';
import { ClassList } from '../bodies/class-list.ts';
import { Faculty, type Call, type FacultyClass, type Made, type Registry, type Status } from '../faculty.ts';
import { contractOf, foundationContract, type Carry, type Classes, type ClassesSource, type Clock, type Contract, type Crypto, type Memory, type Tools } from '../foundation.ts';
import { openHouse, type Answer, type FacultyContext, type Offer, type Opened } from '../house/house.ts';
import { GroundHouses } from '../being/dock-pilot.ts';
import { DOCK, dockClasses, GROUND, GroundNeed, IDS, KINDS, ownerKinds } from './dock.ts';
import { contain, type Contained, type Runner } from './runner.ts';
import { HouseCarry, HouseClock, LadderCarry, SealedMemory, ViewMemory } from './views.ts';

/** A door, as a carry hooks it. */
export type Door = (box: Uint8Array) => Promise<Uint8Array | null>;

/** The ground's one key, kept outside it by its host. */
export interface Unlock {
  /** Sixty-four lowercase hex digits: drawn and kept where none is kept yet. */
  key(): Promise<string>;
}
export const Unlock = foundationContract('unlock');

/** Where the owner reaches the ground: a body with a handler or a channel of its own, calling the ground's hand. */
export const Hand = foundationContract('hand');

/** A carry the ground hooks doors to, and unhooks them from. */
export interface Hooked extends Carry {
  listen(options: { ward: string; door: Door }): void | Promise<void>;
  unlisten(options: { ward: string }): void;
}

/**
 * The contract a body fills, read from its blueprint: a contract of the
 * foundation, the ground's own work, or `offer` where it offers beings a
 * blueprint of its own.
 */
type Serves = Contract['contract'] | 'ground' | 'offer';

/**
 * A body offering `Installer`: the need kinds it meets, and `meet`, which
 * meets one need of the faculty named, its spec as that faculty declares
 * it. It answers what it met, as each binary's absolute path under its
 * name, and the ground hands that answer to the faculty as `made.met`
 * under the need's kind. Nothing answered is handed as null. A throw
 * leaves that faculty down with why.
 */
export interface Installer {
  readonly meets: readonly string[];
  meet(need: { readonly kind: string; readonly spec: Json; readonly name: string }): Json | void | Promise<Json | void>;
}

/** One need of a faculty met: the installer that met it, and what it answered. Her twin keeps it. */
export interface Met {
  readonly by: string;
  readonly met: Json;
}
export const Installer = foundationContract('installer');

/** The faculties every terrain holds: the library's crypto, tools, and the clock of every web engine. */
const libraryRegistry: Registry = { faculties: { noble: NobleCrypto, strict: StrictTools, clock: WebClock } };

/**
 * Registries joined as one rung, the first first. A name one holds is
 * refused to the next, never replaced. No entry exports it; every shipped
 * ground joins its first rung with it.
 */
export const joinedRegistry = (...registries: readonly Registry[]): Registry => {
  const faculties: Record<string, FacultyClass> = {};
  for (const registry of registries) {
    for (const [name, faculty] of Object.entries(registry.faculties ?? {})) {
      if (Object.hasOwn(faculties, name)) throw new TypeError(`the registry names a faculty ${name}, which the ground holds already`);
      faculties[name] = faculty;
    }
  }
  return { faculties };
};

/** One foundation body a house names: the faculty that serves it, and the args it hands this house. */
export interface BodyNamed {
  readonly faculty: string;
  readonly [argument: string]: Json | undefined;
}

/** One house's entry: its code, its memory where it takes one, its faculties, and its bound on every ask. */
export interface Entry {
  readonly classes: BodyNamed;
  readonly memory?: BodyNamed;
  readonly faculties?: readonly string[];
  readonly wait?: number;
}

/** One faculty's entry: where it stands, what it is handed, the bodies it calls, and its grant. */
export interface FacultyEntry {
  readonly make?: string;
  readonly from?: string;
  readonly args?: Readonly<Record<string, Json>>;
  readonly secrets?: readonly string[];
  readonly faculties?: readonly string[];
  /** The installers that meet what its faculty needs of the terrain, asked in this order. */
  readonly installers?: readonly string[];
  readonly kinds?: readonly string[];
}

/** A house as the ground holds it: open with its ward, or closed and why. */
export interface Standing {
  readonly name: string;
  readonly entry: Entry;
  readonly ward?: string;
  readonly why?: string;
}

/**
 * What the ground's hand takes, as every terrain serves it: `describe`, or
 * an ask as `root` of a being, in the house it names or in the dock where
 * it names none. With no id, the house's steward is asked.
 */
export interface HandAsk {
  readonly describe?: true;
  readonly house?: string;
  readonly id?: string;
  readonly method?: string;
  readonly args?: Json;
  /** The answer the owner holds, which makes a `readOnly` ask a watch. */
  readonly after?: Answer;
  /** Her cells read, and nothing asked. */
  readonly cells?: true;
  /** The call's id: the same id asked again answers what the first answered, and runs nothing twice. */
  readonly call?: string;
}

/** What the ground's hand shows its owner: the dock's asks, every body of the ladder, and every house. */
export interface Described {
  readonly dock: Json;
  readonly faculties: Readonly<Record<string, Json>>;
  readonly houses: readonly Standing[];
}

/** The entries the host names, raised on the terrain's args around the dock: the memory, the unlock, crypto, tools and the clock before it, and the hand after it. */
export interface Primordial {
  readonly unlock: FacultyEntry;
  readonly memory: FacultyEntry;
  readonly crypto: FacultyEntry;
  readonly tools: FacultyEntry;
  /** The ground's one clock, which the dock and every house receive. */
  readonly clock: FacultyEntry;
  /** Where the owner reaches the hand: a socket, a key, a channel. It names `ground` in its faculties. */
  readonly hand?: FacultyEntry;
}

/** What `Ground.open` takes, all of it the host's. */
export interface GroundOptions {
  /** The ladder's first rung: the terrain's faculties, and whatever the host installs beside them. */
  readonly registry: Registry;
  readonly primordial: Primordial;
  /** The terrain's default entries; an entry the owner lands under the same name stands in its place. */
  readonly entries?: Readonly<Record<string, FacultyEntry>>;
  /** The terrain's bound on every ask of every house, in milliseconds; the one the owner sets through the dock stands in its place. */
  readonly wait?: number;
  /**
   * A ground woken per event opens a house only when something reaches it:
   * a box for its ward, or the hand. A house whose ward it never learned
   * opens at the boot. `wake()` opens every one. The dock opens at every
   * boot all the same.
   */
  readonly lazy?: boolean;
  /**
   * Each faculty stands its `fake` in its place, and one that needs its
   * terrain and has no fake stays down with why: the bench's ground.
   */
  readonly fakes?: boolean;
  /**
   * Each house opens in a runner of its own, its bodies held here, and its
   * classes loaded there from the modules its classes body names. A ground
   * with none opens each house in place, as the edge does.
   */
  readonly runner?: Runner;
  /**
   * The terrain's import of a faculty's address from its own install: the
   * module the address's face is. An entry with no `from` whose `make` is
   * an address stands the one faculty that face shows.
   */
  readonly image?: (address: string) => Promise<unknown>;
}

/**
 * A faculty's address in the image: a package, the kind `faculties`, then
 * one folder, as `@nervur-org/proof/faculties/layout`.
 */
const ADDRESS = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*\/faculties\/[a-z0-9][a-z0-9._-]*$/;

// A class a face shows that extends Faculty, read by its shape, so a copy of the library the image holds beside this one reads alike.
const isFaculty = (value: unknown): value is FacultyClass =>
  typeof value === 'function' && 'blueprint' in value && typeof (value.prototype as { up?: unknown } | undefined)?.up === 'function' && typeof (value.prototype as { down?: unknown }).down === 'function';

// A classes body's answer that names modules, which a runner loads, rather than classes loaded already.
const isSource = (classes: Classes | ClassesSource): classes is ClassesSource => Array.isArray((classes as { modules?: unknown }).modules);

const PRIMORDIAL = new Set<Serves>(['unlock', 'crypto', 'tools', 'clock', 'ground', 'hand']);
/** The names every faculty's hooks and parts hold, which no blueprint's method takes. */
const HOOKS = new Set(['made', 'install', 'migrate', 'up', 'health', 'down', 'uninstall', 'opened', 'house', 'blueprint', 'window', 'handler', 'registry', 'schemes', 'port']);
const NONE = { args: s.object({}) } as const;
/** Why the hand mints no occupant itself: an invitation onto a house's steward is the dock's `housesInvite`, and none stands onto the dock. */
const UNINVITED = 'the hand invites through the dock’s housesInvite alone';

// The contract a blueprint names: a foundation's, the ground's work, an offer of its own, or none.
const servesOf = (blueprint: unknown): Serves | undefined => {
  if (blueprint === GroundNeed) return 'ground';
  const contract = contractOf(blueprint);
  if (contract !== undefined) return contract;
  return typeof blueprint === 'object' && blueprint !== null ? 'offer' : undefined;
};

// The blueprint a body holds: its own where its `up` learnt it, or its class's.
const blueprintHeld = (stood: { readonly Class?: FacultyClass; readonly body?: Faculty } | undefined): unknown => stood?.body?.blueprint ?? stood?.Class?.blueprint;

// The blueprint an offer names, settled.
const settled = (blueprint: unknown): Blueprint => blueprintOf(blueprint) ?? (blueprint as Blueprint);

const failed = (text: string): Answer => ({ error: { message: text } });

const isAnswer = (value: unknown): value is Answer => typeof value === 'object' && value !== null && ('result' in value || 'error' in value);

/**
 * What a hook came to: nothing where it holds, or why not. A status not
 * ok gives its own why. A throw is read the same way, its message the why
 * after what the hook was doing, and a secret waited for names itself.
 */
const statusOf = async (run: () => Status | void | Promise<Status | void>, doing: string): Promise<string | undefined> => {
  try {
    const status = await run();
    if (typeof status !== 'object' || status === null || status.ok) return undefined;
    return typeof status.why === 'string' && status.why !== '' ? status.why : `${doing}: it answered not ok`;
  } catch (error) {
    return error instanceof Waiting ? error.message : `${doing}: ${message(error)}`;
  }
};

// A body let go, whatever its `down` does: nothing it throws falls further.
const letGo = async (body: Faculty | undefined): Promise<void> => {
  try {
    await body?.down();
  } catch {
    // A body that cannot let go is gone all the same.
  }
};

// The ground's own work, a faculty the library holds: the body is the work's methods.
const groundWork = (work: () => object): FacultyClass =>
  class GroundWork extends Faculty {
    static override readonly blueprint = GroundNeed;
    static override readonly takes = NONE;
    constructor(made: Made) {
      super(made);
      Object.assign(this, work());
    }
  };

// A foundation body's args for one house: everything its part of the entry names but the faculty.
const argsOf = ({ faculty: _faculty, ...args }: BodyNamed): Readonly<Record<string, Json>> => args as Readonly<Record<string, Json>>;

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** What a body's read of an absent secret throws: its message is the why the body stays down with. */
class Waiting extends Error {}

// The memory a primordial faculty receives: none, since the dock is not open yet.
const unopened: Memory = {
  read: () => Promise.reject(new Error('a primordial faculty keeps nothing')),
  list: () => Promise.reject(new Error('a primordial faculty keeps nothing')),
  write: () => Promise.reject(new Error('a primordial faculty keeps nothing')),
};

// What a primordial faculty derives: nothing, since the ground's key is not drawn yet.
const underived = (): Promise<Uint8Array> => Promise.reject(new Error('a primordial faculty derives nothing'));

interface Held {
  readonly entry: Entry;
  readonly opened?: Opened;
  readonly clock?: HouseClock;
  readonly carry?: HouseCarry;
  /** The bound it opened on, which a move of the bound opens it again for. */
  readonly bound?: number;
  /** The carry its door was hooked to, which closing unhooks it from. */
  readonly hooked?: Hooked;
  readonly why?: string;
  /** The door's and the hand's calls on it not yet ended, which closing waits for. */
  readonly flight?: Set<Promise<unknown>>;
  /** Its ward, where it stands closed until something reaches it. */
  readonly asleep?: string;
}

/** The dock as the ground holds it: open from the boot to the close, its door hooked to each carry the ladder stands. */
interface Docked {
  readonly opened: Opened;
  readonly clock: HouseClock;
  readonly carry: HouseCarry;
  readonly flight: Set<Promise<unknown>>;
  hooked?: Hooked;
}

/** A body of the ladder as the ground holds it: standing, or down and why. */
interface Stood {
  readonly entry: FacultyEntry;
  /** Its class, where one was found: an offer is known by its blueprint while its body is down. */
  readonly Class?: FacultyClass;
  readonly body?: Faculty;
  readonly why?: string;
}

/**
 * What a primordial body's `call` reaches: a method of a primordial body
 * its entry names, called as it is, since each is the host's own. The
 * hand calls the ground's work so.
 */
const primordialCall =
  (raised: ReadonlyMap<string, Faculty>, named: readonly string[]) =>
  async ({ faculty, method, args }: Call): Promise<Answer> => {
    const body = raised.get(faculty);
    const run = (body as unknown as Record<string, unknown> | undefined)?.[method];
    if (!named.includes(faculty) || typeof run !== 'function') return failed(`the ${faculty} has no method ${method} to call here`);
    try {
      return { result: ((await (run as (args: unknown) => unknown).call(body, args)) ?? null) as Json };
    } catch (error) {
      return failed(message(error));
    }
  };

// One primordial body raised on its entry, filling the contract it names, or the reason the ground cannot open.
const primordial = async (registry: Registry, role: Serves, entry: FacultyEntry, raised: ReadonlyMap<string, Faculty>, listener: Handler): Promise<Faculty> => {
  const Class = entry.make === undefined ? undefined : registry.faculties?.[entry.make];
  if (Class === undefined) throw new Error(`no faculty ${entry.make} in the ground’s registry for its ${role}`);
  // The tools are not up yet, so the library's own check holds its args.
  const why = Class.takes?.args === undefined ? null : new StrictTools().check(Class.takes.args, entry.args ?? {});
  if (why !== null) throw new TypeError(`the faculty ${entry.make} is refused for its ${role}: ${why.replace(/^the value/, 'its args')}`);
  for (const callee of entry.faculties ?? []) if (!raised.has(callee)) throw new Error(`the ${role} calls ${callee}, which stands before it nowhere`);
  if (servesOf(Class.blueprint) !== role) throw new Error(`the faculty ${entry.make} serves no ${role}`);
  const made: Made = { name: role, args: entry.args ?? {}, secrets: {}, memory: unopened, derive: underived, met: {}, faculties: entry.faculties ?? [], call: primordialCall(raised, entry.faculties ?? []), listener };
  const body = new Class(made);
  const down = (await statusOf(() => body.install(), 'it did not install')) ?? (await statusOf(() => body.up(), 'it did not stand'));
  if (down !== undefined) {
    await letGo(body);
    throw new Error(`the faculty ${entry.make} did not stand for its ${role}: ${down}`);
  }
  return body;
};

export class Ground {
  readonly #options: GroundOptions;
  readonly #registry: Registry;
  /** Each faculty the terrain imported by its address, which joins its registry as code, never as state. */
  readonly #images = new Map<string, FacultyClass>();
  #memory!: Memory;
  #crypto!: Crypto;
  #tools!: Tools;
  #keys!: SeedKeys;
  /** The primordial bodies by role, in the order they went up. */
  readonly #primordial = new Map<string, Faculty>();
  #dock: Docked | undefined;
  /** Whether the dock stands open on the owner's classes beside the library's. */
  #extended = false;
  readonly #houses = new Map<string, Held>();
  readonly #stood = new Map<string, Stood>();
  /** Each asleep house opening, so two boxes at once open it once. */
  readonly #waking = new Map<string, Promise<unknown>>();

  private constructor(options: GroundOptions) {
    this.#options = options;
    // The library's own faculty first, the ground's work, then the terrain's and the host's.
    this.#registry = joinedRegistry({ faculties: { [GROUND]: groundWork(() => this.#work()) } }, libraryRegistry, options.registry);
  }

  /**
   * A ground opened on its host's registry and entries: the primordial
   * bodies go up, the dock opens on them and stands the ladder and every
   * house, and the hand goes up.
   */
  static async open(options: GroundOptions): Promise<Ground> {
    const ground = new Ground(options);
    try {
      await ground.#boot();
    } catch (error) {
      await ground.close();
      throw error;
    }
    return ground;
  }

  async #boot(): Promise<void> {
    const { primordial: host } = this.#options;
    // The memory first, so a lock it takes holds before the key is drawn.
    for (const [role, entry] of [
      ['memory', host.memory],
      ['unlock', host.unlock],
      ['crypto', host.crypto],
      ['tools', host.tools],
      ['clock', host.clock],
    ] as const) {
      this.#primordial.set(role, await primordial(this.#registry, role, entry, this.#primordial, this.handler));
    }
    this.#memory = this.#primordial.get('memory') as unknown as Memory;
    this.#crypto = this.#primordial.get('crypto') as unknown as Crypto;
    this.#tools = this.#primordial.get('tools') as unknown as Tools;
    this.#keys = new SeedKeys(await (this.#primordial.get('unlock') as unknown as Unlock).key(), this.#crypto);
    this.#primordial.set('ground', await primordial(this.#registry, 'ground', { make: GROUND }, this.#primordial, this.handler));
    await this.#openDock();
    const booted = await this.#counted(this.#dock!, this.#dock!.opened.ask({ method: 'boot' }));
    if ('error' in booted) throw new Error(`the dock did not boot: ${booted.error.message}`);
    await this.#grantDock();
    if (host.hand !== undefined) this.#primordial.set('hand', await primordial(this.#registry, 'hand', host.hand, this.#primordial, this.handler));
  }

  // ---- the dock ----

  // The dock opened on the primordial bodies alone: its seed derived from the ground's key, its places in a view of the ground's memory, and the ladder's carry and clock as they come to stand.
  async #openDock(granted: readonly Offer[] = [], classes: Classes = dockClasses()): Promise<void> {
    const memory = new ViewMemory(this.#memory, await this.#prefix(DOCK, DOCK));
    // A memory that holds places and no dock this key opens holds another ground's, which this key does not open.
    if ((await memory.list()).length === 0 && (await this.#memory.list()).length > 0) throw new Error('this memory holds no dock this key opens');
    const clock = new HouseClock(this.#clock(), DOCK);
    const carry = new HouseCarry(new LadderCarry(() => this.#carry()));
    const work = this.#primordial.get('ground')!;
    const offers: Offer[] = [{ blueprint: GroundNeed, object: work, kinds: [KINDS.steward, KINDS.faculty, KINDS.house] }, ...granted];
    const opened = await openHouse(
      {
        keys: new SeedKeys(this.#tools.hex(await this.#keys.derive('dock', 32)), this.#crypto),
        memory,
        classes,
        carry,
        clock,
        crypto: this.#crypto,
        tools: this.#tools,
      },
      offers,
    );
    this.#dock = { opened, clock, carry, flight: new Set() };
  }

  /**
   * The dock opened again once the ladder stands, on each body its steward
   * stands on, offered as any body is offered to a house: the terrain's
   * shell, where it stands. Where the owner names her dock classes, it
   * opens on the library's joined to hers, and is offered each body whose
   * entry's kinds name a kind of hers, for those kinds alone. Where hers do
   * not load or do not open, it opens on the library's, and the steward's
   * cells say why. The being that holds the shell's offer is borne then.
   */
  async #grantDock(): Promise<void> {
    const dock = this.#dock!;
    const read = await this.#counted(dock, dock.opened.ask({ method: 'grants' }));
    const names = 'result' in read ? (read.result as string[]) : [];
    const granted = this.#offers({ classes: { faculty: '' }, faculties: names.filter((name) => this.#stood.get(name)?.body !== undefined) });
    const shell = typeof granted === 'string' ? [] : granted;
    const shown = await this.#counted(dock, dock.opened.ask({ method: 'classesShow' }));
    const named = 'result' in shown ? (shown.result as { classes?: BodyNamed }).classes : undefined;
    if (shell.length === 0 && named === undefined && !this.#extended) return;
    const owner = named === undefined ? undefined : await this.#ownerDock(named);
    await this.#counted(dock, dock.opened.ask({ method: 'housesList' }));
    await this.#closeDock();
    let why = typeof owner === 'string' ? owner : undefined;
    this.#extended = false;
    if (owner !== undefined && typeof owner !== 'string') {
      try {
        await this.#openDock([...shell, ...owner.offers], owner.classes);
        this.#extended = true;
      } catch (error) {
        why = `the ${DOCK} did not open on the owner’s classes: ${message(error)}`;
      }
    }
    if (!this.#extended) await this.#openDock(shell);
    // The dock opened again hooks its door to the carries the ladder stands, as the first did.
    await this.#hookDock();
    if (shell.length > 0) {
      const born = await this.#counted(this.#dock!, this.#dock!.opened.ask({ method: 'granted' }));
      if ('error' in born) throw new Error(`the dock did not take its grants: ${born.error.message}`);
    }
    if (named !== undefined) await this.#counted(this.#dock!, this.#dock!.opened.ask({ method: 'classesLoaded', args: why === undefined ? {} : { why } }));
  }

  /**
   * The owner's dock classes, loaded from the body her steward names, with
   * the offers her kinds are granted: each body of the ladder whose entry's
   * kinds name one of hers, offered to those kinds alone. Or why they are
   * refused, which leaves the dock on the library's.
   */
  async #ownerDock(named: BodyNamed): Promise<{ classes: Classes; offers: Offer[] } | string> {
    try {
      const served = await this.#served<Classes | ClassesSource>(named, 'classes', DOCK);
      const found = isSource(served) ? await ClassList.found(served) : served instanceof ClassList ? served.list() : undefined;
      if (found === undefined) return `the faculty ${named.faculty} serves classes the ${DOCK} cannot list`;
      const owner = found;
      const classes = dockClasses(owner);
      // Her kinds, and the steward's where the steward is hers, so a need she adds is met.
      const kinds = ownerKinds(owner);
      const offers: Offer[] = [];
      for (const [name, stood] of this.#stood) {
        const given = (stood.entry.kinds ?? []).filter((kind) => kinds.has(kind));
        if (given.length === 0 || servesOf(blueprintHeld(stood)) !== 'offer') continue;
        const offer = this.#offers({ classes: { faculty: '' }, faculties: [name] });
        if (typeof offer === 'string') continue;
        offers.push(...offer.map((one) => ({ ...one, kinds: given })));
      }
      return { classes, offers };
    } catch (error) {
      return `the owner’s ${DOCK} classes are refused: ${message(error)}`;
    }
  }

  // The dock's door hooked to the carries standing now, and unhooked from those it held.
  async #hookDock(): Promise<void> {
    const dock = this.#dock;
    if (dock === undefined) return;
    dock.hooked?.unlisten({ ward: dock.opened.ward });
    dock.hooked = undefined;
    const carry = this.#carry();
    if (typeof carry === 'string') return;
    await carry.listen({ ward: dock.opened.ward, door: (box) => this.#dockDoor(box) });
    dock.hooked = carry;
  }

  #dockDoor(box: Uint8Array): Promise<Uint8Array | null> {
    const dock = this.#dock;
    return dock === undefined ? Promise.resolve(null) : this.#counted(dock, dock.opened.door(box));
  }

  async #closeDock(): Promise<void> {
    const dock = this.#dock;
    if (dock === undefined) return;
    this.#dock = undefined;
    dock.hooked?.unlisten({ ward: dock.opened.ward });
    dock.carry.close();
    dock.clock.close();
    await Promise.allSettled([...dock.flight]);
  }

  // A prefix of the ground's memory for one house, one faculty or the dock: a digest of its name, which says nothing of it.
  async #prefix(of: 'house' | 'faculty' | typeof DOCK, name: string): Promise<string> {
    const names = await this.#keys.derive('view-names', 32);
    const digest = await this.#crypto.sha256(new Uint8Array([...names, ...this.#tools.utf8(`${of}\n${name}`)]));
    return `${this.#tools.hex(digest.subarray(0, 8))}/`;
  }

  // A secret's value, read from its being's cells as the dock's own code, or nothing where none is kept.
  async #secret(name: string): Promise<string | undefined> {
    const dock = this.#dock;
    if (dock === undefined) return undefined;
    const read = await dock.opened.ask({ id: IDS.secret + name, cells: true });
    return 'result' in read && typeof (read.result as { value?: unknown }).value === 'string' ? (read.result as { value: string }).value : undefined;
  }

  // The bound every house opens on where the steward names none: the one in her cells, or the terrain's.
  async #bound(): Promise<number | undefined> {
    const read = this.#dock === undefined ? null : await this.#dock.opened.ask({ cells: true });
    const wait = read !== null && 'result' in read ? (read.result as { wait?: unknown }).wait : undefined;
    return typeof wait === 'number' ? wait : this.#options.wait;
  }

  // ---- the ground's work, as its faculty offers it to the dock ----

  #work(): object {
    const answered =
      <A>(run: (args: A) => unknown) =>
      async (args: A): Promise<Answer> => {
        try {
          return { result: ((await run(args)) ?? null) as Json };
        } catch (error) {
          return { error: { message: message(error) } };
        }
      };
    return {
      terrain: answered(() => ({
        entries: (this.#options.entries ?? {}) as unknown as Json,
        primordial: {
          ...Object.fromEntries(Object.entries(this.#options.primordial).map(([role, entry]) => [role, (entry as FacultyEntry).make ?? ''])),
          [GROUND]: GROUND,
        },
        lazy: this.#options.lazy === true,
        ...(this.#options.wait === undefined ? {} : { wait: this.#options.wait }),
      })),
      check: answered(async ({ entry }: { entry: FacultyEntry }) => {
        const faculty = await this.#found(entry);
        const why = typeof faculty === 'string' ? undefined : this.#untaken(faculty, entry);
        return why === undefined ? {} : { why };
      }),
      raise: answered(({ name, entry, installed, version, met }: { name: string; entry: FacultyEntry; installed?: string; version?: string; met?: Record<string, Met> }) => this.#raise(name, entry, installed, version, met)),
      lower: answered(({ name, why }: { name: string; why?: string }) => this.#lower(name, why)),
      uninstall: answered(({ name, entry }: { name: string; entry: FacultyEntry }) => this.#uninstall(name, entry)),
      health: answered(({ name }: { name: string }) => this.#health(name)),
      open: answered(({ name, entry, seed, bound }: { name: string; entry: Entry; seed: string; bound?: number }) => this.#openHouse(name, entry, seed, bound)),
      close: answered(({ name, why }: { name: string; why?: string }) => this.#closeHouse(name, why)),
      sleep: answered(({ name, entry, ward }: { name: string; entry: Entry; ward: string }) => this.#sleep(name, entry, ward)),
      catalog: answered(() => this.#catalog()),
      call: answered((call: { faculty: string; method: string; args?: Json }) => this.#callFaculty(call)),
      placesOut: answered(({ name, entry }: { name: string; entry: Entry }) => this.#placesOut(name, entry)),
      placesIn: answered(({ name, entry, places }: { name: string; entry: Entry; places: Record<string, Record<string, string>> }) => this.#placesIn(name, entry, places)),
      invite: answered(({ name, occupant, notes }: { name: string; occupant: string; notes: Record<string, Json> }) => this.#invite(name, occupant, notes)),
      /** The hand, as a primordial faculty serves it to the owner. It is no method of the blueprint, so no being reaches it. */
      hand: (request: HandAsk) => this.hand(request),
    };
  }

  // ---- the ladder ----

  // A body standing under a name, or why there is none.
  #standing(name: string): Faculty | string {
    const stood = this.#stood.get(name);
    if (stood === undefined) return `no faculty ${name} stands here`;
    return stood.body ?? `the faculty ${name} is down: ${stood.why}`;
  }

  // Why an entry's args fail the schema its faculty takes. A secret is never required, so it fails nothing here.
  #untaken(faculty: FacultyClass, entry: FacultyEntry): string | undefined {
    const args = faculty.takes?.args;
    if (args === undefined) return undefined;
    const why = this.#tools.check(args, entry.args ?? {});
    return why === null ? undefined : why.replace(/^the value/, 'its args');
  }

  /**
   * The secrets a body receives: each its entry names that is kept. A read
   * of one its faculty takes or its entry names, while it is absent, throws
   * `Waiting`, which names the secret and what it holds, so the author
   * writes nothing for it.
   */
  async #secrets(faculty: FacultyClass, entry: FacultyEntry): Promise<Readonly<Record<string, string>>> {
    const named = entry.secrets ?? [];
    const kept: Record<string, string> = {};
    for (const secret of named) {
      const value = await this.#secret(secret);
      if (value !== undefined) kept[secret] = value;
    }
    const taken = faculty.takes?.secrets ?? {};
    return new Proxy(kept, {
      get: (held, key) => {
        if (typeof key !== 'string' || Object.hasOwn(held, key)) return Reflect.get(held, key);
        if (!Object.hasOwn(taken, key) && !named.includes(key)) return undefined;
        const holds = Object.hasOwn(taken, key) ? `: ${taken[key]}` : '';
        throw new Waiting(named.includes(key) ? `it waits for the secret ${key}, which is not kept${holds}` : `it waits for the secret ${key}, which its entry does not name${holds}`);
      },
    });
  }

  // The one faculty an address's face shows, imported from the terrain's install, or why there is none.
  async #imaged(address: string): Promise<FacultyClass | string> {
    const held = this.#images.get(address);
    if (held !== undefined) return held;
    const image = this.#options.image;
    if (image === undefined) return `the terrain imports no faculty by its address ${address}`;
    let face: unknown;
    try {
      face = await image(address);
    } catch (error) {
      return `the address ${address} did not import: ${message(error)}`;
    }
    const shown = [...new Set(Object.values(face as object))].filter(isFaculty);
    if (shown.length !== 1) return `the face of ${address} shows ${shown.length} faculties, not one`;
    this.#images.set(address, shown[0]);
    return shown[0];
  }

  // The faculty an entry makes, from the image by its address, or from the registry its `from` names, or why there is none.
  async #found(entry: FacultyEntry): Promise<FacultyClass | string> {
    if (entry.from === undefined && entry.make !== undefined && ADDRESS.test(entry.make)) return this.#imaged(entry.make);
    let registry = this.#registry;
    if (entry.from !== undefined) {
      const below = this.#standing(entry.from);
      if (typeof below === 'string') return `its registry: ${below}`;
      if (below.registry === undefined) return `the faculty ${entry.from} carries no registry`;
      registry = below.registry;
    }
    const faculty = entry.make === undefined ? undefined : registry.faculties?.[entry.make];
    return faculty ?? `no faculty ${entry.make} in ${entry.from ?? 'the ground’s registry'}`;
  }

  // The faculty that stands for an entry: its fake on a ground that stands fakes, or why one that needs its terrain stands nowhere there.
  #standsFor(found: FacultyClass): FacultyClass | string {
    if (this.#options.fakes !== true) return found;
    if (found.fake !== undefined) return found.fake;
    return Object.keys(found.needs ?? {}).length > 0 ? 'it needs its terrain, and has no fake to stand in its place' : found;
  }

  // The faculty's sealed memory: a view of the ground's, under a key derived for its name alone.
  async #facultyMemory(name: string): Promise<Memory> {
    return new SealedMemory(new ViewMemory(this.#memory, await this.#prefix('faculty', name)), await this.#keys.derive(`faculty:${name}`, 32), this.#crypto, this.#tools);
  }

  // The faculty's own keys: bytes derived from the ground's key under its name and its label. A name holds no colon, so no two entries meet.
  #facultyDerive(name: string): Made['derive'] {
    return (label, length) => {
      if (typeof label !== 'string' || label === '') return Promise.reject(new TypeError('a faculty derives under a label'));
      if (!Number.isInteger(length) || length < 32) return Promise.reject(new TypeError('a faculty derives thirty-two bytes at least'));
      return this.#keys.derive(`faculty-key:${name}:${label}`, length);
    };
  }

  // Each installer an entry names, standing and serving `installer`, in its order, or why one is not.
  #installers(entry: FacultyEntry): (readonly [string, Installer])[] | string {
    const installers: (readonly [string, Installer])[] = [];
    for (const name of entry.installers ?? []) {
      const body = this.#standing(name);
      if (typeof body === 'string') return body;
      if (servesOf(blueprintHeld(this.#stood.get(name))) !== 'installer') return `the faculty ${name} serves no installer`;
      installers.push([name, body as unknown as Installer]);
    }
    return installers;
  }

  // Each need of a faculty handed to the first installer named that meets its kind: which met each and what it answered, or why one was not met.
  async #meet(name: string, faculty: FacultyClass, installers: readonly (readonly [string, Installer])[]): Promise<{ readonly met: Record<string, Met> } | { readonly why: string }> {
    const met: Record<string, Met> = {};
    for (const [kind, spec] of Object.entries(faculty.needs ?? {})) {
      const by = installers.find(([, installer]) => installer.meets.includes(kind));
      if (by === undefined) return { why: `no installer its entry names meets its need ${kind}` };
      let answer: Json | void;
      try {
        answer = await by[1].meet({ kind, spec, name });
      } catch (error) {
        return { why: `its need ${kind} was not met by ${by[0]}: ${message(error)}` };
      }
      met[kind] = { by: by[0], met: answer ?? null };
    }
    return { met };
  }

  /**
   * One body raised on its entry, where one stands under the name taken
   * down first. Where the entry moved, its needs are met and it installs.
   * Where it did not, the body is handed what its twin kept of each
   * meeting, and nothing is met again. Where its version moved from the
   * one its twin kept, it migrates. Then it goes up, or stays down and
   * says why.
   */
  async #raise(name: string, entry: FacultyEntry, installed: string | undefined, kept: string | undefined, keptMet: Readonly<Record<string, Met>> | undefined): Promise<{ installed?: string; why?: string; serves?: string; port?: number; version?: string; met?: Record<string, Met> }> {
    await this.#lower(name);
    const now = this.#tools.canonical(entry);
    let done = installed;
    let version = kept;
    let met: Record<string, Met> | undefined;
    const stood = await (async (): Promise<Stood> => {
      const found = await this.#found(entry);
      if (typeof found === 'string') return { entry, why: found };
      // Its class is known from here, so a house is offered its blueprint while it is down.
      const down = (why: string): Stood => ({ entry, Class: found, why });
      const refused = this.#untaken(found, entry);
      if (refused !== undefined) return down(refused);
      const Class = this.#standsFor(found);
      if (typeof Class === 'string') return down(Class);
      const shape = this.#shapeless(name, Class.blueprint);
      if (shape !== undefined) return down(shape);
      const installers = this.#installers(entry);
      if (typeof installers === 'string') return down(installers);
      const moved = installed !== now;
      if (moved) {
        const meeting = await this.#meet(name, Class, installers);
        if ('why' in meeting) return down(meeting.why);
        if (Object.keys(Class.needs ?? {}).length > 0) met = meeting.met;
      }
      const handed = Object.fromEntries(Object.entries((moved ? met : keptMet) ?? {}).map(([kind, one]) => [kind, one.met]));
      let body: Faculty;
      try {
        body = new Class(await this.#made(name, entry, await this.#secrets(Class, entry), handed));
      } catch (error) {
        return down(`it was not made: ${message(error)}`);
      }
      if (moved) {
        const why = await statusOf(() => body.install(), 'it did not install');
        if (why !== undefined) return down(why);
        done = now;
      }
      if (Class.version !== undefined) {
        if (kept !== undefined && kept !== Class.version) {
          const why = await statusOf(() => body.migrate(kept), `it did not migrate from ${kept}`);
          if (why !== undefined) return down(why);
        }
        version = Class.version;
      }
      const why = (await statusOf(() => body.up(), 'it did not stand')) ?? this.#refused(name, Class, body);
      if (why !== undefined) {
        // A body raised and then refused lets go of what its `up` opened.
        await letGo(body);
        return down(why);
      }
      return { entry, Class: found, body };
    })();
    this.#stood.set(name, stood);
    await this.#hookDock();
    const serves = stood.body === undefined ? undefined : servesOf(blueprintHeld(stood));
    return {
      ...(done === undefined ? {} : { installed: done }),
      ...(stood.why === undefined ? {} : { why: stood.why }),
      ...(serves === undefined || serves === 'offer' ? {} : { serves }),
      ...(stood.body?.port === undefined ? {} : { port: stood.body.port }),
      ...(version === undefined ? {} : { version }),
      ...(met === undefined ? {} : { met }),
    };
  }

  // What install made let go of, once the body is down and its entry removed: an error names why, and the removal stands.
  async #uninstall(name: string, entry: FacultyEntry): Promise<{ why?: string }> {
    const found = await this.#found(entry);
    const Class = typeof found === 'string' ? found : this.#standsFor(found);
    if (typeof Class === 'string') return {};
    const secrets: Record<string, string> = {};
    for (const secret of entry.secrets ?? []) {
      const value = await this.#secret(secret);
      if (value !== undefined) secrets[secret] = value;
    }
    let body: Faculty;
    try {
      body = new Class(await this.#made(name, entry, secrets, {}));
    } catch (error) {
      return { why: `it did not uninstall: ${message(error)}` };
    }
    const why = await statusOf(() => body.uninstall(), 'it did not uninstall');
    return why === undefined ? {} : { why };
  }

  // A body's health, asked now: down is not ok, and a body that answers no health serves while it stands.
  async #health(name: string): Promise<Status> {
    const body = this.#standing(name);
    if (typeof body === 'string') return { ok: false, why: body };
    const why = await statusOf(() => body.health(), 'its health');
    return why === undefined ? { ok: true } : { ok: false, why };
  }

  // A body taken down: it stands down with why where one is given, and is gone where none is. Its class stays known while it is down.
  async #lower(name: string, why?: string): Promise<void> {
    const stood = this.#stood.get(name);
    if (why === undefined) this.#stood.delete(name);
    else if (stood !== undefined) this.#stood.set(name, { entry: stood.entry, ...(stood.Class === undefined ? {} : { Class: stood.Class }), why });
    await letGo(stood?.body);
    if (stood?.body !== undefined && servesOf(blueprintHeld(stood)) === 'carry') await this.#hookDock();
  }

  // What the ground hands a faculty it makes: its args, its secrets, its sealed memory, its keys, its calls, and the listener.
  async #made(name: string, entry: FacultyEntry, secrets: Readonly<Record<string, string>>, met: Readonly<Record<string, Json>>): Promise<Made> {
    const named = entry.faculties ?? [];
    return {
      name,
      args: entry.args ?? {},
      secrets,
      memory: await this.#facultyMemory(name),
      derive: this.#facultyDerive(name),
      met: Object.freeze({ ...met }),
      faculties: named,
      call: ({ faculty, method, args = {}, id }) => (named.includes(faculty) ? this.#invoke(faculty, method, args, id, 'a faculty holds no token of a house') : Promise.resolve(failed(`its entry names no faculty ${faculty}`))),
      listener: this.handler,
    };
  }

  // What a blueprint may not be: a primordial contract, or an offer held to no subset. None where its body names its own at `up`.
  #shapeless(name: string, blueprint: unknown): string | undefined {
    const serves = servesOf(blueprint);
    if (serves === undefined) return undefined;
    if (PRIMORDIAL.has(serves)) return `the ${serves} is primordial, and the dock’s entries name none`;
    if (serves !== 'offer') return undefined;
    try {
      offered(blueprint, `the faculty ${name}`);
      const hook = Object.keys(settled(blueprint).methods).find((method) => HOOKS.has(method));
      return hook === undefined ? undefined : `the faculty ${name} offers a method ${hook}, which is a hook of every faculty`;
    } catch (error) {
      return message(error);
    }
  }

  // What a body up may not be: no blueprint, an offer missing a method its blueprint names, or a contract filled wrong.
  #refused(name: string, Class: FacultyClass, body: Faculty): string | undefined {
    const blueprint = blueprintHeld({ Class, body });
    const serves = servesOf(blueprint);
    if (serves === undefined) return 'a faculty offers a blueprint: a need of its own, or a contract of the foundation';
    const shape = body.blueprint === undefined ? undefined : this.#shapeless(name, body.blueprint);
    if (shape !== undefined) return shape;
    const own = body as unknown as Record<string, unknown>;
    if (serves === 'offer') {
      const missing = Object.keys(settled(blueprint).methods).find((method) => typeof own[method] !== 'function');
      return missing === undefined ? undefined : `the faculty ${name} has no method ${missing}`;
    }
    if ((serves === 'memory' || serves === 'classes') && typeof body.house !== 'function') return `a body serving ${serves} serves each house through house()`;
    if (serves === 'carry' && (body.schemes === undefined || body.schemes.length === 0)) return 'a carry names the schemes it speaks';
    if (serves === 'installer') {
      const installer = body as unknown as Partial<Installer>;
      if (!Array.isArray(installer.meets) || !installer.meets.every((kind) => typeof kind === 'string') || typeof installer.meet !== 'function') return 'an installer names the need kinds it meets, and meet()';
    }
    return undefined;
  }

  /**
   * A method of a body offering beings a blueprint, called and answered,
   * never thrown: its args held to the method's schema, a call id of the
   * caller's or a new one, and an answer held to its shape. A body down,
   * a method it lacks and a throw each answer an error.
   */
  async #invoke(name: string, method: string, args: Json, id: string | undefined, tokenless: string): Promise<Answer> {
    const body = this.#standing(name);
    if (typeof body === 'string') return failed(body);
    const blueprint = blueprintHeld(this.#stood.get(name));
    if (servesOf(blueprint) !== 'offer') return failed(`${name} offers no methods`);
    const spec = settled(blueprint).methods[method];
    const run = (body as unknown as Record<string, unknown>)[method];
    if (spec === undefined || typeof run !== 'function') return failed(`${name} has no method ${method}`);
    const why = this.#tools.check(spec.args, args);
    if (why !== null) return failed(why);
    const context: FacultyContext = {
      id: id ?? this.#tools.hex(this.#crypto.random(16)),
      call: () => Promise.resolve(failed(tokenless)),
      describe: () => Promise.resolve({ error: { message: tokenless } }),
    };
    try {
      const answered = await (run as (args: Json, context: FacultyContext) => Promise<unknown>).call(body, args, context);
      return isAnswer(answered) ? answered : failed(`${name} answered no answer`);
    } catch (error) {
      return failed(`${name} failed: ${message(error)}`);
    }
  }

  /**
   * What a house holds of a body offering beings: the blueprint's methods,
   * each reaching the body standing under the name as it is called. A body
   * down answers an error naming why, so the house opens beside it.
   */
  #seat(name: string, blueprint: unknown): object {
    const methods = Object.keys(settled(blueprint).methods);
    return Object.fromEntries(
      methods.map((method) => [
        method,
        (args: Json, context: FacultyContext): Promise<unknown> => {
          const stood = this.#stood.get(name);
          const body = stood?.body as unknown as Record<string, (args: Json, context: FacultyContext) => Promise<unknown>> | undefined;
          if (body === undefined) return Promise.resolve(failed(`the faculty ${name} is down: ${stood?.why ?? 'it stands nowhere'}`));
          return body[method](args, context);
        },
      ]),
    );
  }

  // ---- houses ----

  // The ground's carries joined by scheme, or why there is none.
  #carry(): (Hooked & Carry) | string {
    const bySchemes: Record<string, Carry> = {};
    for (const stood of this.#stood.values()) {
      if (stood.body === undefined || servesOf(blueprintHeld(stood)) !== 'carry') continue;
      for (const scheme of stood.body.schemes ?? []) bySchemes[scheme] = stood.body as unknown as Carry;
    }
    if (Object.keys(bySchemes).length === 0) return 'no body serves the carry';
    return new JoinedCarry(bySchemes);
  }

  // The ground's one clock, a primordial body.
  #clock(): Clock {
    return this.#primordial.get('clock') as unknown as Clock;
  }

  /**
   * What a house is offered: the faculties its entry names, each with the
   * kinds its own entry grants. A body down is offered all the same, by
   * its class's blueprint, and answers errors until it stands. One whose
   * class no registry gave is offered nothing.
   */
  #offers(entry: Entry, house?: string): Offer[] | string {
    const offers: Offer[] = [];
    for (const name of entry.faculties ?? []) {
      if (name === GROUND && house !== undefined) {
        offers.push({ blueprint: GroundHouses, object: this.#granted(house) });
        continue;
      }
      const stood = this.#stood.get(name);
      if (stood === undefined) return `no faculty ${name} stands here`;
      const blueprint = blueprintHeld(stood);
      if (blueprint === undefined) continue;
      if (servesOf(blueprint) !== 'offer') return `the faculty ${name} offers beings nothing`;
      const { kinds } = stood.entry;
      const window = stood.body?.window ?? stood.Class?.window;
      offers.push({
        blueprint,
        object: this.#seat(name, blueprint),
        ...(window === undefined ? {} : { window }),
        ...(kinds === undefined ? {} : { kinds }),
        opened: (context) => this.#stood.get(name)?.body?.opened?.(context),
      });
    }
    return offers;
  }

  /**
   * What a house whose entry grants `ground` holds of it: the dock
   * steward's houses asks, each asked through the hand under a call id of
   * that house's own. It reaches every house of this ground but herself,
   * and the house that invites is named by the ground, never by her.
   */
  #granted(house: string): object {
    const ask = async (method: string, args: Json, context: FacultyContext): Promise<Answer> => {
      const named = (args as { name?: unknown }).name;
      if (named === house) return failed(`the house ${house} asks nothing of herself through the ${GROUND}`);
      const dock = this.#dock;
      if (dock === undefined) return failed('the ground is closed');
      const answered = await this.#counted(dock, dock.opened.ask({ method, args, call: `${house}:${context.id}` }));
      return 'describe' in answered ? failed(`the ${DOCK} answered no ${method}`) : answered;
    };
    return Object.fromEntries(
      Object.keys(settled(GroundHouses).methods).map((method) => [
        method,
        (args: Json, context: FacultyContext) => ask(method, method === 'housesInvite' ? { ...(args as Record<string, Json>), by: house } : args, context),
      ]),
    );
  }

  // A new occupant of an open house's steward, and her invitation: a house asleep opens first.
  async #invite(name: string, occupant: string, notes: Record<string, Json>): Promise<{ invitation: string }> {
    const held = await this.#woken(name);
    if (held?.opened === undefined) throw new Error(`no house ${name} is open here`);
    const answered = await this.#counted(held, held.opened.ask({ invite: { occupant, notes } }));
    if ('error' in answered) throw new Error(answered.error.message);
    return { invitation: (answered as { result: string }).result };
  }

  // What a foundation body serves one house, or why it serves it nothing.
  async #served<T>(named: BodyNamed, serves: 'memory' | 'classes', house: string): Promise<T> {
    const stood = this.#standing(named.faculty);
    if (typeof stood === 'string') throw new Error(stood);
    if (servesOf(blueprintHeld(this.#stood.get(named.faculty))) !== serves || stood.house === undefined) throw new Error(`the faculty ${named.faculty} serves no ${serves}`);
    return (await stood.house({ house, args: argsOf(named) })) as T;
  }

  // The memory a house keeps its places in: what the body its entry names serves it, or its view of the ground's.
  async #houseMemory(name: string, entry: Entry): Promise<Memory> {
    if (entry.memory === undefined) return new ViewMemory(this.#memory, await this.#prefix('house', name));
    return this.#served<Memory>(entry.memory, 'memory', name);
  }

  // One house opened on the bodies its entry names, or closed and why.
  async #open(name: string, entry: Entry, seed: string, bound: number | undefined): Promise<Held> {
    try {
      const offers = this.#offers(entry, name);
      if (typeof offers === 'string') return { entry, why: offers };
      const hooked = this.#carry();
      if (typeof hooked === 'string') return { entry, why: hooked };
      const ticking = this.#clock();
      const memory = await this.#houseMemory(name, entry);
      const classes = await this.#served<Classes | ClassesSource>(entry.classes, 'classes', name);
      const clock = new HouseClock(ticking, name);
      const carry = new HouseCarry(hooked);
      const wait = entry.wait === undefined ? bound : bound === undefined ? entry.wait : Math.min(entry.wait, bound);
      const foundation = { keys: new SeedKeys(seed, this.#crypto), memory, carry, clock, crypto: this.#crypto, tools: this.#tools };
      const options = wait === undefined ? {} : { wait };
      const runner = this.#options.runner;
      // A ground that contains its houses opens each in a runner, which loads its classes from their modules there.
      if (runner !== undefined && !isSource(classes)) throw new Error(`the faculty ${entry.classes.faculty} serves classes no runner loads: a contained house loads hers from modules`);
      const opened =
        runner !== undefined
          ? await contain(runner, foundation, classes as ClassesSource, offers, options)
          : await openHouse({ ...foundation, classes: isSource(classes) ? await ClassList.load(classes) : classes }, offers, options);
      await hooked.listen({ ward: opened.ward, door: (box) => this.#door(name, box) });
      return { entry, opened, clock, carry, hooked, flight: new Set(), ...(bound === undefined ? {} : { bound }) };
    } catch (error) {
      return { entry, why: message(error) };
    }
  }

  // A house opened on its entry where it is not open on it and its bound: what it held closed first.
  async #openHouse(name: string, entry: Entry, seed: string, given: number | undefined): Promise<{ ward?: string; why?: string }> {
    const bound = given ?? (await this.#bound());
    const held = this.#houses.get(name);
    if (held?.opened !== undefined && this.#tools.canonical(held.entry) === this.#tools.canonical(entry) && held.bound === bound) return { ward: held.opened.ward };
    if (held !== undefined) {
      this.#houses.set(name, { entry: held.entry, why: 'it is opening again' });
      await this.#close(held);
    }
    const opened = await this.#open(name, entry, seed, bound);
    this.#houses.set(name, opened);
    return opened.opened === undefined ? { why: opened.why ?? 'it did not open' } : { ward: opened.opened.ward };
  }

  // A house closed through its views: it stands closed with why where one is given, and is gone where none is.
  async #closeHouse(name: string, why: string | undefined): Promise<void> {
    const held = this.#houses.get(name);
    if (held === undefined) return;
    if (why === undefined) this.#houses.delete(name);
    else this.#houses.set(name, { entry: held.entry, why });
    await this.#close(held);
  }

  // A house held closed until something reaches it, its door hooked unopened: the first box opens it, then goes in.
  async #sleep(name: string, entry: Entry, ward: string): Promise<void> {
    const carry = this.#carry();
    if (typeof carry === 'string') {
      this.#houses.set(name, { entry, why: carry });
      return;
    }
    this.#houses.set(name, { entry, asleep: ward, hooked: carry });
    await carry.listen({ ward, door: (box) => this.#door(name, box) });
  }

  // A house that stands closed until something reaches it, opened once through its being in the dock.
  async #woken(name: string): Promise<Held | undefined> {
    const held = this.#houses.get(name);
    if (held?.asleep === undefined || this.#dock === undefined) return held;
    let waking = this.#waking.get(name);
    if (waking === undefined) {
      waking = this.#counted(this.#dock, this.#dock.opened.ask({ id: IDS.house + name, method: 'open', args: {} }));
      this.#waking.set(name, waking);
      void waking.finally(() => this.#waking.delete(name));
    }
    await waking;
    return this.#houses.get(name);
  }

  /** Every house that stands closed until reached, opened now, as a wake by alarm needs: each arms its own times again. */
  async wake(): Promise<void> {
    await Promise.all([...this.#houses.keys()].map((name) => this.#woken(name)));
    // A clock that keeps its waits in a platform's alarm ends each one due.
    await (this.#clock() as Clock & { alarm?: () => Promise<void> }).alarm?.();
  }

  // A box for a house the ground still holds open, and nothing for one it closed.
  async #door(name: string, box: Uint8Array): Promise<Uint8Array | null> {
    const held = await this.#woken(name);
    return held?.opened === undefined ? null : this.#counted(held, held.opened.door(box));
  }

  // A call on a house, in flight until it ends, so closing the house waits for it.
  #counted<T>(held: { readonly flight?: Set<Promise<unknown>> }, call: Promise<T>): Promise<T> {
    held.flight?.add(call);
    const done = () => void held.flight?.delete(call);
    call.then(done, done);
    return call;
  }

  // Its door unhooked, its sends stopped and its waits run out, then every call in flight on it ended.
  async #close(held: Held): Promise<void> {
    const ward = held.opened?.ward ?? held.asleep;
    if (ward !== undefined) held.hooked?.unlisten({ ward });
    held.carry?.close();
    held.clock?.close();
    await Promise.allSettled([...(held.flight ?? [])]);
    (held.opened as Partial<Contained> | undefined)?.close?.();
  }

  // Every place of a house's memory, each entry's bytes as hex.
  async #placesOut(name: string, entry: Entry): Promise<{ places: Record<string, Record<string, string>> }> {
    const store = await this.#houseMemory(name, entry);
    const places: Record<string, Record<string, string>> = {};
    for (const place of await store.list()) {
      const { entries } = await store.read({ place });
      places[place] = Object.fromEntries(Object.entries(entries).map(([key, bytes]) => [key, this.#tools.hex(bytes)]));
    }
    return { places };
  }

  // Places written into a house's memory that holds none: with none given, only whether it holds none.
  async #placesIn(name: string, entry: Entry, places: Record<string, Record<string, string>>): Promise<void> {
    const store = await this.#houseMemory(name, entry);
    if ((await store.list()).length > 0) throw new Error(`the memory for ${name} holds places already`);
    const writes: Record<string, Record<string, Uint8Array | null>> = {};
    for (const [place, entries] of Object.entries(places)) {
      writes[place] = Object.fromEntries(
        Object.entries(entries).map(([key, text]) => {
          const bytes = this.#tools.bytes(text);
          if (bytes === null) throw new TypeError(`the place ${place} holds no hex under ${key}`);
          return [key, bytes];
        }),
      );
    }
    if (Object.keys(writes).length === 0) return;
    if ((await store.write({ writes, expect: Object.fromEntries(Object.keys(writes).map((place) => [place, null])) })) === null) throw new Error(`the memory for ${name} refused the places`);
  }

  /** Every house of the dock, open with its ward, or closed and why. The dock is none of them. */
  list(): readonly Standing[] {
    return [...this.#houses].map(([name, held]) => ({
      name,
      entry: held.entry,
      ...(held.opened === undefined ? (held.asleep === undefined ? {} : { ward: held.asleep }) : { ward: held.opened.ward }),
      ...(held.why === undefined ? {} : { why: held.why }),
    }));
  }

  // One ask of the dock's steward by the hand, answered, or thrown where it refused.
  async #steward(method: string, args: Json): Promise<Json> {
    const answer = await this.hand({ method, args });
    if ('error' in answer) throw new Error(answer.error.message);
    return 'result' in answer ? answer.result : null;
  }

  #standingOf(name: string): Standing {
    const found = this.list().find((standing) => standing.name === name);
    if (found === undefined) throw new Error(`no house ${name} is here`);
    return found;
  }

  /** A house added through the dock and opened, as the hand adds one. */
  async add(name: string, entry: Entry): Promise<Standing> {
    await this.#steward('housesAdd', { name, ...entry } as unknown as Json);
    return this.#standingOf(name);
  }

  /** A new entry landed over a house's through the dock, and the house opened again on it. */
  async update(name: string, entry: Entry): Promise<Standing> {
    await this.#steward('housesUpdate', { name, ...entry } as unknown as Json);
    return this.#standingOf(name);
  }

  /** A house closed and its entry dropped through the dock. Its seed and its places stay. */
  async remove(name: string): Promise<void> {
    await this.#steward('housesRemove', { name });
  }

  /** A body raised through the dock on its entry, answering why it is down where it is. */
  async stand(name: string, entry: FacultyEntry): Promise<{ readonly why?: string }> {
    return (await this.#steward('facultiesAdd', { name, ...entry })) as { why?: string };
  }

  /** A new entry landed over a faculty's through the dock. */
  async restand(name: string, entry: FacultyEntry): Promise<{ readonly why?: string }> {
    return (await this.#steward('facultiesUpdate', { name, ...entry })) as { why?: string };
  }

  /** A body taken down and up again through the dock. */
  async restart(name: string): Promise<{ readonly why?: string }> {
    return (await this.#steward('facultiesRestart', { name })) as { why?: string };
  }

  /** A body taken down and its entry dropped through the dock, where no house and no body uses it, answering why where its uninstall failed. */
  async unstand(name: string): Promise<{ readonly why?: string }> {
    return (await this.#steward('facultiesRemove', { name })) as { why?: string };
  }

  /** A being in a house asked as `root`, by her id, or the house's steward where none is named. */
  async ask({ house, ...request }: Omit<HandAsk, 'describe' | 'house'> & { readonly house: string }): Promise<Answer | { readonly describe: Json }> {
    if (Object.hasOwn(request, 'invite')) return failed(UNINVITED);
    const held = await this.#woken(house);
    if (held?.opened === undefined) return { error: { message: `no house ${house} is open here` } };
    return this.#counted(held, held.opened.ask(request));
  }

  /**
   * The ground's hand, one request at a time, as every terrain serves it:
   * `describe`, or an ask as `root` of a being in the house it names, or of
   * a being of the dock where it names none. It is the one road into the
   * ground: every change is an ask of the dock. A secret's cells are read
   * by no one through it.
   */
  async hand({ describe, house, ...request }: HandAsk): Promise<Answer | { readonly describe: Json }> {
    if (describe === true) return { result: (await this.describe()) as unknown as Json };
    if (house !== undefined) return this.ask({ house, ...request });
    const dock = this.#dock;
    if (dock === undefined) return { error: { message: 'the ground is closed' } };
    if (request.cells === true && request.id?.startsWith(IDS.secret) === true) return { error: { message: 'a secret’s cells are shown to no one' } };
    if (Object.hasOwn(request, 'invite')) return failed(UNINVITED);
    const answered = await this.#counted(dock, dock.opened.ask(request));
    // The owner's dock classes named or dropped: the dock opens again on them now.
    if (request.method === 'classesSet' && request.id === undefined && 'result' in answered) await this.#grantDock();
    return answered;
  }

  /**
   * What the ground's hand shows its owner: the asks the dock's steward
   * shows `root`, every body of the ladder with its methods, what it serves,
   * or why it is down, each method's description, args, result, flags and hint,
   * and every house. A face reads it and needs no code of its own for any
   * of them.
   */
  async describe(): Promise<Described> {
    const shown = (value: unknown): Json => {
      const blueprint = blueprintOf(value) ?? (value as Blueprint);
      return {
        blueprint: blueprint.name,
        methods: Object.fromEntries(
          Object.entries(blueprint.methods).map(([method, spec]) => [method, JSON.parse(JSON.stringify({ description: spec.description, args: spec.args, result: spec.result, readOnly: spec.readOnly, idempotent: spec.idempotent, hints: spec.hints })) as Json]),
        ),
      };
    };
    const faculties: Record<string, Json> = {};
    for (const [name, stood] of this.#stood) {
      const serves = servesOf(blueprintHeld(stood));
      if (stood.body === undefined) faculties[name] = { why: stood.why ?? 'down' };
      else if (serves !== 'offer') faculties[name] = { serves: serves ?? null, methods: {} };
      else faculties[name] = shown(blueprintHeld(stood));
    }
    const read = this.#dock === undefined ? null : await this.#dock.opened.ask({});
    return { dock: read !== null && 'describe' in read ? read.describe : null, faculties, houses: this.list() };
  }

  // A method of a body of the ladder called by name, its args held to the method's schema. It holds no token of any house, so a call it makes back answers an error.
  async #callFaculty({ faculty: name, method, args = {} }: { faculty: string; method: string; args?: Json }): Promise<Json> {
    const answered = await this.#invoke(name, method, args, undefined, 'the hand holds no token');
    if ('error' in answered) throw new Error(answered.error.message);
    return answered.result;
  }

  /**
   * The one handler the ground's listener chains: the hand's where it
   * serves one, then each standing body's in the ladder's order, read as
   * each request arrives, so a body raised while the ground runs is served
   * at once.
   */
  readonly handler: Handler = {
    fetch: async (request) => {
      for (const handler of this.#handlers()) {
        const response = await handler.fetch(request);
        if (response !== null) return response;
      }
      return null;
    },
    upgrade: (request) => {
      for (const handler of this.#handlers()) {
        const taken = handler.upgrade?.(request);
        if (taken !== null && taken !== undefined) return taken;
      }
      return null;
    },
  };

  // The hand's handler, then each standing body's, which opens every house naming the body before it takes a request, so its tokens answer on a ground woken per event.
  #handlers(): readonly Handler[] {
    const hand = this.#primordial.get('hand')?.handler;
    return [
      ...(hand === undefined ? [] : [hand]),
      ...[...this.#stood].flatMap(([name, stood]) => {
        const handler = stood.body?.handler;
        if (handler === undefined) return [];
        const naming = () => Promise.all([...this.#houses].flatMap(([house, held]) => ((held.entry.faculties ?? []).includes(name) ? [this.#woken(house)] : [])));
        return [
          {
            fetch: async (request: Request) => {
              await naming();
              return handler.fetch(request);
            },
            upgrade: (request: Request) => {
              void naming();
              return handler.upgrade?.(request) ?? null;
            },
          },
        ];
      }),
    ];
  }

  /** The hand down first, then every house closed through its views, the dock, every body in the reverse of the ladder, and the primordial last. */
  async close(): Promise<void> {
    const hand = this.#primordial.get('hand');
    this.#primordial.delete('hand');
    await letGo(hand);
    // Every being of the dock is read once as her steward reads her, so each first ask a change began has run before the dock's clock closes.
    const dock = this.#dock;
    if (dock !== undefined) await this.#counted(dock, dock.opened.ask({ method: 'housesList' }));
    const held = [...this.#houses.values()].reverse();
    this.#houses.clear();
    for (const one of held) await this.#close(one);
    await this.#closeDock();
    const stood = [...this.#stood.values()].reverse();
    this.#stood.clear();
    for (const one of stood) await letGo(one.body);
    const primordials = [...this.#primordial.values()].reverse();
    this.#primordial.clear();
    for (const one of primordials) await letGo(one);
  }

  // ---- the catalogue ----

  // Every registry of the ladder, the ground's first, then each standing body's that carries one, with each faculty it holds and what it takes.
  #catalog(): Json {
    const shown = (registry: Registry): Json =>
      Object.entries(registry.faculties ?? {})
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([make, faculty]) => ({
          make,
          ...(faculty.takes === undefined ? {} : { takes: JSON.parse(JSON.stringify(faculty.takes)) as Json }),
          ...(faculty.needs === undefined ? {} : { needs: faculty.needs }),
          ...(faculty.version === undefined ? {} : { version: faculty.version }),
        }));
    const bodies = [...this.#stood].flatMap(([name, stood]) => (stood.body?.registry === undefined ? [] : [{ from: name, faculties: shown(stood.body.registry) }]));
    // Each faculty imported by its address joins the terrain's rung, under its address.
    return [{ faculties: shown({ faculties: { ...this.#registry.faculties, ...Object.fromEntries(this.#images) } }) }, ...bodies];
  }
}
