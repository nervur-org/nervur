// SPDX-License-Identifier: Apache-2.0
// Quo over TCP, as quo/CARRIER-TCP.md writes it: one listener for every
// ward behind it, and one connection a dialled address, carrying many
// asks at once, each framed by kind and id.
import { lookup } from 'node:dns/promises';
import { isIP, createConnection, createServer, type Server, type Socket } from 'node:net';
import type { Carry, Sent } from '../foundation.ts';
import { ASK, Frames, NOTHING, PK, REPLY, framed, parseAddress, privateAddress } from '../quo/frame.ts';

// How long a line lies still before the system asks the far end whether it is there: under a router's forgetting.
const KEEPALIVE = 25_000;

export { parseAddress, privateAddress } from '../quo/frame.ts';

/** What listens: a ward's name and its door. */
export interface Listened {
  readonly ward: string;
  door(box: Uint8Array): Promise<Uint8Array | null>;
}

interface Dialled {
  socket: Socket;
  pending: Map<number, (answer: { kind: number; box: Uint8Array } | null) => void>;
  next: number;
}

export class TcpCarry implements Carry {
  readonly #port: number;
  readonly #host: string;
  readonly #addresses: readonly string[] | undefined;
  readonly #allowPrivate: boolean;
  readonly #wait: number;
  readonly #doors = new Map<string, Listened['door']>();
  readonly #dialled = new Map<string, Promise<Dialled>>();
  readonly #accepted = new Set<Socket>();
  #server: Server | undefined;
  #bound: number | undefined;

  constructor({ port = 0, host = '0.0.0.0', addresses, allowPrivate = false, wait = 30_000 }: { port?: number; host?: string; addresses?: readonly string[]; allowPrivate?: boolean; wait?: number } = {}) {
    this.#port = port;
    this.#host = host;
    this.#addresses = addresses;
    this.#allowPrivate = allowPrivate;
    this.#wait = wait;
  }

  /** Answers for a house's ward on this carry's listener, which starts with the first. */
  async listen({ ward, door }: Listened): Promise<void> {
    this.#doors.set(ward, door);
    if (this.#server !== undefined) return;
    const server = createServer((socket) => this.#answer(socket));
    this.#server = server;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.#port, this.#host, () => {
        const address = server.address();
        this.#bound = typeof address === 'object' && address !== null ? address.port : this.#port;
        resolve();
      });
    });
  }

  /** A ward this listener answers no more. */
  unlisten({ ward }: { ward: string }): void {
    this.#doors.delete(ward);
  }

  /** The listener closed, every connection with it, and every ask in flight answered nothing. */
  async close(): Promise<void> {
    for (const socket of this.#accepted) socket.destroy();
    for (const dialled of this.#dialled.values()) void dialled.then((held) => held.socket.destroy(), () => undefined);
    this.#dialled.clear();
    const server = this.#server;
    this.#server = undefined;
    if (server !== undefined) await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  /** The addresses the house writes into an invitation, whoever it goes toward. */
  at(_options: { toward?: string } = {}): readonly string[] {
    if (this.#addresses !== undefined) return this.#addresses;
    if (this.#bound === undefined) return [];
    const host = this.#host === '0.0.0.0' ? '127.0.0.1' : this.#host.includes(':') ? `[${this.#host}]` : this.#host;
    return [`tcp://${host}:${this.#bound}`];
  }

  /** None: TCP names no domain, and a vouch is read on the web. */
  vouched(_options: { ward: string; at: readonly string[] }): Promise<readonly string[]> {
    return Promise.resolve([]);
  }

  #answer(socket: Socket) {
    this.#accepted.add(socket);
    socket.setKeepAlive(true, KEEPALIVE);
    socket.on('close', () => this.#accepted.delete(socket));
    socket.on('error', () => socket.destroy());
    const frames = new Frames();
    socket.on('data', (chunk: Buffer) => {
      const read = frames.take(chunk, ({ kind, id, rest }) => {
        if (kind !== ASK) return;
        const ward = Buffer.from(rest.subarray(0, PK)).toString('hex');
        const door = this.#doors.get(ward);
        if (door === undefined) {
          socket.write(framed(NOTHING, id, new Uint8Array(0)));
          return;
        }
        door(rest.slice(PK)).then(
          (reply) => {
            if (!socket.destroyed) socket.write(reply === null ? framed(NOTHING, id, new Uint8Array(0)) : framed(REPLY, id, reply));
          },
          () => {
            if (!socket.destroyed) socket.write(framed(NOTHING, id, new Uint8Array(0)));
          },
        );
      });
      if (!read) socket.destroy();
    });
  }

  async send({ ward, at, box, wait = this.#wait }: { ward: string; at: readonly string[]; box: Uint8Array; wait?: number }): Promise<Sent> {
    // A ward this carry listens for is on this ground: its door takes the box by pointer.
    const door = this.#doors.get(ward);
    if (door !== undefined) {
      const reply = await door(box).catch(() => null);
      if (reply !== null) return { reply };
    }
    for (const address of at) {
      const parsed = parseAddress(address);
      if (parsed === null) continue;
      const answer = await this.#ask(address, parsed, ward, box, wait);
      // A reply ends it; an ask that may have been heard is not carried again.
      if (answer === 'heard') return { reply: null, heard: true };
      if (answer !== null) return { reply: answer, via: address };
    }
    return { reply: null, heard: false };
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
    dialled.socket.write(framed(ASK,id, new Uint8Array([...Buffer.from(ward, 'hex'), ...box])));
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
        const ip = isIP(host) === 0 ? (await lookup(host)).address : host;
        if (!this.#allowPrivate && privateAddress(ip)) throw new Error(`${address} is private, and this carry does not send there`);
        const socket = createConnection({ host: ip, port });
        await new Promise<void>((resolve, reject) => {
          socket.once('connect', resolve);
          socket.once('error', reject);
        });
        // A line a router would forget while a watch is held is kept warm by the system.
        socket.setKeepAlive(true, KEEPALIVE);
        const dialled: Dialled = { socket, pending: new Map(), next: 1 };
        const frames = new Frames();
        const drop = () => {
          this.#dialled.delete(address);
          for (const resolve of dialled.pending.values()) resolve(null);
          dialled.pending.clear();
        };
        socket.on('data', (chunk: Buffer) => {
          const read = frames.take(chunk, ({ kind, id, rest }) => {
            if (kind === ASK) return;
            dialled.pending.get(id)?.({ kind, box: new Uint8Array(rest) });
          });
          if (!read) socket.destroy();
        });
        socket.on('close', drop);
        socket.on('error', () => socket.destroy());
        return dialled;
      })();
      this.#dialled.set(address, held);
      held.catch(() => this.#dialled.delete(address));
    }
    return held;
  }
}
