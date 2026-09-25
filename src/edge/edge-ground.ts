// SPDX-License-Identifier: Apache-2.0
// The ground on an edge: one Durable Object, which the Worker hands every
// request. The object runs one event at a time and stands alone for its
// name, so it is the ground's one instance and takes no lock. It is woken
// per event: each wake runs the boot, a house opens when a box or the hand
// first reaches it, and an alarm opens every house so each arms its own
// times again. Its held lines hibernate, so an object with nothing to do
// but hold them may be evicted, and a message wakes it.
import type { Json } from '../being/being.ts';
import { ClassList } from '../bodies/class-list.ts';
import { WebCarry, type Handler, type Held, type HeldSocket } from '../bodies/web-carry.ts';
import type { BeingClass } from '../foundation.ts';
import { s } from '../being/schema.ts';
import { Ground, joinedRegistry, type Registry } from '../ground/ground.ts';
import { DurableClock } from './durable-clock.ts';
import { DurableMemory } from './durable-memory.ts';
import type { DurableStorage } from './durable.ts';
import { NativeCrypto } from './native-crypto.ts';
import { SecretUnlock } from './secret-unlock.ts';
import { SocketCarry, type Connect } from './socket-carry.ts';

/** A house's code as the deploy bundles it: what a folder's entry exports. */
export interface Code {
  readonly steward: BeingClass;
  readonly public?: BeingClass;
  readonly beings?: readonly BeingClass[];
}

export interface EdgeGroundOptions {
  /** The deploy's own registry, which joins the terrain's as the ladder's first rung. */
  readonly registry?: Registry;
  /** Each house's code by the name its entry's `bundle` body gives in `at`. */
  readonly code?: Readonly<Record<string, Code>>;
  /** The platform's outbound sockets, `connect` from `cloudflare:sockets`; an edge without it dials the web alone. */
  readonly connect?: Connect;
}

/** A WebSocket the object accepted, as the platform gives it. */
interface Socket {
  send(data: Uint8Array | string): void;
  close(code?: number, reason?: string): void;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

/** What the platform hands the object: its storage, and the hibernating WebSockets it accepts. */
export interface DurableState {
  readonly storage: DurableStorage;
  acceptWebSocket(socket: unknown): void;
}

interface Namespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

/** One request of the hand, as every terrain serves it. */
type HandRequest = Parameters<Ground['hand']>[0];

/** The ground's Durable Object, as the platform calls it. */
export interface EdgeObject {
  fetch(request: Request): Promise<Response>;
  webSocketMessage(socket: unknown, message: string | ArrayBuffer): Promise<void>;
  webSocketClose(socket: unknown): Promise<void>;
  webSocketError(socket: unknown): Promise<void>;
  alarm(): Promise<void>;
}

/** What one wake holds. */
interface Woken {
  readonly ground: Ground;
  readonly handlers: readonly Handler[];
}

/**
 * The bound on every ask: a minute, under the hundred seconds the web lets
 * a request wait for its first byte, so a watch answers before the line
 * that carries it is cut.
 */
const WAIT = 60_000;

/** Where the edge serves its hand. */
const HAND = '/nervur/hand';

// Two keys compared by their digests, so the time taken says nothing of where they differ.
const same = async (given: string, key: string): Promise<boolean> => {
  const digest = async (text: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  const [a, b] = await Promise.all([digest(given), digest(key)]);
  let differs = 0;
  for (let at = 0; at < a.length; at++) differs |= a[at] ^ b[at];
  return differs === 0;
};

const NONE = { args: s.object({}) } as const;
const WORDS = s.array(s.string());

// Words an entry's args list, or none.
const strings = (value: Json | undefined): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

const socketOf = (socket: Socket): HeldSocket => ({
  send: (data) => socket.send(data),
  close: () => socket.close(),
});

export const EdgeGround = Object.freeze({
  /**
   * The ground's Durable Object class, which the Worker's module exports
   * under the name its binding gives. The Worker's environment holds what
   * opens its drawer and its hand, and nothing else: `NERVUR_SECRET`, the
   * ground's key, sixty-four hex digits, and `NERVUR_HAND`, the key of its
   * hand, both set as secrets. Every other setting is an entry in the
   * drawer.
   */
  object({ registry, code = {}, connect }: EdgeGroundOptions = {}): new (state: DurableState, env: Readonly<Record<string, unknown>>) => EdgeObject {
    return class implements EdgeObject {
      readonly #state: DurableState;
      readonly #env: Readonly<Record<string, string | undefined>>;
      #woken: Promise<Woken> | undefined;
      readonly #held = new Map<Socket, Held>();

      constructor(state: DurableState, env: Readonly<Record<string, unknown>>) {
        this.#state = state;
        this.#env = Object.fromEntries(Object.entries(env).flatMap(([name, value]) => (typeof value === 'string' ? [[name, value]] : [])));
      }

      // The boot, once a wake: a boot that failed is run again by the next event.
      #wake(): Promise<Woken> {
        this.#woken ??= this.#boot();
        this.#woken.catch(() => (this.#woken = undefined));
        return this.#woken;
      }

      async #boot(): Promise<Woken> {
        const env = this.#env;
        const storage = this.#state.storage;
        const own: Registry = {
          faculties: {
            'secret-unlock': { takes: { args: s.object({ secret: s.string() }) }, up: ({ args }) => ({ serves: 'unlock', object: new SecretUnlock(args.secret as string) }) },
            // The hand, for whoever holds the key its args give; to anyone else, as on an edge that gives none, nothing is here.
            'key-hand': {
              takes: { args: s.object({ key: s.optional(s.string()) }) },
              up: ({ args, faculties }) => {
                const key = typeof args.key === 'string' ? args.key : undefined;
                const ground = faculties.ground as { hand(request: HandRequest): Promise<unknown> };
                return {
                  serves: 'hand',
                  handler: {
                    fetch: async (request: Request) => {
                      if (new URL(request.url).pathname !== HAND) return null;
                      const given = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
                      if (key === undefined || given === undefined || request.method !== 'POST' || !(await same(given, key))) return null;
                      let asked: HandRequest;
                      try {
                        asked = (await request.json()) as HandRequest;
                      } catch {
                        return Response.json({ error: { message: 'the hand takes one JSON object' } }, { status: 400 });
                      }
                      return Response.json(await ground.hand(asked));
                    },
                  },
                };
              },
            },
            durable: { takes: NONE, up: () => ({ serves: 'memory', object: new DurableMemory(storage, 'ground') }) },
            native: { takes: NONE, up: () => ({ serves: 'crypto', object: new NativeCrypto() }) },
            // The ground's clock, which the object's alarm, through the ground's wake, ends each due wait of.
            'durable-clock': { takes: NONE, up: () => ({ serves: 'clock', object: new DurableClock(storage) }) },
            web: {
              takes: { args: s.object({ allowPrivate: s.optional(s.boolean()), addresses: s.optional(WORDS), origins: s.optional(WORDS) }) },
              up: ({ args }) => {
                const web = new WebCarry({ allowPrivate: args.allowPrivate === true, origins: strings(args.origins), addresses: strings(args.addresses) });
                return { serves: 'carry', schemes: ['https', 'http', 'wss', 'ws'], object: web, handler: web };
              },
            },
            ...(connect === undefined
              ? {}
              : { socket: { takes: { args: s.object({ allowPrivate: s.optional(s.boolean()) }) }, up: ({ args }) => ({ serves: 'carry', schemes: ['tcp'], object: new SocketCarry({ connect, allowPrivate: args.allowPrivate === true }) }) } }),
            bundle: {
              takes: NONE,
              up: () => ({
                serves: 'classes',
                house: ({ args }) => {
                  const bundled = typeof args.at === 'string' && Object.hasOwn(code, args.at) ? code[args.at] : undefined;
                  if (bundled === undefined) throw new Error(`the deploy bundles no code named ${String(args.at)}`);
                  return new ClassList(bundled);
                },
              }),
            },
          },
        };
        const ground = await Ground.open({
          registry: joinedRegistry(own, registry ?? {}),
          // The unlock's args are the environment's, read once into its entry, which never lands in the drawer.
          primordial: {
            unlock: { make: 'secret-unlock', args: env.NERVUR_SECRET === undefined ? {} : { secret: env.NERVUR_SECRET } },
            memory: { make: 'durable' },
            crypto: { make: 'native' },
            tools: { make: 'strict' },
            clock: { make: 'durable-clock' },
            hand: { make: 'key-hand', args: env.NERVUR_HAND === undefined ? {} : { key: env.NERVUR_HAND }, faculties: ['ground'] },
          },
          // A Worker learns no name it is reached by before a request, so it writes only the addresses its entry gives.
          entries: {
            bundle: { make: 'bundle' },
            web: { make: 'web' },
            ...(connect === undefined ? {} : { tcp: { make: 'socket' } }),
          },
          wait: WAIT,
          lazy: true,
        });
        return { ground, handlers: [ground.handler] };
      }

      async fetch(request: Request): Promise<Response> {
        const { handlers } = await this.#wake();
        if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') return this.#upgrade(request, handlers);
        for (const handler of handlers) {
          const response = await handler.fetch(request);
          if (response !== null) return response;
        }
        return new Response(null, { status: 404 });
      }

      // A held line accepted to hibernate, what opened it kept beside it so a later wake opens it again.
      #upgrade(request: Request, handlers: readonly Handler[]): Response {
        for (const handler of handlers) {
          const taken = handler.upgrade?.(request);
          if (taken === null || taken === undefined) continue;
          const pair = new (globalThis as unknown as { WebSocketPair: new () => Record<'0' | '1', Socket> }).WebSocketPair();
          const [client, server] = [pair[0], pair[1]];
          this.#state.acceptWebSocket(server);
          server.serializeAttachment({ url: request.url, protocol: request.headers.get('sec-websocket-protocol'), origin: request.headers.get('origin') });
          this.#held.set(server, taken.open(socketOf(server)));
          return new Response(null, { status: 101, webSocket: client, headers: { 'sec-websocket-protocol': taken.protocol } } as ResponseInit);
        }
        return new Response(null, { status: 426 });
      }

      // What a hibernated line was opened by, opened again on this wake.
      async #heldOf(socket: Socket): Promise<Held | undefined> {
        const known = this.#held.get(socket);
        if (known !== undefined) return known;
        const { handlers } = await this.#wake();
        const { url, protocol, origin } = socket.deserializeAttachment() as { url: string; protocol: string | null; origin: string | null };
        const headers: Record<string, string> = {};
        if (protocol !== null) headers['sec-websocket-protocol'] = protocol;
        if (origin !== null) headers.origin = origin;
        for (const handler of handlers) {
          const taken = handler.upgrade?.(new Request(url, { headers }));
          if (taken === null || taken === undefined) continue;
          const held = taken.open(socketOf(socket));
          this.#held.set(socket, held);
          return held;
        }
        socket.close();
        return undefined;
      }

      /** A message on a held line, answered before the wake lets go. */
      async webSocketMessage(socket: Socket, message: string | ArrayBuffer): Promise<void> {
        const held = await this.#heldOf(socket);
        await held?.message(typeof message === 'string' ? message : new Uint8Array(message));
      }

      async webSocketClose(socket: Socket): Promise<void> {
        this.#held.get(socket)?.close();
        this.#held.delete(socket);
      }

      async webSocketError(socket: Socket): Promise<void> {
        await this.webSocketClose(socket);
      }

      /** The object's alarm: every house opens, so each arms its times again, and every wait due ends. */
      async alarm(): Promise<void> {
        const { ground } = await this.#wake();
        await ground.wake();
      }
    };
  },

  /** The Worker: every request goes to the ground's one object, by the binding's name. */
  worker({ binding = 'GROUND', name = 'ground' }: { binding?: string; name?: string } = {}) {
    return {
      fetch(request: Request, env: Readonly<Record<string, unknown>>): Promise<Response> {
        const namespace = env[binding] as Namespace | undefined;
        if (namespace === undefined) return Promise.resolve(new Response(`the Worker binds no Durable Object namespace ${binding}`, { status: 500 }));
        return namespace.get(namespace.idFromName(name)).fetch(request);
      },
    };
  },
});
