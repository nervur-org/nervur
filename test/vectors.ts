// SPDX-License-Identifier: Apache-2.0
// How `crypto/` reproduces a record of `quo/vectors/arithmetic.json`, one
// reading per kind of record. A record no reading recognises is a failure.
import type { Record } from './records.ts';
import { agree, decrypt, ed25519Public, encapsulate, encrypt, hex, hkdf, lockFrom, sha256, sign, unhex, utf8, verify, x25519Public } from '../src/core/crypto/index.ts';
import type { Expect } from '../src/core/proof/index.ts';

export { records, type Record } from './records.ts';

const b = (r: Record, field: string): Uint8Array => unhex(r[field] as string);
const has = (r: Record, ...fields: string[]): boolean => fields.every((f) => f in r);

const sealKey = async (shared: Uint8Array) => {
  const out = await hkdf(shared, utf8('quo-seal'), 44);
  return { key: out.subarray(0, 32), nonce: out.subarray(32) };
};

type Reading = [string, (r: Record) => boolean, (r: Record, e: Expect) => Promise<void>];

const readings: Reading[] = [
  ['sha-256', (r) => has(r, 'input', 'hash'), async (r, e) => e.equal(hex(await sha256(b(r, 'input'))), r.hash)],
  [
    'signature',
    (r) => has(r, 'pk', 'message', 'signature'),
    async (r, e) => {
      e.equal(await verify(b(r, 'pk'), b(r, 'message'), b(r, 'signature')), !r.refuses);
      if (has(r, 'secret')) e.equal(hex(await sign(b(r, 'secret'), b(r, 'message'))), r.signature);
    },
  ],
  [
    'x25519 agreement',
    (r) => has(r, 'secret', 'pk') && (has(r, 'shared') || r.refuses === true),
    async (r, e) => {
      const shared = await agree(b(r, 'secret'), b(r, 'pk'));
      e.equal(shared === null ? null : hex(shared), r.refuses ? null : r.shared);
    },
  ],
  [
    'key pair',
    (r) => has(r, 'secret', 'pk') && !has(r, 'message', 'shared', 'refuses'),
    async (r, e) => e.equal(hex(await (r.name.includes('X25519') ? x25519Public : ed25519Public)(b(r, 'secret'))), r.pk),
  ],
  [
    'hkdf',
    (r) => has(r, 'ikm', 'info'),
    async (r, e) => {
      const length = has(r, 'out') ? (r.out as string).length / 2 : 44;
      e.equal(r.salt, '');
      e.equal(hex(await hkdf(b(r, 'ikm'), b(r, 'info'), length)), has(r, 'out') ? r.out : `${r.key as string}${r.nonce as string}`);
    },
  ],
  [
    'aes-256-gcm',
    (r) => has(r, 'additional', 'ciphertext'),
    async (r, e) => {
      const { key, nonce } = has(r, 'shared') ? await sealKey(b(r, 'shared')) : { key: b(r, 'key'), nonce: b(r, 'nonce') };
      const opened = await decrypt(key, nonce, b(r, 'additional'), b(r, 'ciphertext'));
      if (r.refuses) return e.equal(opened, null);
      e.equal(opened && hex(opened), r.plaintext);
      e.equal(hex(await encrypt(key, nonce, b(r, 'additional'), b(r, 'plaintext'))), r.ciphertext);
    },
  ],
  ['ml-kem-768 lock', (r) => has(r, 'd', 'z', 'ek'), async (r, e) => e.equal(hex(lockFrom(b(r, 'd'), b(r, 'z')).ek), r.ek)],
  [
    'ml-kem-768 encapsulation',
    (r) => has(r, 'ek', 'm'),
    async (r, e) => {
      const out = encapsulate(b(r, 'ek'), b(r, 'm'));
      e.ok(out, 'encapsulated');
      e.equal(hex(out!.ciphertext), r.ciphertext);
      e.equal(hex(out!.shared), r.shared);
    },
  ],
];

// A secret whose first byte is zero, which an engine's own import may
// refuse, on both curves, against keys and a signature Node's OpenSSL made.
export const zeroFirst = async (e: Expect): Promise<void> => {
  const secret = unhex(`00${'42'.repeat(31)}`);
  e.equal(hex(await ed25519Public(secret)), '39fa39f019c05af806ac2cf57c7d9da1c9c8520390202ccb99bb3b501ed30733');
  const signature = 'cfb1db93b98f4accb1f17cd7a0ba3a9a3a64bec986ba1643a2abfdb6241640e9b76fe50deffbb0da9c361608a18740207cac3ce9ed385b6393d74bc3ddad4503';
  e.equal(hex(await sign(secret, utf8('quo'))), signature);
  e.equal(await verify(unhex('39fa39f019c05af806ac2cf57c7d9da1c9c8520390202ccb99bb3b501ed30733'), utf8('quo'), unhex(signature)), true);
  const padlock = 'a2ce338a743b77655a0733e32c359a4e2073a4a5d152b398ef20038bce9ff475';
  e.equal(hex(await x25519Public(secret)), padlock);
  const other = unhex('07'.repeat(32));
  e.equal(hex((await agree(secret, await x25519Public(other)))!), hex((await agree(other, unhex(padlock)))!));
};

export const reproduce = async (record: Record, e: Expect): Promise<void> => {
  const reading = readings.find(([, reads]) => reads(record));
  if (!reading) throw new Error(`no reading recognises ${record.name}`);
  await reading[2](record, e);
};
