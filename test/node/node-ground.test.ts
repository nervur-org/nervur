// A NodeGround on a folder: its ladder stood from its drawer, its houses
// from folders of code in its view of the ground's ledger, its drawer
// kept across a restart, and the command as a face that reads every word
// it offers from what the ground describes.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { NodeGround } from 'nervur/node';
import { cli } from '../fixtures/node/grounds.ts';

const folder = fileURLToPath(new URL('../fixtures/node-ground/', import.meta.url));
const run = promisify(execFile);
const env = { NERVUR_TCP_PORT: '0', NERVUR_HTTP_PORT: '0', NERVUR_BIND: '127.0.0.1', NERVUR_ALLOW_PRIVATE: '1' };

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

// The command with its args on standard input, as `-` reads them.
const piped = (hand: string, input: string, ...args: string[]) =>
  new Promise<{ code: number | null; answer: Record<string, unknown> }>((resolve, reject) => {
    const child = spawn(process.execPath, [cli, '--at', hand, ...args, '-'], { stdio: ['pipe', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, answer: JSON.parse(out || 'null') as Record<string, unknown> }));
    child.stdin.end(input);
  });

// The ground's ladder, stood through its hand: the folder's registry, then its echo, with its prefix.
const ladder = async (hand: string) => {
  assert.equal((await nervur(hand, 'faculties', 'add', 'name=recipe', 'make=module', 'args={"at":"recipe.ts"}')).code, 0);
  const echo = await nervur(hand, 'faculties', 'add', 'name=echo', 'from=recipe', 'make=echo', 'args={"prefix":"~"}', 'secrets=["signature"]');
  return echo;
};

const shop = ['name=shop', 'classes={"faculty":"folder","at":"shop"}', 'faculties=["echo"]'];

test('A NodeGround stands its ladder, opens houses from its folder, serves its faculties, and keeps its drawer', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  t.after(() => rm(state, { recursive: true, force: true }));
  const first = await NodeGround.open({ folder, state, env });
  let open: NodeGround | undefined = first;
  t.after(() => open?.close());

  const lacking = await ladder(first.hand);
  assert.equal(lacking.code, 1, 'a faculty whose secret is not kept stays down');
  assert.match((lacking.answer.error as { message: string }).message, /no secret signature is kept/);
  assert.deepEqual((await piped(first.hand, '{"name":"signature","value":"— polly"}', 'secrets', 'set')).answer, { result: null }, 'a secret read from standard input');
  assert.equal((await nervur(first.hand, 'faculties', 'restart', 'name=echo')).code, 0, 'it stands once its secret is kept and it goes up again');
  assert.equal((await ladder(first.hand)).code, 0, 'the same entries answer as they stand');

  const added = await nervur(first.hand, 'houses', 'add', ...shop);
  assert.equal(added.code, 0, JSON.stringify(added.answer));
  const ward = (added.answer.result as { ward: string }).ward;
  assert.equal((await nervur(first.hand, 'ask', 'shop', 'bear', 'kind=org.example.parrot', 'id=polly')).code, 0);
  assert.deepEqual((await nervur(first.hand, 'ask', 'shop', '--id', 'polly', 'repeat', '{"text":"hi"}')).answer, { result: '~hi — polly' }, 'the faculty, with its args and its secret');
  const shown = await nervur(first.hand, 'ask', 'shop', '--id', 'polly');
  assert.ok(shown.code === 0 && 'describe' in shown.answer, 'with no method, what she shows, and what was asked exits 0');
  const echoed = await fetch(`http://127.0.0.1:${first.httpPort}/echo?text=hello`);
  assert.equal(await echoed.text(), 'hello', 'the faculty’s handler on the ground’s listener, stood while it ran');
  assert.ok(!(await readFile(join(state, 'ground.ledger'), 'utf8')).includes('polly'), 'the ledger holds her sealed');

  await first.close();
  open = undefined;
  const second = await NodeGround.open({ folder, state, env });
  open = second;
  const listed = await nervur(second.hand, 'houses', 'list');
  assert.deepEqual(listed.answer, { result: [{ name: 'shop', entry: { classes: { faculty: 'folder', at: 'shop' }, faculties: ['echo'] }, ward }] }, 'each house with its whole entry');
  assert.deepEqual((await nervur(second.hand, 'ask', 'shop', '--id', 'polly', 'repeat', 'text=again')).answer, { result: '~again — polly' }, 'her row and the ladder stayed in the drawer');
});

test('The command reads every word from what the ground describes', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  t.after(() => rm(state, { recursive: true, force: true }));
  const ground = await NodeGround.open({ folder, state, env });
  t.after(() => ground.close());
  await piped(ground.hand, '{"name":"signature","value":"!"}', 'secrets', 'set');
  await ladder(ground.hand);

  const help = await nervur(ground.hand, 'help');
  const faculties = (help.answer.result as { faculties: Record<string, { methods: Record<string, unknown> }> }).faculties;
  assert.deepEqual(Object.keys(faculties).sort(), ['clock', 'echo', 'faculties', 'folder', 'houses', 'moves', 'recipe', 'secrets', 'tcp', 'web']);
  assert.deepEqual(Object.keys(faculties.houses.methods).sort(), ['add', 'list', 'remove', 'update']);
  assert.deepEqual(Object.keys(faculties.faculties.methods).sort(), ['add', 'list', 'remove', 'restart', 'update']);
  assert.deepEqual(faculties.recipe.methods, {}, 'a registry offers beings nothing');
  assert.deepEqual(Object.keys((await nervur(ground.hand, 'echo')).answer.result as { methods: object }), ['blueprint', 'methods']);
  assert.deepEqual((await nervur(ground.hand, 'echo', 'say', 'text=yo')).answer, { result: '~yo !' }, 'any faculty, called as its owner');
  const wrong = await nervur(ground.hand, 'echo', 'say', 'words=yo');
  assert.equal(wrong.code, 1, 'args held to the method’s schema');
  assert.equal((await nervur(ground.hand, 'nothing')).code, 1);
  assert.deepEqual((await nervur(ground.hand, 'secrets', 'list')).answer, { result: ['signature'] }, 'names, and never a value');
});

test('A house’s code and a module stand inside the ground’s folder', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  t.after(() => rm(state, { recursive: true, force: true }));
  const ground = await NodeGround.open({ folder, state, env });
  t.after(() => ground.close());
  const outside = await nervur(ground.hand, 'houses', 'add', 'name=loose', 'classes={"faculty":"folder","at":"../where"}');
  assert.equal(outside.code, 1);
  assert.match((outside.answer.error as { message: string }).message, /a folder of code stands inside/);
  assert.deepEqual((await nervur(ground.hand, 'ask', 'loose', 'bear')).answer, { error: { message: 'no house loose is open here' } });
  const module = await nervur(ground.hand, 'faculties', 'add', 'name=stray', 'make=module', 'args={"at":"../../index.ts"}');
  assert.match((module.answer.error as { message: string }).message, /a module stands inside/);
});

test('The command writes the unit or the job that runs a folder', async () => {
  const { stdout } = await run(process.execPath, [cli, 'service', folder]);
  assert.match(stdout, process.platform === 'darwin' ? /<string>up<\/string>/ : /ExecStart=.* up /);
  assert.ok(stdout.includes(folder.replace(/\/$/, '')), 'it names the folder');
});
