// A NodeGround on a folder: its recipe's faculties, its houses from folders
// of code on ledgers, its record kept across a restart, and the command as
// a face that reads every word it offers from what the ground describes.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { NodeGround } from 'nervur/node';
import { cli } from '../fixtures/node/grounds.ts';

const folder = fileURLToPath(new URL('../fixtures/node-ground/', import.meta.url));
const run = promisify(execFile);
const env = { NERVUR_TCP_PORT: '0', NERVUR_HTTP_PORT: '0', NERVUR_BIND: '127.0.0.1', NERVUR_ALLOW_PRIVATE: '1', ECHO_PREFIX: '~' };

// The command, as an owner runs it on the machine: its one JSON line, and its exit.
const nervur = async (hand: string, ...args: string[]) => {
  try {
    const { stdout } = await run(process.execPath, [cli, '--at', hand, ...args]);
    return { code: 0, answer: JSON.parse(stdout) as Record<string, unknown> };
  } catch (error) {
    const failed = error as { code: number; stdout: string };
    return { code: failed.code, answer: JSON.parse(failed.stdout || 'null') as Record<string, unknown> };
  }
};

const shop = ['name=shop', 'memory={"body":"ledger"}', 'classes={"body":"folder","at":"shop"}', 'faculties=["echo"]'];

test('A NodeGround opens houses from its folder, serves its faculties, and keeps its record', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  t.after(() => rm(state, { recursive: true, force: true }));
  const first = await NodeGround.open({ folder, state, env });
  let open: NodeGround | undefined = first;
  t.after(() => open?.close());

  const added = await nervur(first.hand, 'houses', 'add', ...shop);
  assert.equal(added.code, 0, JSON.stringify(added.answer));
  const ward = (added.answer.result as { ward: string }).ward;
  assert.equal((await nervur(first.hand, 'ask', 'shop', 'bear', 'kind=org.example.parrot', 'id=polly')).code, 0);
  assert.deepEqual((await nervur(first.hand, 'ask', 'shop', '--id', 'polly', 'repeat', '{"text":"hi"}')).answer, { result: '~hi' }, 'the recipe’s faculty, with its setting');
  const shown = await nervur(first.hand, 'ask', 'shop', '--id', 'polly');
  assert.ok(shown.code === 0 && 'describe' in shown.answer, 'with no method, what she shows, and what was asked exits 0');
  const echoed = await fetch(`http://127.0.0.1:${first.httpPort}/echo?text=hello`);
  assert.equal(await echoed.text(), 'hello', 'the faculty’s handler on the ground’s listener');

  await first.close();
  open = undefined;
  const second = await NodeGround.open({ folder, state, env });
  open = second;
  const listed = await nervur(second.hand, 'houses', 'list');
  assert.deepEqual(listed.answer, { result: [{ name: 'shop', ward }] });
  assert.deepEqual((await nervur(second.hand, 'ask', 'shop', '--id', 'polly', 'repeat', 'text=again')).answer, { result: '~again' }, 'her row stayed in the ledger');
});

test('The command reads every word from what the ground describes', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  t.after(() => rm(state, { recursive: true, force: true }));
  const ground = await NodeGround.open({ folder, state, env });
  t.after(() => ground.close());

  const help = await nervur(ground.hand, 'help');
  const faculties = (help.answer.result as { faculties: Record<string, { methods: Record<string, unknown> }> }).faculties;
  assert.deepEqual(Object.keys(faculties).sort(), ['echo', 'houses', 'moves']);
  assert.deepEqual(Object.keys(faculties.houses.methods).sort(), ['add', 'list', 'remove']);
  assert.deepEqual(Object.keys((await nervur(ground.hand, 'echo')).answer.result as { methods: object }), ['blueprint', 'methods']);
  assert.deepEqual((await nervur(ground.hand, 'echo', 'say', 'text=yo')).answer, { result: '~yo' }, 'any faculty, called as its owner');
  const wrong = await nervur(ground.hand, 'echo', 'say', 'words=yo');
  assert.equal(wrong.code, 1, 'args held to the method’s schema');
  assert.equal((await nervur(ground.hand, 'nothing')).code, 1);
});

test('A house’s code stands inside the ground’s folder', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  t.after(() => rm(state, { recursive: true, force: true }));
  const ground = await NodeGround.open({ folder, state, env });
  t.after(() => ground.close());
  const outside = await nervur(ground.hand, 'houses', 'add', 'name=loose', 'memory={"body":"ledger"}', 'classes={"body":"folder","at":"../where"}');
  assert.equal(outside.code, 1);
  assert.match((outside.answer.error as { message: string }).message, /a folder of code stands inside/);
  assert.deepEqual((await nervur(ground.hand, 'ask', 'loose', 'bear')).answer, { error: { message: 'no house loose is open here' } });
});

test('The command writes the unit or the job that runs a folder', async () => {
  const { stdout } = await run(process.execPath, [cli, 'service', folder]);
  assert.match(stdout, process.platform === 'darwin' ? /<string>up<\/string>/ : /ExecStart=.* up /);
  assert.ok(stdout.includes(folder.replace(/\/$/, '')), 'it names the folder');
});
