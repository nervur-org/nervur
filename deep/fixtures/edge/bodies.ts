// The edge's bodies inside workerd, each reached from the test over HTTP:
// `POST /<body>/<op>` with its args as JSON, answered `{ result }` or
// `{ error }`. They live in one Durable Object, on its real storage, its
// real alarm and the platform's own sockets and Web Crypto.
import { connect } from 'cloudflare:sockets';
import { DurableClock, DurableMemory, NativeCrypto, SocketCarry, type DurableStorage } from 'nervur/edge';
import { fromWire, toWire } from './wire.ts';

interface Namespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

type Op = (args: Record<string, unknown>) => unknown;

export class Bodies {
  readonly #storage: DurableStorage;
  readonly #clock: DurableClock;
  readonly #crypto = new NativeCrypto();
  readonly #carry = new SocketCarry({ connect, allowPrivate: true });
  // Each wait by the token its asking was answered with, so a wait replaced under its id still ends as its own.
  readonly #waits = new Map<number, Promise<boolean>>();
  readonly #ops: Readonly<Record<string, Op>>;

  constructor(state: { storage: DurableStorage }) {
    this.#storage = state.storage;
    this.#clock = new DurableClock(state.storage);
    const memory = (name: unknown) => new DurableMemory(this.#storage, name as string);
    this.#ops = {
      'memory/read': ({ name, place }) => memory(name).read({ place: place as string }),
      'memory/list': ({ name }) => memory(name).list(),
      'memory/write': ({ name, writes, expect }) => memory(name).write({ writes: writes as never, expect: expect as never }),
      'clock/now': () => this.#clock.now(),
      'clock/wait': ({ id, ms }) => {
        const token = this.#waits.size;
        this.#waits.set(token, this.#clock.wait({ id: id as string, ms: ms as number }));
        return token;
      },
      'clock/waited': ({ token }) => this.#waits.get(token as number),
      'clock/cancel': ({ id }) => this.#clock.cancel({ id: id as string }),
      'crypto/call': ({ method, args }) => (this.#crypto as unknown as Record<string, (...given: unknown[]) => unknown>)[method as string](...(args as unknown[])),
      'carry/send': (args) => this.#carry.send(args as never),
      'carry/close': () => this.#carry.close(),
    };
  }

  async alarm(): Promise<void> {
    await this.#clock.alarm();
  }

  async fetch(request: Request): Promise<Response> {
    const op = this.#ops[new URL(request.url).pathname.slice(1)];
    if (op === undefined) return new Response(null, { status: 404 });
    try {
      const result = await op(fromWire(await request.json()) as Record<string, unknown>);
      return Response.json({ result: toWire(result) });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
}

export default {
  fetch: (request: Request, env: { BODIES: Namespace }) => env.BODIES.get(env.BODIES.idFromName('suite')).fetch(request),
};
