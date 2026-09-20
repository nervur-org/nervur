// SPDX-License-Identifier: Apache-2.0
// Bytes and the one text spelling Quo gives them: hex, two lowercase digits
// a byte.
const DIGITS = Array.from({ length: 256 }, (_, at) => at.toString(16).padStart(2, '0'));
const HEX = /^(?:[0-9a-f]{2})*$/;

export const hex = (bytes: Uint8Array): string => {
  let out = '';
  for (const byte of bytes) out += DIGITS[byte];
  return out;
};

// Hex of `length` bytes, or any length when none is named.
export const isHex = (text: unknown, length?: number): text is string =>
  typeof text === 'string' && HEX.test(text) && (length === undefined || text.length === length * 2);

export const unhex = (text: string): Uint8Array => {
  if (!isHex(text)) throw new TypeError('not hex');
  const out = new Uint8Array(text.length / 2);
  for (let at = 0; at < out.length; at += 1) out[at] = parseInt(text.slice(at * 2, at * 2 + 2), 16);
  return out;
};

export const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

export const zero = (bytes: Uint8Array): boolean => bytes.every((b) => b === 0);

const encoder = new TextEncoder();
export const utf8 = (text: string): Uint8Array => encoder.encode(text);
