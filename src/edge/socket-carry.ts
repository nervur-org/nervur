// SPDX-License-Identifier: Apache-2.0
// Quo over TCP from an edge, as quo/CARRIER-TCP.md writes it, over the
// platform's outbound sockets. It only dials: an edge listens on the web
// alone, so it keeps no door and names no address. One connection a
// dialled address carries many asks at once, each framed by kind and id.
import type { Carry, Sent } from '../foundation.ts';
import { ASK, Frames, REPLY, framed, parseAddress, privateHost } from '../quo/frame.ts';

/** An outbound socket, as a Worker's `connect()` gives it. */
export interface Socket {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
  readonly opened: Promise<unknown>;
  close(): Promise<void>;
}

/** Opens a socket to a host and port: `connect` from `cloudflare:sockets`. */
export type Connect = (address: { hostname: string; port: number }) => Socket;

interface Dialled {
  readonly socket: Socket;
  readonly writer: WritableStreamDefaultWriter<Uint8Array>;
  readonly pending: Map<number, (answer: { kind: number; box: Uint8Array } | null) => void>;
  next: number;
}

const unhex = (text: string) => Uint8Array.from(text.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));

export class SocketCarry implements Carry {
  readonly #connect: Connect;
  readonly #allowPrivate: boolean;
  readonly #wait: number;
  readonly #dialled = new Map<string, Promise<Dialled>>();

  /** `connect` is the platform's. A private or loopback host is judged as written, since an edge resolves no name. */
  constructor({ connect, allowPrivate = false, wait = 30_000 }: { connect: Connect; allowPrivate?: boolean; wait?: number }) {
    this.#connect = connect;
    this.#allowPrivate = allowPrivate;
    this.#wait = wait;
  }

  /** None: an edge is reached on the web. */
  at(_options: { toward?: string } = {}): readonly string[] {
    return [];
  }

  /** None: TCP names no domain, and a vouch is read on the web. */
  vouched(_options: { ward: string; at: readonly string[] }): Promise<readonly string[]> {
    return Promise.resolve([]);
  }

  async send({ ward, at, box, wait = this.#wait }: { ward: string; at: readonly string[]; box: Uint8Array; wait?: number }): Promise<Sent> {
    for (const address of at) {
      const parsed = parseAddress(address);
      if (parsed === null || (!this.#allowPrivate && privateHost(parsed.host))) continue;
      const answer = await this.#ask(address, parsed, ward, box, wait);
      // A reply ends it; an ask that may have been heard is not carried again.
      if (answer === 'heard') return { reply: null, heard: true };
      if (answer !== null) return { reply: answer, via: address };
    }
    return { reply: null, heard: false };
  }

  /** Every connection closed, and every ask in flight answered nothing. */
  async close(): Promise<void> {
    const dialled = [...this.#dialled.values()];
    this.#dialled.clear();
    for (const held of dialled) void held.then((line) => line.socket.close(), () => undefined);
  }

  async #ask(address: string, target: { host: string; port: number }, ward: string, box: Uint8Array, wait: number): Promise<Uint8Array | null | 'heard'> {
    let dialled: Dialled;
    try {
      dialled = await this.#dial(address, target);
    } catch {
      return null;
    }
    const id = dialled.next;
    dialled.next = (dialled.next + 1) >>> 0;
    const answered = new Promise<{ kind: number; box: Uint8Array } | null>((resolve) => dialled.pending.set(id, resolve));
    const whole = new Uint8Array(64 + box.length);
    whole.set(unhex(ward));
    whole.set(box, 64);
    // A write that fails leaves the line, which answers every ask on it nothing.
    dialled.writer.write(framed(ASK, id, whole)).catch(() => void dialled.socket.close().catch(() => undefined));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<'late'>((resolve) => (timer = setTimeout(() => resolve('late'), wait)));
    const answer = await Promise.race([answered, late]);
    clearTimeout(timer);
    dialled.pending.delete(id);
    if (answer === 'late' || answer === null) return 'heard';
    return answer.kind === REPLY ? answer.box : null;
  }

  #dial(address: string, { host, port }: { host: string; port: number }): Promise<Dialled> {
    let held = this.#dialled.get(address);
    if (held === undefined) {
      held = (async () => {
        const socket = this.#connect({ hostname: host, port });
        await socket.opened;
        const dialled: Dialled = { socket, writer: socket.writable.getWriter(), pending: new Map(), next: 1 };
        void this.#read(address, dialled);
        return dialled;
      })();
      this.#dialled.set(address, held);
      held.catch(() => this.#dialled.delete(address));
    }
    return held;
  }

  // Replies read off the line until it ends; then every ask still on it answers nothing.
  async #read(address: string, dialled: Dialled): Promise<void> {
    const frames = new Frames();
    const reader = dialled.socket.readable.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const whole = frames.take(value, ({ kind, id, rest }) => {
          if (kind === ASK) return;
          dialled.pending.get(id)?.({ kind, box: rest });
        });
        if (!whole) break;
      }
    } catch {
      // The line went.
    }
    if ((await this.#dialled.get(address)?.catch(() => undefined)) === dialled) this.#dialled.delete(address);
    for (const settle of dialled.pending.values()) settle(null);
    dialled.pending.clear();
    await dialled.socket.close().catch(() => undefined);
  }
}
