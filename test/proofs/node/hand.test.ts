// Where a ground's hand stands: a socket in its state folder, and on
// Windows a named pipe named for that folder, one per folder, the same on
// every start. The pipe itself is proven on the Windows machine.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handAt } from '../../../src/node/hand.ts';

test('The hand is a socket in the state folder, and on Windows a pipe named for it', () => {
  assert.equal(handAt('/srv/shop/state', 'linux'), '/srv/shop/state/hand');
  const pipe = handAt('/srv/shop/state', 'win32');
  assert.match(pipe, /^\\\\\.\\pipe\\nervur-[0-9a-f]{16}$/);
  assert.equal(handAt('/srv/shop/state', 'win32'), pipe, 'the same pipe on every start');
  assert.notEqual(handAt('/srv/bank/state', 'win32'), pipe, 'another folder, another pipe');
  assert.equal(handAt('/SRV/Shop/state', 'win32'), pipe, 'a path Windows reads alike names one pipe');
});
