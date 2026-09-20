// SPDX-License-Identifier: Apache-2.0
// Quo over the web, `quo/CARRIER-WEB.md`, on what every engine has: fetch
// and the WebSocket client.
//
//   WebDialer     bytes to a ward pk at an address: `http` and `https` as
//                 one post each, `ws` and `wss` on one held line per
//                 address, which many asks share
//
// A post that comes back with status 200 and a body is a reply, and every
// other status is nothing. A post the network refused, or a held line
// that did not open, was not dialed. A line that carried a box and closed
// answers nothing.
import { concat, hex, isHex, unhex } from '../crypto/index.ts';
import { UNDIALED, type Dialed } from '../harbor/index.ts';
import { webAddress, type WebAddress } from '../quo/index.ts';
import { askBody, readBody } from './frame.ts';

export const MIN_POST = 65;
export const MAX_POST = 64 + 1_048_576;
const MAX_ID = 0xffff_ffff;

// Bytes on a buffer of their own, as a body and a message take them.
const own = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(bytes);

// One held line to one address.
class HeldLine {
  readonly #socket: WebSocket;
  readonly #waiting = new Map<number, (box: Uint8Array | null) => void>();
  #next = 1;

  private constructor(socket: WebSocket) {
    this.#socket = socket;
    socket.binaryType = 'arraybuffer';
    socket.addEventListener('message', (e: MessageEvent) => {
      const frame = typeof e.data === 'string' ? null : readBody(new Uint8Array(e.data as ArrayBuffer));
      if (frame === null) return this.close();
      if (frame.kind === 'ask') return;
      const done = this.#waiting.get(frame.id);
      this.#waiting.delete(frame.id);
      done?.(frame.kind === 'reply' ? frame.box : null);
    });
    socket.addEventListener('close', () => {
      for (const done of this.#waiting.values()) done(null);
      this.#waiting.clear();
    });
  }

  // A line that opened with the subprotocol `quo`, or null.
  static open(href: string, onClose: () => void): Promise<HeldLine | null> {
    return new Promise((resolve) => {
      let socket: WebSocket;
      try {
        socket = new WebSocket(href, 'quo');
      } catch {
        resolve(null);
        return;
      }
      const line = new HeldLine(socket);
      socket.addEventListener('open', () => (socket.protocol === 'quo' ? resolve(line) : (socket.close(), resolve(null))));
      socket.addEventListener('close', () => {
        onClose();
        resolve(null);
      });
      socket.addEventListener('error', () => resolve(null));
    });
  }

  ask(pk: Uint8Array, box: Uint8Array): Promise<Uint8Array | null> {
    if (this.#socket.readyState !== WebSocket.OPEN) return Promise.resolve(null);
    const id = this.#next;
    this.#next = this.#next === MAX_ID ? 1 : this.#next + 1;
    return new Promise((resolve) => {
      this.#waiting.set(id, resolve);
      this.#socket.send(own(askBody(id, pk, box)));
    });
  }

  close(): void {
    this.#socket.close();
  }
}

export class WebDialer {
  readonly #lines = new Map<string, Promise<HeldLine | null>>();

  dial(at: string, pk: string, bytes: Uint8Array): Promise<Dialed> {
    const address = webAddress(at);
    if (address === null || !isHex(pk, 64)) return Promise.resolve(UNDIALED);
    return address.held ? this.#held(address, pk, bytes) : this.#post(address, pk, bytes);
  }

  async #post(address: WebAddress, pk: string, bytes: Uint8Array): Promise<Dialed> {
    let response: Response;
    try {
      response = await fetch(address.href, { method: 'POST', body: own(concat(unhex(pk), bytes)) });
    } catch {
      return UNDIALED;
    }
    const body = new Uint8Array(await response.arrayBuffer().catch(() => new ArrayBuffer(0)));
    return response.status === 200 && body.length > 0 ? body : null;
  }

  async #held(address: WebAddress, pk: string, bytes: Uint8Array): Promise<Dialed> {
    let line = this.#lines.get(address.href);
    if (!line) {
      line = HeldLine.open(address.href, () => this.#lines.delete(address.href));
      this.#lines.set(address.href, line);
      void line.then((held) => held ?? this.#lines.delete(address.href));
    }
    const held = await line;
    return held ? held.ask(unhex(pk), bytes) : UNDIALED;
  }

  async close(): Promise<void> {
    const lines = [...this.#lines.values()];
    this.#lines.clear();
    for (const line of await Promise.all(lines)) line?.close();
  }
}

// The ward pk and box a post carries, or null for a body that is no ask.
export const readPost = (body: Uint8Array): { pk: string; box: Uint8Array } | null =>
  body.length < MIN_POST || body.length > MAX_POST ? null : { pk: hex(body.subarray(0, 64)), box: body.slice(64) };
