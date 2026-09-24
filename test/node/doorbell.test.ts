// A faculty served in JavaScript by `nervur/serve`, over the bridge: the
// porch hands the doorbell a handle, and a press calls it back through the
// house. A handle called from a second life of the program acts as the
// first one did, once.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { bridge } from 'nervur/node';
import * as porch from '../fixtures/garage/porch.ts';
import { folder, program } from '../fixtures/node/folder.ts';

test('A faculty served in JavaScript calls a handle it was handed back through the house', { timeout: 30_000 }, async (t) => {
  const network = new FakeNetwork();
  const doorbell = await bridge({ command: process.execPath, args: program('doorbell.ts') });
  t.after(() => doorbell.stop?.());
  const ground = await BenchGround.open({ network, host: 'porch', names: ['porch.local'], modules: { porch }, faculties: { bell: doorbell } });
  t.after(() => ground.down());
  await ground.add('porch', 'porch', { faculties: ['bell'] });
  await ground.ask({ house: 'porch', method: 'bear', args: { kind: 'org.example.porch', id: 'porch' } });
  assert.ok('result' in (await ground.ask({ house: 'porch', id: 'porch', method: 'arm' })));
  assert.ok('result' in (await ground.ask({ house: 'porch', id: 'porch', method: 'press' })));
  // A watch answers once the ring has landed: the event, not a clock.
  assert.deepEqual(await ground.ask({ house: 'porch', id: 'porch', method: 'rings', after: { result: 0 } }), { result: 1 });
});

test('A handle called from a second life of its program acts once, as the first did', { timeout: 30_000 }, async (t) => {
  const { cwd, until } = folder(t);
  const network = new FakeNetwork();
  const bell = await bridge({ command: process.execPath, args: program('lasting-bell.ts'), cwd });
  t.after(() => bell.stop?.());
  const ground = await BenchGround.open({ network, host: 'porch', names: ['porch.local'], modules: { porch }, faculties: { bell } });
  t.after(() => ground.down());
  await ground.add('porch', 'porch', { faculties: ['bell'] });
  await ground.ask({ house: 'porch', method: 'bear', args: { kind: 'org.example.porch', id: 'porch' } });
  const ask = (method: string) => ground.ask({ house: 'porch', id: 'porch', method });
  assert.ok('result' in (await ask('arm')));

  assert.ok('result' in (await ask('press')));
  await until('presses', 1);
  assert.deepEqual(await ask('rings'), { result: 1 });

  // The second press kills the program before it calls back. The house
  // sends it again a second later, to the program's second life.
  writeFileSync(join(cwd, 'die'), '');
  assert.ok('result' in (await ask('press')));
  await until('lives', 2);
  await network.elapse(1_000);
  await until('presses', 2);
  assert.deepEqual(await ask('rings'), { result: 2 });
});
