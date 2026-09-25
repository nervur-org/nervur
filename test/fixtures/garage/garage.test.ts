// garage.test.ts
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, watch, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { bridge } from 'nervur/node';
import * as phone from './phone.ts';
import * as pi from './pi.ts';

test('Each tap on the phone pulses the relay once, whatever fails between', { timeout: 30_000 }, async (t) => {
  const state = mkdtempSync(join(tmpdir(), 'garage-'));
  t.after(() => rmSync(state, { recursive: true, force: true }));
  // Where the program runs, and where the Pi's pin shows each pulse.
  const pin = join(state, 'relay');
  mkdirSync(pin);
  // The program dies once, after its second pulse and before it answers.
  writeFileSync(join(pin, 'crash-after'), '2');
  const network = new FakeNetwork();

  // The Pi's ground, whose registry bridges the program as a NodeGround's does, and the door's twin.
  const relay = fileURLToPath(new URL('./relay.py', import.meta.url));
  const garage = await BenchGround.open({
    network,
    host: 'pi',
    names: ['garage.local'],
    modules: { pi },
    registry: { faculties: { bridge: ({ memory }) => bridge({ command: 'python3', args: [relay], cwd: pin, memory }) } },
  });
  t.after(() => garage.down());
  // The relay, granted to the twin's class alone.
  await garage.hand({ faculty: 'faculties', method: 'add', args: { name: 'relay', make: 'bridge', kinds: ['org.example.garage'] } });
  await garage.add('garage', 'pi', { faculties: ['relay'] });
  await garage.ask({ house: 'garage', method: 'bear', args: { kind: 'org.example.garage', id: 'door' } });

  // Alice's phone: a device, holding a standing on the twin.
  const alice = await BenchGround.open({ network, host: 'phone', modules: { phone } });
  t.after(() => alice.down());
  await alice.add('phone', 'phone');
  await alice.ask({ house: 'phone', method: 'bear', args: { kind: 'org.example.remote', id: 'remote' } });
  const paper = await garage.ask({ house: 'garage', method: 'offerFor', args: { being: 'door', occupant: 'alice' } });
  await alice.ask({ house: 'phone', id: 'remote', method: 'accept', args: { invitation: (paper as { result: { handle: string } }).result.handle } });

  // A being's answer, watched until it is what the test waits for: each ask answers once it moves.
  const watched = async <T>(ground: BenchGround, house: string, id: string, method: string, done: (seen: T) => boolean): Promise<T> => {
    let seen = ((await ground.ask({ house, id, method })) as { result: T }).result;
    while (!done(seen)) seen = ((await ground.ask({ house, id, method, after: { result: seen as never } })) as { result: T }).result;
    return seen;
  };
  const pulsed = (count: number) => watched<{ pulses: number[] }>(garage, 'garage', 'door', 'log', (log) => log.pulses.length >= count);
  const heard = (count: number) => watched<number>(alice, 'phone', 'remote', 'heard', (seen) => seen >= count);
  // Resolves once the relay's program has started `count` times.
  const lives = (count: number) =>
    new Promise<void>((resolve) => {
      const started = () => existsSync(join(pin, 'lives')) && readFileSync(join(pin, 'lives'), 'utf8').trim().split('\n').length >= count;
      const watcher = watch(pin, () => {
        if (!started()) return;
        watcher.close();
        resolve();
      });
      t.after(() => watcher.close());
      if (!started()) return;
      watcher.close();
      resolve();
    });
  const tap = async () => assert.ok('result' in (await alice.ask({ house: 'phone', id: 'remote', method: 'tap' })));

  await tap();
  await pulsed(1);
  await heard(1);

  // The second pulse kills the program before it answers. Once it runs
  // again, a second on the bench's clock sends the pulse again, with its
  // call id, and the program answers the pulse it gave.
  await tap();
  await lives(2);
  await network.elapse(1_000);
  await pulsed(2);
  await heard(2);
  assert.ok(!existsSync(join(pin, 'crash-after')), 'the program died between its second pulse and its answer');

  // The reply to the phone is lost, so a second later it asks again, and
  // the twin answers from its call id.
  network.loseNext();
  await tap();
  await pulsed(3);
  await network.elapse(1_000);
  await heard(3);

  assert.ok(network.crossings.some(({ outcome }) => outcome === 'lost'), 'a reply to the phone was lost');
  assert.equal(readFileSync(join(pin, 'pulses'), 'utf8').trim().split('\n').length, 3, 'three pulses, never four');
  assert.deepEqual(await garage.ask({ house: 'garage', id: 'door', method: 'log' }), { result: { openers: ['alice', 'alice', 'alice'], pulses: [1, 2, 3], failed: [] } });
});
