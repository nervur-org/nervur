// SPDX-License-Identifier: Apache-2.0
// The runner's side of a contained house. It opens the house on bodies
// that are messages to the ground: keys, memory, the carry and the clock's
// waits go out, and the time and the carry's addresses ride on every
// message in. Crypto and tools are pure, so they run here. Before any
// class loads, every global the house does not hand is taken away, so a
// species reaching one meets nothing.
import type { Json } from '../being/being.ts';
import { ClassList } from '../bodies/class-list.ts';
import { NobleCrypto } from '../bodies/noble-crypto.ts';
import { StrictTools } from '../bodies/strict-tools.ts';
import type { Carry, ClassesSource, Clock, Keys, Memory } from '../foundation.ts';
import { openHouse, type FacultyContext, type Offer, type Opened, type OpenedContext } from '../house/house.ts';

/** The runner's end of its thread, as its engine gives it. */
export interface Port {
  post(message: unknown): void;
  listen(heard: (message: unknown) => void): void;
}

/** What a runner keeps of its engine before the globals go: one turn of its event loop. */
export interface Engine {
  readonly turn: (next: () => void) => void;
}

/** The globals a house never hands a being: each reaches past the house. */
export const STRIPPED = [
  'process',
  'require',
  'module',
  'exports',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'WebSocketStream',
  'EventSource',
  'importScripts',
  'Worker',
  'SharedWorker',
  'BroadcastChannel',
  'postMessage',
  'onmessage',
  'addEventListener',
  'removeEventListener',
  'dispatchEvent',
  'close',
  'navigator',
  'location',
  'indexedDB',
  'caches',
  'localStorage',
  'sessionStorage',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'clearTimeout',
  'clearInterval',
  'clearImmediate',
  'Deno',
  'Bun',
] as const;

/** Each global the house does not hand, gone, or shadowed where the engine keeps it on a prototype. */
export const strip = (): void => {
  const scope = globalThis as Record<string, unknown>;
  for (const name of STRIPPED) {
    try {
      delete scope[name];
    } catch {
      // A global the engine will not delete is shadowed below.
    }
    if (name in scope) {
      try {
        Object.defineProperty(scope, name, { value: undefined, configurable: false, writable: false, enumerable: false });
      } catch {
        // A global the engine fixed in place stays, and a species reaching it reaches what the engine allows.
      }
    }
  }
};

/** Turns with no crypto in flight before the runner says its work ended: a chain between two calls resolves within one. */
const QUIET = 3;

/** Bytes drawn from a seed, the same seed the same bytes: a runner whose randomness must repeat, as the bench's does. */
const drawn = (seed: string) => {
  let state = 0x811c9dc5;
  for (let at = 0; at < seed.length; at++) state = Math.imul(state ^ seed.charCodeAt(at), 0x01000193) >>> 0;
  if (state === 0) state = 1;
  return (length: number): Uint8Array => {
    const out = new Uint8Array(length);
    for (let at = 0; at < length; at++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      out[at] = state & 0xff;
    }
    return out;
  };
};

/** The crypto a runner asks of the ground: every curve and the lattice. */
export const CURVES = ['signingPublic', 'sign', 'verify', 'agreePublic', 'agree', 'lockPair', 'encapsulate', 'decapsulate'] as const;

/** The library's crypto, each call counted while it is in flight, and its randomness from a seed where one is given. */
export class RunnerCrypto extends NobleCrypto {
  inFlight = 0;
  readonly #draw: ((length: number) => Uint8Array) | undefined;

  constructor(seed: string | undefined, ground: (method: string, args: unknown[]) => Promise<unknown>) {
    super();
    this.#draw = seed === undefined ? undefined : drawn(seed);
    const counted = this as unknown as Record<string, unknown>;
    // The curves and the lattice run on the ground's side, whose engine has compiled them hot; a fresh thread would run them cold.
    for (const name of CURVES) counted[name] = (...values: unknown[]) => ground(name, values);
    for (const name of ['sha256', 'hkdf', 'seal', 'open']) {
      const original = counted[name] as (...values: unknown[]) => Promise<unknown>;
      counted[name] = async (...values: unknown[]) => {
        this.inFlight++;
        try {
          return await original.apply(this, values);
        } finally {
          this.inFlight--;
        }
      };
    }
  }

  override random(length: number): Uint8Array {
    return this.#draw === undefined ? super.random(length) : this.#draw(length);
  }
}

interface Said {
  readonly t: string;
  readonly id?: number;
  readonly now?: number;
  readonly at?: readonly string[];
  readonly [field: string]: unknown;
}

interface Spec {
  readonly blueprint: { readonly name: string; readonly methods: Readonly<Record<string, unknown>> };
  readonly kinds?: readonly string[];
  readonly window?: number;
  readonly opened: boolean;
}

/** The runner: one house, opened on the first message and asked through every one after. */
export const inside = (port: Port, engine: Engine): void => {
  let now = 0;
  let at: readonly string[] = [];
  let next = 0;
  let house: Opened | undefined;
  let crypto: RunnerCrypto | undefined;
  const calls = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  // The context of each offer's opening, and of each method call in flight, which the ground's calls reach.
  const openedContexts = new Map<number, OpenedContext>();
  const contexts = new Map<number, FacultyContext>();

  const call = (body: string, method: string, args: unknown[], extra: Record<string, unknown> = {}): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const id = ++next;
      calls.set(id, { resolve, reject });
      port.post({ t: 'call', id, body, method, args, ...extra });
    });

  const keys: Keys = {
    ward: () => call('keys', 'ward', []) as ReturnType<Keys['ward']>,
    sign: (message) => call('keys', 'sign', [message]) as Promise<Uint8Array>,
    agree: (pk) => call('keys', 'agree', [pk]) as Promise<Uint8Array | null>,
    decapsulate: (ciphertext) => call('keys', 'decapsulate', [ciphertext]) as Promise<Uint8Array>,
    derive: (label, length) => call('keys', 'derive', [label, length]) as Promise<Uint8Array>,
  };
  const memory: Memory = {
    read: (options) => call('memory', 'read', [options]) as ReturnType<Memory['read']>,
    list: () => call('memory', 'list', []) as ReturnType<Memory['list']>,
    write: (options) => call('memory', 'write', [options]) as ReturnType<Memory['write']>,
  };
  const carry: Carry = {
    send: (options) => call('carry', 'send', [options]) as ReturnType<Carry['send']>,
    at: () => at,
    vouched: (options) => call('carry', 'vouched', [options]) as ReturnType<Carry['vouched']>,
  };
  const clock: Clock = {
    now: () => now,
    wait: (options) => call('clock', 'wait', [options]) as Promise<boolean>,
    cancel: (options) => port.post({ t: 'call', id: 0, body: 'clock', method: 'cancel', args: [options] }),
  };

  // Each offer as the house calls it: its methods and its opening go to the ground's side.
  const offerOf = (spec: Spec, index: number): Offer => ({
    blueprint: spec.blueprint,
    ...(spec.kinds === undefined ? {} : { kinds: spec.kinds }),
    ...(spec.window === undefined ? {} : { window: spec.window }),
    object: Object.fromEntries(
      Object.keys(spec.blueprint.methods).map((method) => [
        method,
        async (args: Json, context: FacultyContext) => {
          const n = ++next;
          contexts.set(n, context);
          try {
            return await call('offer', method, [args, { n, id: context.id, ...(context.watch === undefined ? {} : { watch: { until: context.watch.until } }) }], { offer: index });
          } finally {
            contexts.delete(n);
          }
        },
      ]),
    ),
    opened: async (context) => {
      openedContexts.set(index, context);
      if (spec.opened) await call('opened', '', [context.ward], { offer: index });
    },
  });

  const open = async (said: Said) => {
    strip();
    const source = said.source as ClassesSource;
    crypto = new RunnerCrypto(said.seed as string | undefined, (method, args) => call('crypto', method, args));
    const classes = await ClassList.load(source);
    const offers = (said.offers as Spec[]).map(offerOf);
    house = await openHouse({ keys, memory, classes, carry, clock, crypto, tools: new StrictTools() }, offers, said.wait === undefined ? {} : { wait: said.wait as number });
    port.post({ t: 'opened', ward: house.ward });
  };

  // One request of the ground's, answered.
  const answer = (id: number, run: () => Promise<unknown>) => {
    run().then(
      (value) => port.post({ t: 'answer', id, value }),
      (error: unknown) => port.post({ t: 'answer', id, error: error instanceof Error ? error.message : String(error) }),
    );
  };

  // The end of the work the last message began: once a run of turns passes
  // with no crypto in flight, the runner waits on the ground alone, and
  // says which message it ended on. It carries nothing of the house.
  let begun = 0;
  let told = 0;
  let still = 0;
  let turning = false;
  const turn = () => {
    still = (crypto?.inFlight ?? 0) === 0 ? still + 1 : 0;
    if (still < QUIET) {
      engine.turn(turn);
      return;
    }
    turning = false;
    if (told !== begun) {
      told = begun;
      port.post({ t: 'end', s: begun });
    }
  };

  port.listen((heard) => {
    const said = heard as Said;
    if (typeof said.now === 'number') now = said.now;
    if (Array.isArray(said.at)) at = said.at;
    if (typeof said.s === 'number') {
      begun = said.s;
      still = 0;
      if (!turning) {
        turning = true;
        engine.turn(turn);
      }
    }
    switch (said.t) {
      case 'open':
        open(said).catch((error: unknown) => port.post({ t: 'failed', message: error instanceof Error ? error.message : String(error) }));
        return;
      case 'ping':
        port.post({ t: 'pong' });
        return;
      case 'close':
        // The house closed whole: the thread holds nothing of it, and may open another.
        house = undefined;
        openedContexts.clear();
        contexts.clear();
        calls.clear();
        return;
      case 'reply': {
        const waiting = calls.get(said.id!);
        if (waiting === undefined) return;
        calls.delete(said.id!);
        if (typeof said.error === 'string') waiting.reject(new Error(said.error));
        else waiting.resolve(said.value);
        return;
      }
      case 'ask':
        answer(said.id!, () => house!.ask(said.request as Parameters<Opened['ask']>[0]));
        return;
      case 'door':
        answer(said.id!, () => house!.door(said.box as Uint8Array));
        return;
      case 'context':
        answer(said.id!, async () => {
          if (said.kind === 'same') return (await contexts.get(said.n as number)?.watch?.same(said.answer as never)) ?? false;
          const context = openedContexts.get(said.offer as number);
          if (context === undefined) return { error: { message: 'no such token' } };
          return said.kind === 'call' ? context.call(said.options as never) : context.describe(said.options as never);
        });
        return;
      default:
        return;
    }
  });
};
