// The classes contract's one suite, run against every body of it. `make`
// gives a body answering the steward, the public being and one other class.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Classes } from 'nervur';

/** A class as a body of classes answers it. */
type BeingClass = NonNullable<Awaited<ReturnType<Classes['resolve']>>>;

export const classesSuite = (name: string, make: (classes: { steward: BeingClass; public: BeingClass; other: BeingClass }) => Classes, classes: { steward: BeingClass; public: BeingClass; other: BeingClass }, kinds: { steward: string; public: string; other: string }) => {
  test(`${name}: each kind resolves to its class, and an unknown kind to nothing`, async () => {
    const body = make(classes);
    assert.equal(await body.resolve({ kind: kinds.other }), classes.other);
    assert.equal(await body.resolve({ kind: kinds.steward }), classes.steward);
    assert.equal(await body.resolve({ kind: 'org.example.nobody' }), undefined);
  });

  test(`${name}: it names the steward's kind and the public being's`, () => {
    const body = make(classes);
    assert.equal(body.steward(), kinds.steward);
    assert.equal(body.public(), kinds.public);
  });
};
