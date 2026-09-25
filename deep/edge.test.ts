// EdgeGround's own run: the edge's bodies on workerd, the engine a Worker
// runs on, as `wrangler dev` runs it. One Durable Object holds them, on its
// real storage and its real alarm, with the platform's own sockets and Web
// Crypto. Each is held to its contract's one suite from here, over HTTP:
// the suite asks, and the body answers inside workerd.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before } from 'node:test';
import type { Carry, Clock, Crypto, Memory, Sent } from 'nervur';
import { TcpCarry } from 'nervur/node';
import { carrySuite } from '../test/suites/carry.ts';
import { clockSuite } from '../test/suites/clock.ts';
import { cryptoSuite } from '../test/suites/crypto.ts';
import { memorySuite } from '../test/suites/memory.ts';
import { fromWire, toWire } from './fixtures/edge/wire.ts';
import { built, started, type Running } from './fixtures/edge/workerd.ts';

const out = mkdtempSync(join(tmpdir(), 'nervur-edge-'));
let engine: Running | undefined;
let origin = '';
// The object's time as it read before the suites ran, and when.
let worker = 0;
let read = 0;

before(async () => {
  await built(out, 'bodies', 'config.capnp');
  engine = await started(out);
  origin = engine.origin;
  pool = (await call('crypto/call', { method: 'random', args: [131_072] })) as Uint8Array;
  worker = (await call('clock/now')) as number;
  read = Date.now();
});

after(async () => {
  await engine?.kill();
  rmSync(out, { recursive: true, force: true });
});

// One op of a body inside workerd, its answer read back, or its error thrown here.
const call = async (op: string, args: object = {}): Promise<unknown> => {
  const response = await fetch(`${origin}/${op}`, { method: 'POST', body: JSON.stringify(toWire(args)) });
  const answer = (await response.json()) as { result?: unknown; error?: string };
  if (answer.error !== undefined) throw new Error(answer.error);
  return fromWire(answer.result);
};

// Random bytes are drawn in workerd before the suites run, since the contract draws them without waiting.
let pool: Uint8Array = new Uint8Array(0);
const METHODS = ['sha256', 'hkdf', 'seal', 'open', 'signingPublic', 'sign', 'verify', 'agreePublic', 'agree', 'lockPair', 'encapsulate', 'decapsulate'] as const;
const crypto = Object.fromEntries(METHODS.map((method) => [method, (...args: unknown[]) => call('crypto/call', { method, args })])) as unknown as Crypto;
crypto.random = (length) => {
  if (pool.length < length) throw new Error('the bytes drawn in workerd ran out');
  const drawn = pool.slice(0, length);
  pool = pool.subarray(length);
  return drawn;
};
cryptoSuite('NativeCrypto on workerd', () => crypto);

let memories = 0;
memorySuite('DurableMemory on workerd', () => {
  const name = `suite-${memories++}`;
  return {
    read: ({ place }) => call('memory/read', { name, place }) as never,
    list: () => call('memory/list', { name }) as never,
    write: ({ writes, expect }) => call('memory/write', { name, writes, expect }) as never,
  } satisfies Memory;
});

// Each wait and cancel reaches the object in the order the suite made it; a wait's end is read after.
clockSuite('DurableClock on workerd', () => {
  let turn: Promise<unknown> = Promise.resolve();
  const inTurn = (op: string, args: object) => {
    const sent = turn.then(() => call(op, args));
    turn = sent.catch(() => undefined);
    return sent;
  };
  const clock: Clock = {
    // The object's time, read before the suites ran, moved on by what passed here since.
    now: () => worker + (Date.now() - read),
    wait: ({ id, ms }) => inTurn('clock/wait', { id, ms }).then((token) => call('clock/waited', { token }) as Promise<boolean>),
    cancel: ({ id }) => void inTurn('clock/cancel', { id }),
  };
  return { clock, advance: async () => undefined };
});

carrySuite('SocketCarry on workerd', async () => {
  const one: Carry = { send: (options) => call('carry/send', options) as Promise<Sent>, at: () => [], vouched: async () => [] };
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
      await call('carry/close');
      await two.close();
      await three.close();
    },
  };
});
