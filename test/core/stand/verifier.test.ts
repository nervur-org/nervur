// SPDX-License-Identifier: Apache-2.0
// Quo's verifier judges the stand as a door, an asker, and a listener and
// a dialer over tcp, the post and the held line, and meets it with the
// JavaScript example kit both ways. Every
// check passes. The runs go at once, each its own process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { holds } from '../../claims.ts';
import { verify } from '../../verify.ts';

const PART_ONE = ['wards and invitations', 'the move', 'the count', 'the reaches', 'the zero head', 'the signature', 'strangers', 'the payload', 'unannounced', 'removal', 'the size', 'the asker', 'harness errors'];
// A subtest takes the runner's default, not its parent's, so each says its own.
const TIME = { timeout: 30_000 };

test(holds('proof.verifier', 'verifier: the stand passes quo/verifier, alone and against the JavaScript example kit'), { ...TIME, concurrency: true }, async (t) => {
  await Promise.all([
    t.test('as a door and an asker', TIME, async () => assert.match(await verify('--only', PART_ONE.join(','), '--'), /boxes the kit sealed were taken apart/)),
    t.test('as a tcp listener', TIME, async () => assert.match(await verify('--only', 'the listener', '--'), /judged as a tcp listener/)),
    t.test('as a tcp dialer, by a route and by an invitation', TIME, async () => assert.match(await verify('--only', 'the dialer', '--'), /judged as a tcp dialer/)),
    t.test('as a post listener and dialer', TIME, async () => assert.match(await verify('--only', 'the post listener,the post dialer', '--'), /judged as an http listener; judged as an http dialer/)),
    t.test('as a held line listener and dialer', TIME, async () => assert.match(await verify('--only', 'the held line listener,the held line dialer', '--'), /judged as a ws listener; judged as a ws dialer/)),
    t.test('answering the JavaScript example kit', TIME, async () => void (await verify('--two', '--', '--other'))),
    t.test('asking the JavaScript example kit', TIME, async () => void (await verify('--two', '--other', '--'))),
  ]);
});
