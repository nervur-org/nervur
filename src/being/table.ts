// SPDX-License-Identifier: Apache-2.0
// A class resolved: her declaration checked and settled into the table the
// house reads. Every way a class fails is gathered, and the refusal names
// each one.
import { DECLARATION, MEMBERS, type Declaration, type Json, type Me } from './being.ts';
import { blueprintOf, method, WAIT_BOUND, type Blueprint, type BlueprintMethod } from './need.ts';
import { outside } from './schema.ts';

/** The roles the house names. */
export const HOUSE_ROLES: ReadonlySet<string> = new Set(['handle', 'stranger', 'steward', 'being', 'root']);

/** The state of a class that names none. */
export const READY = 'ready';

/** An ask's entry, settled. `null` is the entry's omission. */
export interface TableEntry extends BlueprintMethod {
  readonly method: string;
  /** Where the ask exists; `null`, every state. */
  readonly in: readonly string[] | null;
  /** Who may call it; `null`, every occupant but handles. */
  readonly for: readonly string[] | null;
  /** Where it may land; `null`, the state it began in. */
  readonly to: readonly string[] | null;
  /** Its author wrote `idempotent: false`, which a public being's default needs to know. */
  readonly effect: boolean;
  readonly examples: readonly Json[];
}

/** A class as the house reads her. */
export interface Table {
  readonly kind: string;
  readonly description?: string;
  readonly view?: string;
  readonly cells: Readonly<Record<string, Json>>;
  readonly needs: Readonly<Record<string, Blueprint>>;
  readonly roles: Readonly<Record<string, (asker: never, me: never) => boolean>>;
  readonly state: (me: Me<Record<string, Json>>) => string;
  /** The state of her default cells. */
  readonly first: string;
  readonly states: readonly string[];
  readonly asks: Readonly<Record<string, TableEntry>>;
}

/** A class the house will not resolve, and every reason why. */
export class Refused extends Error {
  readonly reasons: readonly string[];
  constructor(what: string, reasons: readonly string[]) {
    super(`${what} is refused: ${reasons.join('; ')}`);
    this.name = 'Refused';
    this.reasons = reasons;
  }
}

const KIND = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){2,}$/;
const VIEW_BYTES = 65_536;
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BLUEPRINT_NAME = /^[a-z][a-z0-9._-]*$/;
const ENTRY_FIELDS = new Set(['in', 'for', 'to', 'args', 'result', 'hints', 'examples', 'description', 'wait']);
const METHOD_FIELDS = new Set(['args', 'result', 'hints', 'description', 'wait']);
const HINTS = new Set(['readOnly', 'idempotent', 'destructive']);
const EXAMPLE_FIELDS = new Set(['description', 'cells', 'role', 'args', 'fakes', 'gives']);
const EVERY_OBJECT = new Set(Object.getOwnPropertyNames(Object.prototype));

const plain = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** Whether a value is JSON, as cells and notes hold. */
export const isJson = (value: unknown): value is Json => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  return plain(value) && Object.values(value).every(isJson);
};

const names = (value: unknown, where: string, reasons: string[]): readonly string[] | null => {
  if (value === undefined) return null;
  const list = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(list) || list.length === 0 || !list.every((name) => typeof name === 'string' && name.length > 0)) {
    reasons.push(`${where} is not a name or a list of names`);
    return [];
  }
  return Object.freeze([...new Set(list as string[])]);
};

// Args are always an object: one, or a choice of several, as a reply is.
const objectSchema = (schema: Record<string, unknown>): boolean =>
  schema.type === 'object' || (Array.isArray(schema.anyOf) && schema.anyOf.length > 0 && schema.anyOf.every((branch) => plain(branch) && objectSchema(branch)));

const methodChecked =(spec: unknown, fields: ReadonlySet<string>, where: string, reasons: string[]): BlueprintMethod | undefined => {
  if (!plain(spec)) {
    reasons.push(`${where} is not an object`);
    return undefined;
  }
  for (const key of Object.keys(spec)) if (!fields.has(key)) reasons.push(`${where} names ${key}, which is no field`);
  const { args, result, hints, description, wait } = spec;
  if (wait !== undefined && !(Number.isInteger(wait) && (wait as number) > 0 && (wait as number) <= WAIT_BOUND)) reasons.push(`${where}.wait is not a count of milliseconds within five minutes`);
  if (args !== undefined) {
    reasons.push(...outside(args, `${where}.args`));
    if (plain(args) && !objectSchema(args)) reasons.push(`${where}.args is not an object schema`);
  }
  if (result !== undefined) reasons.push(...outside(result, `${where}.result`));
  if (description !== undefined && typeof description !== 'string') reasons.push(`${where}.description is not a string`);
  if (hints !== undefined) {
    if (!plain(hints)) reasons.push(`${where}.hints is not an object`);
    else {
      for (const [key, value] of Object.entries(hints)) {
        if (!HINTS.has(key)) reasons.push(`${where}.hints names ${key}, which is no hint`);
        else if (typeof value !== 'boolean') reasons.push(`${where}.hints.${key} is not true or false`);
      }
      if (hints.readOnly === true && hints.idempotent === false) reasons.push(`${where} is readOnly and not idempotent`);
    }
  }
  return method(spec);
};

const blueprintChecked = (blueprint: Blueprint, where: string, reasons: string[]): Blueprint => {
  if (typeof blueprint.name !== 'string' || !BLUEPRINT_NAME.test(blueprint.name)) reasons.push(`${where} has a name that is no blueprint name`);
  for (const [name, spec] of Object.entries(blueprint.methods)) {
    if (!NAME.test(name)) reasons.push(`${where}.${name} is no method name`);
    methodChecked(spec, METHOD_FIELDS, `${where}.${name}`, reasons);
  }
  return blueprint;
};

const examplesChecked = (examples: unknown, where: string, reasons: string[]): readonly Json[] => {
  if (examples === undefined) return [];
  if (!Array.isArray(examples)) {
    reasons.push(`${where}.examples is not a list`);
    return [];
  }
  examples.forEach((example, index) => {
    if (!plain(example) || !isJson(example)) {
      reasons.push(`${where}.examples[${index}] is not a JSON object`);
      return;
    }
    for (const key of Object.keys(example)) if (!EXAMPLE_FIELDS.has(key)) reasons.push(`${where}.examples[${index}] names ${key}, which is no field`);
  });
  return Object.freeze([...examples]) as readonly Json[];
};

/** Her class checked and settled, or refused with every reason. */
export const resolve = (Class: unknown): Table => {
  const declaration = typeof Class === 'function' ? (Class as { [DECLARATION]?: Declaration })[DECLARATION] : undefined;
  if (declaration === undefined) throw new Refused('the class', ['it is not a class of Being.of']);
  const reasons: string[] = [];
  const kind = declaration.kind;
  if (typeof kind !== 'string' || !KIND.test(kind)) reasons.push('its kind is not a reversed domain and a name');
  const what = typeof kind === 'string' ? kind : 'the class';
  if (declaration.description !== undefined && typeof declaration.description !== 'string') reasons.push('its description is not a string');
  // A view is data a screen renders, never more than a screen holds.
  if (declaration.view !== undefined && (typeof declaration.view !== 'string' || new TextEncoder().encode(declaration.view).length > VIEW_BYTES)) reasons.push('its view is not text of at most 64 KiB');

  const cells = declaration.cells ?? {};
  if (!plain(cells) || !isJson(cells)) reasons.push('its cells are not a JSON object');

  // Needs, each a blueprint under her own member name.
  const needs: Record<string, Blueprint> = {};
  const declaredNeeds = declaration.needs ?? {};
  if (!plain(declaredNeeds)) reasons.push('its needs are not an object');
  else {
    for (const [member, value] of Object.entries(declaredNeeds)) {
      const blueprint = blueprintOf(value);
      if (blueprint === undefined) reasons.push(`its need ${member} is not a need`);
      else needs[member] = blueprintChecked(blueprint, `its need ${member}`, reasons);
    }
  }

  // Roles, the author's tests over the asker and her cells.
  const roles = declaration.roles ?? {};
  if (!plain(roles)) reasons.push('its roles are not an object');
  for (const [name, test] of Object.entries(plain(roles) ? roles : {})) {
    if (HOUSE_ROLES.has(name)) reasons.push(`its role ${name} is the house's`);
    if (typeof test !== 'function') reasons.push(`its role ${name} is not a function`);
  }

  // Asks, each an entry and a method.
  const asks: Record<string, TableEntry> = {};
  const declaredAsks = declaration.asks;
  if (!plain(declaredAsks)) reasons.push('its asks are not an object');
  const prototype = (Class as { prototype: object }).prototype;
  for (const [name, entry] of Object.entries(plain(declaredAsks) ? declaredAsks : {})) {
    const where = `its ask ${name}`;
    if (!NAME.test(name)) reasons.push(`${where} is no method name`);
    const settled = methodChecked(entry, ENTRY_FIELDS, where, reasons);
    if (settled === undefined) continue;
    const raw = entry;
    if (typeof (prototype as Record<string, unknown>)[name] !== 'function') reasons.push(`${where} has no method`);
    asks[name] = Object.freeze({
      ...settled,
      method: name,
      in: names(raw.in, `${where}.in`, reasons),
      for: names(raw.for, `${where}.for`, reasons),
      to: names(raw.to, `${where}.to`, reasons),
      effect: raw.hints?.idempotent === false,
      examples: examplesChecked(raw.examples, where, reasons),
    });
  }

  // Member names: a need, an ask, a member of Being and her own methods.
  const own = new Set<string>();
  for (let proto = prototype; proto !== null && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
    for (const key of Object.getOwnPropertyNames(proto)) if (key !== 'constructor') own.add(key);
  }
  for (const member of Object.keys(needs)) {
    if (member in asks) reasons.push(`its need ${member} and its ask ${member} share a name`);
    if (MEMBERS.has(member)) reasons.push(`its need ${member} and Being's ${member} share a name`);
    if (own.has(member)) reasons.push(`its need ${member} and its method ${member} share a name`);
    if (EVERY_OBJECT.has(member)) reasons.push(`its need ${member} is a member of every object`);
  }
  for (const name of Object.keys(asks)) {
    if (MEMBERS.has(name)) reasons.push(`its ask ${name} and Being's ${name} share a name`);
    if (EVERY_OBJECT.has(name)) reasons.push(`its ask ${name} is a member of every object`);
  }

  // The state, and the state of her default cells.
  const state = declaration.state ?? (() => READY);
  let first = READY;
  if (declaration.state !== undefined) {
    if (typeof declaration.state !== 'function') reasons.push('its state is not a function');
    else {
      try {
        first = declaration.state({ id: '', position: 'normal', cells: cells });
      } catch {
        reasons.push('its state throws on its default cells');
      }
      if (typeof first !== 'string' || first.length === 0) reasons.push('its state names no state on its default cells');
    }
  }

  const states = table(asks, roles, first, declaration.state !== undefined, reasons);
  if (reasons.length > 0) throw new Refused(what, reasons);
  return Object.freeze({
    kind,
    ...(declaration.description === undefined ? {} : { description: declaration.description }),
    ...(declaration.view === undefined ? {} : { view: declaration.view }),
    cells: cells,
    needs: Object.freeze(needs),
    roles: Object.freeze({ ...roles }),
    state: state,
    first,
    states,
    asks: Object.freeze(asks),
  });
};

// The table: every state reached from the first, every ask reached by a
// role, and every role named by an ask. A terminal state is allowed.
const table = (asks: Record<string, TableEntry>, roles: object, first: string, stated: boolean, reasons: string[]): readonly string[] => {
  const named = new Set([first]);
  for (const entry of Object.values(asks)) for (const name of [...(entry.in ?? []), ...(entry.to ?? [])]) named.add(name);
  if (!stated) for (const name of named) if (name !== READY) reasons.push(`it names the state ${name} and has no state of its own`);

  const reached = new Set([first]);
  const queue = [first];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const entry of Object.values(asks)) {
      if (entry.in !== null && !entry.in.includes(at)) continue;
      for (const next of entry.to ?? [at]) {
        if (reached.has(next)) continue;
        reached.add(next);
        queue.push(next);
      }
    }
  }
  for (const name of named) if (!reached.has(name)) reasons.push(`no ask reaches the state ${name}`);

  const declared = new Set(Object.keys(roles));
  const used = new Set<string>();
  for (const entry of Object.values(asks)) {
    for (const role of entry.for ?? []) {
      used.add(role);
      if (!declared.has(role) && !HOUSE_ROLES.has(role)) reasons.push(`its ask ${entry.method} is for ${role}, which is no role`);
    }
  }
  for (const role of declared) if (!used.has(role)) reasons.push(`its role ${role} is named by no ask`);
  return Object.freeze([...named]);
};
