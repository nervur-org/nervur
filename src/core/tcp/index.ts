// SPDX-License-Identifier: Apache-2.0
// Quo over TCP: `nervur/tcp`, an entry that names a platform, Node's
// sockets.
//
//   TcpCarrier    a Carrier that dials: bytes to a ward pk go in an ask
//                 frame to the `tcp://host:port` addresses its book holds
//                 for that pk, in their order
//   TcpListener   answers ask frames for the doors it is handed, a harbor
//                 among them, at a `tcp://` address
//   NodeSockets   both, as the body a Node terrain hands the TCP carrier
//
// A connection is opened per address, carries many asks at once, and is
// dropped when either side closes it; the next ask dials again. An ask
// goes to the next address only when the one before could not be dialed,
// since an ask a line took may have been heard.
import { connect, createServer, type Server, type Socket } from 'node:net';
import { hex, isHex, unhex } from '../crypto/index.ts';
import { Carrier } from '../contract/index.ts';
import { UNDIALED, type Arrivals, type Dialed, type Sockets } from '../harbor/index.ts';
import { tcpAddress, tcpAt, type TcpAddress } from '../quo/index.ts';
import { askFrame, FrameReader, nothingFrame, replyFrame } from '../line/index.ts';

// What a listener hands an ask to: bytes for a ward pk, or nothing.
export interface Doors {
  arrive(pk: string, bytes: Uint8Array): Promise<Uint8Array | null>;
}

const MAX_ID = 0xffff_ffff;

// The `tcp` addresses among some, in their order.
const tcpAddresses = (at: readonly string[]): TcpAddress[] => at.map(tcpAddress).filter((a): a is TcpAddress => a !== null);

class Line {
  readonly #socket: Socket;
  readonly #reader = new FrameReader();
  readonly #waiting = new Map<number, (box: Uint8Array | null) => void>();
  #next = 1;
  closed = false;

  constructor(socket: Socket, onClose: () => void) {
    this.#socket = socket;
    socket.on('data', (chunk: Buffer) => {
      for (const f of this.#reader.push(new Uint8Array(chunk))) {
        if (f.kind === 'ask') continue;
        const resolve = this.#waiting.get(f.id);
        this.#waiting.delete(f.id);
        resolve?.(f.kind === 'reply' ? f.box : null);
      }
      if (this.#reader.bad) socket.destroy();
    });
    socket.on('error', () => socket.destroy());
    socket.on('close', () => {
      this.closed = true;
      onClose();
      for (const resolve of this.#waiting.values()) resolve(null);
      this.#waiting.clear();
    });
  }

  static open(host: string, port: number, onClose: () => void): Promise<Line | null> {
    return new Promise((resolve) => {
      const socket = connect({ host, port });
      socket.once('connect', () => resolve(new Line(socket, onClose)));
      socket.once('error', () => {
        socket.destroy();
        resolve(null);
      });
    });
  }

  ask(pk: Uint8Array, box: Uint8Array): Promise<Uint8Array | null> {
    if (this.closed) return Promise.resolve(null);
    const id = this.#next;
    this.#next = this.#next === MAX_ID ? 1 : this.#next + 1;
    return new Promise((resolve) => {
      this.#waiting.set(id, resolve);
      this.#socket.write(askFrame(id, pk, box));
    });
  }

  close(): void {
    this.#socket.destroy();
  }
}

export class TcpCarrier extends Carrier {
  readonly #routes = new Map<string, TcpAddress[]>();
  readonly #lines = new Map<string, Promise<Line | null>>();

  // Where a ward pk is reached, replacing any route before: its `tcp`
  // addresses in order, the others skipped. A list with none is not
  // taken; null forgets the route.
  route(pk: string, at: readonly string[] | null): boolean {
    if (!isHex(pk, 64)) return false;
    if (at === null) return this.#routes.delete(pk) || true;
    const mine = tcpAddresses(at);
    if (mine.length === 0) return false;
    this.#routes.set(pk, mine);
    return true;
  }

  // Whether a ward pk has a route.
  routed(pk: string): boolean {
    return this.#routes.has(pk);
  }

  // Nothing where the pk has no route, no address is reached, or the
  // connection closed before an answer.
  carry(pk: string, bytes: Uint8Array): Promise<Uint8Array | null> {
    return this.#carry(this.#routes.get(pk) ?? [], pk, bytes);
  }

  // Bytes to a ward pk at the addresses named, as a route would carry them.
  carryAt(at: readonly string[], pk: string, bytes: Uint8Array): Promise<Uint8Array | null> {
    return isHex(pk, 64) ? this.#carry(tcpAddresses(at), pk, bytes) : Promise.resolve(null);
  }

  async #carry(addresses: readonly TcpAddress[], pk: string, bytes: Uint8Array): Promise<Uint8Array | null> {
    for (const address of addresses) {
      const out = await this.#dial(address, pk, bytes);
      if (out !== UNDIALED) return out;
    }
    return null;
  }

  // Bytes to a ward pk at one address, or `UNDIALED` where no line opens.
  dial(at: string, pk: string, bytes: Uint8Array): Promise<Dialed> {
    const address = tcpAddress(at);
    return address && isHex(pk, 64) ? this.#dial(address, pk, bytes) : Promise.resolve(UNDIALED);
  }

  async #dial(address: TcpAddress, pk: string, bytes: Uint8Array): Promise<Dialed> {
    const line = await this.#line(address);
    return line ? line.ask(unhex(pk), bytes) : UNDIALED;
  }

  #line({ host, port }: TcpAddress): Promise<Line | null> {
    const at = tcpAt(host, port);
    let line = this.#lines.get(at);
    if (!line) {
      line = Line.open(host, port, () => this.#lines.delete(at)).then((dialed) => {
        if (!dialed) this.#lines.delete(at);
        return dialed;
      });
      this.#lines.set(at, line);
    }
    return line;
  }

  async close(): Promise<void> {
    const lines = [...this.#lines.values()];
    this.#lines.clear();
    for (const line of await Promise.all(lines)) line?.close();
  }
}

export class TcpListener {
  readonly #server: Server;
  readonly #doors: Doors;
  readonly #sockets = new Set<Socket>();

  private constructor(doors: Doors) {
    this.#doors = doors;
    this.#server = createServer((socket) => this.#serve(socket));
  }

  // A listener on `host` and `port`, 127.0.0.1 and a free port unless named.
  static listen(doors: Doors, host = '127.0.0.1', port = 0): Promise<TcpListener> {
    const listener = new TcpListener(doors);
    return new Promise((resolve, reject) => {
      listener.#server.once('error', reject);
      listener.#server.listen(port, host, () => resolve(listener));
    });
  }

  // The `tcp://host:port` address this listener answers at.
  get at(): string {
    const address = this.#server.address() as { address: string; port: number };
    return tcpAt(address.address, address.port);
  }

  #serve(socket: Socket): void {
    this.#sockets.add(socket);
    const reader = new FrameReader();
    socket.on('data', (chunk: Buffer) => {
      for (const f of reader.push(new Uint8Array(chunk))) {
        if (f.kind === 'ask') void this.#answer(socket, f.id, f.pk, f.box);
      }
      if (reader.bad) socket.destroy();
    });
    socket.on('error', () => socket.destroy());
    socket.on('close', () => this.#sockets.delete(socket));
  }

  async #answer(socket: Socket, id: number, pk: Uint8Array, box: Uint8Array): Promise<void> {
    let reply: Uint8Array | null = null;
    try {
      reply = await this.#doors.arrive(hex(pk), box);
    } catch {
      reply = null;
    }
    if (!socket.destroyed) socket.write(reply === null ? nothingFrame(id) : replyFrame(id, reply));
  }

  close(): Promise<void> {
    for (const socket of this.#sockets) socket.destroy();
    return new Promise((resolve) => this.#server.close(() => resolve()));
  }
}

// Node's sockets under the TCP carrier: a dialer of its own for each
// carrier that asks, and a listener wherever it is told.
export class NodeSockets implements Sockets {
  readonly #dialer = new TcpCarrier();

  dial(address: string, pk: string, bytes: Uint8Array): Promise<Dialed> {
    return this.#dialer.dial(address, pk, bytes);
  }

  listen(ground: Arrivals, host: string, port: number): Promise<TcpListener> {
    return TcpListener.listen(ground, host, port);
  }

  close(): Promise<void> {
    return this.#dialer.close();
  }
}
