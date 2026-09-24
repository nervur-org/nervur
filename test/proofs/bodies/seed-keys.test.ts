import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NobleCrypto } from '../../../src/bodies/noble-crypto.ts';
import { SeedKeys } from '../../../src/bodies/seed-keys.ts';
import { keysSuite } from '../suites/keys.ts';

const crypto = new NobleCrypto();
const seed = 'a'.repeat(64);

keysSuite('SeedKeys', () => new SeedKeys(seed, crypto), crypto);

test('SeedKeys takes sixty-four lowercase hex digits and nothing else', () => {
  for (const bad of [undefined, '', 'A'.repeat(64), 'a'.repeat(63), `${'a'.repeat(64)}\n`, 'g'.repeat(64)]) {
    assert.throws(() => new SeedKeys(bad, crypto), TypeError, String(bad));
  }
});

test('The ward key comes from the seed as the spec derives it', async () => {
  const bytes = Uint8Array.from(Buffer.from(seed, 'hex'));
  const ward = await new SeedKeys(seed, crypto).ward();
  assert.deepEqual(ward.signing, await crypto.signingPublic(await crypto.hkdf(bytes, 'quo-ward-sign', 32)));
  assert.deepEqual(ward.padlock, await crypto.agreePublic(await crypto.hkdf(bytes, 'quo-ward-seal', 32)));
});
