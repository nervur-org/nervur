// SPDX-License-Identifier: Apache-2.0
// ML-KEM-768 of FIPS 203 encapsulates. Web Crypto has none on every terrain,
// so it comes from `@noble/post-quantum`.
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';

export const EK = 1184;
export const CIPHERTEXT = 1088;

export type Lock = { ek: Uint8Array; dk: Uint8Array };

// KeyGen_internal(d, z): the lock from sixty-four drawn bytes, d then z.
export const lockFrom = (d: Uint8Array, z: Uint8Array): Lock => {
  const { publicKey, secretKey } = ml_kem768.keygen(Uint8Array.from([...d, ...z]));
  return { ek: publicKey, dk: secretKey };
};

// Encaps_internal(ek, m), or null for an encapsulation key the modulus check
// of FIPS 203 section 7.2 refuses.
export const encapsulate = (ek: Uint8Array, m: Uint8Array): { ciphertext: Uint8Array; shared: Uint8Array } | null => {
  if (ek.length !== EK) return null;
  try {
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(ek, m);
    return { ciphertext: cipherText, shared: sharedSecret };
  } catch {
    return null;
  }
};

// Decapsulation is implicit rejection: a ciphertext for another lock gives a
// shared secret that opens nothing.
export const decapsulate = (dk: Uint8Array, ciphertext: Uint8Array): Uint8Array | null => {
  if (ciphertext.length !== CIPHERTEXT) return null;
  try {
    return ml_kem768.decapsulate(ciphertext, dk);
  } catch {
    return null;
  }
};
