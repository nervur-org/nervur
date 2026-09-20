// SPDX-License-Identifier: Apache-2.0
// Ed25519 signs, as RFC 8032 defines it, by `@noble/curves` in every
// engine, since an engine's Web Crypto may refuse a secret the curve takes,
// and verifies with the cofactorless check the spec names, which the
// library's own verify does not make. The decoding rules are held here:
//
//   a signature of any length but sixty-four
//   an `s` at or above the group order
//   an `R` that does not decode, or whose bytes are not its point's encoding
//   a public key that does not decode, or whose y is at or above the prime
//   a public key of small order, in any spelling
import { ed25519 } from '@noble/curves/ed25519.js';
import { concat } from './bytes.ts';
import { own, subtle } from './subtle.ts';

const P = 2n ** 255n - 19n;
const L = 2n ** 252n + 27742317777372353535851937790883648493n;

const mod = (a: bigint): bigint => ((a % P) + P) % P;
const power = (base: bigint, exponent: bigint): bigint => {
  let out = 1n;
  let b = mod(base);
  for (let e = exponent; e > 0n; e >>= 1n) {
    if (e & 1n) out = (out * b) % P;
    b = (b * b) % P;
  }
  return out;
};
const D = mod(-121665n * power(121666n, P - 2n));
const ROOT_MINUS_ONE = power(2n, (P - 1n) / 4n);

const little = (bytes: Uint8Array): bigint => bytes.reduceRight((n, b) => (n << 8n) | BigInt(b), 0n);

type Point = { x: bigint; y: bigint; z: bigint; t: bigint };

// A point from its thirty-two bytes, or null where RFC 8032 section 5.1.3
// refuses it, the sign bit set on x = 0 included.
const decode = (bytes: Uint8Array): Point | null => {
  if (bytes.length !== 32) return null;
  const sign = (bytes[31]! & 0x80) !== 0;
  const y = little(bytes) & ((1n << 255n) - 1n);
  if (y >= P) return null;
  const u = mod(y * y - 1n);
  const v = mod(D * y * y + 1n);
  let x = mod(u * power(v, 3n) * power(u * power(v, 7n), (P - 5n) / 8n));
  const check = mod(v * x * x);
  if (check === mod(-u)) x = mod(x * ROOT_MINUS_ONE);
  else if (check !== u) return null;
  if (x === 0n && sign) return null;
  if ((x & 1n) !== (sign ? 1n : 0n)) x = mod(-x);
  return { x, y, z: 1n, t: mod(x * y) };
};

const add = (a: Point, b: Point): Point => {
  const A = mod((a.y - a.x) * (b.y - b.x));
  const B = mod((a.y + a.x) * (b.y + b.x));
  const C = mod(2n * D * a.t * b.t);
  const E = mod(2n * a.z * b.z);
  const [e, f, g, h] = [B - A, E - C, E + C, B + A];
  return { x: mod(e * f), y: mod(g * h), z: mod(f * g), t: mod(e * h) };
};

// Small order: eight times the point is the identity.
const smallOrder = (p: Point): boolean => {
  let q = p;
  for (let i = 0; i < 3; i += 1) q = add(q, q);
  return q.x === 0n && q.y === q.z;
};

const secretOf = (secret: Uint8Array): Uint8Array => {
  if (secret.length !== 32) throw new TypeError('a secret is thirty-two bytes');
  return secret;
};

export const ed25519Public = async (secret: Uint8Array): Promise<Uint8Array> => ed25519.getPublicKey(secretOf(secret));

export const sign = async (secret: Uint8Array, message: Uint8Array): Promise<Uint8Array> => ed25519.sign(message, secretOf(secret));

// The cofactorless check, `[s]B = R + [k]A`, on points decoded as above.
export const verify = async (pk: Uint8Array, message: Uint8Array, signature: Uint8Array): Promise<boolean> => {
  if (signature.length !== 64) return false;
  const key = decode(pk);
  if (key === null || smallOrder(key)) return false;
  if (decode(signature.subarray(0, 32)) === null) return false;
  const s = little(signature.subarray(32));
  if (s >= L) return false;
  const R = ed25519.Point.fromBytes(signature.subarray(0, 32));
  const A = ed25519.Point.fromBytes(pk);
  const hashed = new Uint8Array(await subtle().digest('SHA-512', own(concat(signature.subarray(0, 32), pk, message))));
  const k = little(hashed) % L;
  return ed25519.Point.BASE.multiplyUnsafe(s).equals(R.add(A.multiplyUnsafe(k)));
};
