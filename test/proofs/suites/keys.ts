// The keys contract's one suite, run against every body of it. `make`
// gives a body over the ward whose seed is `seed`, where the body holds a
// seed at all.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Crypto, Keys } from '../../../src/foundation.ts';

export const keysSuite = (name: string, make: () => Keys, crypto: Crypto) => {
  const keys = make();

  test(`${name}: the ward's keys are a signing pk, a padlock and a lock`, async () => {
    const ward = await keys.ward();
    assert.equal(ward.signing.length, 32);
    assert.equal(ward.padlock.length, 32);
    assert.equal(ward.lock.length, 1184);
    assert.deepEqual(await keys.ward(), ward, 'the same keys every time');
  });

  test(`${name}: it signs, agrees and decapsulates as the ward`, async () => {
    const ward = await keys.ward();
    const message = new Uint8Array([1, 2, 3]);
    assert.ok(await crypto.verify(ward.signing, message, await keys.sign(message)));
    const secret = crypto.random(32);
    assert.deepEqual(await keys.agree(await crypto.agreePublic(secret)), await crypto.agree(secret, ward.padlock));
    assert.equal(await keys.agree(new Uint8Array(32)), null, 'a point of small order takes no seal');
    const sealed = (await crypto.encapsulate(ward.lock))!;
    assert.deepEqual(await keys.decapsulate(sealed.ciphertext), sealed.shared);
  });

  test(`${name}: a derived key is the house's and never Quo's`, async () => {
    const one = await keys.derive('rows', 32);
    assert.deepEqual(await keys.derive('rows', 32), one);
    assert.notDeepEqual(await keys.derive('other', 32), one);
    await assert.rejects(keys.derive('quo-seal', 32));
  });
};
