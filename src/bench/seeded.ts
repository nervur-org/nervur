// SPDX-License-Identifier: Apache-2.0
// What makes a bench run the same twice: bytes drawn from a seed, never
// from the platform. They are for tests alone and guard nothing.
import { NobleCrypto } from '../bodies/noble-crypto.ts';

/** A stream of bytes from a name: the same name, the same bytes. */
export const stream = (name: string) => {
  // FNV-1a over the name seeds xorshift32.
  let state = 0x811c9dc5;
  for (let at = 0; at < name.length; at++) state = Math.imul(state ^ name.charCodeAt(at), 0x01000193) >>> 0;
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

/** Sixty-four hex digits from a name. */
export const seedOf = (name: string): string => Array.from(stream(`seed:${name}`)(32), (byte) => byte.toString(16).padStart(2, '0')).join('');

/** The default crypto, with randomness drawn from a seed. */
export class SeededCrypto extends NobleCrypto {
  readonly #draw: (length: number) => Uint8Array;

  constructor(name: string) {
    super();
    this.#draw = stream(`random:${name}`);
  }

  override random(length: number): Uint8Array {
    return this.#draw(length);
  }
}
