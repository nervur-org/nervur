// SPDX-License-Identifier: Apache-2.0
// The server side of RFC 6455, as far as a held line needs it: the accept
// key, frames written plain, and a reader of masked frames that joins
// fragments into messages and stops at the first byte that breaks the RFC
// or a message longer than it takes.
import { createHash } from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export const OP = { continuation: 0x0, text: 0x1, binary: 0x2, close: 0x8, ping: 0x9, pong: 0xa } as const;

export const acceptKey = (key: string): string =>
  createHash('sha1')
    .update(key + GUID)
    .digest('base64');

export const isClientKey = (key: unknown): key is string => typeof key === 'string' && /^[A-Za-z0-9+/]{22}==$/.test(key);

// One frame as a server writes it: final, unmasked.
export const frameOf = (opcode: number, payload: Uint8Array = new Uint8Array(0)): Uint8Array => {
  const length = payload.length;
  const extended = length < 126 ? 0 : length < 65_536 ? 2 : 8;
  const out = new Uint8Array(2 + extended + length);
  const view = new DataView(out.buffer);
  out[0] = 0x80 | opcode;
  out[1] = extended === 0 ? length : extended === 2 ? 126 : 127;
  if (extended === 2) view.setUint16(2, length);
  if (extended === 8) view.setBigUint64(2, BigInt(length));
  out.set(payload, 2 + extended);
  return out;
};

export type WsEvent = { type: 'binary'; data: Uint8Array } | { type: 'text' } | { type: 'ping'; data: Uint8Array } | { type: 'close' } | { type: 'bad' };

// Frames a client wrote, masked, read as they come.
export class WsReader {
  readonly #max: number;
  #buffer = new Uint8Array(0);
  #parts: Uint8Array[] | null = null;
  #partsLength = 0;
  #partsText = false;
  #done = false;

  constructor(max: number) {
    this.#max = max;
  }

  push(chunk: Uint8Array): WsEvent[] {
    if (this.#done) return [];
    const joined = new Uint8Array(this.#buffer.length + chunk.length);
    joined.set(this.#buffer);
    joined.set(chunk, this.#buffer.length);
    this.#buffer = joined;
    const out: WsEvent[] = [];
    while (this.#buffer.length >= 2) {
      const b0 = this.#buffer[0]!;
      const b1 = this.#buffer[1]!;
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      if ((b0 & 0x70) !== 0 || !masked) return this.#bad(out);
      let length = b1 & 0x7f;
      let at = 2;
      const view = new DataView(this.#buffer.buffer, this.#buffer.byteOffset, this.#buffer.length);
      if (length === 126) {
        if (this.#buffer.length < 4) break;
        length = view.getUint16(2);
        at = 4;
      } else if (length === 127) {
        if (this.#buffer.length < 10) break;
        const long = view.getBigUint64(2);
        if (long > BigInt(this.#max)) return this.#bad(out);
        length = Number(long);
        at = 10;
      }
      const control = opcode >= 0x8;
      if (control && (length > 125 || !fin)) return this.#bad(out);
      if (!control && this.#partsLength + length > this.#max) return this.#bad(out);
      if (this.#buffer.length < at + 4 + length) break;
      const mask = this.#buffer.subarray(at, at + 4);
      const payload = this.#buffer.slice(at + 4, at + 4 + length);
      for (let i = 0; i < payload.length; i += 1) payload[i]! ^= mask[i & 3]!;
      this.#buffer = this.#buffer.slice(at + 4 + length);
      if (opcode === OP.close) {
        this.#done = true;
        out.push({ type: 'close' });
        return out;
      }
      if (opcode === OP.ping) out.push({ type: 'ping', data: payload });
      else if (opcode === OP.pong) continue;
      else if (opcode === OP.text || opcode === OP.binary) {
        if (this.#parts !== null) return this.#bad(out);
        if (fin) out.push(opcode === OP.text ? { type: 'text' } : { type: 'binary', data: payload });
        else {
          this.#parts = [payload];
          this.#partsLength = payload.length;
          this.#partsText = opcode === OP.text;
        }
      } else if (opcode === OP.continuation) {
        if (this.#parts === null) return this.#bad(out);
        this.#parts.push(payload);
        this.#partsLength += payload.length;
        if (fin) {
          const whole = new Uint8Array(this.#partsLength);
          let o = 0;
          for (const part of this.#parts) {
            whole.set(part, o);
            o += part.length;
          }
          out.push(this.#partsText ? { type: 'text' } : { type: 'binary', data: whole });
          this.#parts = null;
          this.#partsLength = 0;
        }
      } else return this.#bad(out);
    }
    return out;
  }

  #bad(out: WsEvent[]): WsEvent[] {
    this.#done = true;
    this.#buffer = new Uint8Array(0);
    out.push({ type: 'bad' });
    return out;
  }
}
