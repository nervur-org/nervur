// A faculty that crashes, refuses or hangs, and a memory that refuses a
// write, on the bench. An effect to a faculty is tried again after a crash
// and acts once; a refusal is final; a refused write lands nothing.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeClock, FakeFaculty, FakeMemory, FakeNetwork } from 'nervur/bench';
import { Mail } from '../fixtures/world/mailer.ts';
import * as office from '../fixtures/world/office.ts';

const world = async () => {
  const clock = new FakeClock();
  const network = new FakeNetwork({ clock });
  const mail = new FakeFaculty(Mail, { send: (args) => `sent to ${(args as { to: string }).to}` });
  const ground = await BenchGround.open({ network, clock, host: 'office', names: ['office.example'], modules: { office }, faculties: { mail: mail.offer } });
  await ground.add('office', 'office', { faculties: ['mail'] });
  await ground.ask({ house: 'office', method: 'bear', args: { kind: 'org.example.mailer', id: 'mailer' } });
  const log = async () => ((await ground.ask({ house: 'office', id: 'mailer', method: 'log' })) as { result: { sent: string[]; failed: string[]; count: number } }).result;
  return { network, mail, ground, log };
};

test('A faculty that crashes is tried again with the same call id, and its answer lands once', async () => {
  const { network, mail, ground, log } = await world();
  mail.throwNext(2);
  assert.ok('result' in (await ground.ask({ house: 'office', id: 'mailer', method: 'notify', args: { to: 'ana' } })));
  await network.elapse(30_000);
  assert.deepEqual((await log()).sent, ['sent to ana']);
  assert.equal(mail.calls.length, 3, 'two crashes and the answer');
  assert.equal(new Set(mail.calls.map(({ id }) => id)).size, 1, 'one call id throughout');
});

test('A faculty’s refusal is final, and reaches the reply once', async () => {
  const { network, mail, ground, log } = await world();
  mail.refuseNext('no such mailbox');
  await ground.ask({ house: 'office', id: 'mailer', method: 'notify', args: { to: 'nobody' } });
  await network.elapse(30_000);
  assert.deepEqual(await log(), { sent: [], failed: ['no such mailbox'], count: 0 });
  assert.equal(mail.calls.length, 1);
});

test('A refused write lands nothing, and the ask after it lands', async () => {
  const { ground, log } = await world();
  const memory = ground.machine.memoryOf('office') as FakeMemory;
  memory.refuseNext();
  const refused = await ground.ask({ house: 'office', id: 'mailer', method: 'count', args: { by: 5 } });
  assert.ok(!('result' in refused), 'the memory refused her write');
  assert.equal((await log()).count, 0);
  assert.ok('result' in (await ground.ask({ house: 'office', id: 'mailer', method: 'count', args: { by: 5 } })));
  assert.equal((await log()).count, 5);
});
