// SPDX-License-Identifier: Apache-2.0
// Addresses as SPEC.md reads an invitation's `at`, and as CARRIER-TCP.md
// and CARRIER-WEB.md write them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAt, readInvitation, schemeOf, tcpAddress, tcpAt, unspecified, webAddress } from '../../../src/core/quo/index.ts';
import { Door, MemoryRelations, WardKey } from '../../../src/core/quo/index.ts';
import { CryptoEntropy } from '../../../src/core/pointer/index.ts';

test('[address] at keeps the strings that are URIs with a scheme, in order, and is absent otherwise', () => {
  assert.deepEqual(readAt(['tcp://a:1', 7, 'no scheme', 'x-new://anything', null, 'HTTPS://h/q']), ['tcp://a:1', 'x-new://anything', 'HTTPS://h/q']);
  for (const value of ['tcp://a:1', {}, null, undefined, 3]) assert.deepEqual(readAt(value), []);
  assert.equal(schemeOf('HTTPS://h/q'), 'https');
  assert.equal(schemeOf('1tcp://a:1'), null);
  assert.equal(schemeOf('tcp://a b:1'), null, 'a space is no URI character');
});

test('[address] a tcp address is tcp://host:port and nothing after the port', () => {
  assert.deepEqual(tcpAddress('tcp://127.0.0.1:80'), { host: '127.0.0.1', port: 80 });
  assert.deepEqual(tcpAddress('TCP://[::1]:65535'), { host: '::1', port: 65_535 });
  assert.deepEqual(tcpAddress('tcp://example.org:1'), { host: 'example.org', port: 1 });
  for (const at of ['127.0.0.1:80', 'tcp://a', 'tcp://a:0', 'tcp://a:65536', 'tcp://a:b', 'tcp://a:1/', 'tcp://a:1?q', 'tcp://a:1#f', 'tcp://u@a:1', 'tcp://[zz]:1', 'tcp://a%:1', 'tcp:a:1', 'https://a:1', 7, null]) {
    assert.equal(tcpAddress(at), null, String(at));
  }
  assert.equal(tcpAt('::1', 7), 'tcp://[::1]:7');
  assert.equal(tcpAt('127.0.0.1', 7), 'tcp://127.0.0.1:7');
});

test('[address] a web address has a host, a port by its scheme, and a path', () => {
  assert.deepEqual(webAddress('https://example.org'), { scheme: 'https', secure: true, held: false, host: 'example.org', port: 443, path: '/', href: 'https://example.org' });
  assert.deepEqual(webAddress('ws://[::1]:8080/quo?x=1'), { scheme: 'ws', secure: false, held: true, host: '::1', port: 8080, path: '/quo?x=1', href: 'ws://[::1]:8080/quo?x=1' });
  assert.equal(webAddress('wss://h:/q')?.port, 443);
  assert.equal(webAddress('http://h')?.port, 80);
  for (const at of ['https:///q', 'https://u@h/q', 'https://h/q#f', 'https://h:99999/', 'https://h:x/', 'tcp://h:1', 'mailto:a@b']) assert.equal(webAddress(at), null, at);
});

test('[address] an invitation keeps its at, drops what is not one, and a door writes the addresses it is given', async () => {
  const entropy = new CryptoEntropy();
  const door = new Door(await WardKey.from('ward'), new MemoryRelations(), { answer: () => Promise.resolve({ silence: true }), zero: false }, entropy.drawer);
  const { invitation: bare } = await door.invite();
  assert.equal('at' in bare, false);
  for (const wide of ['tcp://0.0.0.0:1', 'tcp://[::]:1', 'http://0.0.0.0:80/q', 'ws://[::]/q']) assert.equal(unspecified(wide), true, wide);
  for (const narrow of ['tcp://127.0.0.1:1', 'https://h.example/q', 'nope', 7]) assert.equal(unspecified(narrow), false, String(narrow));
  const { invitation } = await door.invite(['tcp://a:1', 'wss://h/q']);
  assert.deepEqual(invitation.at, ['tcp://a:1', 'wss://h/q']);
  assert.deepEqual(readInvitation(invitation)?.at, ['tcp://a:1', 'wss://h/q']);
  assert.equal('at' in readInvitation({ ...bare, at: 'tcp://a:1' })!, false, 'an at that is no array is absent');
  assert.equal('at' in readInvitation({ ...bare, at: [7, 'nope'] })!, false, 'an at holding no address is absent');
  assert.deepEqual(readInvitation({ ...bare, at: ['x://y', 7], other: 1 })?.at, ['x://y']);
});
