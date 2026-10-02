// SPDX-License-Identifier: Apache-2.0
// A faculty: one class every faculty extends, foundation and custom alike.
// The ground makes one instance on what it hands it, the body, and runs
// its hooks. Every hook is optional and answers a status: the base class
// answers each one ok and does nothing. A throw reads as a status not ok,
// so nothing a faculty does falls further than its own body.
import type { Json } from './being/being.ts';
import type { Schema } from './being/schema.ts';
import type { Handler } from './bodies/web-carry.ts';
import type { Memory } from './foundation.ts';
import type { OpenedContext } from './house/house.ts';
import type { Answer } from './house/rows-shape.ts';

/** What a hook answers: whether it holds, and why not where it does not. */
export interface Status {
  readonly ok: boolean;
  readonly why?: string;
}

/** The status an unwritten hook answers. */
export const OK: Status = Object.freeze({ ok: true });

/**
 * What a faculty takes: the args of its entry, held to a schema in the
 * house's subset, and each secret it takes, by name with what it holds.
 * Args that fail the schema are refused at the hand and stay down at the
 * boot. A secret is declared, never required: one read while it is absent
 * keeps the body down, waiting for it.
 */
export interface Takes {
  readonly args?: Schema;
  readonly secrets?: Readonly<Record<string, string>>;
}

/** One call of another body: its entry's name, the method, the args, and the call id. */
export interface Call {
  readonly faculty: string;
  readonly method: string;
  readonly args?: Json;
  readonly id?: string;
}

/** What the ground hands a faculty it makes: `this.made` in every hook. */
export interface Made {
  readonly name: string;
  readonly args: Readonly<Record<string, Json>>;
  /**
   * Each secret its entry names that the dock keeps. Reading one it takes
   * or names while it is absent throws, and the ground keeps the body down
   * waiting for it. `name in secrets` asks without waiting.
   */
  readonly secrets: Readonly<Record<string, string>>;
  /** Its own memory, sealed under a key the ground derives for its name alone. */
  readonly memory: Memory;
  /**
   * Bytes derived from the ground's key for this entry alone, under a
   * label of the faculty's. The same entry on the same key derives the
   * same bytes after any restart or restore, so a key it signs with is
   * never stored. Thirty-two bytes at least.
   */
  derive(label: string, length: number): Promise<Uint8Array>;
  /**
   * What each installer answered for a need of its class, keyed by the
   * need's kind: under `binaries`, each binary's absolute path. It is empty
   * where its class needs nothing, and nothing of it enters the process
   * environment.
   */
  readonly met: Readonly<Record<string, Json>>;
  /** The bodies its entry names in `faculties`: the ones it may call. */
  readonly faculties: readonly string[];
  /** A method of a body its entry names in `faculties`, answered, never thrown. */
  call(call: Call): Promise<Answer>;
  /** The ground's one listener, which a carry that serves HTTP serves. */
  readonly listener: Handler;
}

/** What one house receives of a body serving its memory or its code: the house's name, and the args its entry holds. */
export interface ForHouse {
  readonly house: string;
  readonly args: Readonly<Record<string, Json>>;
}

/** One example of a faculty: a method asked with its args and a call id, and the answer it gives, asked once and again. */
export interface FacultyExample {
  readonly method: string;
  readonly args?: Json;
  readonly id: string;
  readonly gives: Answer;
}

// What a faculty made outside a ground holds: nothing, and every read says so.
const unmade: Made = new Proxy({} as Made, {
  get: () => {
    throw new Error('a faculty made outside a ground holds nothing made');
  },
});

/**
 * Code a registry holds by name, one contained entity. Its statics are
 * what it declares: the blueprint it offers, what it takes, what it needs
 * of its terrain, its version, how long it remembers a call id, its fake
 * and its examples. Its instance is the body, and every hook reads
 * `this.made`.
 */
export abstract class Faculty {
  /** What it offers: a need of its own, or the foundation contract it fills. */
  static readonly blueprint: unknown;
  static readonly takes?: Takes;
  /** What it needs of its terrain, plain data by need kind, which an installer its entry names meets before `install`. */
  static readonly needs?: Readonly<Record<string, Json>>;
  /** The version of its code, which its twin keeps once its memory is brought to it. */
  static readonly version?: string;
  /** How long it remembers a call id, in milliseconds. */
  static readonly window?: number;
  /** The bench's stand-in: a faculty with the same blueprint that needs no terrain. */
  static readonly fake?: FacultyClass;
  /** What the bench asks of its body and its fake alike. */
  static readonly examples?: readonly FacultyExample[];
  /** Throws where a body breaks what it promises and no example can say. */
  static contract?(body: Faculty): void | Promise<void>;

  /** Its blueprint, where only its `up` learns it, as a program behind the bridge declares its own. */
  blueprint?: unknown;
  /** How long it remembers a call id, where only its `up` learns it. */
  window?: number;
  /** A handler the ground's listener chains, where it serves HTTP. */
  handler?: Handler;
  /** More faculties, which every entry naming it in `from` is raised from. */
  registry?: Registry;
  /** The schemes of the addresses a carry speaks. */
  schemes?: readonly string[];
  /** The port its listener holds once it is up, which its twin keeps as a cell. */
  port?: number;
  /** What one house receives of a body serving its memory or its code. */
  house?(options: ForHouse): unknown;
  /** Told when a house it is offered to opens, with the context that calls its tokens there. */
  opened?(context: OpenedContext): void | Promise<void>;

  readonly #made: Made;

  constructor(made: Made = unmade) {
    this.#made = made;
  }

  get made(): Made {
    return this.#made;
  }

  /** The slow work done once for each entry, after its needs are met. */
  install(): Status | Promise<Status> {
    return OK;
  }

  /** Its memory brought from the version its twin kept to its own, forward or back, before `up`. */
  migrate(_from: string): Status | Promise<Status> {
    return OK;
  }

  /** What it opens, opened. Reaching its world is no condition of standing. */
  up(): Status | Promise<Status> {
    return OK;
  }

  /** Whether it serves now, asked on demand and never on a clock. */
  health(): Status | Promise<Status> {
    return OK;
  }

  /** What `up` opened, let go. */
  down(): void | Promise<void> {}

  /** What `install` made, let go, once it is down and its entry removed. */
  uninstall(): Status | Promise<Status> {
    return OK;
  }
}

/** A class extending `Faculty`, as a registry holds it. */
export type FacultyClass = (new (made: Made) => Faculty) & {
  readonly blueprint: unknown;
  readonly takes?: Takes;
  readonly needs?: Readonly<Record<string, Json>>;
  readonly version?: string;
  readonly window?: number;
  readonly fake?: FacultyClass;
  readonly examples?: readonly FacultyExample[];
  contract?(body: Faculty): void | Promise<void>;
};

/** Code that holds faculties by name. */
export interface Registry {
  readonly faculties?: Readonly<Record<string, FacultyClass>>;
}
