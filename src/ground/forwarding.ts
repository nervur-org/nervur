// SPDX-License-Identifier: Apache-2.0
// A faculty of a terrain whose body forwards its contract to an object its
// `up` opens: an unlock in a file, a ledger, a carry, a folder of code. The
// library's grounds write theirs so, and no entry exports it.
import type { Json } from '../being/being.ts';
import type { Handler } from '../bodies/web-carry.ts';
import { Faculty, OK, type FacultyClass, type ForHouse, type Made, type Registry, type Status, type Takes } from '../faculty.ts';
import type { OpenedContext } from '../house/house.ts';

/** What a forwarding faculty's `up` opens: the object its methods reach, and each part where it has one. */
export interface Opening {
  readonly object?: object;
  readonly blueprint?: unknown;
  readonly window?: number;
  readonly handler?: Handler;
  readonly registry?: Registry;
  readonly schemes?: readonly string[];
  readonly port?: number;
  house?(options: ForHouse): unknown;
  opened?(context: OpenedContext): void | Promise<void>;
  health?(): Status | Promise<Status>;
  down?(): void | Promise<void>;
}

/** The ground's hand asked through a primordial hand's `call`: what the hand answered, or the error that stopped it. */
export const handOf = async (call: Made['call'], request: unknown): Promise<unknown> => {
  const answered = await call({ faculty: 'ground', method: 'hand', args: request as Json });
  return 'result' in answered ? answered.result : answered;
};

// The names a body's own hooks and parts hold, which no forwarded method takes.
const OWN = new Set(['constructor', 'made', 'install', 'migrate', 'up', 'health', 'down', 'uninstall', 'opened', 'house', 'blueprint', 'window', 'handler', 'registry', 'schemes', 'port']);

// Every method an object holds, its own and its class's, by name.
const methodsOf = (object: object): string[] => {
  const names = new Set<string>();
  for (let at: object | null = object; at !== null && at !== Object.prototype; at = Object.getPrototypeOf(at) as object | null) {
    for (const name of Object.getOwnPropertyNames(at)) if (!OWN.has(name) && typeof (object as Record<string, unknown>)[name] === 'function') names.add(name);
  }
  return [...names];
};

/**
 * A faculty class whose body forwards every method of the object its
 * opening holds. `open` runs in `up`, so what it throws keeps the body
 * down with why.
 */
export const forwarding = (declared: { readonly blueprint?: unknown; readonly takes?: Takes }, open: (made: Made) => Opening | Promise<Opening>): FacultyClass =>
  class Forwarding extends Faculty {
    static override readonly blueprint = declared.blueprint;
    static override readonly takes = declared.takes;
    #opening: Opening | undefined;

    override async up(): Promise<Status> {
      const opening = await open(this.made);
      this.#opening = opening;
      const own = this as unknown as Record<string, unknown>;
      if (opening.blueprint !== undefined) this.blueprint = opening.blueprint;
      if (opening.window !== undefined) this.window = opening.window;
      if (opening.handler !== undefined) this.handler = opening.handler;
      if (opening.registry !== undefined) this.registry = opening.registry;
      if (opening.schemes !== undefined) this.schemes = opening.schemes;
      if (opening.port !== undefined) this.port = opening.port;
      if (opening.house !== undefined) this.house = opening.house.bind(opening);
      if (opening.opened !== undefined) this.opened = opening.opened.bind(opening);
      const { object } = opening;
      if (object !== undefined) for (const name of methodsOf(object)) own[name] = ((object as Record<string, (...args: unknown[]) => unknown>)[name]).bind(object);
      return OK;
    }

    override health(): Status | Promise<Status> {
      return this.#opening?.health?.() ?? OK;
    }

    override async down(): Promise<void> {
      await this.#opening?.down?.();
    }
  };
