// SPDX-License-Identifier: Apache-2.0
// The `nervur` command as a person runs it: every command its own process.
// A harbor is made, asked straight from its folder with no server, then
// served, and two served harbors meet over TCP with the command alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import type { JsonObject } from '../../src/core/being/index.ts';
import { farAnswer, main, parse, pilotRequests, requestOf, SERVING, via } from '../../src/core/cli/command.ts';
import { hex } from '../../src/core/crypto/index.ts';
import { EdgeCustody, readPack, type EdgeStorage } from '../../src/core/edge/index.ts';
import { socketOf } from '../../src/core/node/index.ts';
import { Dna, readRootRequest, type RootRequest } from '../../src/core/harbor/index.ts';
import { DEFAULTS, World } from '../../src/index.ts';
import { holds } from '../claims.ts';
import { shop, SHOP_FILE as SHOP } from '../core/harbor/shop.ts';
import { scratch } from '../core/contract/suites.ts';

const run = promisify(execFile);
const MAIN = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));
const TIME = { timeout: 30_000 };

// What `module add` answered: the module and its version, `live` aside.
const added = (said: Said): unknown => {
  const answer = (said.out as { answer?: { answer?: JsonObject } }).answer?.answer;
  return answer?.added === undefined ? said.out : { added: answer.added, version: answer.version };
};

type Said = { code: number; out: Record<string, unknown> };
const nervur = async (dir: string, ...args: string[]): Promise<Said> => {
  try {
    const { stdout } = await run(process.execPath, [MAIN, ...args, '--dir', dir]);
    return { code: 0, out: JSON.parse(stdout) as Record<string, unknown> };
  } catch (e) {
    const { code, stdout, stderr } = e as { code: number; stdout: string; stderr: string };
    return { code, out: stdout ? (JSON.parse(stdout) as Record<string, unknown>) : { stderr } };
  }
};

// A served harbor, once it printed where it listens.
const served = (dir: string, ...args: string[]): Promise<{ child: ChildProcess; pk: string; at: string }> =>
  new Promise((done, fail) => {
    const child = spawn(process.execPath, [MAIN, 'serve', '--dir', dir, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    let err = '';
    child.stderr!.on('data', (d: Buffer) => (err += d.toString()));
    child.stdout!.on('data', (d: Buffer) => {
      text += d.toString();
      if (text.includes('\n')) done({ child, ...(JSON.parse(text) as { pk: string; at: string }) });
    });
    child.once('exit', (code) => fail(new Error(`serve exited ${String(code)}: ${err}`)));
  });
const stop = (child: ChildProcess): Promise<unknown> => {
  const gone = new Promise((done) => child.once('exit', done));
  child.kill('SIGTERM');
  return gone;
};

test(holds('dna.command', 'cli: module add commits a file’s text, a file that does not load says why, and log and live walk and move the DNA'), TIME, async () => {
  const project = scratch();
  const dir = join(project, 'harbor');
  const file = join(project, 'greetings.js');
  await writeFile(file, "import { readFile } from 'node:fs';\nexport const module = 'org.example.greetings';\nexport const version = '1';\nexport const classes = [];\n");
  await nervur(dir, 'init');
  assert.deepEqual(await nervur(dir, 'module', 'add', file), { code: 1, out: { answer: { answer: { error: "a module imports nothing but 'nervur'" } } } });
  await writeFile(file, 'export const module = ;\n');
  assert.match(((await nervur(dir, 'module', 'add', file)).out as { answer: { answer: { error: string } } }).answer.answer.error, /^the module did not load: /);
  await writeFile(file, "export const module = 'org.example.greetings';\nexport const version = '1';\nexport const classes = [];\n");
  const genesis = ((await nervur(dir, 'live')).out as { answer: { answer: { live: string } } }).answer.answer.live;
  const said = await nervur(dir, 'module', 'add', file);
  assert.deepEqual(added(said), { added: 'org.example.greetings', version: '1' });
  const one = said.out as { answer: { answer: { live: string } } };
  const log = ((await nervur(dir, 'log')).out as { answer: { answer: { log: { commit: string; message: string }[] } } }).answer.answer.log;
  assert.deepEqual(
    log.map((l) => [l.commit, l.message]),
    [
      [one.answer.answer.live, 'add org.example.greetings 1'],
      [genesis, 'genesis'],
    ],
  );
  assert.deepEqual((await nervur(dir, 'live', genesis)).out, { answer: { answer: { live: genesis } } });
  assert.deepEqual(((await nervur(dir, 'modules')).out as { answer: { answer: { modules: JsonObject } } }).answer.answer.modules, {}, 'the genesis commit runs nothing');
  assert.deepEqual((await nervur(dir, 'origin', 'http://127.0.0.1:9/none.git')).out, { answer: { answer: { origin: 'http://127.0.0.1:9/none.git' } } });
  assert.equal((await nervur(dir, 'fetch')).code, 1, 'a fetch from nowhere is an error answer');
  assert.deepEqual((await nervur(dir, 'origin', 'none')).out, { answer: { answer: { origin: null } } });
  assert.equal((await nervur(dir, 'gc')).code, 0, 'gc is the catalogue ask of that name');
});

test('[cli] a command names one root request, and a malformed one says why', () => {
  assert.deepEqual(parse(['boot', 'k', 'com.acme.x', '--ward', 'w']), { command: 'boot', words: ['k', 'com.acme.x'], flags: { ward: 'w' } });
  assert.throws(() => parse(['census', '--nope', 'x']), /--nope is no flag/);
  assert.throws(() => parse(['census', '--dir']), /--dir is no flag/);
  assert.deepEqual(parse([]), { words: [], flags: {} });
  assert.deepEqual(requestOf('census', [], {}), {});
  assert.deepEqual(requestOf('sweep', [], {}), { method: 'sweep', args: {} });
  assert.deepEqual(requestOf('host', ['w'], { seed: 'ab' }), { method: 'host', args: { ward: 'w', seed: 'ab' } });
  assert.deepEqual(requestOf('host', ['w'], { memory: 'vault' }), { method: 'host', args: { ward: 'w', memory: 'vault' } });
  assert.deepEqual(requestOf('move', ['w', 'vault'], {}), { method: 'move', args: { ward: 'w', memory: 'vault' } });
  assert.deepEqual(requestOf('move', ['w', 'root'], {}), { method: 'move', args: { ward: 'w', memory: null } });
  assert.throws(() => requestOf('move', ['w'], {}), /move takes 2 arguments/);
  assert.deepEqual(requestOf('route', ['pk', 'none'], {}), { method: 'route', args: { ward: 'pk', at: null } });
  assert.deepEqual(requestOf('route', ['pk', 'tcp://a:1', 'wss://h/q'], {}), { method: 'route', args: { ward: 'pk', at: ['tcp://a:1', 'wss://h/q'] } });
  assert.throws(() => requestOf('route', ['pk'], {}), /route takes a ward pk and its addresses/);
  assert.deepEqual(requestOf('reach', ['tcp://a:1'], {}), { method: 'reach', args: { at: ['tcp://a:1'] } });
  assert.throws(() => requestOf('reach', [], {}), /reach takes the addresses/);
  assert.deepEqual(requestOf('public', ['none'], { ward: 'w' }), { ward: 'w', method: 'public', args: { key: null } });
  assert.deepEqual(requestOf('ask', [], {}), { method: 'ask', args: {} });
  assert.deepEqual(requestOf('ask', ['me', 'buy', '{"item":"tea"}'], { ward: 'w' }), { ward: 'w', method: 'ask', args: { being: 'me', method: 'buy', args: { item: 'tea' } } });
  assert.deepEqual(requestOf('disown', ['o'], {}), { method: 'disown', args: { id: 'o' } });
  assert.deepEqual(requestOf('become', ['com.acme.own-ward'], { ward: 'w' }), { ward: 'w', method: 'become', args: { class: 'com.acme.own-ward' } });
  assert.deepEqual(requestOf('host', ['w'], { class: 'com.acme.own-ward' }), { method: 'host', args: { ward: 'w', class: 'com.acme.own-ward' } });
  assert.deepEqual(requestOf('unboot', ['b'], {}), { method: 'unboot', args: { being: 'b' } });
  assert.deepEqual(requestOf('invite', ['b', 'i'], {}), { method: 'invite', args: { being: 'b', id: 'i' } });
  assert.deepEqual(requestOf('module', ['add', SHOP], {}), { method: 'ask', args: { being: 'catalogue', method: 'add', args: { source: shop.source } } }, 'the file is read, and its text is asked');
  assert.throws(() => requestOf('module', ['add', '/nowhere/m.js'], {}), /ENOENT/);
  assert.deepEqual(requestOf('live', [], {}), { method: 'ask', args: { being: 'catalogue', method: 'live', args: {} } });
  assert.deepEqual(requestOf('live', ['refs/heads/main'], {}), { method: 'ask', args: { being: 'catalogue', method: 'live', args: { commit: 'refs/heads/main' } } });
  assert.throws(() => requestOf('live', ['a', 'b'], {}), /live takes a commit, or nothing/);
  assert.deepEqual(requestOf('log', [], {}), { method: 'ask', args: { being: 'catalogue', method: 'log', args: {} } });
  assert.deepEqual(requestOf('origin', ['https://h/r.git'], {}), { method: 'ask', args: { being: 'catalogue', method: 'origin', args: { url: 'https://h/r.git' } } });
  assert.deepEqual(requestOf('origin', ['none'], {}), { method: 'ask', args: { being: 'catalogue', method: 'origin', args: { url: null } } });
  assert.deepEqual(requestOf('fetch', [], {}), { method: 'ask', args: { being: 'catalogue', method: 'fetch', args: {} } });
  assert.deepEqual(requestOf('module', ['remove', 'com.acme.m'], {}), { method: 'ask', args: { being: 'catalogue', method: 'remove', args: { module: 'com.acme.m' } } });
  assert.deepEqual(requestOf('modules', [], {}), { method: 'ask', args: { being: 'catalogue', method: 'modules', args: {} } });
  assert.throws(() => requestOf('open', ['one'], {}), /open takes 2 arguments/);
  assert.throws(() => requestOf('unboot', [], {}), /unboot takes 1 argument$/);
  assert.throws(() => requestOf('ask', ['a', 'b', '{}', 'd'], {}), /at most/);
  assert.throws(() => requestOf('fly', [], {}), /usage/);
  assert.deepEqual(parse(['census', '--via', 'far']).flags, { via: 'far' });
  assert.deepEqual(via('far', {}), { method: 'pilot', args: { name: 'far' } });
  assert.deepEqual(via('far', { method: 'm', args: { a: 1 } }), { method: 'pilot', args: { name: 'far', method: 'm', args: { a: 1 } } });
  assert.deepEqual(pilotRequests('far', {}, 'tcp://h:1'), [{ method: 'hold', args: { name: 'far', invitation: {}, at: 'tcp://h:1' } }]);
  assert.deepEqual(pilotRequests('far', {}), [{ method: 'hold', args: { name: 'far', invitation: {} } }], 'with no address, the take learns the route from at');
  const web = { method: 'open', args: { key: 'web', class: 'org.nervur.web' } };
  assert.deepEqual(pilotRequests('far', {}, 'https://h/quo', web)[0], web, 'a web address opens the web carrier first');
  assert.deepEqual(pilotRequests('far', { at: ['wss://h/quo'] }, undefined, web)[0], web, 'so does a web address the invitation names');
  assert.equal(pilotRequests('far', { at: ['https://h/quo'] })[0]!.method, 'hold', 'a harbor with the web opened opens none');
  assert.equal(pilotRequests('far', { at: ['tcp://h:1'] }, undefined, web)[0]!.method, 'hold', 'a TCP address needs no web');
  assert.deepEqual(farAnswer({ error: 'no such ward' }), { error: 'no such ward' });
});

test(holds('rootline.json', 'cli: the root line answers a request, and refuses what is none'), async () => {
  const world = new World(DEFAULTS);
  const harbor = await world.harbor('h');
  for (const bad of [null, [], 'x', { ward: 1 }, { method: 2 }, { args: [] }]) assert.deepEqual(await harbor.ask(bad), { error: 'not a root request' });
  assert.deepEqual(await harbor.ask({ ward: 'nobody' }), { error: 'no such ward' });
  assert.deepEqual(await harbor.ask({ method: 'host', args: { ward: 'w' } }), { answer: { hosted: 'w' } });
  assert.deepEqual(await harbor.ask({ ward: 'w', method: 'nothing' }), { answer: { error: 'unknown ask' } });
  assert.deepEqual(readRootRequest({ ward: 'w', method: 'm', args: {}, other: 1 }), { ward: 'w', method: 'm', args: {} });
});

test(holds('ward.hold-restart', 'cli: the dock holds a far ward as its owner under a name, and the hold survives a restart'), async () => {
  const world = new World(DEFAULTS);
  const [far, home] = await Promise.all([world.harbor('far'), world.harbor('home')]);
  const line = (request: RootRequest) => home.ask(request);
  assert.deepEqual(await line({ method: 'boot', args: { key: 'p', class: 'org.nervur.pilot' } }), { answer: { error: 'a faculty is opened, and nothing else stands in the box ward' } }, 'no pilot being stands');
  const owner = (await far.ask({ method: 'own', args: { id: 'home' } })).answer as JsonObject;
  const farPk = ((await far.ask({})).answer as { notes: { pk: string } }).notes.pk;
  for (const req of pilotRequests('p', owner)) assert.deepEqual(await line(req), { answer: { held: 'p', ward: farPk } });
  assert.deepEqual(farAnswer(await line(via('p', { method: 'host', args: { ward: 'shop' } }))), { answer: { hosted: 'shop' } });
  assert.deepEqual(farAnswer(await line(via('p', { method: 'own', args: { id: 'eve' } }))), { answer: { error: 'unknown ask' } }, 'a carried key never hands piloting on');
  assert.deepEqual(farAnswer(await line(via('nobody', {}))), { error: 'nobody is not held' }, 'no being is held under that name');
  const beings = (((await line({})) as JsonObject).answer as { notes: { beings: JsonObject } }).notes.beings;
  assert.deepEqual(Object.keys(beings), ['catalogue'], 'a hold is a standing of the dock, and no being');

  const again = await world.restart('home');
  const census = farAnswer(await again.ask(via('p', {}))) as { answer: { notes: { pk: string } } };
  assert.equal(census.answer.notes.pk, farPk, 'the relation woke from the package');
  world.cut.add('far');
  assert.deepEqual(farAnswer(await again.ask(via('p', {}))), { error: 'unreached' }, 'the dock says what the far ward did not');
  world.cut.delete('far');
  assert.deepEqual(await again.ask({ method: 'drop', args: { name: 'p' } }), { answer: { dropped: 'p' } });
});

test(holds('package.moves-ground', 'cli: a harbor exported from one folder and imported into another is the same harbor'), TIME, async () => {
  const [here, there, mine] = [scratch(), scratch(), scratch()];
  const made = await nervur(here, 'init');
  await nervur(here, 'module', 'add', SHOP);
  await nervur(here, 'open', 'echo', 'org.example.echo');
  await nervur(here, 'host', 'alice');
  await nervur(here, 'boot', '--ward', 'alice', 'me', 'org.example.customer');
  const bare = (await nervur(here, 'export')).out as { seed?: string; places: Record<string, unknown> };
  assert.equal(bare.seed, undefined, 'the seed stays in custody unless it is asked for');
  assert.equal(Object.keys(bare.places).filter((p) => !Dna.occupies(p)).length, 2, 'the box ward and alice');
  assert.ok(Object.keys(bare.places).some((p) => Dna.occupies(p)), 'and the DNA goes with them');
  assert.ok(!JSON.stringify(bare).includes(SHOP), 'no path of this machine');
  const whole = JSON.stringify((await nervur(here, 'export', '--with-seed')).out);
  const file = join(scratch(), 'carried.json');
  await writeFile(file, whole);
  assert.deepEqual((await nervur(there, 'import', file)).out, { landed: Object.keys(bare.places) });
  assert.deepEqual((await nervur(there, 'census')).out, (await nervur(here, 'census')).out, 'the same box ward');
  assert.deepEqual((await nervur(there, 'ask', '--ward', 'alice', 'me', 'echo', '{"text":"there"}')).out, { answer: { answer: { said: { echoed: 'there', to: 'lent:1' } } } });
  assert.match((await nervur(there, 'import', file)).out.stderr as string, /a harbor stands at/);
  await nervur(mine, 'init');
  assert.match((await nervur(mine, 'import', file)).out.stderr as string, /a harbor stands at/);
  const piped = scratch();
  const landed = await new Promise<string>((done, fail) => {
    const child = spawn(process.execPath, [MAIN, 'import', '-', '--dir', piped], { stdio: ['pipe', 'pipe', 'inherit'] });
    let out = '';
    child.stdout!.on('data', (d: Buffer) => (out += d.toString()));
    child.once('error', fail);
    child.once('close', () => done(out));
    child.stdin!.end(whole);
  });
  assert.deepEqual(JSON.parse(landed), { landed: Object.keys(bare.places) }, 'a harbor carried on this command input');
  assert.deepEqual((await nervur(piped, 'census')).out, (await nervur(here, 'census')).out);
  const seedless = join(scratch(), 'bare.json');
  await writeFile(seedless, JSON.stringify(bare));
  const empty = scratch();
  assert.match((await nervur(empty, 'import', seedless)).out.stderr as string, /carries no seed/);
  assert.match((await nervur(empty, 'import', join(empty, 'nowhere.json'))).out.stderr as string, /ENOENT/);
  assert.deepEqual((await nervur(empty, 'export')).out, { places: {} }, 'a refused import leaves an empty folder');
  const moved = (await nervur(there, 'census')).out as { answer: { notes: { pk: string } } };
  assert.equal(moved.answer.notes.pk, made.out.pk, 'the ward of the seed it was made under');

  // Packed for an edge: each harbor under its name in one pack, its seed
  // sealed under the worker's secret beside its places, and every harbor
  // packed before kept.
  const packed = join(scratch(), 'pack.json');
  const edge = async (dir: string, secret: string, ...args: string[]): Promise<Record<string, unknown>> => {
    try {
      const { stdout } = await run(process.execPath, [MAIN, 'edge', ...args, '--dir', dir], { env: { ...process.env, NERVUR_SECRET: secret } });
      return JSON.parse(stdout) as Record<string, unknown>;
    } catch (e) {
      return { stderr: (e as { stderr: string }).stderr };
    }
  };
  const SECRET = 'the worker secret';
  const places = Object.keys(bare.places).length;
  assert.deepEqual(await edge(here, SECRET, 'pack', packed, 'main'), { packed: 'main', package: packed, harbors: ['main'], places });
  assert.deepEqual(await edge(piped, SECRET, 'pack', packed, 'yard'), { packed: 'yard', package: packed, harbors: ['main', 'yard'], places });
  assert.deepEqual(await readdir(dirname(packed)), ['pack.json'], 'the pack alone, its code in its places');
  const text = await readFile(packed, 'utf8');
  assert.ok(!text.includes('org.example.shop'), 'and sealed, the code as every place is');
  const pack = readPack(JSON.parse(text))!;
  assert.deepEqual(Object.keys(pack), ['main', 'yard']);
  assert.deepEqual(pack.main!.places, bare.places, 'the places as they were sealed');
  const seed = (JSON.parse(whole) as { seed: string }).seed;
  assert.ok(!text.includes(seed), 'the pack holds no seed in the clear, and no path of this machine');
  const custody = new EdgeCustody(heldStorage(), SECRET);
  await custody.land(pack.main!.sealed);
  assert.equal(hex(await custody.seed()), seed, 'the packed seed opens under the worker secret');
  const stranger = new EdgeCustody(heldStorage(), `${SECRET}x`);
  await stranger.land(pack.main!.sealed);
  await assert.rejects(stranger.seed(), /does not open/, 'and under no other');
  assert.match((await edge(here, '', 'pack', packed, 'main')).stderr as string, /none is set/);
  assert.match((await edge(here, SECRET, 'pack', packed, 'Main')).stderr as string, /no harbor name/);
  assert.match((await edge(scratch(), SECRET, 'pack', packed, 'main')).stderr as string, /no harbor stands/);
  assert.match((await edge(here, SECRET, 'unpack', packed, 'main')).stderr as string, /edge takes pack or dev, a file, and the harbor name/);
  assert.match((await edge(here, SECRET, 'pack', packed, 'main', '--via', 'far')).stderr as string, /takes no --via/);
});

// A Durable Object's storage in a Map, as custody reads it.
const heldStorage = (): EdgeStorage => {
  const held = new Map<string, unknown>();
  const storage: EdgeStorage = {
    get: (key) => Promise.resolve(held.get(key)),
    put: (entries) => Promise.resolve(void Object.entries(entries).forEach(([k, v]) => held.set(k, v))),
    delete: (keys) => Promise.resolve(keys.filter((k) => held.delete(k)).length),
    list: ({ prefix }) => Promise.resolve(new Map([...held].filter(([k]) => k.startsWith(prefix)))),
    transaction: (work) => work(storage),
  };
  return storage;
};

test('[cli] main refuses a command it cannot run', async () => {
  const lines: string[] = [];
  await assert.rejects(main([], {}, (l) => lines.push(l), DEFAULTS), /usage/);
  await assert.rejects(main(['init', 'x'], { NERVUR_DIR: scratch() }, (l) => lines.push(l), DEFAULTS), /takes no argument/);
  await assert.rejects(main(['serve', 'x'], { NERVUR_DIR: scratch() }, (l) => lines.push(l), DEFAULTS), /takes no argument/);
  await assert.rejects(main(['module', 'fly', 'x'], { NERVUR_DIR: scratch() }, (l) => lines.push(l), DEFAULTS), /module is add or remove/);
  await assert.rejects(main(['pilot', 'x'], { NERVUR_DIR: scratch() }, (l) => lines.push(l), DEFAULTS), /pilot takes a name, an invitation/);
  await assert.rejects(main(['census', '--via', 'x', '--ward', 'w'], { NERVUR_DIR: scratch() }, (l) => lines.push(l), DEFAULTS), /--via takes no --ward/);
  await assert.rejects(main(['export', 'x'], { NERVUR_DIR: scratch() }, (l) => lines.push(l), DEFAULTS), /export takes no argument/);
  await assert.rejects(main(['import'], { NERVUR_DIR: scratch() }, (l) => lines.push(l), DEFAULTS), /import takes one file/);
  await assert.rejects(main(['export', '--via', 'far'], { NERVUR_DIR: scratch() }, (l) => lines.push(l), DEFAULTS), /takes no --via/);
  assert.notEqual(SERVING, 0);
  assert.deepEqual(lines, []);
});

test(holds('cli.asks', 'cli: init opens the tcp carrier as one root open unless told no, and serve adds nothing to a harbor'), TIME, async () => {
  const beings = async (dir: string) => Object.keys(((await nervur(dir, 'census')).out as { answer: { notes: { beings: JsonObject } } }).answer.notes.beings).sort();
  const dir = scratch();
  assert.equal((await nervur(dir, 'init')).code, 0);
  assert.deepEqual(await beings(dir), ['catalogue', 'tcp']);
  const bare = scratch();
  assert.equal((await nervur(bare, 'init', '--no-tcp')).code, 0);
  assert.deepEqual(await beings(bare), ['catalogue'], 'nothing but the catalogue');
  await assert.rejects(served(bare), /no tcp carrier/);
  assert.deepEqual(await beings(bare), ['catalogue'], 'serving opened nothing');
  const none = scratch();
  await assert.rejects(served(none), /no harbor stands/);
  assert.ok(!existsSync(join(none, 'seed')), 'serving made no harbor');
});

test('[cli] a harbor made, then asked from its folder, each command its own process', TIME, async () => {
  const dir = scratch();
  const made = await nervur(dir, 'init');
  assert.equal(made.code, 0);
  assert.match(made.out.pk as string, /^[0-9a-f]{128}$/);
  assert.equal((made.out.owner as { ward: string }).ward, made.out.pk);
  assert.deepEqual(await nervur(dir, 'init'), { code: 1, out: { error: `a harbor stands at ${dir}` } });
  assert.deepEqual(await nervur(dir, 'open', 'echo', 'org.example.echo'), { code: 1, out: { answer: { error: 'no such faculty' } } }, 'no module runs yet');
  assert.deepEqual(await nervur(dir, 'module', 'add', 'test/core/quo/scene.ts'), { code: 1, out: { answer: { answer: { error: "a module imports nothing but 'nervur'" } } } }, 'a file that is no module');
  const nowhere = await nervur(dir, 'module', 'add', 'test/kit/nowhere.js');
  assert.equal(nowhere.code, 2);
  assert.match(nowhere.out.stderr as string, /ENOENT/);
  assert.deepEqual(added(await nervur(dir, 'module', 'add', relative(process.cwd(), SHOP))), { added: 'org.example.shop', version: '1' }, 'a path named from here');
  const { modules } = ((await nervur(dir, 'modules')).out as { answer: { answer: { modules: Record<string, JsonObject> } } }).answer.answer;
  assert.equal(modules['org.example.shop']!.running, '1', 'kept by the id it declares, in the DNA');
  assert.ok(!existsSync(join(dir, 'modules.json')), 'nothing beside the harbor');
  assert.deepEqual(added(await nervur(dir, 'module', 'add', SHOP)), { added: 'org.example.shop', version: '1' }, 'added again, the same text');
  assert.deepEqual((await nervur(dir, 'open', 'echo', 'org.example.echo')).out, { answer: { opened: 'echo' } });
  assert.deepEqual((await nervur(dir, 'host', 'alice')).out, { answer: { hosted: 'alice' } });
  assert.deepEqual((await nervur(dir, 'boot', '--ward', 'alice', 'me', 'org.example.customer')).out, { answer: { booted: 'me' } });
  assert.deepEqual((await nervur(dir, 'ask', '--ward', 'alice', 'me', 'echo', '{"text":"hi"}')).out, { answer: { answer: { said: { echoed: 'hi', to: 'lent:1' } } } });
  const census = (await nervur(dir, 'census', '--ward', 'alice')).out as { answer: { notes: { beings: unknown } } };
  assert.deepEqual(census.answer.notes.beings, { me: { class: 'org.example.customer', public: false, absent: false } });
  assert.deepEqual(await nervur(dir, 'census', '--ward', 'nobody'), { code: 1, out: { error: 'no such ward' } });
  assert.deepEqual(await nervur(dir, 'boot', '--ward', 'alice', 'x', 'org.example.nobody'), { code: 1, out: { answer: { error: 'no such class' } } });
  assert.deepEqual(await nervur(dir, 'module', 'remove', 'org.example.shop'), { code: 1, out: { answer: { answer: { error: 'a being stands on this module' } } } });
  assert.deepEqual((await nervur(dir, 'sweep')).out, { answer: { swept: [] } }, 'a harbor names every place of its folder');
  const bad = await nervur(dir, 'fly');
  assert.equal(bad.code, 2);
  assert.match(bad.out.stderr as string, /usage/);
});

test('[cli] a served harbor piloted from another folder by the invitation init printed', TIME, async () => {
  const [home, far] = [scratch(), scratch()];
  const [, made] = await Promise.all([nervur(home, 'init'), nervur(far, 'init')]);
  const owner = JSON.stringify(made.out.owner);
  const f = await served(far);
  try {
    assert.deepEqual(await nervur(home, 'pilot', 'far', '{"ward":"x"}', f.at), { code: 1, out: { answer: { error: 'no invitation' } } });
    assert.deepEqual((await nervur(home, 'pilot', 'far', JSON.stringify({ ...(made.out.owner as JsonObject), secret: '00'.repeat(32) }), f.at)).out, { answer: { error: 'not taken' } });
    assert.deepEqual(((await nervur(home, 'census')).out as { answer: { notes: { beings: JsonObject } } }).answer.notes.beings, { catalogue: { class: 'org.nervur.catalogue', public: false, absent: false }, tcp: { class: 'org.nervur.tcp', public: false, absent: false } }, 'a hold not taken leaves nothing; a new harbor stands its tcp carrier');
    assert.deepEqual((await nervur(home, 'pilot', 'far', owner, f.at)).out, { piloting: 'far', ward: made.out.pk });
    assert.deepEqual(added(await nervur(home, 'module', 'add', SHOP, '--via', 'far')), { added: 'org.example.shop', version: '1' }, 'the source read here, committed there');
    assert.deepEqual((await nervur(home, 'host', 'shop', '--via', 'far')).out, { answer: { hosted: 'shop' } });
    assert.deepEqual(await nervur(home, 'own', 'eve', '--via', 'far'), { code: 1, out: { answer: { error: 'unknown ask' } } });
    assert.deepEqual((await nervur(far, 'reach', f.at)).out, { answer: { reach: [f.at] } });
    const second = (await nervur(far, 'own', 'second')).out.answer as JsonObject;
    assert.deepEqual(second.at, [f.at], 'an invitation carries where the harbor is reached');
    const elsewhere = scratch();
    await nervur(elsewhere, 'init');
    assert.deepEqual((await nervur(elsewhere, 'pilot', 'far', JSON.stringify(second))).out, { piloting: 'far', ward: made.out.pk }, 'no address named: the take learns the route from at');
    assert.equal(((await nervur(elsewhere, 'census', '--via', 'far')).out as { answer: { notes: { pk: string } } }).answer.notes.pk, made.out.pk);
  } finally {
    await stop(f.child);
  }
  assert.deepEqual(await nervur(home, 'census', '--via', 'far'), { code: 1, out: { error: 'unreached' } });
  const again = await served(far, '--host', '127.0.0.1', '--port', f.at.split(':').at(-1)!);
  try {
    const census = (await nervur(home, 'census', '--via', 'far')).out as { answer: { notes: { pk: string; beings: JsonObject } } };
    assert.equal(census.answer.notes.pk, made.out.pk, 'both harbors woke the relation from their folders');
  } finally {
    await stop(again.child);
  }
});

test(holds('kit.two-processes', 'cli: two served harbors meet over TCP, and a stopped one is asked from its folder again'), TIME, async () => {
  const [home, acme] = [scratch(), scratch()];
  await Promise.all([nervur(home, 'init'), nervur(acme, 'init')]);
  await Promise.all([nervur(home, 'module', 'add', SHOP), nervur(acme, 'module', 'add', SHOP)]);
  const [h, a] = await Promise.all([served(home), served(acme)]);
  try {
    assert.ok(existsSync(socketOf(home)));
    const twice = await nervur(home, 'serve');
    assert.equal(twice.code, 2);
    assert.match(twice.out.stderr as string, /already served/);
    await nervur(acme, 'host', 'shop');
    await nervur(acme, 'boot', '--ward', 'shop', 'shop', 'org.example.shop');
    const shopPk = ((await nervur(acme, 'census', '--ward', 'shop')).out as { answer: { notes: { pk: string } } }).answer.notes.pk;
    const invitation = (await nervur(acme, 'invite', '--ward', 'shop', 'shop', 'alice')).out.answer;
    await nervur(home, 'host', 'alice');
    await nervur(home, 'boot', '--ward', 'alice', 'me', 'org.example.customer');
    assert.deepEqual((await nervur(home, 'route', shopPk, a.at)).out, { answer: { routed: shopPk } });
    assert.deepEqual((await nervur(home, 'ask', '--ward', 'alice', 'me', 'join', JSON.stringify({ invitation }))).out, { answer: { answer: { joined: 'shop' } } });
    assert.deepEqual((await nervur(home, 'ask', '--ward', 'alice', 'me', 'buy', '{"item":"tea"}')).out, { answer: { answer: { said: { bought: 'tea' } } } });
  } finally {
    await Promise.all([stop(h.child), stop(a.child)]);
  }
  assert.ok(!existsSync(socketOf(home)), 'a stopped harbor leaves no socket');
  const again = await served(acme, '--host', '127.0.0.1', '--port', a.at.split(':').at(-1)!);
  assert.equal(again.at, a.at);
  try {
    assert.deepEqual((await nervur(home, 'ask', '--ward', 'alice', 'me', 'buy', '{"item":"cake"}')).out, { answer: { answer: { said: { bought: 'cake' } } } }, 'home asked from its folder, its route woken from the package');
  } finally {
    await stop(again.child);
  }
});
