// SPDX-License-Identifier: Apache-2.0
// The bridge: a faculty written in any language, as a program the ground
// starts beside it. It speaks one JSON value a line on its standard
// streams. Its first answer, to `describe`, is its blueprint and its
// window, fixed for as long as its faculty stands. It starts with an
// empty environment beside what `env` names, and it is started again
// whenever it exits. The object the house holds never changes. It keeps
// its state in the faculty's memory, through lines of its own.
//
//   in   { id, method, args, call }          a call to the program
//   out  { id, result } | { id, error }      its answer
//   out  { id, token, args, call }           the program calls a handle
//   in   { id, result } | { id, error }      the house's answer to that
//   out  { id, memory, args }                the program reads or writes its memory
//   in   { id, result } | { id, error }      the ground's answer to that
//
// `id` pairs a line with its answer, and a program numbers its own lines.
// `call` is the call id: the house's on a call in, and the program's own
// on a call out, the same every time that call is sent, in any life of
// the program, so a handle called twice acts once. A memory line names
// `read`, `list` or `write`, with the memory contract's args, every
// entry's bytes in lowercase hex.
import { spawn, type ChildProcess } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { delimiter, isAbsolute, join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Json } from '../being/being.ts';
import { need } from '../being/need.ts';
import { StrictTools } from '../bodies/strict-tools.ts';
import type { Memory } from '../foundation.ts';
import type { Faculty } from '../ground/ground.ts';
import type { Answer, FacultyContext } from '../house/house.ts';

export interface BridgeOptions {
  /** The program, by path or by a name the ground's PATH finds. */
  readonly command: string;
  readonly args?: readonly string[];
  /** Everything the program's environment holds. The ground's own is never passed. */
  readonly env?: Readonly<Record<string, string>>;
  readonly cwd?: string;
  /** The faculty's own memory, which the program reads and writes by its memory lines. */
  readonly memory?: Memory;
  /** How long its `describe` may take, in milliseconds. */
  readonly wait?: number;
}

const tools = new StrictTools();

// The bytes of every entry a memory line writes, read from hex.
const writesOf = (writes: unknown): Record<string, Record<string, Uint8Array | null>> => {
  if (typeof writes !== 'object' || writes === null || Array.isArray(writes)) throw new TypeError('a write names its places in writes');
  return Object.fromEntries(
    Object.entries(writes).map(([place, entries]) => {
      if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) throw new TypeError(`the place ${place} is an object of entries`);
      return [
        place,
        Object.fromEntries(
          Object.entries(entries as Record<string, unknown>).map(([entry, hex]) => {
            if (hex === null) return [entry, null];
            const bytes = typeof hex === 'string' ? tools.bytes(hex) : null;
            if (bytes === null) throw new TypeError(`the entry ${entry} of ${place} holds no lowercase hex`);
            return [entry, bytes];
          }),
        ),
      ];
    }),
  );
};

const expectOf = (expect: unknown): Record<string, string | null> => {
  if (typeof expect !== 'object' || expect === null || Array.isArray(expect) || !Object.values(expect).every((version) => version === null || typeof version === 'string')) {
    throw new TypeError('a write names the versions it read in expect');
  }
  return expect as Record<string, string | null>;
};

// One memory line answered from the faculty's memory.
const remembered = async (memory: Memory | undefined, op: string, args: unknown): Promise<Answer> => {
  if (memory === undefined) return { error: { message: 'this program holds no memory' } };
  const given = (typeof args === 'object' && args !== null && !Array.isArray(args) ? args : {}) as Record<string, unknown>;
  try {
    if (op === 'read') {
      if (typeof given.place !== 'string') throw new TypeError('a read names its place');
      const { entries, version } = await memory.read({ place: given.place });
      return { result: { entries: Object.fromEntries(Object.entries(entries).map(([entry, bytes]) => [entry, tools.hex(bytes)])), version } };
    }
    if (op === 'list') return { result: [...(await memory.list())] };
    if (op === 'write') return { result: (await memory.write({ writes: writesOf(given.writes), expect: expectOf(given.expect) })) as Json };
    return { error: { message: `no memory line ${op}` } };
  } catch (error) {
    return { error: { message: error instanceof Error ? error.message : String(error) } };
  }
};

/** The longest line either side writes, as a Quo frame's bound. */
const LONGEST = 1_048_576;
const BACKOFF = 60_000;
// The contexts of recent calls, where a token the program calls back is sought.
const CONTEXTS = 32;

type Waiting = { readonly resolve: (answer: Answer) => void; readonly reject: (error: Error) => void };

// A name found on the ground's PATH, so the program's own empty environment needs none.
const located = (command: string): string => {
  if (isAbsolute(command) || command.includes('/')) return command;
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    const at = join(dir, command);
    try {
      accessSync(at, constants.X_OK);
      return at;
    } catch {
      // Not in this folder.
    }
  }
  throw new Error(`no program ${command} on the ground's PATH`);
};

class Bridge {
  readonly #options: BridgeOptions;
  readonly #command: string;
  #child: ChildProcess | undefined;
  #calls = new Map<number, Waiting>();
  #next = 0;
  #blueprint: string | undefined;
  #contexts: FacultyContext[] = [];
  #stopped = false;
  /** Why it was stopped for good: a program that described another blueprint than it did at the boot. */
  #refused: string | undefined;
  #failures = 0;
  #up: Promise<{ blueprint: Json; window?: number }> | undefined;

  constructor(options: BridgeOptions) {
    this.#options = options;
    this.#command = located(options.command);
  }

  // The program started, its describe read, and its blueprint held to the first one.
  start(): Promise<{ blueprint: Json; window?: number }> {
    this.#up = (async () => {
      const child = spawn(this.#command, [...(this.#options.args ?? [])], { cwd: this.#options.cwd, env: { ...this.#options.env }, stdio: ['pipe', 'pipe', 'pipe'] });
      this.#child = child;
      child.stdin.on('error', () => undefined);
      child.stderr.on('data', (chunk: Buffer) => process.stderr.write(`[${this.#options.command}] ${chunk.toString()}`));
      const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
      lines.on('line', (line) => this.#read(line));
      child.once('exit', () => this.#exited(child));
      // A program that describes nothing, or runs past the describe's wait, is ended, so its exit starts it again.
      const failed = (why: string) => {
        child.kill('SIGKILL');
        return new Error(`the program ${this.#options.command} ${why}`);
      };
      const described = await this.#send('describe', {}, undefined, this.#options.wait ?? 10_000).catch((error: unknown) => {
        throw failed(`described nothing: ${error instanceof Error ? error.message : String(error)}`);
      });
      if ('error' in described) throw failed(`described nothing: ${described.error.message}`);
      const result = described.result as { blueprint?: { name?: unknown; methods?: unknown }; window?: unknown };
      if (typeof result?.blueprint?.name !== 'string' || typeof result.blueprint.methods !== 'object') throw failed('described no blueprint');
      const text = JSON.stringify(result.blueprint);
      // Another blueprint than at the boot is refused and stopped for good: new code arrives when its faculty stands again.
      if (this.#blueprint !== undefined && this.#blueprint !== text) {
        this.#stopped = true;
        this.#refused = `the program ${this.#options.command} describes another blueprint than it did at the boot, and is stopped`;
        process.stderr.write(`[${this.#options.command}] ${this.#refused}\n`);
        throw failed('describes another blueprint than it did at the boot');
      }
      this.#blueprint = text;
      this.#failures = 0;
      return { blueprint: result.blueprint as Json, ...(typeof result.window === 'number' ? { window: result.window } : {}) };
    })();
    return this.#up;
  }

  #read(line: string): void {
    if (line.length > LONGEST) {
      this.#child?.kill('SIGKILL');
      return;
    }
    let message: { id?: unknown; token?: unknown; memory?: unknown; args?: unknown; call?: unknown; result?: unknown; error?: { message?: unknown } };
    try {
      message = JSON.parse(line) as typeof message;
    } catch {
      process.stderr.write(`[${this.#options.command}] a line that is no JSON: ${line.slice(0, 200)}\n`);
      return;
    }
    // The program reads or writes its memory.
    if (typeof message.memory === 'string') {
      const { id } = message;
      void remembered(this.#options.memory, message.memory, message.args).then((answer) => this.#write({ id, ...answer }));
      return;
    }
    // The program calls a handle it was handed.
    if (typeof message.token === 'string') {
      if (typeof message.call === 'string' && message.call !== '') void this.#callBack(message.id, message.token, message.args, message.call);
      else this.#write({ id: message.id, error: { message: 'a handle is called with a call id of the program’s own' } });
      return;
    }
    const waiting = typeof message.id === 'number' ? this.#calls.get(message.id) : undefined;
    if (waiting === undefined) return;
    this.#calls.delete(message.id as number);
    if ('result' in message) waiting.resolve({ result: message.result as Json });
    else waiting.resolve({ error: { message: typeof message.error?.message === 'string' ? message.error.message : 'the program failed' } });
  }

  // A token is answered by the house that handed it, found among the contexts of recent calls.
  async #callBack(id: unknown, token: string, args: unknown, call: string): Promise<void> {
    let answer: Answer = { error: { message: 'no such token' } };
    for (const context of [...this.#contexts].reverse()) {
      answer = await context.call({ token, args: (args ?? {}) as Json, id: call });
      if (!('error' in answer) || answer.error.message !== 'no such token') break;
    }
    this.#write({ id, ...answer });
  }

  #write(message: unknown): void {
    this.#child?.stdin?.write(`${JSON.stringify(message)}\n`);
  }

  #send(method: string, args: Json, call: string | undefined, wait?: number): Promise<Answer> {
    const child = this.#child;
    if (child === undefined || child.exitCode !== null || child.signalCode !== null) return Promise.reject(new Error(`the program ${this.#options.command} is down`));
    const id = ++this.#next;
    return new Promise<Answer>((resolve, reject) => {
      const timer = wait === undefined ? undefined : setTimeout(() => reject(new Error(`the program ${this.#options.command} did not describe itself in time`)), wait);
      this.#calls.set(id, {
        resolve: (answer) => {
          clearTimeout(timer);
          resolve(answer);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.#write({ id, method, args, ...(call === undefined ? {} : { call }) });
    });
  }

  // Every call in flight failed, as a crash fails it, and the program started again after a pause that grows.
  #exited(child: ChildProcess): void {
    if (this.#child !== child) return;
    for (const waiting of this.#calls.values()) waiting.reject(new Error(`the program ${this.#options.command} exited`));
    this.#calls.clear();
    if (this.#stopped) return;
    const pause = this.#failures === 0 ? 0 : Math.min(BACKOFF, 1_000 * 2 ** (this.#failures - 1));
    this.#failures++;
    setTimeout(() => {
      if (!this.#stopped) this.start().catch((error: unknown) => process.stderr.write(`[${this.#options.command}] ${error instanceof Error ? error.message : String(error)}\n`));
    }, pause).unref();
  }

  /** One call, as the house makes it. A throw is a failure to answer, and the house tries again. */
  async call(method: string, args: Json, context: FacultyContext): Promise<Answer> {
    this.#contexts = [...this.#contexts.filter((held) => held !== context), context].slice(-CONTEXTS);
    // A program refused for good answers why, which is final: asking again changes nothing until its ground restarts.
    const refused = () => (this.#refused === undefined ? undefined : { error: { message: this.#refused } });
    try {
      await this.#up;
    } catch (error) {
      const why = refused();
      if (why !== undefined) return why;
      throw error;
    }
    return refused() ?? this.#send(method, args, context.id);
  }

  async stop(): Promise<void> {
    this.#stopped = true;
    const child = this.#child;
    // A program ended by a signal has no exit code, and has exited all the same.
    if (child === undefined || child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    child.stdin?.end();
    const term = setTimeout(() => child.kill('SIGTERM'), 2_000);
    const kill = setTimeout(() => child.kill('SIGKILL'), 4_000);
    await exited;
    clearTimeout(term);
    clearTimeout(kill);
  }
}

/**
 * A program in any language, offered as a faculty: its blueprint and its
 * window from its own `describe`, and an object whose every method is a
 * line to it. It answers once the program has described itself.
 */
export const bridge = async (options: BridgeOptions): Promise<Faculty> => {
  const held = new Bridge(options);
  // A program that never described itself is offered to no one, so nothing starts it again.
  const { blueprint, window } = await held.start().catch(async (error: unknown) => {
    await held.stop();
    throw error;
  });
  const { name, methods } = blueprint as { name: string; methods: Record<string, object> };
  const object = Object.fromEntries(Object.keys(methods).map((method) => [method, (args: Json, context: FacultyContext) => held.call(method, args, context)]));
  return { blueprint: need(name, methods), object, ...(window === undefined ? {} : { window }), stop: () => held.stop() };
};
