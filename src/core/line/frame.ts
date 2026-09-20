// SPDX-License-Identifier: Apache-2.0
// The frames of `quo/CARRIER-TCP.md`, which the held line of
// `quo/CARRIER-WEB.md` carries too, one body to a message:
//
//   frame = length (4, big-endian) || body
//   body  = kind (1) || id (4, big-endian) || rest
//   00 ask      rest = ward pk (64) || box
//   01 reply    rest = box
//   02 nothing  rest = empty
//
// A reader says bytes are not a frame as soon as they say so, and reads
// nothing after them.
import { concat } from '../crypto/index.ts';

export const ASK = 0;
export const REPLY = 1;
export const NOTHING = 2;
export const MAX_BODY = 1_048_645;
const PK = 64;

export type Frame = { kind: 'ask'; id: number; pk: Uint8Array; box: Uint8Array } | { kind: 'reply'; id: number; box: Uint8Array } | { kind: 'nothing'; id: number };

const body = (kind: number, id: number, ...rest: Uint8Array[]): Uint8Array => {
  const head = new Uint8Array(5);
  head[0] = kind;
  new DataView(head.buffer).setUint32(1, id >>> 0);
  return concat(head, ...rest);
};
const framed = (b: Uint8Array): Uint8Array => {
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, b.length);
  return concat(length, b);
};

export const askBody = (id: number, pk: Uint8Array, box: Uint8Array): Uint8Array => body(ASK, id, pk, box);
export const replyBody = (id: number, box: Uint8Array): Uint8Array => body(REPLY, id, box);
export const nothingBody = (id: number): Uint8Array => body(NOTHING, id);
export const askFrame = (id: number, pk: Uint8Array, box: Uint8Array): Uint8Array => framed(askBody(id, pk, box));
export const replyFrame = (id: number, box: Uint8Array): Uint8Array => framed(replyBody(id, box));
export const nothingFrame = (id: number): Uint8Array => framed(nothingBody(id));

// Whether a body of this length, and this first byte when known, is no frame.
const notAFrame = (length: number, kind: number | undefined): boolean =>
  length > MAX_BODY || length < 5 || (kind !== undefined && (kind > NOTHING || (kind === ASK && length < 5 + PK) || (kind === NOTHING && length !== 5)));

// One whole body, read, or null for bytes that are no frame.
export const readBody = (b: Uint8Array): Frame | null => {
  if (notAFrame(b.length, b[0])) return null;
  const id = new DataView(b.buffer, b.byteOffset).getUint32(1);
  if (b[0] === ASK) return { kind: 'ask', id, pk: b.slice(5, 5 + PK), box: b.slice(5 + PK) };
  if (b[0] === REPLY) return { kind: 'reply', id, box: b.slice(5) };
  return { kind: 'nothing', id };
};

// Frames out of a stream, each with its length in front.
export class FrameReader {
  #buffer: Uint8Array = new Uint8Array(0);
  #bad = false;

  // True once bytes that are not a frame arrived; nothing is read after.
  get bad(): boolean {
    return this.#bad;
  }

  push(chunk: Uint8Array): Frame[] {
    if (this.#bad) return [];
    this.#buffer = this.#buffer.length === 0 ? chunk.slice() : concat(this.#buffer, chunk);
    const out: Frame[] = [];
    while (this.#buffer.length >= 4) {
      const length = new DataView(this.#buffer.buffer, this.#buffer.byteOffset).getUint32(0);
      if (notAFrame(length, this.#buffer.length > 4 ? this.#buffer[4] : undefined)) {
        this.#bad = true;
        this.#buffer = new Uint8Array(0);
        return out;
      }
      if (this.#buffer.length < 4 + length) break;
      const frame = readBody(this.#buffer.subarray(4, 4 + length))!;
      this.#buffer = this.#buffer.slice(4 + length);
      out.push(frame);
    }
    return out;
  }
}
