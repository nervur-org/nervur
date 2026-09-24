// The Node bodies and the web clock, each held to its contract's suite.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { WebClock } from 'nervur';
import { FileMemory, TcpCarry } from 'nervur/node';
import { parseAddress, privateAddress } from '../../../src/node/tcp-carry.ts';
import { carrySuite } from '../suites/carry.ts';
import { clockSuite } from '../suites/clock.ts';
import { memorySuite } from '../suites/memory.ts';

const folders: string[] = [];
const folder = () => {
  const made = mkdtempSync(join(tmpdir(), 'nervur-memory-'));
  folders.push(made);
  return made;
};
process.on('exit', () => {
  for (const made of folders) rmSync(made, { recursive: true, force: true });
});

memorySuite('FileMemory', () => new FileMemory(join(folder(), 'memory')));

// A web clock's time moves by itself; a wait resolves on its own event.
clockSuite('WebClock', () => ({ clock: new WebClock(), advance: async () => undefined }));

carrySuite('TcpCarry', async () => {
  const one = new TcpCarry({ host: '127.0.0.1', allowPrivate: true });
  const two = new TcpCarry({ host: '127.0.0.1', allowPrivate: true });
  const three = new TcpCarry({ host: '127.0.0.1', allowPrivate: true });
  return {
    spare: async () => {
      let reached = false;
      await three.listen({
        ward: 'ab'.repeat(64),
        door: async () => {
          reached = true;
          return new Uint8Array([9]);
        },
      });
      return { at: three.at({})[0], reached: () => reached };
    },
    one,
    two,
    listen: (listened) => two.listen(listened),
    // Port 1 refuses on this host, so nothing there ever heard a box.
    nowhere: 'tcp://127.0.0.1:1',
    // The listener goes while the ask is in flight, so the reply is lost.
    cut: () => two.close(),
    close: async () => {
      await one.close();
      await two.close();
      await three.close();
    },
  };
});

test('FileMemory keeps what landed across a new body on the same file', async () => {
  const path = join(folder(), 'memory');
  await new FileMemory(path).write({ writes: { p: { a: new Uint8Array([7]) } }, expect: { p: null } });
  assert.deepEqual((await new FileMemory(path).read({ place: 'p' })).entries.a, new Uint8Array([7]));
});

test('FileMemory reads a file it cannot parse as a failure, never as empty', async () => {
  const path = join(folder(), 'memory');
  writeFileSync(path, 'not json');
  await assert.rejects(new FileMemory(path).list());
});

test('A tcp address is tcp://host:port and nothing after the port', () => {
  assert.deepEqual(parseAddress('tcp://example.org:7000'), { host: 'example.org', port: 7000 });
  assert.deepEqual(parseAddress('TCP://[::1]:1'), { host: '::1', port: 1 });
  for (const bad of ['tcp://example.org:7000/', 'tcp://example.org', 'tcp://a:0', 'tcp://a:65536', 'tcp://u@a:1', 'http://a:1', 'tcp://a:1?x']) assert.equal(parseAddress(bad), null, bad);
});

test('A carry refuses to send to a private or loopback address unless its ground allows it', async (t) => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) assert.ok(privateAddress(ip), ip);
  for (const ip of ['203.0.113.7', '8.8.8.8', '2001:db8::1']) assert.ok(!privateAddress(ip), ip);
  const two = new TcpCarry({ host: '127.0.0.1', allowPrivate: true });
  const one = new TcpCarry();
  t.after(async () => {
    await two.close();
    await one.close();
  });
  let reached = false;
  await two.listen({
    ward: 'ab'.repeat(64),
    door: async () => {
      reached = true;
      return new Uint8Array([1]);
    },
  });
  assert.deepEqual(await one.send({ ward: 'ab'.repeat(64), at: two.at({}), box: new Uint8Array([1]) }), { reply: null, heard: false });
  assert.equal(reached, false);
});

test('A stream that sends no frame is closed, and nothing after it is read', async (t) => {
  const carry = new TcpCarry({ host: '127.0.0.1', allowPrivate: true });
  t.after(() => carry.close());
  await carry.listen({ ward: 'ab'.repeat(64), door: async () => new Uint8Array([1]) });
  const { port } = parseAddress(carry.at({})[0])!;
  const socket = createConnection({ host: '127.0.0.1', port });
  t.after(() => socket.destroy());
  await new Promise((resolve) => socket.once('connect', resolve));
  const closed = new Promise((resolve) => socket.once('close', resolve));
  socket.write(Buffer.from([0, 0, 0, 2, 0, 0]));
  await closed;
});
