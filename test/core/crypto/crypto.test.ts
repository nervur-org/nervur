// SPDX-License-Identifier: Apache-2.0
// `crypto/` reproduces every record of `quo/vectors/arithmetic.json`, and a
// record the file adds that no reading here recognises is a failure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decapsulate, encapsulate, hex, lockFrom } from '../../../src/core/crypto/index.ts';
import { holds } from '../../claims.ts';
import { expect } from '../../../src/core/proof/index.ts';
import { records, reproduce, zeroFirst } from '../../vectors.ts';

for (const record of records) test(holds('proof.vectors', `crypto: ${record.name}`), () => reproduce(record, expect));

test(holds('proof.vectors', 'crypto: a secret whose first byte is zero'), () => zeroFirst(expect));

test('[crypto] a lock decapsulates what was encapsulated to it, and another lock does not', () => {
  const lock = lockFrom(new Uint8Array(32).fill(1), new Uint8Array(32).fill(2));
  const other = lockFrom(new Uint8Array(32).fill(3), new Uint8Array(32).fill(4));
  const sent = encapsulate(lock.ek, new Uint8Array(32).fill(5))!;
  assert.equal(hex(decapsulate(lock.dk, sent.ciphertext)!), hex(sent.shared));
  assert.notEqual(hex(decapsulate(other.dk, sent.ciphertext)!), hex(sent.shared));
});

test('[crypto] an encapsulation key the modulus check refuses is no lock', () => {
  const ek = lockFrom(new Uint8Array(32), new Uint8Array(32)).ek.slice();
  ek[0] = 0xff;
  ek[1] = 0xff;
  assert.equal(encapsulate(ek, new Uint8Array(32)), null);
});
