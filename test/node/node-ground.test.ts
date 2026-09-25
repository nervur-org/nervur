// A NodeGround on a folder: its ladder stood from its drawer, its houses
// from folders of code in its view of the ground's ledger, its drawer
// kept across a restart, and the command as a face that reads every word
// it offers from what the ground describes.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { NodeGround } from 'nervur/node';
import { cli } from '../fixtures/node/grounds.ts';
import { loopbackGround } from '../fixtures/node/spawned.ts';

const folder = fileURLToPath(new URL('../fixtures/node-ground/', import.meta.url));
const run = promisify(execFile);

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
  assert.equal((await nervur(hand, 'faculties', 'add', 'name=recipe', 'from=folder', 'make=module', 'args={"at":"recipe.ts"}')).code, 0);
  const echo = await nervur(hand, 'faculties', 'add', 'name=echo', 'from=recipe', 'make=echo', 'args={"prefix":"~"}', 'secrets=["signature"]');
  return echo;
};

const shop = ['name=shop', 'classes={"faculty":"folder","at":"shop"}', 'faculties=["echo"]'];

test('A NodeGround stands its ladder, opens houses from its folder, serves its faculties, and keeps its drawer', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  const first = await loopbackGround(folder, state, { web: true });
  let open: NodeGround | undefined = first;
  t.after(() => open?.close());
  t.after(() => rm(state, { recursive: true, force: true }));

  const lacking = await ladder(first.hand);
  assert.equal(lacking.code, 1, 'an entry naming a secret not kept is refused at the hand');
  assert.equal((lacking.answer.error as { message: string }).message, 'the faculty echo is refused: no secret signature is kept');
  const wrong = await nervur(first.hand, 'faculties', 'add', 'name=echo', 'from=recipe', 'make=echo', 'args={"prefix":1}', 'secrets=["signature"]');
  assert.equal((wrong.answer.error as { message: string }).message, 'the faculty echo is refused: its args.prefix is not a string', 'what a module’s faculty takes is held too');
  assert.deepEqual((await piped(first.hand, '{"name":"signature","value":"— polly"}', 'secrets', 'set')).answer, { result: null }, 'a secret read from standard input');
  assert.equal((await ladder(first.hand)).code, 0, 'it stands once its secret is kept');
  assert.equal((await ladder(first.hand)).code, 0, 'the same entries answer as they stand');

  const added = await nervur(first.hand, 'houses', 'add', ...shop);
  assert.equal(added.code, 0, JSON.stringify(added.answer));
  const ward = (added.answer.result as { ward: string }).ward;
  assert.equal((await nervur(first.hand, 'ask', 'shop', 'bear', 'kind=org.example.parrot', 'id=polly')).code, 0);
  assert.deepEqual((await nervur(first.hand, 'ask', 'shop', '--id', 'polly', 'repeat', '{"text":"hi"}')).answer, { result: '~hi — polly' }, 'the faculty, with its args and its secret');
  const shown = await nervur(first.hand, 'ask', 'shop', '--id', 'polly');
  assert.ok(shown.code === 0 && 'describe' in shown.answer, 'with no method, what she shows, and what was asked exits 0');
  const echoed = await fetch(`http://127.0.0.1:${await first.port()}/echo?text=hello`);
  assert.equal(await echoed.text(), 'hello', 'the faculty’s handler on the ground’s listener, stood while it ran');
  assert.ok(!(await readFile(join(state, 'ground.ledger'), 'utf8')).includes('polly'), 'the ledger holds her sealed');

  await first.close();
  open = undefined;
  const second = await NodeGround.open({ folder, state, env: {} });
  open = second;
  const listed = await nervur(second.hand, 'houses', 'list');
  assert.deepEqual(listed.answer, { result: [{ name: 'shop', entry: { classes: { faculty: 'folder', at: 'shop' }, faculties: ['echo'] }, ward }] }, 'each house with its whole entry');
  assert.deepEqual((await nervur(second.hand, 'ask', 'shop', '--id', 'polly', 'repeat', 'text=again')).answer, { result: '~again — polly' }, 'her row and the ladder stayed in the drawer');
});

test('The command reads every word from what the ground describes', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  const ground = await loopbackGround(folder, state);
  t.after(() => ground.close());
  t.after(() => rm(state, { recursive: true, force: true }));
  await piped(ground.hand, '{"name":"signature","value":"!"}', 'secrets', 'set');
  await ladder(ground.hand);

  const help = await nervur(ground.hand, 'help');
  const { dock, faculties } = help.answer.result as { dock: { asks: { method: string }[] }; faculties: Record<string, { methods: Record<string, unknown> }> };
  assert.deepEqual(Object.keys(faculties).sort(), ['echo', 'folder', 'listener', 'recipe', 'shell', 'tcp', 'web'], 'the ladder alone, the clock primordial');
  assert.deepEqual(
    dock.asks.map(({ method }) => method).sort(),
    [
      'boot',
      'callFaculty',
      'facultiesAdd',
      'facultiesCatalog',
      'facultiesList',
      'facultiesRemove',
      'facultiesRestart',
      'facultiesUpdate',
      'granted',
      'grants',
      'housesAdd',
      'housesList',
      'housesRemove',
      'housesUpdate',
      'movesIn',
      'movesOut',
      'pilotsDismiss',
      'pilotsInvite',
      'pilotsList',
      'secretsList',
      'secretsRemove',
      'secretsSet',
      'shellRun',
      'waitSet',
      'waitShow',
    ],
    'the dock’s asks, as the hand reaches them',
  );
  assert.deepEqual(
    ((await nervur(ground.hand, 'houses')).answer.result as { method: string }[]).map(({ method }) => method).sort(),
    ['housesAdd', 'housesList', 'housesRemove', 'housesUpdate'],
    'one word shows the asks it begins',
  );
  assert.deepEqual(faculties.recipe.methods, {}, 'a registry offers beings nothing');
  assert.deepEqual(Object.keys((await nervur(ground.hand, 'echo')).answer.result as { methods: object }), ['blueprint', 'methods']);
  assert.deepEqual((await nervur(ground.hand, 'echo', 'say', 'text=yo')).answer, { result: '~yo !' }, 'any faculty, called as its owner');
  const wrong = await nervur(ground.hand, 'echo', 'say', 'words=yo');
  assert.equal(wrong.code, 1, 'args held to the method’s schema');
  assert.equal((await nervur(ground.hand, 'nothing')).code, 1);
  assert.deepEqual((await nervur(ground.hand, 'secrets', 'list')).answer, { result: [{ name: 'signature', kept: true, entries: ['echo'] }] }, 'names and who names them, and never a value');
  const catalog = (await nervur(ground.hand, 'faculties', 'catalog')).answer.result as { from?: string; faculties: { make: string; takes?: { secrets?: object } }[] }[];
  assert.deepEqual(
    catalog.map(({ from, faculties: held }) => [from ?? 'ground', held.map(({ make }) => make)]),
    [
      ['ground', ['clock', 'file-unlock', 'folder', 'ground', 'keychain-unlock', 'ledger', 'listener', 'noble', 'shell', 'socket-hand', 'strict', 'tcp', 'web']],
      ['folder', ['bridge', 'module']],
      ['recipe', ['echo']],
    ],
    'every registry of the ladder and each faculty it holds',
  );
  assert.deepEqual(catalog[2].faculties[0].takes?.secrets, { signature: 'the words it signs with' }, 'with what each takes');
  const first = await nervur(ground.hand, '--call', 'restart-1', 'faculties', 'restart', 'name=echo');
  assert.deepEqual(first.answer, { result: {} });
  assert.deepEqual((await nervur(ground.hand, '--call', 'restart-1', 'faculties', 'restart', 'name=echo')).answer, first.answer, 'a call id sent again answers what the first answered');
});

test('A house’s code and a module stand inside the ground’s folder', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  const ground = await loopbackGround(folder, state);
  // The ground closes before its state goes, so nothing it still writes lands in a folder being removed.
  t.after(async () => {
    await ground.close();
    await rm(state, { recursive: true, force: true });
  });
  const outside = await nervur(ground.hand, 'houses', 'add', 'name=loose', 'classes={"faculty":"folder","at":"../where"}');
  assert.match((outside.answer.result as { why: string }).why, /a folder of code stands inside/, 'its entry lands, and the house stays closed with why');
  assert.deepEqual((await nervur(ground.hand, 'ask', 'loose', 'bear')).answer, { error: { message: 'no house loose is open here' } });
  const module = await nervur(ground.hand, 'faculties', 'add', 'name=stray', 'from=folder', 'make=module', 'args={"at":"../../index.ts"}');
  assert.match((module.answer.result as { why: string }).why, /a module stands inside/, 'its entry lands, and its body stays down with why');
});

test('It refuses a setting read from the environment beyond what opens the drawer and the hand: a port moved through the dock is kept across a restart', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  const read = new Set<string>();
  const given: Record<string, string> = { NERVUR_TCP_PORT: '1', NERVUR_HTTP_PORT: '1', NERVUR_BIND: '10.9.9.9', NERVUR_WAIT: 'never', NERVUR_ADDRESSES: 'tcp://nowhere:1', NERVUR_ORIGINS: 'https://nowhere', NERVUR_ALLOW_PRIVATE: '1' };
  const env = new Proxy(given, {
    get: (held, name: string) => {
      read.add(name);
      return held[name];
    },
  });
  // Every entry the terrain's: its TCP stands on the loopback at 9110, or down where another ground holds it.
  let open: NodeGround | undefined = await NodeGround.open({ folder, state, env });
  t.after(() => open?.close());
  t.after(() => rm(state, { recursive: true, force: true }));
  assert.deepEqual(
    [...read].filter((name) => !['NERVUR_STATE', 'NERVUR_UNLOCK', 'NERVUR_HAND'].includes(name)),
    [],
    'the ground read only what opens its drawer and its hand',
  );
  const terrain = (await nervur(open.hand, 'faculties', 'list')).answer.result as { name: string; entry: object; terrain?: boolean }[];
  assert.deepEqual(terrain.find(({ name }) => name === 'web'), { name: 'web', entry: { make: 'web', args: { bind: '127.0.0.1' }, faculties: ['listener'] }, terrain: true, serves: 'carry' }, 'the terrain’s entry as its code fixes it, whatever the environment says');
  assert.deepEqual(terrain.find(({ name }) => name === 'tcp')?.entry, { make: 'tcp', args: { bind: '127.0.0.1', port: 9110 } }, 'a new ground listens on this machine alone, until its owner names a bind');
  assert.equal((await nervur(open.hand, 'faculties', 'update', 'name=tcp', 'make=tcp', 'args={"port":"x"}')).code, 1, 'a port that is no port is refused at the hand');
  assert.equal((await nervur(open.hand, 'faculties', 'update', 'name=tcp', 'make=tcp', 'args={"port":0,"bind":"127.0.0.1"}')).code, 0);
  await open.close();
  open = await NodeGround.open({ folder, state, env: {} });
  const kept = (await nervur(open.hand, 'faculties', 'list')).answer.result as { name: string; entry: object; terrain?: boolean }[];
  assert.deepEqual(kept.find(({ name }) => name === 'tcp'), { name: 'tcp', entry: { make: 'tcp', args: { port: 0, bind: '127.0.0.1' } }, serves: 'carry' }, 'the drawer kept the owner’s port');
});

test('A port another holds keeps the TCP body down with why, the ground boots beside it, and the hand mends it', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  // A listener holding the terrain's port on the loopback; where another holds it already, it stays taken all the same.
  const holder = createServer();
  const held = await new Promise<boolean>((resolve) => {
    holder.once('error', () => resolve(false));
    holder.listen(9110, '127.0.0.1', () => resolve(true));
  });
  t.after(() => new Promise<void>((resolve) => (held ? holder.close(() => resolve()) : resolve())));
  const ground = await NodeGround.open({ folder, state, env: {} });
  t.after(() => ground.close());
  t.after(() => rm(state, { recursive: true, force: true }));
  const listed = (await nervur(ground.hand, 'faculties', 'list')).answer.result as { name: string; why?: string }[];
  assert.match(listed.find(({ name }) => name === 'tcp')?.why ?? '', /EADDRINUSE/, 'down, and the reason names the port taken');
  assert.equal((await nervur(ground.hand, 'houses', 'list')).code, 0, 'the ground is up, and its hand answers');
  assert.equal((await nervur(ground.hand, 'faculties', 'update', 'name=tcp', 'make=tcp', 'args={"port":0,"bind":"127.0.0.1"}')).code, 0, 'the hand mends it');
  const mended = (await nervur(ground.hand, 'faculties', 'list')).answer.result as { name: string; why?: string; serves?: string }[];
  assert.deepEqual(mended.find(({ name }) => name === 'tcp'), { name: 'tcp', entry: { make: 'tcp', args: { port: 0, bind: '127.0.0.1' } }, serves: 'carry' });
});

test('It refuses a second ground on the state one runs on: its ledger holds the state’s lock while it stands, and lets it go when it goes down', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  t.after(() => rm(state, { recursive: true, force: true }));
  const first = await NodeGround.open({ folder, state, env: {} });
  await assert.rejects(NodeGround.open({ folder, state, env: {} }), /holds the lock of/);
  await first.close();
  const second = await NodeGround.open({ folder, state, env: {} });
  await second.close();
});

test('The hand is a primordial faculty: its socket stands once the dock has booted, goes first at the stop, and no entry names it', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  t.after(() => rm(state, { recursive: true, force: true }));
  const ground = await NodeGround.open({ folder, state, env: {} });
  const help = await nervur(ground.hand, 'help');
  assert.equal(help.code, 0, 'its socket answers');
  assert.equal((help.answer.result as { faculties: Record<string, unknown> }).faculties.hand, undefined, 'it stands in no ladder');
  assert.deepEqual((await nervur(ground.hand, 'faculties', 'add', 'name=hand', 'make=socket-hand')).answer, { error: { message: 'the hand is primordial: its entry is the host’s, and the drawer names none' } });
  assert.deepEqual((await nervur(ground.hand, 'faculties', 'add', 'name=mine', 'make=socket-hand')).answer, { error: { message: 'the faculty socket-hand is the ground’s hand, which is primordial, and the drawer names none' } });
  await ground.close();
  assert.equal(existsSync(ground.hand), false, 'its socket goes with it');
});

test('The shell runs a command for the hand alone, and its environment holds nothing of the ground', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  process.env.NERVUR_PROBE = 'a variable of the ground’s';
  t.after(() => void delete process.env.NERVUR_PROBE);
  const ground = await NodeGround.open({ folder, state, env: {} });
  t.after(() => ground.close());
  t.after(() => rm(state, { recursive: true, force: true }));
  await piped(ground.hand, '{"name":"signature","value":"never-in-a-shell"}', 'secrets', 'set');
  assert.deepEqual(await nervur(ground.hand, 'shell', 'run', '--', 'echo', 'hi'), { code: 0, answer: { result: { code: 0, stdout: 'hi\n', stderr: '' } } }, 'a command line after --');
  const printed = ((await nervur(ground.hand, 'shell', 'run', '--', 'env')).answer.result as { stdout: string }).stdout;
  assert.match(printed, /^PATH=/m, 'the variables its entry names');
  assert.ok(!printed.includes('NERVUR_'), 'no variable of the ground’s');
  assert.ok(!printed.includes('never-in-a-shell'), 'no secret');
  assert.deepEqual((await nervur(ground.hand, 'ask', 'dock', '--id', 'faculty.shell', '--cells')).answer.result, { terrain: true, entry: null, installed: JSON.stringify({ args: { env: ['PATH', 'HOME', 'USER', 'LANG', 'TERM', 'SHELL', 'TMPDIR'], root: folder.replace(/\/$/, '') }, kinds: ['org.nervur.dock.shell'], make: 'shell' }), why: null, serves: null, port: null }, 'its twin, read in the dock, granted to the dock’s shell alone');
  assert.deepEqual((await nervur(ground.hand, 'ask', 'dock', '--id', 'secret.signature', '--cells')).answer, { error: { message: 'a secret’s cells are shown to no one' } });
  assert.deepEqual((await nervur(ground.hand, 'faculties', 'update', 'name=shell', 'make=shell', 'args={"root":"/","env":["NERVUR_PROBE"]}')).answer, { error: { message: 'the shell is the dock’s alone: no entry names it, makes it or grants it' } }, 'no owner moves its entry');
});

test('The command writes the unit or the job that runs a folder', async () => {
  const { stdout } = await run(process.execPath, [cli, 'service', folder]);
  assert.match(stdout, process.platform === 'darwin' ? /<string>up<\/string>/ : /ExecStart=.* up /);
  assert.ok(stdout.includes(folder.replace(/\/$/, '')), 'it names the folder');
});
