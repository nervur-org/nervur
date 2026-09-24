// SPDX-License-Identifier: Apache-2.0
// Quo over the web, as quo/CARRIER-WEB.md writes it: the post, one ask in
// one request, and the held line, a WebSocket carrying many asks at once.
// It opens no server. As a listener it is a handler the ground's one
// listener chains; as a dialer it posts and opens held lines itself.
import type { Carry, Sent } from '../foundation.ts';
import { ASK, NOTHING, PK, REPLY, body, privateHost, read } from '../quo/frame.ts';
import { vouchesOf } from './vouch.ts';

/** A WebSocket the ground's listener opened: bytes out, and closing. */
export interface HeldSocket {
  send(data: Uint8Array): void;
  close(): void;
}

/** What a handler does with a WebSocket once it is open. */
export interface Held {
  /** Settles once what the message asked is answered, so a ground woken per event holds its wake until then. */
  message(data: Uint8Array | string): void | Promise<void>;
  close(): void;
}

/**
 * Whatever speaks HTTP on a ground. `fetch` answers a request, or `null`
 * where it is not this handler's. `upgrade` takes a WebSocket: the
 * subprotocol it selects, and what it does once the socket is open.
 */
export interface Handler {
  fetch(request: Request): Promise<Response | null>;
  upgrade?(request: Request): { protocol: string; open(socket: HeldSocket): Held } | null;
}

type Door = (box: Uint8Array) => Promise<Uint8Array | null>;
type Answer = Uint8Array | 'unheard' | 'heard';

/** The longest post: a ward pk and the longest box. */
const LONGEST_POST = 1_048_640;
const PROTOCOL = 'quo';
// Errors of a connection never made: the box went nowhere.
const UNREACHED = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'UND_ERR_CONNECT_TIMEOUT']);

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const unhex = (text: string) => Uint8Array.from(text.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
const joined = (a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
};

interface Line {
  readonly socket: WebSocket;
  readonly pending: Map<number, (frame: { kind: number; rest: Uint8Array } | null) => void>;
  next: number;
}

export class WebCarry implements Carry, Handler {
  readonly #doors = new Map<string, Door>();
  readonly #lines = new Map<string, Promise<Line>>();
  readonly #path: string;
  readonly #addresses: readonly string[] | (() => readonly string[]);
  readonly #origins: ReadonlySet<string>;
  readonly #allowPrivate: boolean;
  readonly #wait: number;

  /**
   * `path` is where it listens under the ground's listener, `/quo` where
   * omitted. `addresses` are written into invitations, or read each time
   * where the listener's port is known only once it listens. `origins` are
   * the pages of other origins it answers, by the CORS protocol.
   */
  constructor({
    path = '/quo',
    addresses = [],
    origins = [],
    allowPrivate = false,
    wait = 30_000,
  }: { path?: string; addresses?: readonly string[] | (() => readonly string[]); origins?: readonly string[]; allowPrivate?: boolean; wait?: number } = {}) {
    this.#path = path;
    this.#addresses = addresses;
    this.#origins = new Set(origins);
    this.#allowPrivate = allowPrivate;
    this.#wait = wait;
  }

  /** A ward's door, answered on the post and on held lines alike. */
  listen({ ward, door }: { ward: string; door: Door }): void {
    this.#doors.set(ward, door);
  }

  /** A ward this handler answers no more. */
  unlisten({ ward }: { ward: string }): void {
    this.#doors.delete(ward);
  }

  at(_options: { toward?: string } = {}): readonly string[] {
    return typeof this.#addresses === 'function' ? this.#addresses() : this.#addresses;
  }

  /** The hosts of its `https` and `wss` addresses that vouch for the ward, each read over TLS. */
  vouched({ ward, at }: { ward: string; at: readonly string[] }): Promise<readonly string[]> {
    return vouchesOf({ fetcher: (url, init) => fetch(url, init), ward, at, schemes: ['https', 'wss'], allowPrivate: this.#allowPrivate, wait: this.#wait });
  }

  // ---- the listener ----

  #cors(request: Request): Record<string, string> {
    const origin = request.headers.get('origin');
    return origin !== null && (this.#origins.has(origin) || this.#origins.has('*')) ? { 'access-control-allow-origin': origin, vary: 'origin' } : {};
  }

  // A page reaches the door from its own host, or from an origin the carry
  // names. A request that names no origin is no page's, and is let in.
  #admits(request: Request): boolean {
    const origin = request.headers.get('origin');
    if (origin === null || this.#origins.has(origin) || this.#origins.has('*')) return true;
    try {
      return new URL(origin).host === new URL(request.url).host;
    } catch {
      return false;
    }
  }

  async fetch(request: Request): Promise<Response | null> {
    if (new URL(request.url).pathname !== this.#path) return null;
    const cors = this.#cors(request);
    if (request.method === 'OPTIONS' && 'access-control-allow-origin' in cors) {
      return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type' } });
    }
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: cors });
    if (!this.#admits(request)) return new Response(null, { status: 403 });
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length <= PK || bytes.length > LONGEST_POST) return new Response(null, { status: 400, headers: cors });
    const door = this.#doors.get(hex(bytes.subarray(0, PK)));
    if (door === undefined) return new Response(null, { status: 404, headers: cors });
    const reply = await door(bytes.slice(PK)).catch(() => null);
    if (reply === null) return new Response(null, { status: 204, headers: cors });
    return new Response(new Uint8Array(reply), { status: 200, headers: { ...cors, 'content-type': 'application/octet-stream' } });
  }

  upgrade(request: Request): { protocol: string; open(socket: HeldSocket): Held } | null {
    if (new URL(request.url).pathname !== this.#path) return null;
    const offered = (request.headers.get('sec-websocket-protocol') ?? '').split(',').map((protocol) => protocol.trim());
    if (!offered.includes(PROTOCOL) || !this.#admits(request)) return null;
    return {
      protocol: PROTOCOL,
      open: (socket) => ({
        message: (data) => {
          const frame = typeof data === 'string' ? null : read(data);
          if (frame === null) return socket.close();
          // A reply or a nothing frame is not a listener's to read.
          if (frame.kind !== ASK) return;
          const door = this.#doors.get(hex(frame.rest.subarray(0, PK)));
          return (door === undefined ? Promise.resolve(null) : door(frame.rest.slice(PK)).catch(() => null)).then((reply) => {
            try {
              socket.send(reply === null ? body(NOTHING, frame.id, new Uint8Array()) : body(REPLY, frame.id, reply));
            } catch {
              // The line went while the door answered.
            }
          });
        },
        close: () => undefined,
      }),
    };
  }

  // ---- the dialer ----

  async send({ ward, at, box, wait = this.#wait }: { ward: string; at: readonly string[]; box: Uint8Array; wait?: number }): Promise<Sent> {
    // A ward this carry listens for is on this ground: its door takes the box by pointer.
    const door = this.#doors.get(ward);
    if (door !== undefined) {
      const reply = await door(box).catch(() => null);
      if (reply !== null) return { reply };
    }
    for (const address of at) {
      let url: URL;
      try {
        url = new URL(address);
      } catch {
        continue;
      }
      if (!this.#allowPrivate && privateHost(url.hostname)) continue;
      const scheme = url.protocol.slice(0, -1);
      const answer = scheme === 'http' || scheme === 'https' ? await this.#post(address, ward, box, wait) : scheme === 'ws' || scheme === 'wss' ? await this.#held(address, ward, box, wait) : 'unheard';
      // A reply ends it; an ask that may have been heard is not carried again.
      if (answer === 'heard') return { reply: null, heard: true };
      if (answer !== 'unheard') return { reply: answer, via: address };
    }
    return { reply: null, heard: false };
  }

  async #post(address: string, ward: string, box: Uint8Array, wait: number): Promise<Answer> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), wait);
    try {
      // A redirect is never followed, so no answer leads the box to an address its check never read.
      const response = await fetch(address, { method: 'POST', body: joined(unhex(ward), box), signal: abort.signal, redirect: 'error' });
      if (response.status !== 200) {
        await response.body?.cancel();
        return 'unheard';
      }
      const reply = new Uint8Array(await response.arrayBuffer());
      return reply.length > 0 ? reply : 'unheard';
    } catch (error) {
      // A connection never made, or a port the fetch standard blocks, sent nothing.
      const cause = (error as { cause?: { code?: unknown; message?: unknown } }).cause;
      const unsent = (typeof cause?.code === 'string' && UNREACHED.has(cause.code)) || cause?.message === 'bad port';
      return !abort.signal.aborted && unsent ? 'unheard' : 'heard';
    } finally {
      clearTimeout(timer);
    }
  }

  async #held(address: string, ward: string, box: Uint8Array, wait: number): Promise<Answer> {
    let line: Line;
    try {
      line = await this.#line(address);
    } catch {
      return 'unheard';
    }
    const id = line.next;
    line.next = (line.next + 1) >>> 0;
    const answered = new Promise<{ kind: number; rest: Uint8Array } | null>((resolve) => line.pending.set(id, resolve));
    try {
      line.socket.send(body(ASK, id, joined(unhex(ward), box)));
    } catch {
      line.pending.delete(id);
      return 'unheard';
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), wait)));
    const frame = await Promise.race([answered, late]);
    clearTimeout(timer);
    line.pending.delete(id);
    if (frame === null) return 'heard';
    return frame.kind === REPLY ? frame.rest : 'unheard';
  }

  #line(address: string): Promise<Line> {
    let held = this.#lines.get(address);
    if (held === undefined) {
      held = new Promise<Line>((resolve, reject) => {
        const socket = new WebSocket(address, [PROTOCOL]);
        socket.binaryType = 'arraybuffer';
        const line: Line = { socket, pending: new Map(), next: 1 };
        let open = false;
        socket.onopen = () => {
          if (socket.protocol !== PROTOCOL) return socket.close();
          open = true;
          resolve(line);
        };
        socket.onmessage = (event) => {
          const frame = typeof event.data === 'string' ? null : read(new Uint8Array(event.data as ArrayBuffer));
          if (frame === null) return socket.close();
          // An ask is not a dialer's to read: nothing is said to it, and the line stands.
          if (frame.kind === ASK) return;
          line.pending.get(frame.id)?.(frame);
        };
        socket.onclose = () => {
          this.#lines.delete(address);
          for (const settle of line.pending.values()) settle(null);
          line.pending.clear();
          if (!open) reject(new Error(`no held line to ${address}`));
        };
        socket.onerror = () => undefined;
      });
      this.#lines.set(address, held);
      held.catch(() => this.#lines.delete(address));
    }
    return held;
  }

  /** Closes every held line it dialled. */
  async close(): Promise<void> {
    for (const line of this.#lines.values()) void line.then((held) => held.socket.close(), () => undefined);
    this.#lines.clear();
  }
}
