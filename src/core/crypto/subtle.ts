// SPDX-License-Identifier: Apache-2.0
// Web Crypto, read at every use. A page on a plain http origin has `crypto`
// without `subtle`, and a terrain may install it after this module loads.
export const subtle = (): SubtleCrypto => {
  const found = globalThis.crypto?.subtle;
  if (!found) throw new Error('this terrain has no crypto.subtle: a ward needs a secure context');
  return found;
};

export type Bytes = Uint8Array<ArrayBuffer>;

// Web Crypto takes a buffer it owns, so every input is copied into one.
export const own = (bytes: Uint8Array): Bytes => Uint8Array.from(bytes);
