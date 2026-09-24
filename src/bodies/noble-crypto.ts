// SPDX-License-Identifier: Apache-2.0
// The default crypto: Ed25519, X25519 and ML-KEM-768 from noble, SHA-256,
// HKDF and AES-GCM from Web Crypto.
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import type { Crypto } from '../foundation.ts';

const subtle = globalThis.crypto.subtle;
const ascii = new TextEncoder();
const view = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(bytes);

export class NobleCrypto implements Crypto {
  random(length: number): Uint8Array {
    const out = new Uint8Array(length);
    for (let at = 0; at < length; at += 65_536) globalThis.crypto.getRandomValues(out.subarray(at, Math.min(length, at + 65_536)));
    return out;
  }

  async sha256(data: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(await subtle.digest('SHA-256', view(data)));
  }

  async hkdf(ikm: Uint8Array, info: string, length: number): Promise<Uint8Array> {
    const key = await subtle.importKey('raw', view(ikm), 'HKDF', false, ['deriveBits']);
    const bits = await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: ascii.encode(info) }, key, length * 8);
    return new Uint8Array(bits);
  }

  async seal(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array, additional: Uint8Array): Promise<Uint8Array> {
    const aes = await subtle.importKey('raw', view(key), 'AES-GCM', false, ['encrypt']);
    return new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: view(nonce), additionalData: view(additional) }, aes, view(plaintext)));
  }

  async open(key: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array, additional: Uint8Array): Promise<Uint8Array | null> {
    if (ciphertext.length < 16) return null;
    const aes = await subtle.importKey('raw', view(key), 'AES-GCM', false, ['decrypt']);
    try {
      return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: view(nonce), additionalData: view(additional) }, aes, view(ciphertext)));
    } catch {
      return null;
    }
  }

  async signingPublic(secret: Uint8Array): Promise<Uint8Array> {
    return ed25519.getPublicKey(secret);
  }

  async sign(secret: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
    return ed25519.sign(message, secret);
  }

  async verify(pk: Uint8Array, message: Uint8Array, signature: Uint8Array): Promise<boolean> {
    if (pk.length !== 32 || signature.length !== 64) return false;
    try {
      // Strict decoding refuses a y at or above the prime and a non-canonical R.
      if (ed25519.Point.fromBytes(pk, false).isSmallOrder()) return false;
      return ed25519.verify(signature, message, pk, { zip215: false });
    } catch {
      return false;
    }
  }

  async agreePublic(secret: Uint8Array): Promise<Uint8Array> {
    return x25519.getPublicKey(secret);
  }

  async agree(secret: Uint8Array, pk: Uint8Array): Promise<Uint8Array | null> {
    if (pk.length !== 32) return null;
    try {
      const shared = x25519.getSharedSecret(secret, pk);
      return shared.every((byte) => byte === 0) ? null : shared;
    } catch {
      return null;
    }
  }

  async lockPair(seed: Uint8Array): Promise<{ encapsulation: Uint8Array; decapsulation: Uint8Array }> {
    const { publicKey, secretKey } = ml_kem768.keygen(seed);
    return { encapsulation: publicKey, decapsulation: secretKey };
  }

  async encapsulate(encapsulation: Uint8Array): Promise<{ ciphertext: Uint8Array; shared: Uint8Array } | null> {
    try {
      const { cipherText, sharedSecret } = ml_kem768.encapsulate(encapsulation);
      return { ciphertext: cipherText, shared: sharedSecret };
    } catch {
      return null;
    }
  }

  async decapsulate(decapsulation: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array> {
    return ml_kem768.decapsulate(ciphertext, decapsulation);
  }
}
