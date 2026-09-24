// The crypto contract's one suite, run against every body of it. It holds
// a body to quo/vectors/arithmetic.json, the primitives the seal rests on.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Crypto } from 'nervur';
import { quo } from '../fixtures/quo.ts';

type Vector = Record<string, string | boolean | undefined>;
const vectors: Vector[] = JSON.parse(readFileSync(new URL('vectors/arithmetic.json', quo), 'utf8')).vectors;
const bytes = (hex: unknown) => Uint8Array.from((hex as string).match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
const hex = (value: Uint8Array | null) => (value === null ? null : Buffer.from(value).toString('hex'));
const has = (vector: Vector, ...keys: string[]) => keys.every((key) => key in vector);

export const cryptoSuite = (name: string, make: () => Crypto) => {
  const crypto = make();

  test(`${name}: every record of the arithmetic vectors`, async () => {
    for (const v of vectors) {
      const why = v.name as string;
      if (has(v, 'hash')) assert.equal(hex(await crypto.sha256(bytes(v.input))), v.hash, why);
      else if (has(v, 'ikm', 'key')) {
        const out = await crypto.hkdf(bytes(v.ikm), Buffer.from(bytes(v.info)).toString('latin1'), 44);
        assert.equal(hex(out.subarray(0, 32)), v.key, why);
        assert.equal(hex(out.subarray(32)), v.nonce, why);
      } else if (has(v, 'ikm')) assert.equal(hex(await crypto.hkdf(bytes(v.ikm), Buffer.from(bytes(v.info)).toString('latin1'), (v.out as string).length / 2)), v.out, why);
      else if (has(v, 'signature')) {
        if (has(v, 'secret')) assert.equal(hex(await crypto.sign(bytes(v.secret), bytes(v.message))), v.signature, why);
        assert.equal(await crypto.verify(bytes(v.pk), bytes(v.message), bytes(v.signature)), !v.refuses, why);
      } else if (has(v, 'shared', 'secret')) assert.equal(hex(await crypto.agree(bytes(v.secret), bytes(v.pk))), v.shared, why);
      else if (has(v, 'secret', 'refuses')) assert.equal(await crypto.agree(bytes(v.secret), bytes(v.pk)), null, why);
      else if (has(v, 'secret', 'pk')) {
        const pk = why.includes('Ed25519') ? await crypto.signingPublic(bytes(v.secret)) : await crypto.agreePublic(bytes(v.secret));
        assert.equal(hex(pk), v.pk, why);
      } else if (has(v, 'plaintext', 'key')) {
        assert.equal(hex(await crypto.seal(bytes(v.key), bytes(v.nonce), bytes(v.plaintext), bytes(v.additional))), v.ciphertext, why);
        assert.equal(hex(await crypto.open(bytes(v.key), bytes(v.nonce), bytes(v.ciphertext), bytes(v.additional))), v.plaintext, why);
      } else if (has(v, 'shared', 'ciphertext', 'additional')) {
        const out = await crypto.hkdf(bytes(v.shared), 'quo-seal', 44);
        const opened = await crypto.open(out.subarray(0, 32), out.subarray(32), bytes(v.ciphertext), bytes(v.additional));
        assert.equal(hex(opened), v.refuses ? null : v.plaintext, why);
      } else if (has(v, 'd', 'z')) assert.equal(hex((await crypto.lockPair(new Uint8Array([...bytes(v.d), ...bytes(v.z)]))).encapsulation), v.ek, why);
      else if (has(v, 'ek', 'm')) {
        const sealed = await crypto.encapsulate(bytes(v.ek));
        assert.ok(sealed !== null && sealed.ciphertext.length === 1088 && sealed.shared.length === 32, why);
      } else assert.fail(`a record no branch reads: ${why}`);
    }
  });

  test(`${name}: an encapsulation opens under its lock`, async () => {
    const pair = await crypto.lockPair(crypto.random(64));
    const sealed = (await crypto.encapsulate(pair.encapsulation))!;
    assert.deepEqual(await crypto.decapsulate(pair.decapsulation, sealed.ciphertext), sealed.shared);
  });

  test(`${name}: a lock the modulus check refuses is refused`, async () => {
    assert.equal(await crypto.encapsulate(new Uint8Array(1184).fill(0xff)), null);
  });

  test(`${name}: random bytes are drawn fresh`, () => {
    assert.equal(crypto.random(100_000).length, 100_000);
    assert.notDeepEqual(crypto.random(32), crypto.random(32));
  });
};
