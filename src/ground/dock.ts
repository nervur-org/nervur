// SPDX-License-Identifier: Apache-2.0
// The dock: the house every ground stands, whose beings are the ground's
// drawer. Its steward answers the hand. A twin stands for each faculty
// entry, a house being for each house entry, and a secret being for each
// secret. Their cells hold every entry, what each faculty installed, each
// house's seed and ward, every secret and the ground's bound on every
// ask. Every name an entry gives is a standing the steward introduces, her
// notes naming the grant. The dock's beings reach the ground through the
// `ground` faculty, offered to their kinds alone. The dock is offered each
// body its steward stands on, as a house is: the terrain's shell, granted
// to the dock's shell being alone. Her classes are the library's, fixed: no entry names them.
import type { Json, Notes } from '../being/being.ts';
import { Being, need, s, type Args } from '../being/index.ts';
import { WAIT_BOUND } from '../being/need.ts';
import { ClassList } from '../bodies/class-list.ts';

/** The dock's name: no house and no faculty takes it. */
export const DOCK = 'dock';

/** The kinds of the dock's beings, which the ground's offers name. */
export const KINDS = Object.freeze({
  steward: 'org.nervur.dock',
  faculty: 'org.nervur.dock.faculty',
  house: 'org.nervur.dock.house',
  secret: 'org.nervur.dock.secret',
  shell: 'org.nervur.dock.shell',
});

/** The id of the dock's being that holds the shell's offer. */
const SHELL_ID = 'shell';

/** The prefix of each dock being's id, before the name its entry gives. */
export const IDS = Object.freeze({ faculty: 'faculty.', house: 'house.', secret: 'secret.' });

/** Any JSON value: a schema with no keyword. */
const ANY = Object.freeze({});
const OBJECT = { type: 'object', properties: {}, additionalProperties: true } as const;
const NAME = s.object({ name: s.string() });
const WHY = s.object({ why: s.optional(s.string()) });
const STOOD = s.object({ ward: s.optional(s.string()), why: s.optional(s.string()) });

/**
 * The ground's work, as its faculty offers it to the dock: a body raised
 * and lowered, a house opened, closed or held asleep, the terrain's
 * defaults, what an entry's faculty takes, the catalogue, a body's method
 * called, and a house's places moved out and in. Each is awaited.
 */
export const GroundNeed = need('org.nervur.ground', {
  terrain: { result: ANY, hints: { readOnly: true } },
  check: { args: s.object({ name: s.string(), entry: OBJECT }), result: WHY, hints: { readOnly: true } },
  raise: { args: s.object({ name: s.string(), entry: OBJECT, installed: s.optional(s.string()) }), result: ANY, hints: { idempotent: true }, wait: WAIT_BOUND },
  lower: { args: s.object({ name: s.string(), why: s.optional(s.string()) }), hints: { idempotent: true }, wait: WAIT_BOUND },
  open: { args: s.object({ name: s.string(), entry: OBJECT, seed: s.string(), bound: s.optional(s.integer({ minimum: 1 })) }), result: STOOD, hints: { idempotent: true }, wait: WAIT_BOUND },
  close: { args: s.object({ name: s.string(), why: s.optional(s.string()) }), hints: { idempotent: true }, wait: WAIT_BOUND },
  sleep: { args: s.object({ name: s.string(), entry: OBJECT, ward: s.string() }), hints: { idempotent: true } },
  catalog: { result: ANY, hints: { readOnly: true } },
  call: { args: s.object({ faculty: s.string(), method: s.string(), args: s.optional(OBJECT) }), result: ANY, hints: { idempotent: true }, wait: WAIT_BOUND },
  placesOut: { args: s.object({ name: s.string(), entry: OBJECT }), result: ANY, hints: { readOnly: true }, wait: WAIT_BOUND },
  placesIn: { args: s.object({ name: s.string(), entry: OBJECT, places: OBJECT }), hints: { idempotent: true }, wait: WAIT_BOUND },
});

/** A command run on the ground's machine, as its owner runs one: its exit code and what it printed. */
export const ShellNeed = need('org.nervur.shell', {
  run: {
    args: s.object({ command: s.string(), args: s.optional(s.array(s.string())), cwd: s.optional(s.string()), stdin: s.optional(s.string()) }),
    result: s.object({ code: s.integer(), stdout: s.string(), stderr: s.string() }),
    hints: { idempotent: true },
    wait: WAIT_BOUND,
  },
});

/** The ground's one listener, as a body offers it: the handler of every body, chained. It has no method a being calls. */
export const ListenerNeed = need('org.nervur.listener', {});

/** One faculty's entry, whole: who makes it, what it is handed, the bodies it calls, and its grant. */
export interface WholeFaculty {
  readonly make?: string;
  readonly from?: string;
  readonly args?: Readonly<Record<string, Json>>;
  readonly secrets?: readonly string[];
  readonly faculties?: readonly string[];
  readonly kinds?: readonly string[];
}

/** One body a house names, and the args it hands that house. */
interface Named {
  readonly faculty: string;
  readonly [argument: string]: Json | undefined;
}

/** One house's entry, whole. */
export interface WholeHouse {
  readonly classes: Named;
  readonly memory?: Named;
  readonly faculties?: readonly string[];
  readonly wait?: number;
}

/** A dock being as her steward reads her: her id, her kind, her cells and the standings the steward introduced. */
interface Shown {
  readonly id: string;
  readonly kind: string;
  readonly cells: Record<string, Json>;
  readonly standings: readonly { readonly id: string; readonly steward: Notes }[];
}

/** Every being the steward holds, read at the start of her ask. */
interface Held {
  readonly faculties: Map<string, Shown>;
  readonly houses: Map<string, Shown>;
  readonly secrets: Set<string>;
}

const NAMED = 'lowercase letters, digits, dots, dashes and underscores, at most fifty-six';
const NAME_RULE = /^[a-z0-9][a-z0-9._-]{0,55}$/;
const DOCKED = `the ${DOCK} is the library’s, and no entry names it`;
// The dock's own faculties: no owner's entry names, makes or grants either.
const OWN: Readonly<Record<string, string>> = {
  ground: 'the ground is the library’s: no entry names it, makes it or grants it',
  shell: 'the shell is the dock’s alone: no entry names it, makes it or grants it',
};

const isObject = (value: unknown): value is Record<string, Json> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNames = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every((name) => typeof name === 'string');
const sorted = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sorted);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sorted(value[key])]),
  );
};
const canonical = (value: unknown): string => JSON.stringify(sorted(value));
const nameOf = (id: string, prefix: string): string => id.slice(prefix.length);
const byName = <T>([a]: readonly [string, T], [b]: readonly [string, T]): number => (a < b ? -1 : a > b ? 1 : 0);
const hasEntry = (being: Shown | undefined): being is Shown & { readonly cells: { readonly entry: Record<string, Json> } } => being !== undefined && isObject(being.cells.entry);

// An entry's optional fields where they hold something.
const some = <T>(key: string, value: T | undefined): Record<string, T> => (value === undefined || (Array.isArray(value) && value.length === 0) ? {} : { [key]: value });

/** A faculty's entry read from what the hand gave, or why it is no entry. */
export const facultyEntryOf = (value: unknown): WholeFaculty | string => {
  if (!isObject(value)) return 'an entry is an object';
  const { make, from, args, secrets, faculties, kinds, ...rest } = value;
  if (Object.keys(rest).length > 0) return `an entry names ${Object.keys(rest).join(', ')}, which no entry holds`;
  if (kinds !== undefined && !isNames(kinds)) return "an entry's kinds are a list of names";
  if (typeof make !== 'string') return "a faculty's entry names it in make";
  if (from !== undefined && typeof from !== 'string') return "an entry's from is a body's name";
  if (args !== undefined && !isObject(args)) return "an entry's args are an object";
  if (secrets !== undefined && !isNames(secrets)) return "an entry's secrets are a list of names";
  if (faculties !== undefined && !isNames(faculties)) return "an entry's faculties are a list of names";
  return { make, ...some('from', from), ...some('args', args), ...some('secrets', secrets), ...some('faculties', faculties), ...some('kinds', kinds) };
};

const namedOf = (held: unknown, what: string): Named | string => {
  if (!isObject(held) || typeof held.faculty !== 'string') return `an entry's ${what} names no faculty`;
  return held as Named;
};

/** A house's entry read from what the hand gave, or why it is no entry. */
export const houseEntryOf = (value: unknown): WholeHouse | string => {
  if (!isObject(value)) return 'an entry is an object';
  const { memory, classes, faculties, wait, ...rest } = value;
  if (Object.keys(rest).length > 0) return `an entry names ${Object.keys(rest).join(', ')}, which no entry holds`;
  const code = namedOf(classes, 'classes');
  if (typeof code === 'string') return code;
  const kept = memory === undefined ? undefined : namedOf(memory, 'memory');
  if (typeof kept === 'string') return kept;
  if (faculties !== undefined && !isNames(faculties)) return "an entry's faculties are a list of names";
  if (wait !== undefined && !(Number.isSafeInteger(wait) && (wait as number) > 0)) return "an entry's wait is whole milliseconds above zero";
  return { classes: code, ...some('memory', kept), ...some('faculties', faculties), ...some('wait', wait as number | undefined) };
};

// A named body's args for its house: everything but the faculty.
const argsOf = ({ faculty: _faculty, ...args }: Named): Record<string, Json> => args as Record<string, Json>;

/** What a faculty's entry grants, by the being each grant relates it to, with the steward's notes on it. */
const facultyGrants = (entry: WholeFaculty): Map<string, Record<string, Json>> => {
  const grants = new Map<string, Record<string, Json>>();
  const add = (id: string, notes: Record<string, Json>) => grants.set(id, { ...grants.get(id), ...notes });
  if (entry.from !== undefined) add(IDS.faculty + entry.from, { from: true });
  (entry.faculties ?? []).forEach((name, at) => add(IDS.faculty + name, { faculties: at }));
  (entry.secrets ?? []).forEach((name, at) => add(IDS.secret + name, { secrets: at }));
  return grants;
};

/** What a house's entry grants, as a faculty's does. */
const houseGrants = (entry: WholeHouse): Map<string, Record<string, Json>> => {
  const grants = new Map<string, Record<string, Json>>();
  const add = (id: string, notes: Record<string, Json>) => grants.set(id, { ...grants.get(id), ...notes });
  add(IDS.faculty + entry.classes.faculty, { classes: true });
  if (entry.memory !== undefined) add(IDS.faculty + entry.memory.faculty, { memory: true });
  (entry.faculties ?? []).forEach((name, at) => add(IDS.faculty + name, { faculties: at }));
  return grants;
};

// The names a list grant holds, in the order its notes give.
const listed = (standings: Shown['standings'], grant: string, prefix: string): string[] =>
  standings
    .filter(({ id, steward }) => id.startsWith(prefix) && typeof steward[grant] === 'number')
    .sort((a, b) => (a.steward[grant] as number) - (b.steward[grant] as number))
    .map(({ id }) => nameOf(id, prefix));

const single = (standings: Shown['standings'], grant: string): string | undefined => {
  const found = standings.find(({ id, steward }) => id.startsWith(IDS.faculty) && steward[grant] === true);
  return found === undefined ? undefined : nameOf(found.id, IDS.faculty);
};

/** A faculty's entry whole: what its twin's cells hold, and the names her standings give. */
const wholeFaculty = (cells: Readonly<Record<string, Json>>, standings: Shown['standings']): WholeFaculty => {
  const held = cells.entry as { make: string; args?: Record<string, Json>; kinds?: string[] };
  return {
    make: held.make,
    ...some('from', single(standings, 'from')),
    ...some('args', held.args),
    ...some('secrets', listed(standings, 'secrets', IDS.secret)),
    ...some('faculties', listed(standings, 'faculties', IDS.faculty)),
    ...some('kinds', held.kinds),
  };
};

/** A house's entry whole, as a twin's is. */
const wholeHouse = (cells: Readonly<Record<string, Json>>, standings: Shown['standings']): WholeHouse => {
  const held = cells.entry as { classes: Record<string, Json>; memory?: Record<string, Json>; wait?: number };
  const code = single(standings, 'classes') ?? '';
  const kept = single(standings, 'memory');
  return {
    classes: { faculty: code, ...held.classes },
    ...(held.memory === undefined || kept === undefined ? {} : { memory: { faculty: kept, ...held.memory } }),
    ...some('faculties', listed(standings, 'faculties', IDS.faculty)),
    ...some('wait', held.wait),
  };
};

/** What a twin's cells keep of an entry: every value but the names, which are standings. */
const facultyCells = (entry: WholeFaculty): Record<string, Json> => ({ make: entry.make ?? '', ...some('args', entry.args), ...some('kinds', entry.kinds) });

/** What a house being's cells keep of an entry. */
const houseCells = (entry: WholeHouse): Record<string, Json> => ({
  classes: argsOf(entry.classes),
  ...(entry.memory === undefined ? {} : { memory: argsOf(entry.memory) }),
  ...some('wait', entry.wait),
});

/**
 * The ladder's order: each body after the one whose registry it stands on
 * and after each it calls. Each body in a cycle is named with it.
 */
const ladder = (entries: Readonly<Record<string, WholeFaculty>>): { order: string[]; cycles: Map<string, string> } => {
  const below = (entry: WholeFaculty): readonly string[] => [...(entry.from === undefined ? [] : [entry.from]), ...(entry.faculties ?? [])];
  const order: string[] = [];
  const cycles = new Map<string, string>();
  const seen = new Map<string, 'visiting' | 'done'>();
  const visit = (name: string, path: readonly string[]) => {
    if (seen.get(name) === 'done') return;
    if (seen.get(name) === 'visiting') {
      const cycle = [...path.slice(path.indexOf(name)), name];
      for (const one of cycle) cycles.set(one, `a cycle: ${cycle.join(' → ')}`);
      return;
    }
    seen.set(name, 'visiting');
    for (const one of below(entries[name])) if (Object.hasOwn(entries, one)) visit(one, [...path, name]);
    seen.set(name, 'done');
    order.push(name);
  };
  for (const name of Object.keys(entries).sort()) visit(name, []);
  return { order, cycles };
};

/** What the ground's faculty tells of its terrain. */
interface Terrain {
  readonly entries: Readonly<Record<string, WholeFaculty>>;
  /** The names and the makes the host holds for its primordial faculties. */
  readonly primordial: Readonly<Record<string, string>>;
  readonly lazy: boolean;
  readonly wait?: number;
}

const houseArgs = { name: s.string(), classes: OBJECT, memory: s.optional(OBJECT), faculties: s.optional(s.array(s.string())), wait: s.optional(s.integer({ minimum: 1 })) };
const facultyArgs = {
  name: s.string(),
  make: s.optional(s.string()),
  from: s.optional(s.string()),
  args: s.optional(OBJECT),
  secrets: s.optional(s.array(s.string())),
  faculties: s.optional(s.array(s.string())),
  kinds: s.optional(s.array(s.string())),
};
const PLACES = OBJECT;
const WAIT_SHOWN = s.object({ wait: s.optional(s.integer({ minimum: 1 })), terrain: s.boolean() });
// Who changes the houses and the faculties: the hand, and a pilot the owner handed a standing.
const PILOTED = ['root', 'pilot'];
// A change is safe to repeat, and one that may install a faculty or open a house takes the longest any ask may.
const CHANGE = { idempotent: true } as const;
const LIST = { readOnly: true, idempotent: true } as const;
// The asks the steward alone makes of the beings she holds.
const HERS = { for: 'steward', hints: CHANGE, wait: WAIT_BOUND } as const;
const SHOWN = { for: ['steward', 'root'], result: ANY, hints: LIST } as const;

const HOUSES_SHOWN = s.array(s.object({ name: s.string(), entry: OBJECT, ward: s.optional(s.string()), why: s.optional(s.string()) }));
const FACULTIES_SHOWN = s.array(s.object({ name: s.string(), entry: OBJECT, terrain: s.optional(s.boolean()), serves: s.optional(s.string()), why: s.optional(s.string()) }));
const CATALOG = s.array(s.object({ from: s.optional(s.string()), faculties: s.array(s.object({ make: s.string(), takes: s.optional(OBJECT) })) }));

/**
 * A ground's dock as a pilot holds it: the asks its steward answers for a
 * standing the owner minted with `pilotsInvite`. A being far or near
 * pilots a ground by `this.held(id, DockPilot)`.
 */
export const DockPilot = need('org.nervur.dock', {
  housesAdd: { args: s.object(houseArgs), result: STOOD, hints: CHANGE, wait: WAIT_BOUND },
  housesUpdate: { args: s.object(houseArgs), result: STOOD, hints: CHANGE, wait: WAIT_BOUND },
  housesRemove: { args: NAME, hints: CHANGE, wait: WAIT_BOUND },
  housesList: { result: HOUSES_SHOWN, hints: LIST, wait: WAIT_BOUND },
  facultiesAdd: { args: s.object(facultyArgs), result: WHY, hints: CHANGE, wait: WAIT_BOUND },
  facultiesUpdate: { args: s.object(facultyArgs), result: WHY, hints: CHANGE, wait: WAIT_BOUND },
  facultiesRestart: { args: NAME, result: WHY, hints: CHANGE, wait: WAIT_BOUND },
  facultiesRemove: { args: NAME, hints: CHANGE, wait: WAIT_BOUND },
  facultiesList: { result: FACULTIES_SHOWN, hints: LIST, wait: WAIT_BOUND },
  facultiesCatalog: { result: CATALOG, hints: LIST },
});

type Face = Record<string, (args?: unknown) => Promise<unknown>>;
type Powers = {
  list(): Promise<readonly { id: string; kind: string; absent: boolean }[]>;
  /** With no method, what the being shows her steward, once her first ask has run. */
  ask(call: { id: string; method?: string; args?: unknown }): Promise<unknown>;
  bear(options: { kind: string; id: string; args?: Json }): void;
  remove(options: { id: string }): void;
  introduce(options: { from: string; to: string; notes?: Notes }): void;
};
type Stood = { ward?: string; why?: string };
type Raised = { installed?: string; why?: string; serves?: string; port?: number };
const RAISED = s.object({ installed: s.optional(s.string()), why: s.optional(s.string()), serves: s.optional(s.string()), port: s.optional(s.integer()) });

/** The dock's steward: every ask the hand makes of the ground. */
export class DockSteward extends Being.of({
  kind: KINDS.steward,
  description: 'The ground’s own steward: its houses, its faculties, its secrets, its moves and its shell.',
  needs: { ground: GroundNeed },
  cells: { wait: null as number | null },
  roles: { pilot: (asker) => asker.notes.pilot === true },
  asks: {
    boot: {
      for: 'root',
      description: 'Stands the ladder from every entry, the terrain’s and the owner’s, and opens every house: each wake asks it once.',
      hints: CHANGE,
      wait: WAIT_BOUND,
    },
    housesAdd: {
      for: PILOTED,
      description: 'Opens a house on the bodies its entry names, and answers its ward, or why it stands closed; the same name and entry answer as it stands.',
      args: s.object(houseArgs),
      result: STOOD,
      hints: CHANGE,
      wait: WAIT_BOUND,
    },
    housesUpdate: {
      for: PILOTED,
      description: 'Lands a new entry over a house’s in one write, and opens the house again on it.',
      args: s.object(houseArgs),
      result: STOOD,
      hints: CHANGE,
      wait: WAIT_BOUND,
    },
    housesRemove: { for: PILOTED, description: 'Closes a house and drops its entry; its seed and its places stay.', args: NAME, hints: CHANGE, wait: WAIT_BOUND },
    housesList: {
      for: PILOTED,
      description: 'Every house with its whole entry, open with its ward or closed with why.',
      result: HOUSES_SHOWN,
      hints: LIST,
      wait: WAIT_BOUND,
    },
    facultiesAdd: {
      for: PILOTED,
      description: 'Raises a body from the registry its entry names, and answers why it is down where it is; the same name and entry answer as it stands.',
      args: s.object(facultyArgs),
      result: WHY,
      hints: CHANGE,
      wait: WAIT_BOUND,
    },
    facultiesUpdate: {
      for: PILOTED,
      description: 'Lands a new entry over a faculty’s in one write: its body goes down, installs where the entry moved, and goes up, and each house and body that uses it follows.',
      args: s.object(facultyArgs),
      result: WHY,
      hints: CHANGE,
      wait: WAIT_BOUND,
    },
    facultiesRestart: {
      for: PILOTED,
      description: 'Takes a body down and up again on its entry, and each house and body that uses it follows.',
      args: NAME,
      result: WHY,
      hints: CHANGE,
      wait: WAIT_BOUND,
    },
    facultiesRemove: { for: PILOTED, description: 'Takes down a body no house and no body uses, and drops its entry.', args: NAME, hints: CHANGE, wait: WAIT_BOUND },
    facultiesList: {
      for: PILOTED,
      description: 'Every faculty entry whole, the terrain’s marked so and the owner’s, standing, or down with why. An entry names its secrets and holds none.',
      result: FACULTIES_SHOWN,
      hints: LIST,
      wait: WAIT_BOUND,
    },
    facultiesCatalog: {
      for: PILOTED,
      description: 'Every registry of the ladder, the ground’s first and then each body’s that carries one, with each faculty it holds and what it takes: the schema its args meet and the secrets its entry names.',
      result: CATALOG,
      hints: LIST,
    },
    waitSet: {
      for: PILOTED,
      description: 'Sets the ground’s bound on every ask, in milliseconds, or drops it back to the terrain’s where none is given; every open house opens again on it.',
      args: s.object({ wait: s.optional(s.integer({ minimum: 1 })) }),
      result: WAIT_SHOWN,
      hints: CHANGE,
      wait: WAIT_BOUND,
    },
    waitShow: { for: PILOTED, description: 'The ground’s bound on every ask, and whether it is the terrain’s.', result: WAIT_SHOWN, hints: LIST },
    secretsSet: {
      for: 'root',
      description: 'Keeps a secret, for the faculties whose entries name it. It answers nothing, so no answer holds it.',
      args: s.object({ name: s.string(), value: s.string() }),
      hints: CHANGE,
    },
    secretsRemove: { for: 'root', description: 'Drops a secret.', args: NAME, hints: CHANGE },
    secretsList: {
      for: 'root',
      description: 'Every secret kept or named, whether it is kept, and the faculty entries that name it, and never a value.',
      result: s.array(s.object({ name: s.string(), kept: s.boolean(), entries: s.array(s.string()) })),
      hints: LIST,
      wait: WAIT_BOUND,
    },
    movesOut: {
      for: 'root',
      description: 'Closes a house and drops its entry, and answers its seed and every place of its memory.',
      args: NAME,
      result: s.object({ seed: s.string(), places: PLACES }),
      hints: { destructive: true },
      wait: WAIT_BOUND,
    },
    movesIn: {
      for: 'root',
      description: 'Keeps a moved seed, writes its places into an empty memory, and opens the house on the bodies its entry names.',
      args: s.object({ ...houseArgs, seed: s.string(), places: PLACES }),
      result: STOOD,
      wait: WAIT_BOUND,
    },
    callFaculty: {
      for: 'root',
      description: 'Calls a method of a body of the ladder by name, its args held to the method’s schema.',
      args: s.object({ faculty: s.string(), method: s.string(), args: s.optional(OBJECT) }),
      result: ANY,
      wait: WAIT_BOUND,
    },
    shellRun: {
      for: 'root',
      description: 'Runs a command on the ground’s machine, with nothing of the ground in its environment, and answers its exit code and what it printed.',
      args: s.object({ command: s.string(), args: s.optional(s.array(s.string())), cwd: s.optional(s.string()), stdin: s.optional(s.string()) }),
      result: s.object({ code: s.integer(), stdout: s.string(), stderr: s.string() }),
      wait: WAIT_BOUND,
    },
    pilotsInvite: {
      for: 'root',
      description: 'A new pilot: an occupant of hers that reaches the houses and faculties asks, as an invitation for the being that pilots.',
      args: s.object({ id: s.string() }),
      result: s.object({ invitation: s.handle() }),
    },
    pilotsDismiss: { for: 'root', description: 'Lets a pilot go.', args: s.object({ id: s.string() }) },
    pilotsList: { for: 'root', description: 'Every pilot she holds.', result: s.array(s.string()), hints: LIST },
    grants: { for: 'root', description: 'Every body the dock is offered: the twins she stands on.', result: s.array(s.string()), hints: LIST },
    granted: { for: 'root', description: 'Bears the being that holds the shell’s offer, once the dock is offered it.', hints: CHANGE },
  },
}) {
  get #powers(): Powers {
    return this.powers as unknown as Powers;
  }

  get #ground(): Face {
    return this.ground as unknown as Face;
  }

  // Every being she holds, the twins and the house beings with their cells and standings.
  async #beings(): Promise<Held> {
    const faculties = new Map<string, Shown>();
    const houses = new Map<string, Shown>();
    const secrets = new Set<string>();
    for (const { id, kind, absent } of await this.#powers.list()) {
      if (absent) continue;
      if (kind === KINDS.secret) {
        // Read as her steward reads her, so her first ask has run.
        await this.#powers.ask({ id });
        secrets.add(nameOf(id, IDS.secret));
      }
      if (kind !== KINDS.faculty && kind !== KINDS.house) continue;
      const shown = (await this.#powers.ask({ id, method: 'shown' })) as Omit<Shown, 'id' | 'kind'>;
      const one = { id, kind, ...shown };
      if (kind === KINDS.faculty) faculties.set(nameOf(id, IDS.faculty), one);
      else houses.set(nameOf(id, IDS.house), one);
    }
    return { faculties, houses, secrets };
  }

  async #terrain(): Promise<Terrain> {
    return (await this.#ground.terrain()) as Terrain;
  }

  // A twin's entry whole: the owner's, or the terrain's where she holds none.
  static #whole(twin: Shown, terrain: Terrain, name: string): WholeFaculty | undefined {
    return hasEntry(twin) ? wholeFaculty(twin.cells, twin.standings) : terrain.entries[name];
  }

  // The bound every house opens on: hers, or the terrain's.
  #bounded(terrain: Terrain): { bound?: number } {
    const bound = this.cells.wait ?? terrain.wait;
    return bound === undefined ? {} : { bound };
  }

  // Every twin's id and every secret's, which a grant may name.
  static #relatable(held: Held): Set<string> {
    return new Set([...[...held.faculties.keys()].map((one) => IDS.faculty + one), ...[...held.secrets].map((one) => IDS.secret + one)]);
  }

  // The name an entry takes, or why it takes none.
  #named(name: string, what: string): void {
    if (!NAME_RULE.test(name)) this.fail(`a ${what} is named with ${NAMED}`);
    if (name === DOCK) this.fail(DOCKED);
  }

  // A faculty's entry held to what the dock refuses before anything lands.
  #facultyEntry(name: string, given: Record<string, Json>, terrain: Terrain, held: Held): WholeFaculty {
    this.#named(name, 'faculty');
    if (Object.hasOwn(OWN, name)) this.fail(OWN[name]);
    const entry = facultyEntryOf(given);
    if (typeof entry === 'string') this.fail(entry);
    if (Object.hasOwn(terrain.primordial, name)) this.fail(`the ${name} is primordial: its entry is the host’s, and the drawer names none`);
    if (entry.from === undefined && entry.make !== undefined && Object.hasOwn(OWN, entry.make)) this.fail(OWN[entry.make]);
    const role = Object.entries(terrain.primordial).find(([, make]) => entry.from === undefined && make === entry.make)?.[0];
    if (role !== undefined) this.fail(`the faculty ${entry.make} is the ground’s ${role}, which is primordial, and the drawer names none`);
    for (const callee of [...(entry.from === undefined ? [] : [entry.from]), ...(entry.faculties ?? [])]) {
      if (Object.hasOwn(OWN, callee)) this.fail(OWN[callee]);
      if (!held.faculties.has(callee)) this.fail(`the faculty ${name} is refused: no faculty ${callee} is here`);
    }
    return entry;
  }

  // What the ground's faculty says the entry fails of what its faculty takes, then each secret it names kept.
  async #takes(name: string, entry: WholeFaculty, secrets: ReadonlySet<string>): Promise<void> {
    const { why } = (await this.#ground.check({ name, entry })) as { why?: string };
    const unkept = (entry.secrets ?? []).find((secret) => !secrets.has(secret));
    const refused = why ?? (unkept === undefined ? undefined : `no secret ${unkept} is kept`);
    if (refused !== undefined) this.fail(`the faculty ${name} is refused: ${refused}`);
  }

  // A house's entry held to what the dock refuses before anything lands.
  #houseEntry(name: string, given: Record<string, Json>, held: Held): WholeHouse {
    this.#named(name, 'house');
    const entry = houseEntryOf(given);
    if (typeof entry === 'string') this.fail(entry);
    for (const faculty of [entry.classes.faculty, ...(entry.memory === undefined ? [] : [entry.memory.faculty]), ...(entry.faculties ?? [])]) {
      if (Object.hasOwn(OWN, faculty)) this.fail(OWN[faculty]);
      if (!held.faculties.has(faculty)) this.fail(`the house ${name} is refused: no faculty ${faculty} is here`);
    }
    return entry;
  }

  // Each grant introduced: the being that names another stands on it, the steward's notes naming the grant.
  #introduce(from: string, grants: ReadonlyMap<string, Record<string, Json>>, held: Shown['standings'] = []): void {
    for (const [to, notes] of grants) {
      // A grant she holds already with the same notes is written again nowhere.
      if (held.some(({ id, steward }) => id === to && canonical(steward) === canonical(notes))) continue;
      this.#powers.introduce({ from, to, notes });
    }
  }

  // Each being the new entry leaves out lets go of the being whose entry named it.
  async #release(from: string, before: ReadonlyMap<string, unknown>, after: ReadonlyMap<string, unknown>, held: ReadonlySet<string>): Promise<void> {
    for (const to of before.keys()) if (!after.has(to) && held.has(to)) await this.#powers.ask({ id: to, method: 'release', args: { id: from } });
  }

  // Who uses a body: the houses that name it or receive it, and the bodies that stand on it or call it.
  static #users(name: string, held: Held): { houses: string[]; faculties: string[] } {
    const serves = held.faculties.get(name)?.cells.serves;
    const every = serves === 'carry' || serves === 'clock';
    const naming = (one: Shown) => one.standings.some(({ id }) => id === IDS.faculty + name);
    const houses = [...held.houses].filter(([, house]) => hasEntry(house) && (every || naming(house))).map(([house]) => house);
    const faculties = [...held.faculties].filter(([, twin]) => naming(twin)).map(([faculty]) => faculty);
    return { houses, faculties };
  }

  // A body and every body above it, the callers after their callees, and every house any of them reaches.
  static #above(name: string, held: Held): { faculties: string[]; houses: string[] } {
    const faculties: string[] = [];
    const houses = new Set<string>();
    const visit = (one: string) => {
      if (faculties.includes(one)) return;
      faculties.push(one);
      const users = DockSteward.#users(one, held);
      for (const house of users.houses) houses.add(house);
      for (const faculty of users.faculties) visit(faculty);
    };
    visit(name);
    return { faculties, houses: [...houses].sort() };
  }

  // After the ladder moves: each body down stands again where it can, and each house closed opens.
  async #mend(): Promise<void> {
    const terrain = await this.#terrain();
    const held = await this.#beings();
    const entries: Record<string, WholeFaculty> = {};
    for (const [name, twin] of held.faculties) {
      const whole = DockSteward.#whole(twin, terrain, name);
      if (whole !== undefined) entries[name] = whole;
    }
    const { order, cycles } = ladder(entries);
    for (const name of order) {
      // The shell's body is the dock's offer, raised at the boot alone.
      if (cycles.has(name) || Object.hasOwn(OWN, name) || typeof held.faculties.get(name)?.cells.why !== 'string') continue;
      await this.#powers.ask({ id: IDS.faculty + name, method: 'up' });
    }
    const bounded = this.#bounded(terrain);
    for (const [, house] of [...held.houses].sort(byName)) {
      if (!hasEntry(house) || typeof house.cells.why !== 'string') continue;
      await this.#powers.ask({ id: house.id, method: 'open', args: bounded });
    }
  }

  // A body taken down with everything above it, `between` run while all are down, then the ladder mended.
  async #cycle(name: string, between: () => Promise<{ why?: string }>): Promise<{ why?: string }> {
    const held = await this.#beings();
    const { faculties, houses } = DockSteward.#above(name, held);
    const why = `the faculty ${name} is going down`;
    for (const house of houses) await this.#powers.ask({ id: IDS.house + house, method: 'close', args: { why } });
    for (const faculty of [...faculties].reverse()) if (faculty !== name) await this.#powers.ask({ id: IDS.faculty + faculty, method: 'down', args: { why } });
    const stood = await between();
    await this.#mend();
    return stood;
  }

  async boot() {
    const terrain = await this.#terrain();
    const held = await this.#beings();
    // A terrain's twin whose default the terrain does not name goes, where the owner named no entry in its place.
    for (const [name, twin] of held.faculties) {
      if (twin.cells.terrain === true && !hasEntry(twin) && terrain.entries[name] === undefined) {
        this.#powers.remove({ id: twin.id });
        held.faculties.delete(name);
      }
    }
    const entries: Record<string, WholeFaculty> = {};
    for (const [name, twin] of held.faculties) {
      const whole = DockSteward.#whole(twin, terrain, name);
      if (whole !== undefined) entries[name] = whole;
    }
    for (const [name, entry] of Object.entries(terrain.entries)) entries[name] ??= entry;
    const { order, cycles } = ladder(entries);
    for (const name of order) {
      const cycle = cycles.get(name);
      const id = IDS.faculty + name;
      const twin = held.faculties.get(name);
      if (twin !== undefined) {
        // Her body stands by a read, and her cells are written only where what came of it moved.
        const raised = cycle === undefined ? ((await this.#powers.ask({ id, method: 'stand' })) as Raised) : { why: cycle };
        if (DockSteward.#moved(twin.cells, raised)) await this.#powers.ask({ id, method: 'record', args: raised });
        // A terrain's entry grants what the terrain's code gives now.
        if (!hasEntry(twin)) this.#introduce(id, facultyGrants(entries[name]), twin.standings);
        continue;
      }
      // A default of the terrain's that no twin holds yet stands now, and its twin is borne.
      const raised = cycle === undefined ? ((await this.#ground.raise({ name, entry: entries[name] })) as Raised) : { why: cycle };
      this.#powers.bear({ kind: KINDS.faculty, id, args: { terrain: true, ...raised } });
      this.#introduce(id, facultyGrants(entries[name]));
    }
    // The dock is offered each body its steward stands on: the terrain's shell, where it has one.
    if (terrain.entries.shell !== undefined && !this.standings.list().some(({ id }) => id === `${IDS.faculty}shell`)) this.#powers.introduce({ from: 'steward', to: `${IDS.faculty}shell`, notes: { faculties: 0 } });
    const bounded = this.#bounded(terrain);
    for (const [name, house] of [...held.houses].sort(byName)) {
      if (!hasEntry(house)) continue;
      if (terrain.lazy && typeof house.cells.ward === 'string') {
        await this.#ground.sleep({ name, entry: wholeHouse(house.cells, house.standings), ward: house.cells.ward });
        continue;
      }
      const stood = (await this.#powers.ask({ id: house.id, method: 'opening', args: bounded })) as Stood;
      if ((stood.ward ?? house.cells.ward) !== house.cells.ward || (stood.why ?? null) !== (house.cells.why ?? null)) await this.#powers.ask({ id: house.id, method: 'record', args: stood });
    }
  }

  // Whether what a raise gave moves any cell a twin holds of it.
  static #moved(cells: Readonly<Record<string, Json>>, raised: Raised): boolean {
    return (
      (raised.installed ?? cells.installed ?? null) !== (cells.installed ?? null) ||
      (raised.why ?? null) !== (cells.why ?? null) ||
      (raised.serves ?? null) !== (cells.serves ?? null) ||
      (raised.port ?? null) !== (cells.port ?? null)
    );
  }

  async grants() {
    return this.standings
      .list()
      .filter(({ id }) => id.startsWith(IDS.faculty))
      .map(({ id }) => nameOf(id, IDS.faculty));
  }

  // The being that holds the shell's offer, borne once the dock is offered it.
  async granted() {
    if ((await this.#powers.list()).some(({ id }) => id === SHELL_ID)) return;
    this.#powers.bear({ kind: KINDS.shell, id: SHELL_ID });
  }

  // A house landed on its entry: a being that stays from before takes it, and a new one is borne on a fresh seed or a moved one.
  async #land(name: string, entry: WholeHouse, house: Shown | undefined, bounded: { bound?: number }, seed?: string): Promise<Stood> {
    const id = IDS.house + name;
    if (house !== undefined) {
      const stood = (await this.#powers.ask({ id, method: 'update', args: { entry, ...bounded } })) as Stood;
      this.#introduce(id, houseGrants(entry));
      return stood;
    }
    const fresh = seed ?? Array.from(this.house.random({ length: 32 }), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const stood = (await this.#ground.open({ name, entry, seed: fresh, ...bounded })) as Stood;
    this.#powers.bear({ kind: KINDS.house, id, args: { entry: houseCells(entry), seed: fresh, ...stood } });
    this.#introduce(id, houseGrants(entry));
    return stood;
  }

  async housesAdd(given: Args<DockSteward, 'housesAdd'>) {
    const { name, ...rest } = given as unknown as { name: string } & Record<string, Json>;
    const held = await this.#beings();
    const entry = this.#houseEntry(name, rest, held);
    const house = held.houses.get(name);
    const bounded = this.#bounded(await this.#terrain());
    if (hasEntry(house)) {
      if (canonical(wholeHouse(house.cells, house.standings)) !== canonical(entry)) this.fail(`the house ${name} stands with another entry; update it`);
      // A house that did not open is tried again, as its entry stands.
      if (typeof house.cells.why === 'string') return (await this.#powers.ask({ id: house.id, method: 'open', args: bounded })) as Stood;
      return { ward: house.cells.ward as string };
    }
    return this.#land(name, entry, house, bounded);
  }

  async housesUpdate(given: Args<DockSteward, 'housesUpdate'>) {
    const { name, ...rest } = given as unknown as { name: string } & Record<string, Json>;
    const held = await this.#beings();
    const house = held.houses.get(name);
    if (!hasEntry(house)) return this.fail(`no house ${name} is here to update`);
    const entry = this.#houseEntry(name, rest, held);
    const bounded = this.#bounded(await this.#terrain());
    const before = wholeHouse(house.cells, house.standings);
    if (canonical(before) === canonical(entry)) {
      if (typeof house.cells.why === 'string') return (await this.#powers.ask({ id: house.id, method: 'open', args: bounded })) as Stood;
      return { ward: house.cells.ward as string };
    }
    const stood = await this.#land(name, entry, house, bounded);
    await this.#release(house.id, houseGrants(before), houseGrants(entry), DockSteward.#relatable(held));
    return stood;
  }

  async housesRemove({ name }: Args<DockSteward, 'housesRemove'>) {
    const held = await this.#beings();
    const house = held.houses.get(name);
    if (!hasEntry(house)) return;
    await this.#powers.ask({ id: house.id, method: 'remove' });
    await this.#release(house.id, houseGrants(wholeHouse(house.cells, house.standings)), new Map(), DockSteward.#relatable(held));
  }

  async housesList() {
    const held = await this.#beings();
    return [...held.houses]
      .filter(([, house]) => hasEntry(house))
      .sort(byName)
      .map(([name, house]) => ({
        name,
        entry: wholeHouse(house.cells, house.standings) as unknown as Json,
        ...(typeof house.cells.ward === 'string' && typeof house.cells.why !== 'string' ? { ward: house.cells.ward } : {}),
        ...(typeof house.cells.why === 'string' ? { why: house.cells.why } : {}),
      })) as never;
  }

  async facultiesAdd(given: Args<DockSteward, 'facultiesAdd'>) {
    const { name, ...rest } = given as unknown as { name: string } & Record<string, Json>;
    const terrain = await this.#terrain();
    const held = await this.#beings();
    const entry = this.#facultyEntry(name, rest, terrain, held);
    const twin = held.faculties.get(name);
    if (twin !== undefined) {
      const whole = DockSteward.#whole(twin, terrain, name);
      if (whole === undefined || canonical(whole) !== canonical(entry)) this.fail(`the faculty ${name} stands with another entry; update it`);
      return typeof twin.cells.why === 'string' ? { why: twin.cells.why } : {};
    }
    await this.#takes(name, entry, held.secrets);
    const raised = (await this.#ground.raise({ name, entry })) as Raised;
    const id = IDS.faculty + name;
    this.#powers.bear({ kind: KINDS.faculty, id, args: { terrain: false, entry: facultyCells(entry), ...raised } });
    this.#introduce(id, facultyGrants(entry));
    await this.#mend();
    return raised.why === undefined ? {} : { why: raised.why };
  }

  async facultiesUpdate(given: Args<DockSteward, 'facultiesUpdate'>) {
    const { name, ...rest } = given as unknown as { name: string } & Record<string, Json>;
    const terrain = await this.#terrain();
    const held = await this.#beings();
    const twin = held.faculties.get(name);
    if (twin === undefined && !Object.hasOwn(OWN, name) && !Object.hasOwn(terrain.primordial, name)) return this.fail(`no faculty ${name} stands here to update`);
    const entry = this.#facultyEntry(name, rest, terrain, held);
    const before = DockSteward.#whole(twin!, terrain, name);
    if (before !== undefined && canonical(before) === canonical(entry)) return typeof twin!.cells.why === 'string' ? { why: twin!.cells.why } : {};
    await this.#takes(name, entry, held.secrets);
    const id = IDS.faculty + name;
    const stood = await this.#cycle(name, async () => (await this.#powers.ask({ id, method: 'update', args: { entry } })) as { why?: string });
    this.#introduce(id, facultyGrants(entry));
    if (before !== undefined) await this.#release(id, facultyGrants(before), facultyGrants(entry), DockSteward.#relatable(held));
    return stood.why === undefined ? {} : { why: stood.why };
  }

  async facultiesRestart({ name }: Args<DockSteward, 'facultiesRestart'>) {
    if (Object.hasOwn(OWN, name)) return this.fail(OWN[name]);
    const held = await this.#beings();
    if (!held.faculties.has(name)) return this.fail(`no faculty ${name} stands here to restart`);
    const stood = await this.#cycle(name, async () => (await this.#powers.ask({ id: IDS.faculty + name, method: 'restart' })) as { why?: string });
    return stood.why === undefined ? {} : { why: stood.why };
  }

  async facultiesRemove({ name }: Args<DockSteward, 'facultiesRemove'>) {
    if (Object.hasOwn(OWN, name)) return this.fail(OWN[name]);
    const terrain = await this.#terrain();
    const held = await this.#beings();
    const twin = held.faculties.get(name);
    if (twin === undefined) return;
    if (!hasEntry(twin)) return this.fail(`the faculty ${name} is the terrain’s; update it`);
    const { houses, faculties } = DockSteward.#users(name, held);
    const users = [...houses.map((house) => `the house ${house}`), ...faculties.map((faculty) => `the faculty ${faculty}`)];
    if (users.length > 0) return this.fail(`the faculty ${name} is in use by ${users.join(', ')}`);
    await this.#powers.ask({ id: twin.id, method: 'remove' });
    await this.#release(twin.id, facultyGrants(wholeFaculty(twin.cells, twin.standings)), new Map(), DockSteward.#relatable(held));
    // A terrain's entry under the same name stands again in its place.
    if (terrain.entries[name] === undefined) this.#powers.remove({ id: twin.id });
    else {
      this.#introduce(twin.id, facultyGrants(terrain.entries[name]));
      await this.#powers.ask({ id: twin.id, method: 'up' });
      await this.#mend();
    }
  }

  async facultiesList() {
    const terrain = await this.#terrain();
    const held = await this.#beings();
    return [...held.faculties].sort(byName).flatMap(([name, twin]) => {
      const entry = DockSteward.#whole(twin, terrain, name);
      if (entry === undefined) return [];
      return [
        {
          name,
          entry: entry as unknown as Json,
          ...(hasEntry(twin) ? {} : { terrain: true }),
          ...(typeof twin.cells.serves === 'string' ? { serves: twin.cells.serves } : {}),
          ...(typeof twin.cells.why === 'string' ? { why: twin.cells.why } : {}),
        },
      ];
    }) as never;
  }

  async facultiesCatalog() {
    return (await this.#ground.catalog()) as never;
  }

  async waitSet({ wait }: Args<DockSteward, 'waitSet'>) {
    this.cells.wait = wait ?? null;
    const terrain = await this.#terrain();
    const bound = wait ?? terrain.wait;
    const held = await this.#beings();
    // Every open house opens again on the bound as it stands now, once its calls in flight end.
    for (const [, house] of [...held.houses].sort(byName)) {
      if (!hasEntry(house) || typeof house.cells.why === 'string') continue;
      await this.#powers.ask({ id: house.id, method: 'open', args: bound === undefined ? {} : { bound } });
    }
    return { ...(bound === undefined ? {} : { wait: bound }), terrain: wait === undefined };
  }

  async waitShow() {
    const bound = this.#bounded(await this.#terrain()).bound;
    return { ...(bound === undefined ? {} : { wait: bound }), terrain: this.cells.wait === null };
  }

  async secretsSet({ name, value }: Args<DockSteward, 'secretsSet'>) {
    if (!NAME_RULE.test(name)) this.fail(`a secret is named with ${NAMED}`);
    const held = await this.#beings();
    if (held.secrets.has(name)) await this.#powers.ask({ id: IDS.secret + name, method: 'set', args: { value } });
    else this.#powers.bear({ kind: KINDS.secret, id: IDS.secret + name, args: { value } });
  }

  async secretsRemove({ name }: Args<DockSteward, 'secretsRemove'>) {
    const held = await this.#beings();
    if (held.secrets.has(name)) this.#powers.remove({ id: IDS.secret + name });
  }

  async secretsList() {
    const terrain = await this.#terrain();
    const held = await this.#beings();
    const naming: Record<string, string[]> = Object.fromEntries([...held.secrets].map((name) => [name, []]));
    for (const [faculty, twin] of held.faculties) for (const secret of DockSteward.#whole(twin, terrain, faculty)?.secrets ?? []) (naming[secret] ??= []).push(faculty);
    return Object.entries(naming)
      .sort(byName)
      .map(([name, entries]) => ({ name, kept: held.secrets.has(name), entries: entries.sort() }));
  }

  async movesOut({ name }: Args<DockSteward, 'movesOut'>) {
    const held = await this.#beings();
    const house = held.houses.get(name);
    if (!hasEntry(house)) return this.fail(`no house ${name} is here`);
    const entry = wholeHouse(house.cells, house.standings);
    // Closed and its entry dropped first, so nothing lands after the copy and no ground runs it twice.
    await this.#powers.ask({ id: house.id, method: 'remove' });
    await this.#release(house.id, houseGrants(entry), new Map(), DockSteward.#relatable(held));
    const { places } = (await this.#ground.placesOut({ name, entry })) as { places: Record<string, Json> };
    return { seed: house.cells.seed as string, places };
  }

  async movesIn(given: Args<DockSteward, 'movesIn'>) {
    const { name, seed, places, ...rest } = given as unknown as { name: string; seed: string; places: Record<string, Json> } & Record<string, Json>;
    if (!/^[0-9a-f]{64}$/.test(seed)) return this.fail('a seed is sixty-four lowercase hex digits');
    const held = await this.#beings();
    const house = held.houses.get(name);
    if (hasEntry(house)) return this.fail(`the house ${name} stands here already`);
    const entry = this.#houseEntry(name, rest, held);
    // A house moves into a memory of its own, never over another's places, and onto no other seed.
    await this.#ground.placesIn({ name, entry, places: {} });
    if (house !== undefined && house.cells.seed !== seed) return this.fail(`the drawer keeps another seed for ${name}`);
    await this.#ground.placesIn({ name, entry, places });
    return this.#land(name, entry, house, this.#bounded(await this.#terrain()), seed);
  }

  async callFaculty({ faculty, method, args }: Args<DockSteward, 'callFaculty'>) {
    return (await this.#ground.call({ faculty, method, ...(args === undefined ? {} : { args }) })) as never;
  }

  // The shell is reached through the being that holds its offer, where the dock is offered one.
  async shellRun(args: Args<DockSteward, 'shellRun'>) {
    const held = (await this.#powers.list()).find(({ id }) => id === SHELL_ID);
    if (held === undefined || held.absent) return this.fail('no shell stands on this ground');
    return (await this.#powers.ask({ id: SHELL_ID, method: 'run', args })) as { code: number; stdout: string; stderr: string };
  }

  pilotsInvite({ id }: Args<DockSteward, 'pilotsInvite'>) {
    return { invitation: this.invite(id, { notes: { pilot: true } }) };
  }

  pilotsDismiss({ id }: Args<DockSteward, 'pilotsDismiss'>) {
    this.occupants.dismiss(id);
  }

  pilotsList() {
    return this.occupants
      .list()
      .filter(({ notes }) => notes.pilot === true)
      .map(({ id }) => id);
  }
}

/** What a dock being reaches of herself to show her steward. */
interface Showing {
  readonly cells: object;
  readonly standings: { list(): readonly { readonly id: string; readonly steward: Notes }[] };
}

// What a dock being shows her steward: her cells, and the standings the steward introduced, never her steward.
const shownOf = (being: Showing): { cells: Record<string, Json>; standings: Shown['standings'] } => ({
  cells: being.cells as Record<string, Json>,
  standings: being.standings
    .list()
    .filter(({ id }) => id !== 'steward')
    .map(({ id, steward }) => ({ id, steward })),
});

/**
 * A faculty's twin: her cells hold the owner's entry, or mark the
 * terrain's, what her body installed, and whether it stands or is down
 * with why. Going up and down is her state machine, and each change the
 * steward asks of her lands in her own write.
 */
export class DockFaculty extends Being.of({
  kind: KINDS.faculty,
  description: 'The twin of one body of the ladder: its entry, what it installed, and whether it stands.',
  needs: { ground: GroundNeed },
  cells: { terrain: false as boolean, entry: null as Record<string, Json> | null, installed: null as string | null, why: null as string | null, serves: null as string | null, port: null as number | null },
  asks: {
    born: { for: 'steward', args: s.object({ terrain: s.boolean(), entry: s.optional(OBJECT), installed: s.optional(s.string()), why: s.optional(s.string()), serves: s.optional(s.string()), port: s.optional(s.integer()) }) },
    shown: SHOWN,
    up: { ...HERS, result: WHY, description: 'Raises her body on her entry, installing where it moved.' },
    stand: { for: 'steward', result: RAISED, hints: LIST, wait: WAIT_BOUND, description: 'Raises her body on her entry and answers what came of it, writing nothing: a boot writes only what moved.' },
    record: { ...HERS, args: RAISED, description: 'Keeps what came of raising her body.' },
    down: { ...HERS, args: s.object({ why: s.string() }), description: 'Takes her body down, and says why.' },
    update: { ...HERS, args: s.object({ entry: OBJECT }), result: WHY, description: 'Lands a new entry over hers, and raises her body on it.' },
    restart: { ...HERS, result: WHY, description: 'Takes her body down and up again.' },
    remove: { ...HERS, description: 'Takes her body down and drops the owner’s entry.' },
    release: { ...HERS, args: s.object({ id: s.string() }), description: 'Lets go of a being whose entry leaves her out.' },
  },
}) {
  get #name(): string {
    return nameOf(this.id, IDS.faculty);
  }

  get #ground(): Face {
    return this.ground as unknown as Face;
  }

  born({ terrain, entry, ...raised }: Args<DockFaculty, 'born'>) {
    this.cells.terrain = terrain;
    this.cells.entry = entry === undefined ? null : (entry as Record<string, Json>);
    this.#keep(raised);
  }

  // What came of raising her body, kept.
  #keep({ installed, why, serves, port }: Raised): void {
    this.cells.installed = installed ?? this.cells.installed;
    this.cells.why = why ?? null;
    this.cells.serves = serves ?? null;
    this.cells.port = port ?? null;
  }

  async stand() {
    const entry = await this.#whole();
    if (entry === undefined) return { why: 'the terrain names no entry for it' };
    return (await this.#ground.raise({ name: this.#name, entry, ...(this.cells.installed === null ? {} : { installed: this.cells.installed }) })) as Raised;
  }

  record(raised: Args<DockFaculty, 'record'>) {
    this.#keep(raised);
  }

  shown() {
    return shownOf(this) as never;
  }

  async #whole(): Promise<WholeFaculty | undefined> {
    if (this.cells.entry !== null) return wholeFaculty(this.cells, shownOf(this).standings);
    return ((await this.#ground.terrain()) as Terrain).entries[this.#name];
  }

  async #raise(entry: WholeFaculty | undefined): Promise<{ why?: string }> {
    if (entry === undefined) {
      this.cells.why = 'the terrain names no entry for it';
      return { why: this.cells.why };
    }
    const raised = (await this.#ground.raise({ name: this.#name, entry, ...(this.cells.installed === null ? {} : { installed: this.cells.installed }) })) as Raised;
    this.#keep(raised);
    return raised.why === undefined ? {} : { why: raised.why };
  }

  async up() {
    return this.#raise(await this.#whole());
  }

  async down({ why }: Args<DockFaculty, 'down'>) {
    await this.#ground.lower({ name: this.#name, why });
    this.cells.why = why;
    this.cells.serves = null;
    this.cells.port = null;
  }

  async update({ entry }: Args<DockFaculty, 'update'>) {
    const whole = entry as unknown as WholeFaculty;
    const grants = facultyGrants(whole);
    for (const { id } of shownOf(this).standings) if (!grants.has(id)) this.standings.drop(id);
    await this.#ground.lower({ name: this.#name });
    this.cells.entry = facultyCells(whole);
    return this.#raise(whole);
  }

  async restart() {
    const whole = await this.#whole();
    await this.#ground.lower({ name: this.#name });
    return this.#raise(whole);
  }

  async remove() {
    await this.#ground.lower({ name: this.#name });
    for (const { id } of shownOf(this).standings) this.standings.drop(id);
    this.cells.entry = null;
    this.cells.why = 'its entry is dropped';
    this.cells.serves = null;
  }

  release({ id }: Args<DockFaculty, 'release'>) {
    if (this.occupants.list().some((one) => one.id === `being:${id}`)) this.occupants.dismiss(`being:${id}`);
  }
}

/**
 * A house's being: her cells hold its entry, its seed and its ward, and
 * whether it stands open or closed with why. The seed stays with her once
 * the entry is dropped, so the house added again is the same ward.
 */
export class DockHouse extends Being.of({
  kind: KINDS.house,
  description: 'One house of the ground: its entry, its seed, its ward, and whether it is open.',
  needs: { ground: GroundNeed },
  cells: { entry: null as Record<string, Json> | null, seed: '', ward: null as string | null, why: null as string | null },
  asks: {
    born: { for: 'steward', args: s.object({ entry: OBJECT, seed: s.string(), ward: s.optional(s.string()), why: s.optional(s.string()) }) },
    shown: SHOWN,
    open: {
      for: ['steward', 'root'],
      description: 'Opens the house on her entry where it is not open on it, and answers its ward or why it stays closed.',
      args: s.object({ bound: s.optional(s.integer({ minimum: 1 })) }),
      result: STOOD,
      hints: CHANGE,
      wait: WAIT_BOUND,
    },
    opening: {
      for: 'steward',
      description: 'Opens the house as `open` does and answers what came of it, writing nothing: a boot writes only what moved.',
      args: s.object({ bound: s.optional(s.integer({ minimum: 1 })) }),
      result: STOOD,
      hints: LIST,
      wait: WAIT_BOUND,
    },
    record: { ...HERS, args: STOOD, description: 'Keeps what came of opening the house.' },
    close: { ...HERS, args: s.object({ why: s.string() }), description: 'Closes the house, and says why.' },
    update: { ...HERS, args: s.object({ entry: OBJECT, bound: s.optional(s.integer({ minimum: 1 })) }), result: STOOD, description: 'Lands a new entry over hers, and opens the house on it.' },
    remove: { ...HERS, description: 'Closes the house and drops her entry; her seed stays.' },
  },
}) {
  get #name(): string {
    return nameOf(this.id, IDS.house);
  }

  get #ground(): Face {
    return this.ground as unknown as Face;
  }

  born({ entry, seed, ward, why }: Args<DockHouse, 'born'>) {
    this.cells.entry = entry as Record<string, Json>;
    this.cells.seed = seed;
    this.cells.ward = ward ?? null;
    this.cells.why = why ?? null;
  }

  shown() {
    return shownOf(this) as never;
  }

  async #open(entry: WholeHouse, bound: number | undefined): Promise<Stood> {
    const stood = (await this.#ground.open({ name: this.#name, entry, seed: this.cells.seed, ...(bound === undefined ? {} : { bound }) })) as Stood;
    this.cells.ward = stood.ward ?? this.cells.ward;
    this.cells.why = stood.why ?? null;
    return stood;
  }

  async open({ bound }: Args<DockHouse, 'open'>) {
    if (this.cells.entry === null) return this.fail(`the house ${this.#name} holds no entry`);
    return this.#open(wholeHouse(this.cells, shownOf(this).standings), bound);
  }

  async opening({ bound }: Args<DockHouse, 'opening'>) {
    if (this.cells.entry === null) return this.fail(`the house ${this.#name} holds no entry`);
    return (await this.#ground.open({ name: this.#name, entry: wholeHouse(this.cells, shownOf(this).standings), seed: this.cells.seed, ...(bound === undefined ? {} : { bound }) })) as Stood;
  }

  record({ ward, why }: Args<DockHouse, 'record'>) {
    this.cells.ward = ward ?? this.cells.ward;
    this.cells.why = why ?? null;
  }

  async close({ why }: Args<DockHouse, 'close'>) {
    await this.#ground.close({ name: this.#name, why });
    this.cells.why = why;
  }

  async update({ entry, bound }: Args<DockHouse, 'update'>) {
    const whole = entry as unknown as WholeHouse;
    const grants = houseGrants(whole);
    for (const { id } of shownOf(this).standings) if (!grants.has(id)) this.standings.drop(id);
    await this.#ground.close({ name: this.#name, why: 'it is being updated' });
    this.cells.entry = houseCells(whole);
    return this.#open(whole, bound);
  }

  async remove() {
    await this.#ground.close({ name: this.#name });
    for (const { id } of shownOf(this).standings) this.standings.drop(id);
    this.cells.entry = null;
    this.cells.why = null;
  }
}

/**
 * A secret: her one cell holds its value. Her asks answer nothing, and the
 * hand never reads her cells, so only the bodies whose twins stand on her
 * receive it, when they go up.
 */
export class DockSecret extends Being.of({
  kind: KINDS.secret,
  description: 'One secret, for the faculties whose entries name it.',
  cells: { value: '' },
  asks: {
    born: { for: 'steward', args: s.object({ value: s.string() }) },
    set: { for: 'steward', args: s.object({ value: s.string() }), hints: CHANGE },
    release: { ...HERS, args: s.object({ id: s.string() }) },
  },
}) {
  born({ value }: Args<DockSecret, 'born'>) {
    this.cells.value = value;
  }

  set({ value }: Args<DockSecret, 'set'>) {
    this.cells.value = value;
  }

  release({ id }: Args<DockSecret, 'release'>) {
    if (this.occupants.list().some((one) => one.id === `being:${id}`)) this.occupants.dismiss(`being:${id}`);
  }
}

/**
 * The being that holds the shell: the terrain's `shell` body, offered to
 * her kind alone as any body is offered to a house, where the dock's
 * steward stands on its twin. The steward's `shellRun` asks her.
 */
export class DockShell extends Being.of({
  kind: KINDS.shell,
  description: 'The ground’s shell, for the dock’s steward alone.',
  needs: { shell: ShellNeed },
  asks: {
    run: {
      for: 'steward',
      args: s.object({ command: s.string(), args: s.optional(s.array(s.string())), cwd: s.optional(s.string()), stdin: s.optional(s.string()) }),
      result: s.object({ code: s.integer(), stdout: s.string(), stderr: s.string() }),
      hints: CHANGE,
      wait: WAIT_BOUND,
    },
  },
}) {
  async run(args: Args<DockShell, 'run'>) {
    return this.shell.run(args);
  }
}

/** The dock's classes: the library's, the same on every ground. */
export const dockClasses = (): ClassList => new ClassList({ steward: DockSteward, beings: [DockFaculty, DockHouse, DockSecret, DockShell] });
