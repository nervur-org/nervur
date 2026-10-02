// SPDX-License-Identifier: Apache-2.0
// The dock: the house every ground stands, whose beings' cells hold the
// ground's state. Its steward answers the hand. A twin stands for each faculty
// entry, a house being for each house entry, and a secret being for each
// secret. Their cells hold every entry, what each faculty installed, each
// house's seed and ward, every secret and the ground's bound on every
// ask. Every name an entry gives is a standing the steward introduces, her
// notes naming the grant. The dock's beings reach the ground through the
// `ground` faculty, offered to their kinds alone. The dock is offered each
// body its steward stands on, as a house is: the terrain's shell, granted
// to the dock's shell being alone. Her classes are the library's, and an
// owner extends them through `classesSet`: a steward of hers that adds to
// the library's and never overrides it, and beings of her own kinds, sealed
// from every seed and every secret.
import { DECLARATION, declarationOf, MEMBERS, type Declaration, type Entry, type Face as NeedFace, type Json, type Notes, type Reply, type Typed } from '../being/being.ts';
import type { Need } from '../being/need.ts';
import type { BeingClass } from '../foundation.ts';
import { ANY, CATALOG, CHANGE, FACULTIES_SHOWN, FACULTY, HEALTH, HOUSE, HOUSE_MOVED, HOUSES_SHOWN, INVITED, LIST, NAME, OBJECT, STOOD, WHY } from '../being/dock-pilot.ts';
import { Being, need, s, type Args, type Result } from '../being/index.ts';
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

/**
 * The ground's work, as its faculty offers it to the dock: a body raised,
 * lowered, uninstalled and asked its health, a house opened, closed or
 * held asleep, the terrain's defaults, what an entry's faculty takes, the
 * catalogue, a body's method called, and a house's places moved out and
 * in. Each is awaited.
 */
export const GroundNeed = need('org.nervur.ground', {
  terrain: { result: ANY, readOnly: true },
  check: { args: s.object({ name: s.string(), entry: OBJECT }), result: WHY, readOnly: true },
  raise: { args: s.object({ name: s.string(), entry: OBJECT, installed: s.optional(s.string()), version: s.optional(s.string()), met: s.optional(OBJECT) }), result: ANY, idempotent: true, wait: WAIT_BOUND },
  lower: { args: s.object({ name: s.string(), why: s.optional(s.string()) }), idempotent: true, wait: WAIT_BOUND },
  uninstall: { args: s.object({ name: s.string(), entry: OBJECT }), result: WHY, idempotent: true, wait: WAIT_BOUND },
  health: { args: NAME, result: HEALTH, readOnly: true, wait: WAIT_BOUND },
  open: { args: s.object({ name: s.string(), entry: OBJECT, seed: s.string(), bound: s.optional(s.integer({ minimum: 1 })) }), result: STOOD, idempotent: true, wait: WAIT_BOUND },
  close: { args: s.object({ name: s.string(), why: s.optional(s.string()) }), idempotent: true, wait: WAIT_BOUND },
  sleep: { args: s.object({ name: s.string(), entry: OBJECT, ward: s.string() }), idempotent: true },
  catalog: { result: ANY, readOnly: true },
  call: { args: s.object({ faculty: s.string(), method: s.string(), args: s.optional(OBJECT) }), result: ANY, idempotent: true, wait: WAIT_BOUND },
  placesOut: { args: s.object({ name: s.string(), entry: OBJECT }), result: ANY, readOnly: true, wait: WAIT_BOUND },
  placesIn: { args: s.object({ name: s.string(), entry: OBJECT, places: OBJECT }), idempotent: true, wait: WAIT_BOUND },
  invite: { args: s.object({ name: s.string(), occupant: s.string(), notes: OBJECT }), result: INVITED, idempotent: true, wait: WAIT_BOUND },
});

/** A command run on the ground's machine, as its owner runs one: its exit code and what it printed. */
export const ShellNeed = need('org.nervur.shell', {
  run: {
    args: s.object({ command: s.string(), args: s.optional(s.array(s.string())), cwd: s.optional(s.string()), stdin: s.optional(s.string()) }),
    result: s.object({ code: s.integer(), stdout: s.string(), stderr: s.string() }),
    idempotent: true,
    wait: WAIT_BOUND,
  },
});

/** One faculty's entry, whole: who makes it, what it is handed, the bodies it calls, its installers, and its grant. */
export interface WholeFaculty {
  readonly make?: string;
  readonly from?: string;
  readonly args?: Readonly<Record<string, Json>>;
  readonly secrets?: readonly string[];
  readonly faculties?: readonly string[];
  readonly installers?: readonly string[];
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
  /** Every secret's being by name, and whether it keeps a value: one an entry names stands before it is set. */
  readonly secrets: Map<string, boolean>;
}

const NAMED = 'lowercase letters, digits, dots, dashes and underscores, at most fifty-six';
const NAME_RULE = /^[a-z0-9][a-z0-9._-]{0,55}$/;
const DOCKED = `the ${DOCK} is the library’s, and no entry names it`;
/** The library's own faculty, which a house's entry alone may grant. */
export const GROUND = 'ground';
// The dock's own faculties: no owner's faculty entry names or makes either, and only a house's `faculties` grants the ground.
const OWN: Readonly<Record<string, string>> = {
  [GROUND]: 'the ground is the library’s: no faculty entry names it or makes it, and a house’s faculties alone grant it',
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
  const { make, from, args, secrets, faculties, installers, kinds, ...rest } = value;
  if (Object.keys(rest).length > 0) return `an entry names ${Object.keys(rest).join(', ')}, which no entry holds`;
  if (kinds !== undefined && !isNames(kinds)) return "an entry's kinds are a list of names";
  if (typeof make !== 'string') return "a faculty's entry names it in make";
  if (from !== undefined && typeof from !== 'string') return "an entry's from is a body's name";
  if (args !== undefined && !isObject(args)) return "an entry's args are an object";
  if (secrets !== undefined && !isNames(secrets)) return "an entry's secrets are a list of names";
  if (faculties !== undefined && !isNames(faculties)) return "an entry's faculties are a list of names";
  if (installers !== undefined && !isNames(installers)) return "an entry's installers are a list of names";
  return { make, ...some('from', from), ...some('args', args), ...some('secrets', secrets), ...some('faculties', faculties), ...some('installers', installers), ...some('kinds', kinds) };
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
  (entry.installers ?? []).forEach((name, at) => add(IDS.faculty + name, { installers: at }));
  (entry.secrets ?? []).forEach((name, at) => add(IDS.secret + name, { secrets: at }));
  return grants;
};

/**
 * What a house's entry grants, as a faculty's does. The ground has no
 * twin, so its grant is no standing: the house being's cells keep its
 * place in `faculties`.
 */
const houseGrants = (entry: WholeHouse): Map<string, Record<string, Json>> => {
  const grants = new Map<string, Record<string, Json>>();
  const add = (id: string, notes: Record<string, Json>) => grants.set(id, { ...grants.get(id), ...notes });
  add(IDS.faculty + entry.classes.faculty, { classes: true });
  if (entry.memory !== undefined) add(IDS.faculty + entry.memory.faculty, { memory: true });
  (entry.faculties ?? []).forEach((name, at) => {
    if (name !== GROUND) add(IDS.faculty + name, { faculties: at });
  });
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
    ...some('installers', listed(standings, 'installers', IDS.faculty)),
    ...some('kinds', held.kinds),
  };
};

/** A house's entry whole, as a twin's is: the ground's grant stands in `faculties` at the place her cells keep. */
const wholeHouse = (cells: Readonly<Record<string, Json>>, standings: Shown['standings']): WholeHouse => {
  const held = cells.entry as { classes: Record<string, Json>; memory?: Record<string, Json>; wait?: number; ground?: number };
  const code = single(standings, 'classes') ?? '';
  const kept = single(standings, 'memory');
  const faculties = listed(standings, 'faculties', IDS.faculty);
  if (typeof held.ground === 'number') faculties.splice(held.ground, 0, GROUND);
  return {
    classes: { faculty: code, ...held.classes },
    ...(held.memory === undefined || kept === undefined ? {} : { memory: { faculty: kept, ...held.memory } }),
    ...some('faculties', faculties),
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
  ...(entry.faculties?.includes(GROUND) === true ? { ground: entry.faculties.indexOf(GROUND) } : {}),
});

/**
 * The ladder's order: each body after the one whose registry it stands on,
 * after each installer it names, and after each body it names in
 * `faculties`, since its code, its terrain and its callees come from
 * them. Each body in a cycle is named with it.
 */
const ladder = (entries: Readonly<Record<string, WholeFaculty>>): { order: string[]; cycles: Map<string, string> } => {
  const below = (entry: WholeFaculty): readonly string[] => [...(entry.from === undefined ? [] : [entry.from]), ...(entry.installers ?? []), ...(entry.faculties ?? [])];
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

const PLACES = OBJECT;
const WAIT_SHOWN = s.object({ wait: s.optional(s.integer({ minimum: 1 })), terrain: s.boolean() });
// Who changes the houses and the faculties: the hand, and a pilot the owner handed a standing.
const PILOTED = ['root', 'pilot'];
// The asks the steward alone makes of the beings she holds.
const HERS = { for: 'steward', ...CHANGE, wait: WAIT_BOUND } as const;
const SHOWN = { for: ['steward', 'root'], result: ANY, ...LIST } as const;

type Face = Record<string, (args?: unknown) => Promise<unknown>>;

/**
 * What the dock calls, read as it acts on it: an awaited call's result, or
 * its error failing the dock's own ask, so nothing of that ask lands.
 */
const answered = (reply: unknown, fail: (message: string) => never): unknown => {
  const read = reply as Reply | undefined;
  if (read?.error !== undefined) fail(read.error.message);
  return read?.result;
};
// A face whose calls answer as `answered` reads them: every method, or the one named.
const failing = <T extends object>(face: T, fail: (message: string) => never, only?: string): T =>
  // A face is frozen, so the proxy stands over an empty object and reads the face.
  new Proxy({} as T, {
    get: (_empty, name) => {
      const member = Reflect.get(face, name) as unknown;
      if (typeof member !== 'function' || (only !== undefined && name !== only)) return member;
      return async (...args: unknown[]) => answered(await (member as (...given: unknown[]) => unknown).apply(face, args), fail);
    },
  });
type Powers = {
  list(): Promise<readonly { id: string; kind: string; absent: boolean }[]>;
  /** With no method, what the being shows her steward, once her first ask has run. */
  ask(call: { id: string; method?: string; args?: unknown }): Promise<unknown>;
  bear(options: { kind: string; id: string; args?: Json }): void;
  remove(options: { id: string }): void;
  introduce(options: { from: string; to: string; notes?: Notes }): void;
};
type Stood = { ward?: string; why?: string };
type Raised = { installed?: string; why?: string; serves?: string; port?: number; version?: string; met?: Record<string, Json> };
const RAISED = s.object({ installed: s.optional(s.string()), why: s.optional(s.string()), serves: s.optional(s.string()), port: s.optional(s.integer()), version: s.optional(s.string()), met: s.optional(OBJECT) });

/** The dock's steward: every ask the hand makes of the ground. */
export class DockSteward extends Being.of({
  kind: KINDS.steward,
  description: 'The ground’s own steward: its houses, its faculties, its secrets, its moves and its shell.',
  needs: { ground: GroundNeed },
  cells: { wait: null as number | null, classes: null as Record<string, Json> | null, classesWhy: null as string | null },
  roles: { pilot: (asker) => asker.notes.pilot === true },
  asks: {
    boot: {
      for: 'root',
      description: 'Stands the ladder from every entry, the terrain’s and the owner’s, and opens every house: each wake asks it once.',
      ...CHANGE,
      wait: WAIT_BOUND,
    },
    housesAdd: {
      for: PILOTED,
      description: 'Opens a house on the bodies its entry names, and answers its ward, or why it stands closed; the same name and entry answer as it stands.',
      args: HOUSE,
      result: STOOD,
      ...CHANGE,
      wait: WAIT_BOUND,
    },
    housesUpdate: {
      for: PILOTED,
      description: 'Lands a new entry over a house’s in one write, and opens the house again on it.',
      args: HOUSE,
      result: STOOD,
      ...CHANGE,
      wait: WAIT_BOUND,
    },
    housesRemove: { for: PILOTED, description: 'Closes a house and drops its entry; its seed and its places stay.', args: NAME, ...CHANGE, wait: WAIT_BOUND },
    housesList: {
      for: PILOTED,
      description: 'Every house with its whole entry, open with its ward or closed with why.',
      result: HOUSES_SHOWN,
      ...LIST,
      wait: WAIT_BOUND,
    },
    housesInvite: {
      for: PILOTED,
      description: 'Mints a new occupant of a house’s steward, and answers her invitation, for the being who takes it; `by` is the granted house that invites, which the ground alone names.',
      args: s.object({ name: s.string(), id: s.string(), by: s.optional(s.string()) }),
      result: INVITED,
      ...CHANGE,
      wait: WAIT_BOUND,
    },
    facultiesAdd: {
      for: PILOTED,
      description: 'Raises a body from the registry its entry names, and answers why it is down where it is; the same name and entry answer as it stands.',
      args: FACULTY,
      result: WHY,
      ...CHANGE,
      wait: WAIT_BOUND,
    },
    facultiesUpdate: {
      for: PILOTED,
      description: 'Lands a new entry over a faculty’s in one write: its body goes down, installs where the entry moved, and goes up, and each house and body that uses it follows.',
      args: FACULTY,
      result: WHY,
      ...CHANGE,
      wait: WAIT_BOUND,
    },
    facultiesRestart: {
      for: PILOTED,
      description: 'Takes a body down and up again on its entry, and each house and body that uses it follows.',
      args: NAME,
      result: WHY,
      ...CHANGE,
      wait: WAIT_BOUND,
    },
    facultiesRemove: {
      for: PILOTED,
      description: 'Takes down a body no house and no body uses, lets go of what it installed, and drops its entry; it answers why where the uninstall failed.',
      args: NAME,
      result: WHY,
      ...CHANGE,
      wait: WAIT_BOUND,
    },
    facultiesHealth: {
      for: PILOTED,
      description: 'Asks a body its health now: whether it serves, and why not where it does not. A body down is not ok.',
      args: NAME,
      result: HEALTH,
      ...LIST,
      wait: WAIT_BOUND,
    },
    facultiesList: {
      for: PILOTED,
      description: 'Every faculty entry whole, the terrain’s marked so and the owner’s, standing, or down with why. An entry names its secrets and holds none.',
      result: FACULTIES_SHOWN,
      ...LIST,
      wait: WAIT_BOUND,
    },
    facultiesCatalog: {
      for: PILOTED,
      description: 'Every registry of the ladder, the ground’s first and then each body’s that carries one, with each faculty it holds and what it takes: the schema its args meet and the secrets its entry names.',
      result: CATALOG,
      ...LIST,
    },
    waitSet: {
      for: PILOTED,
      description: 'Sets the ground’s bound on every ask, in milliseconds, or drops it back to the terrain’s where none is given; every open house opens again on it.',
      args: s.object({ wait: s.optional(s.integer({ minimum: 1 })) }),
      result: WAIT_SHOWN,
      ...CHANGE,
      wait: WAIT_BOUND,
    },
    waitShow: { for: PILOTED, description: 'The ground’s bound on every ask, and whether it is the terrain’s.', result: WAIT_SHOWN, ...LIST },
    secretsSet: {
      for: 'root',
      description: 'Keeps a secret, for the faculties whose entries name it, and raises each of their bodies again on it, with the houses above them. It answers nothing, so no answer holds it.',
      args: s.object({ name: s.string(), value: s.string() }),
      ...CHANGE,
      wait: WAIT_BOUND,
    },
    secretsRemove: {
      for: 'root',
      description: 'Drops a secret, and each body whose entry names it goes down waiting for it.',
      args: NAME,
      ...CHANGE,
      wait: WAIT_BOUND,
    },
    secretsList: {
      for: 'root',
      description: 'Every secret kept or named, whether it is kept, and the faculty entries that name it, and never a value.',
      result: s.array(s.object({ name: s.string(), kept: s.boolean(), entries: s.array(s.string()) })),
      ...LIST,
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
      args: HOUSE_MOVED,
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
    pilotsList: { for: 'root', description: 'Every pilot she holds.', result: s.array(s.string()), ...LIST },
    classesSet: {
      for: 'root',
      description: 'Names the body of the ladder that serves the owner’s dock classes, as a house entry’s classes, or drops back to the library’s where none is given; the dock opens again on them.',
      args: s.object({ classes: s.optional(OBJECT) }),
      ...CHANGE,
      wait: WAIT_BOUND,
    },
    classesShow: {
      for: 'root',
      description: 'The body that serves the owner’s dock classes, where one is named, and why the dock stands on the library’s alone where they did not load.',
      result: s.object({ classes: s.optional(OBJECT), why: s.optional(s.string()) }),
      ...LIST,
    },
    classesLoaded: { for: 'root', description: 'Keeps why the owner’s dock classes did not load, or that they did: the ground asks it each time the dock opens on them.', args: WHY, ...CHANGE },
    grants: { for: 'root', description: 'Every body the dock is offered: the twins she stands on.', result: s.array(s.string()), ...LIST },
    granted: { for: 'root', description: 'Bears the being that holds the shell’s offer, once the dock is offered it.', ...CHANGE },
  },
}) {
  get #powers(): Powers {
    return failing(this.powers as unknown as Powers, this.fail, 'ask');
  }

  get #ground(): Face {
    return failing(this.ground as unknown as Face, this.fail);
  }

  // Every being she holds, the twins and the house beings with their cells and standings.
  async #beings(): Promise<Held> {
    const faculties = new Map<string, Shown>();
    const houses = new Map<string, Shown>();
    const secrets = new Map<string, boolean>();
    for (const { id, kind, absent } of await this.#powers.list()) {
      if (absent) continue;
      if (kind === KINDS.secret) secrets.set(nameOf(id, IDS.secret), (await this.#powers.ask({ id, method: 'kept' })) === true);
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
    return new Set([...[...held.faculties.keys()].map((one) => IDS.faculty + one), ...[...held.secrets.keys()].map((one) => IDS.secret + one)]);
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
    if (Object.hasOwn(terrain.primordial, name)) this.fail(`the ${name} is primordial: its entry is the host’s, and the dock’s entries name none`);
    if (entry.from === undefined && entry.make !== undefined && Object.hasOwn(OWN, entry.make)) this.fail(OWN[entry.make]);
    const role = Object.entries(terrain.primordial).find(([, make]) => entry.from === undefined && make === entry.make)?.[0];
    if (role !== undefined) this.fail(`the faculty ${entry.make} is the ground’s ${role}, which is primordial, and the dock’s entries name none`);
    for (const callee of [...(entry.from === undefined ? [] : [entry.from]), ...(entry.faculties ?? []), ...(entry.installers ?? [])]) {
      if (Object.hasOwn(OWN, callee)) this.fail(OWN[callee]);
      if (!held.faculties.has(callee)) this.fail(`the faculty ${name} is refused: no faculty ${callee} is here`);
    }
    return entry;
  }

  // What the ground's faculty says the entry's args fail of what its faculty takes. A secret not kept yet is no refusal: its body waits for it.
  async #takes(name: string, entry: WholeFaculty): Promise<void> {
    const { why } = (await this.#ground.check({ name, entry })) as { why?: string };
    if (why !== undefined) this.fail(`the faculty ${name} is refused: ${why}`);
  }

  // Each secret an entry names that no being holds is borne empty, so its twin stands on it before it is set.
  #room(entry: WholeFaculty, held: Held): void {
    for (const secret of entry.secrets ?? []) {
      if (held.secrets.has(secret)) continue;
      this.#powers.bear({ kind: KINDS.secret, id: IDS.secret + secret, args: {} });
      held.secrets.set(secret, false);
    }
  }

  // Every body whose twin stands on a secret goes down and up again with everything above it, so a secret set or dropped reaches it now.
  async #raiseOn(secret: string): Promise<void> {
    const held = await this.#beings();
    for (const [name, twin] of [...held.faculties].sort(byName)) {
      if (Object.hasOwn(OWN, name) || !twin.standings.some(({ id }) => id === IDS.secret + secret)) continue;
      await this.#cycle(name, async () => (await this.#powers.ask({ id: twin.id, method: 'restart' })) as { why?: string });
    }
  }

  // A house's entry held to what the dock refuses before anything lands.
  #houseEntry(name: string, given: Record<string, Json>, held: Held): WholeHouse {
    this.#named(name, 'house');
    const entry = houseEntryOf(given);
    if (typeof entry === 'string') this.fail(entry);
    // A house's faculties alone grant the ground, which stands on every ground and has no twin.
    const granted = (entry.faculties ?? []).filter((faculty) => faculty !== GROUND);
    if (granted.length < (entry.faculties ?? []).length - 1) this.fail(`the house ${name} is refused: it names the ${GROUND} twice`);
    for (const faculty of [entry.classes.faculty, ...(entry.memory === undefined ? [] : [entry.memory.faculty]), ...granted]) {
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
        if (!hasEntry(twin)) {
          this.#room(entries[name], held);
          this.#introduce(id, facultyGrants(entries[name]), twin.standings);
        }
        continue;
      }
      // A default of the terrain's that no twin holds yet stands now, and its twin is borne.
      const raised = cycle === undefined ? ((await this.#ground.raise({ name, entry: entries[name] })) as Raised) : { why: cycle };
      this.#powers.bear({ kind: KINDS.faculty, id, args: { terrain: true, ...raised } });
      this.#room(entries[name], held);
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
      (raised.port ?? null) !== (cells.port ?? null) ||
      (raised.version ?? cells.version ?? null) !== (cells.version ?? null) ||
      canonical(raised.met ?? cells.met ?? null) !== canonical(cells.met ?? null)
    );
  }

  async classesSet({ classes }: Args<DockSteward, 'classesSet'>) {
    this.cells.classesWhy = null;
    if (classes === undefined) {
      this.cells.classes = null;
      return;
    }
    const named = namedOf(classes, 'classes');
    if (typeof named === 'string') return this.fail(named);
    if (Object.hasOwn(OWN, named.faculty)) return this.fail(OWN[named.faculty]);
    const twin = (await this.#beings()).faculties.get(named.faculty);
    if (twin === undefined) return this.fail(`the ${DOCK}’s classes are refused: no faculty ${named.faculty} is on the ladder`);
    // A body down is taken on its word, and one standing serves classes or is refused.
    if (typeof twin.cells.why !== 'string' && twin.cells.serves !== 'classes') return this.fail(`the ${DOCK}’s classes are refused: the faculty ${named.faculty} serves no classes`);
    this.cells.classes = named as unknown as Record<string, Json>;
  }

  classesShow() {
    return { ...(this.cells.classes === null ? {} : { classes: this.cells.classes }), ...(this.cells.classesWhy === null ? {} : { why: this.cells.classesWhy }) };
  }

  classesLoaded({ why }: Args<DockSteward, 'classesLoaded'>) {
    this.cells.classesWhy = why ?? null;
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

  // Her notes say who invited: the hand, a pilot, or a house the ground granted, which the ground names through the hand alone.
  async housesInvite({ name, id, by }: Args<DockSteward, 'housesInvite'>) {
    const root = this.asker.id === 'root';
    if (by !== undefined && !root) return this.fail('only the ground names the house that invites');
    if (by === name) return this.fail(`the house ${name} invites nothing onto herself`);
    const held = await this.#beings();
    if (!hasEntry(held.houses.get(name))) return this.fail(`no house ${name} is here`);
    const notes = !root ? { by: 'pilot' } : by === undefined ? { by: 'root' } : { by: GROUND, house: by };
    return (await this.#ground.invite({ name, occupant: id, notes })) as never;
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
    await this.#takes(name, entry);
    const raised = (await this.#ground.raise({ name, entry })) as Raised;
    const id = IDS.faculty + name;
    this.#powers.bear({ kind: KINDS.faculty, id, args: { terrain: false, entry: facultyCells(entry), ...raised } });
    this.#room(entry, held);
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
    await this.#takes(name, entry);
    const id = IDS.faculty + name;
    const stood = await this.#cycle(name, async () => (await this.#powers.ask({ id, method: 'update', args: { entry } })) as { why?: string });
    this.#room(entry, held);
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
    if (twin === undefined) return {};
    if (!hasEntry(twin)) return this.fail(`the faculty ${name} is the terrain’s; update it`);
    const { houses, faculties } = DockSteward.#users(name, held);
    const users = [...houses.map((house) => `the house ${house}`), ...faculties.map((faculty) => `the faculty ${faculty}`), ...(this.cells.classes?.faculty === name ? [`the ${DOCK}’s classes`] : [])];
    if (users.length > 0) return this.fail(`the faculty ${name} is in use by ${users.join(', ')}`);
    const { why } = (await this.#powers.ask({ id: twin.id, method: 'remove' })) as { why?: string };
    await this.#release(twin.id, facultyGrants(wholeFaculty(twin.cells, twin.standings)), new Map(), DockSteward.#relatable(held));
    // A terrain's entry under the same name stands again in its place.
    if (terrain.entries[name] === undefined) this.#powers.remove({ id: twin.id });
    else {
      this.#room(terrain.entries[name], held);
      this.#introduce(twin.id, facultyGrants(terrain.entries[name]));
      await this.#powers.ask({ id: twin.id, method: 'up' });
      await this.#mend();
    }
    return why === undefined ? {} : { why };
  }

  async facultiesHealth({ name }: Args<DockSteward, 'facultiesHealth'>) {
    if (!(await this.#powers.list()).some(({ id }) => id === IDS.faculty + name)) return this.fail(`no faculty ${name} stands here`);
    return (await this.#powers.ask({ id: IDS.faculty + name, method: 'health' })) as { ok: boolean; why?: string };
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
    // A secret no entry names is borne; one an entry names has her being already, so the bodies on her rise on her value now.
    if (!held.secrets.has(name)) return this.#powers.bear({ kind: KINDS.secret, id: IDS.secret + name, args: { value } });
    await this.#powers.ask({ id: IDS.secret + name, method: 'set', args: { value } });
    await this.#raiseOn(name);
  }

  async secretsRemove({ name }: Args<DockSteward, 'secretsRemove'>) {
    const held = await this.#beings();
    if (!held.secrets.has(name)) return;
    const id = IDS.secret + name;
    // A secret an entry names keeps her being with no value, and each body on her goes down waiting for her.
    if (![...held.faculties.values()].some((twin) => twin.standings.some((one) => one.id === id))) return this.#powers.remove({ id });
    await this.#powers.ask({ id, method: 'set', args: {} });
    await this.#raiseOn(name);
  }

  async secretsList() {
    const terrain = await this.#terrain();
    const held = await this.#beings();
    const naming: Record<string, string[]> = Object.fromEntries([...held.secrets].filter(([, kept]) => kept).map(([name]) => [name, []]));
    for (const [faculty, twin] of held.faculties) for (const secret of DockSteward.#whole(twin, terrain, faculty)?.secrets ?? []) (naming[secret] ??= []).push(faculty);
    return Object.entries(naming)
      .sort(byName)
      .map(([name, entries]) => ({ name, kept: held.secrets.get(name) === true, entries: entries.sort() }));
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
    if (house !== undefined && house.cells.seed !== seed) return this.fail(`the dock’s cells keep another seed for ${name}`);
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
 * terrain's, what her body installed, the version its memory was last
 * brought to, which installer met each of its needs and what it
 * answered, and whether it
 * stands or is down with why. Going up and down is her state machine, and
 * each change the steward asks of her lands in her own write.
 */
export class DockFaculty extends Being.of({
  kind: KINDS.faculty,
  description: 'The twin of one body of the ladder: its entry, what it installed, its version, and whether it stands.',
  needs: { ground: GroundNeed },
  cells: {
    terrain: false as boolean,
    entry: null as Record<string, Json> | null,
    installed: null as string | null,
    version: null as string | null,
    met: null as Record<string, Json> | null,
    why: null as string | null,
    serves: null as string | null,
    port: null as number | null,
  },
  asks: {
    born: {
      for: 'steward',
      args: s.object({
        terrain: s.boolean(),
        entry: s.optional(OBJECT),
        installed: s.optional(s.string()),
        version: s.optional(s.string()),
        met: s.optional(OBJECT),
        why: s.optional(s.string()),
        serves: s.optional(s.string()),
        port: s.optional(s.integer()),
      }),
    },
    shown: SHOWN,
    up: { ...HERS, result: WHY, description: 'Raises her body on her entry, installing where it moved and migrating where its version moved.' },
    stand: { for: 'steward', result: RAISED, ...LIST, wait: WAIT_BOUND, description: 'Raises her body on her entry and answers what came of it, writing nothing: a boot writes only what moved.' },
    record: { ...HERS, args: RAISED, description: 'Keeps what came of raising her body.' },
    down: { ...HERS, args: s.object({ why: s.string() }), description: 'Takes her body down, and says why.' },
    update: { ...HERS, args: s.object({ entry: OBJECT }), result: WHY, description: 'Lands a new entry over hers, and raises her body on it.' },
    restart: { ...HERS, result: WHY, description: 'Takes her body down and up again.' },
    remove: { ...HERS, result: WHY, description: 'Takes her body down, lets go of what it installed, and drops the owner’s entry.' },
    release: { ...HERS, args: s.object({ id: s.string() }), description: 'Lets go of a being whose entry leaves her out.' },
    health: { for: ['steward', 'root'], result: HEALTH, ...LIST, wait: WAIT_BOUND, description: 'Asks her body its health now, and writes nothing: a body down is not ok.' },
  },
}) {
  get #name(): string {
    return nameOf(this.id, IDS.faculty);
  }

  get #ground(): Face {
    return failing(this.ground as unknown as Face, this.fail);
  }

  born({ terrain, entry, ...raised }: Args<DockFaculty, 'born'>) {
    this.cells.terrain = terrain;
    this.cells.entry = entry === undefined ? null : (entry as Record<string, Json>);
    this.#keep(raised);
  }

  // What came of raising her body, kept.
  #keep({ installed, version, met, why, serves, port }: Raised): void {
    this.cells.installed = installed ?? this.cells.installed;
    this.cells.version = version ?? this.cells.version;
    this.cells.met = met ?? this.cells.met;
    this.cells.why = why ?? null;
    this.cells.serves = serves ?? null;
    this.cells.port = port ?? null;
  }

  // What she hands the ground to raise her body: what it installed, the version its memory was brought to, and what met each of its needs.
  #kept(): { installed?: string; version?: string; met?: Record<string, Json> } {
    return {
      ...(this.cells.installed === null ? {} : { installed: this.cells.installed }),
      ...(this.cells.version === null ? {} : { version: this.cells.version }),
      ...(this.cells.met === null ? {} : { met: this.cells.met }),
    };
  }

  async stand() {
    const entry = await this.#whole();
    if (entry === undefined) return { why: 'the terrain names no entry for it' };
    return (await this.#ground.raise({ name: this.#name, entry, ...this.#kept() })) as Raised;
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
    const raised = (await this.#ground.raise({ name: this.#name, entry, ...this.#kept() })) as Raised;
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

  // Her body down, then what it installed let go of, then her entry dropped: the uninstall's failure is answered, and the removal stands.
  async remove() {
    const whole = await this.#whole();
    await this.#ground.lower({ name: this.#name });
    const { why } = whole === undefined ? {} : ((await this.#ground.uninstall({ name: this.#name, entry: whole })) as { why?: string });
    for (const { id } of shownOf(this).standings) this.standings.drop(id);
    this.cells.entry = null;
    this.cells.why = 'its entry is dropped';
    this.cells.serves = null;
    this.cells.version = null;
    this.cells.met = null;
    return why === undefined ? {} : { why };
  }

  release({ id }: Args<DockFaculty, 'release'>) {
    if (this.occupants.list().some((one) => one.id === `being:${id}`)) this.occupants.dismiss(`being:${id}`);
  }

  async health() {
    return (await this.#ground.health({ name: this.#name })) as { ok: boolean; why?: string };
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
      ...CHANGE,
      wait: WAIT_BOUND,
    },
    opening: {
      for: 'steward',
      description: 'Opens the house as `open` does and answers what came of it, writing nothing: a boot writes only what moved.',
      args: s.object({ bound: s.optional(s.integer({ minimum: 1 })) }),
      result: STOOD,
      ...LIST,
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
    return failing(this.ground as unknown as Face, this.fail);
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
 * A secret: her one cell holds its value, or nothing while an entry names
 * her and no value is set. Her asks answer at most whether she keeps one,
 * and the hand never reads her cells, so only the bodies whose twins stand
 * on her receive it, when they go up.
 */
export class DockSecret extends Being.of({
  kind: KINDS.secret,
  description: 'One secret, for the faculties whose entries name it.',
  cells: { value: null as string | null },
  asks: {
    born: { for: 'steward', args: s.object({ value: s.optional(s.string()) }) },
    set: { for: 'steward', args: s.object({ value: s.optional(s.string()) }), ...CHANGE },
    kept: { for: 'steward', result: s.boolean(), ...LIST, description: 'Whether she keeps a value, and never the value.' },
    release: { ...HERS, args: s.object({ id: s.string() }) },
  },
}) {
  born({ value }: Args<DockSecret, 'born'>) {
    this.cells.value = value ?? null;
  }

  set({ value }: Args<DockSecret, 'set'>) {
    this.cells.value = value ?? null;
  }

  kept() {
    return this.cells.value !== null;
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
      ...CHANGE,
      wait: WAIT_BOUND,
    },
  },
}) {
  async run(args: Args<DockShell, 'run'>) {
    return answered(await this.shell.run(args), this.fail) as Result<DockShell, 'run'>;
  }
}

/** The library's own classes of the dock, which boot every ground. */
const LIBRARY: readonly BeingClass[] = [DockSteward, DockFaculty, DockHouse, DockSecret, DockShell];
const LIBRARY_KINDS: ReadonlySet<string> = new Set(Object.values(KINDS));
// The ids the library's beings take, which no being of the owner's takes.
const libraryId = (id: string): boolean => id === SHELL_ID || Object.values(IDS).some((prefix) => id.startsWith(prefix));

const declared = (Class: unknown): Declaration => declarationOf(Class)!;

/**
 * Every member the library's steward defines, which an owner's steward
 * never defines again: her methods and accessors, and every member a being
 * reaches.
 */
const KEPT: ReadonlySet<string> = new Set([...Object.getOwnPropertyNames(DockSteward.prototype), ...MEMBERS, ...Object.keys(declared(DockSteward).asks)]);

/** The asks of hers an owner's steward calls on herself: those a pilot reaches, since the owner's code reaches no further than a pilot. */
const PILOT_ASKS: ReadonlySet<string> = new Set(
  Object.entries(declared(DockSteward).asks)
    .filter(([, entry]) => [entry.for].flat().includes('pilot'))
    .map(([name]) => name),
);

type Sealed = Record<string | symbol, unknown>;
type RawPowers = Powers & { invite(options: { id: string; occupant: string; notes?: Notes; expires?: number }): unknown };

// A being's notes that would make her a pilot, which the owner's code never writes.
const piloting = (notes: Notes | undefined): boolean => notes?.pilot !== undefined;

/**
 * The steward's powers as the owner's code holds them: each reaches her
 * own beings alone. No library being is borne, removed, asked, introduced
 * or stood on by the owner's code, so no seed and no secret reaches it.
 */
const sealedPowers = (powers: RawPowers, kinds: ReadonlySet<string>, fail: (message: string) => never): RawPowers => {
  const mine = (id: string) => {
    if (libraryId(id)) fail(`the being ${id} is the ${DOCK}’s own, and the owner’s code reaches her nowhere`);
  };
  return Object.freeze({
    list: () => powers.list(),
    ask: (call: { id: string; method?: string; args?: unknown }, options?: unknown) => {
      mine(call.id);
      return (powers.ask as (...given: unknown[]) => Promise<unknown>)(call, options);
    },
    bear: (options: { kind: string; id: string; args?: Json }) => {
      if (!kinds.has(options.kind)) fail(`the owner’s steward bears beings of her own kinds alone, and ${options.kind} is none`);
      mine(options.id);
      powers.bear(options);
    },
    remove: (options: { id: string }) => {
      mine(options.id);
      powers.remove(options);
    },
    introduce: (options: { from: string; to: string; notes?: Notes }) => {
      mine(options.from);
      mine(options.to);
      if (piloting(options.notes)) fail('the owner’s code makes no pilot');
      powers.introduce(options);
    },
    invite: (options: { id: string; occupant: string; notes?: Notes; expires?: number }) => {
      mine(options.id);
      if (piloting(options.notes)) fail('the owner’s code makes no pilot');
      return powers.invite(options);
    },
  });
};

/**
 * The steward as the owner's code reaches her: her own members, her needs,
 * her cells and the asks a pilot reaches. The ground's work, the powers
 * over the library's beings, and every ask that is `root`'s alone stay
 * the library's.
 */
const sealedSelf = (steward: DockSteward, kinds: ReadonlySet<string>): object => {
  const target = steward as unknown as Sealed;
  const fail = (message: string): never => steward.fail(message);
  // A house defines her members fixed, so the proxy stands over an empty object of her class and reads her.
  return new Proxy(Object.create(Object.getPrototypeOf(target) as object) as Sealed, {
    get: (_empty, name) => {
      if (name === 'powers') return sealedPowers(target.powers as RawPowers, kinds, fail);
      if (name === 'ground') return fail(`the ground’s work is the ${DOCK}’s own`);
      if (name === 'invite')
        return (id: string, options?: { notes?: Notes }) => {
          if (piloting(options?.notes)) fail('the owner’s code makes no pilot');
          return (target.invite as (...given: unknown[]) => unknown)(id, options);
        };
      if (typeof name === 'string' && Object.hasOwn(DockSteward.prototype, name) && !PILOT_ASKS.has(name)) return () => fail(`${name} is the ${DOCK}’s own, and the owner’s code never calls it`);
      const value = Reflect.get(target, name, target);
      return typeof value === 'function' ? (value as (...given: unknown[]) => unknown).bind(target) : value;
    },
    set: (_empty, name, value) => Reflect.set(target, name, value, target),
  });
};

/**
 * The owner's steward sealed, or why she is refused: a subclass of the
 * library's that adds asks, needs, cells, roles and methods and overrides
 * none. Each method she adds runs on the steward as `sealedSelf` gives
 * her, so her state is her cells, and a private member of hers is none.
 */
const sealedSteward = (Owner: BeingClass, kinds: ReadonlySet<string>): BeingClass => {
  if (Owner === DockSteward) return DockSteward;
  if (!(Owner.prototype instanceof DockSteward)) throw new Error(`the owner’s steward is no subclass of the ${DOCK}’s steward`);
  const base = declared(DockSteward);
  const own = declared(Owner);
  for (const part of ['asks', 'needs', 'cells', 'roles'] as const) {
    const held = (base[part] ?? {}) as Record<string, unknown>;
    const given = (own[part] ?? {}) as Record<string, unknown>;
    for (const name of Object.keys(held)) if (given[name] !== held[name]) throw new Error(`the owner’s steward overrides the ${DOCK}’s ${name}, which is the library’s`);
  }
  const added = new Set<string>();
  for (let at = Owner.prototype as object; at !== DockSteward.prototype; at = Object.getPrototypeOf(at) as object) {
    for (const name of Object.getOwnPropertyNames(at)) {
      if (name === 'constructor') continue;
      if (KEPT.has(name)) throw new Error(`the owner’s steward overrides the ${DOCK}’s ${name}, which is the library’s`);
      added.add(name);
    }
  }
  // Her own class, so her methods run sealed and the owner's class stays as she wrote it.
  abstract class Sealing extends (Owner as unknown as typeof DockSteward) {}
  for (const name of added) {
    const descriptor = Object.getOwnPropertyDescriptor(Owner.prototype, name) ?? findDescriptor(Owner.prototype, name);
    if (descriptor === undefined) continue;
    const wrap = (run: (...given: unknown[]) => unknown) =>
      function (this: DockSteward, ...given: unknown[]) {
        return run.apply(sealedSelf(this, kinds), given);
      };
    Object.defineProperty(Sealing.prototype, name, {
      ...descriptor,
      ...(typeof descriptor.value === 'function' ? { value: wrap(descriptor.value as (...given: unknown[]) => unknown) } : {}),
      ...(descriptor.get === undefined ? {} : { get: wrap(descriptor.get) }),
      ...(descriptor.set === undefined ? {} : { set: wrap(descriptor.set) }),
    });
  }
  return Sealing;
};

const findDescriptor = (from: object, name: string): PropertyDescriptor | undefined => {
  for (let at: object | null = from; at !== null && at !== DockSteward.prototype; at = Object.getPrototypeOf(at) as object | null) {
    const found = Object.getOwnPropertyDescriptor(at, name);
    if (found !== undefined) return found;
  }
  return undefined;
};

/**
 * The dock's classes: the library's, the same on every ground, joined to
 * the owner's where she names them. Her steward is sealed. Her beings take
 * kinds of their own, never the library's. It throws why she is refused.
 */
export const dockClasses = (owner: readonly BeingClass[] = []): ClassList => {
  const hers = owner.filter((Class) => !LIBRARY.includes(Class));
  const stewards = hers.filter((Class) => declared(Class).kind === KINDS.steward);
  if (stewards.length > 1) throw new Error(`the owner names ${stewards.length} stewards of the ${DOCK}, and it takes one`);
  const beings = hers.filter((Class) => declared(Class).kind !== KINDS.steward);
  for (const Class of beings) {
    const { kind } = declared(Class);
    if (LIBRARY_KINDS.has(kind)) throw new Error(`the kind ${kind} is the ${DOCK}’s own, and no being of the owner’s takes it`);
  }
  const kinds = new Set(beings.map((Class) => declared(Class).kind));
  const steward = stewards.length === 0 ? DockSteward : sealedSteward(stewards[0], kinds);
  return new ClassList({ steward, beings: [...LIBRARY.slice(1), ...beings] });
};

/** The kinds of the owner's beings among classes, which the dock is offered bodies for. */
export const ownerKinds = (owner: readonly BeingClass[]): Set<string> =>
  new Set(owner.filter((Class) => !LIBRARY.includes(Class)).map((Class) => declared(Class).kind));

/** An owner's steward of the dock: the library's, and the asks, needs, cells and roles she adds, none of the library's taken again. */
export const dockSteward = <const A extends Record<string, Entry> = Record<never, never>, const N extends Record<string, Need> = Record<never, never>, C extends Record<string, Json> = Record<never, never>>(declaration: {
  readonly description?: string;
  readonly cells?: C;
  readonly needs?: N;
  readonly roles?: Declaration['roles'];
  readonly asks?: A;
}): (abstract new () => DockSteward & Typed<A> & { readonly [K in keyof N]: NeedFace<N[K]> } & { cells: C }) & Pick<typeof DockSteward, typeof DECLARATION> => {
  const base = declared(DockSteward);
  for (const part of ['asks', 'needs', 'cells', 'roles'] as const) {
    const taken = Object.keys(declaration[part] ?? {}).find((name) => Object.hasOwn(base[part] ?? {}, name));
    if (taken !== undefined) throw new TypeError(`the owner’s steward overrides the ${DOCK}’s ${taken}, which is the library’s`);
  }
  const merged: Declaration = {
    ...base,
    ...(declaration.description === undefined ? {} : { description: declaration.description }),
    cells: { ...declaration.cells, ...base.cells },
    needs: { ...declaration.needs, ...base.needs },
    roles: { ...declaration.roles, ...base.roles },
    asks: { ...declaration.asks, ...base.asks },
  };
  abstract class Owned extends DockSteward {}
  Object.defineProperty(Owned, DECLARATION, { value: merged });
  return Owned as never;
};
