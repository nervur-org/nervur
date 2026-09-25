// The edge's bodies, each held to its contract's suite in Node: storage is
// a Durable Object's kept in the process, and a socket is Node's in the
// shape a Worker's `connect()` gives. `deep/edge` holds the same bodies to
// the same suites on workerd.
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { Duplex } from 'node:stream';
import { test } from 'node:test';
import { DurableClock, DurableMemory, NativeCrypto, SocketCarry, type Connect } from 'nervur/edge';
import { TcpCarry } from 'nervur/node';
import { carrySuite } from '../../suites/carry.ts';
import { clockSuite } from '../../suites/clock.ts';
import { cryptoSuite } from '../../suites/crypto.ts';
import { memorySuite } from '../../suites/memory.ts';
import { MapStorage } from '../fixtures/durable.ts';

cryptoSuite('NativeCrypto', () => new NativeCrypto());

let names = 0;
const shared = new MapStorage();
memorySuite('DurableMemory', () => new DurableMemory(shared, `suite-${names++}`));

clockSuite('DurableClock', () => {
  const storage = new MapStorage();
  const clock = new DurableClock(storage);
  storage.alarmed = () => void clock.alarm();
  return { clock, advance: async () => undefined };
});

// Node's socket, in the shape a Worker's `connect()` gives.
const connect: Connect = ({ hostname, port }) => {
  const socket = createConnection({ host: hostname, port });
  const opened = new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  opened.catch(() => undefined);
  const { readable, writable } = Duplex.toWeb(socket) as unknown as { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> };
  return { readable, writable, opened, close: async () => void socket.destroy() };
};

carrySuite('SocketCarry', async () => {
  const one = new SocketCarry({ connect, allowPrivate: true });
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
    nowhere: 'tcp://127.0.0.1:1',
    cut: () => two.close(),
    close: async () => {
      await one.close();
      await two.close();
      await three.close();
    },
  };
});

test('DurableClock keeps the alarm at the earliest wait, and never moves it later', async (t) => {
  const storage = new MapStorage();
  t.after(() => storage.stop());
  const clock = new DurableClock(storage);
  let set = storage.nextSet();
  const late = clock.wait({ id: 'late', ms: 60_000 });
  assert.ok((await set) - Date.now() > 30_000);
  set = storage.nextSet();
  const soon = clock.wait({ id: 'soon', ms: 30_000 });
  assert.ok((await set) - Date.now() <= 30_000, 'the alarm moves to the soonest wait');
  clock.cancel({ id: 'late' });
  clock.cancel({ id: 'soon' });
  assert.deepEqual(await Promise.all([late, soon]), [false, false]);

  // An earlier wake left an alarm sooner than a wait here: a clock opened again never moves it later.
  await storage.setAlarm(Date.now() + 5_000);
  const again = new DurableClock(storage);
  set = storage.nextSet();
  const far = again.wait({ id: 'far', ms: 120_000 });
  const near = again.wait({ id: 'near', ms: 1_000 });
  assert.ok((await set) - Date.now() <= 1_000, 'the far wait set nothing, and the near one moved it earlier');
  again.cancel({ id: 'far' });
  again.cancel({ id: 'near' });
  assert.deepEqual(await Promise.all([far, near]), [false, false]);
});
