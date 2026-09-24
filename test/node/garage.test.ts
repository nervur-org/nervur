// A garage door opened from a phone, through a Pi whose relay is a Python
// program over the bridge. Three taps open it three times: once plainly,
// once while the program dies between its pulse and its answer, and once
// while the network loses the reply to the phone. The relay pulses three
// times, never four.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { BenchGround, FakeClock, FakeFaculty, FakeNetwork } from 'nervur/bench';
import { bridge } from 'nervur/node';
import { Bell } from '../fixtures/garage/garage.ts';
import * as phone from '../fixtures/garage/phone.ts';
import * as pi from '../fixtures/garage/pi.ts';
import * as porch from '../fixtures/garage/porch.ts';

const relay = fileURLToPath(new URL('../fixtures/garage/relay.py', import.meta.url));

test('Each tap on the phone pulses the Python relay once, whatever fails between', { timeout: 30_000 }, async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'garage-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const pulses = join(folder, 'pulses');
  const clock = new FakeClock();
  const network = new FakeNetwork({ clock });
  const bell = new FakeFaculty(Bell, { ring: () => null });

  // The Pi's ground: the relay over the bridge, granted to the twin's class alone.
  const offered = await bridge({ command: 'python3', args: [relay], cwd: folder, env: { RELAY_PULSES: pulses, RELAY_CRASH_AFTER: '2' } });
  const garage = await BenchGround.open({
    network,
    clock,
    host: 'pi',
    names: ['garage.local'],
    modules: { pi },
    faculties: { relay: { ...offered, kinds: ['org.example.garage'] }, bell: bell.offer },
  });
  t.after(() => garage.down());
  await garage.add('garage', 'pi', { faculties: ['relay', 'bell'] });
  await garage.ask({ house: 'garage', method: 'bear', args: { kind: 'org.example.garage', id: 'door' } });

  // Alice's phone: a device, holding a standing on the door's twin.
  const alice = await BenchGround.open({ network, clock, host: 'phone', modules: { phone } });
  await alice.add('phone', 'phone');
  await alice.ask({ house: 'phone', method: 'bear', args: { kind: 'org.example.remote', id: 'remote' } });
  const paper = await garage.ask({ house: 'garage', method: 'offerFor', args: { being: 'door', occupant: 'alice' } });
  await alice.ask({ house: 'phone', id: 'remote', method: 'accept', args: { invitation: (paper as { result: { handle: string } }).result.handle } });

  // Time passes on the bench's clock until the bell has rung `rings` times.
  const rung = async (rings: number) => {
    for (let step = 0; step < 5_000 && bell.calls.length < rings; step++) await network.elapse(1_000);
    assert.equal(bell.calls.length, rings, `the bell rang ${rings} times`);
  };
  const tap = async () => assert.ok('result' in (await alice.ask({ house: 'phone', id: 'remote', method: 'tap' })));

  await tap();
  await rung(1);
  await tap();
  await rung(2);
  assert.ok(existsSync(join(folder, 'crashed')), 'the program died between its second pulse and its answer');
  network.loseNext();
  await tap();
  await rung(3);
  for (let step = 0; step < 100 && ((await alice.ask({ house: 'phone', id: 'remote', method: 'heard' })) as { result: number }).result < 3; step++) await network.elapse(1_000);

  assert.ok(network.crossings.some(({ outcome }) => outcome === 'lost'), 'a reply to the phone was lost');
  assert.equal(readFileSync(pulses, 'utf8').trim().split('\n').length, 3, 'three pulses, never four');
  assert.deepEqual(await garage.ask({ house: 'garage', id: 'door', method: 'log' }), { result: { openers: ['alice', 'alice', 'alice'], pulses: [1, 2, 3], failed: [] } });
  assert.deepEqual(await alice.ask({ house: 'phone', id: 'remote', method: 'heard' }), { result: 3 }, 'the phone heard every opening');
});

test('A faculty served in JavaScript calls a handle it was handed back through the house', { timeout: 30_000 }, async (t) => {
  const clock = new FakeClock();
  const network = new FakeNetwork({ clock });
  const doorbell = await bridge({ command: process.execPath, args: ['--conditions=nervur-source', fileURLToPath(new URL('../fixtures/garage/doorbell.ts', import.meta.url))] });
  const ground = await BenchGround.open({ network, clock, host: 'porch', names: ['porch.local'], modules: { porch }, faculties: { bell: doorbell } });
  t.after(() => ground.down());
  await ground.add('porch', 'porch', { faculties: ['bell'] });
  await ground.ask({ house: 'porch', method: 'bear', args: { kind: 'org.example.porch', id: 'porch' } });
  assert.ok('result' in (await ground.ask({ house: 'porch', id: 'porch', method: 'arm' })));
  assert.ok('result' in (await ground.ask({ house: 'porch', id: 'porch', method: 'press' })));
  const rings = async () => ((await ground.ask({ house: 'porch', id: 'porch', method: 'rings' })) as { result: number }).result;
  for (let step = 0; step < 5_000 && (await rings()) < 1; step++) await network.elapse(1_000);
  assert.equal(await rings(), 1);
});
