// SPDX-License-Identifier: Apache-2.0
// SHA-256 hashes, and HKDF-SHA-256 derives under the zero-length salt, with
// the label's ASCII bytes as `info`.
import { own, subtle } from './subtle.ts';

const SALT = new Uint8Array(0);

export const sha256 = async (bytes: Uint8Array): Promise<Uint8Array> => new Uint8Array(await subtle().digest('SHA-256', own(bytes)));

export const hkdf = async (ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> => {
  const material = await subtle().importKey('raw', own(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: own(info) }, material, length * 8);
  return new Uint8Array(bits);
};
