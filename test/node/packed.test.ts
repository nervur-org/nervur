// The package as a stranger receives it: packed, installed into an empty
// folder, and read from `dist` alone. A hand-written ground stands there and
// answers a ground here over TCP, and the README's and the guide's folders
// run under `nervur up`.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { groundOne, hand } from '../fixtures/node/grounds.ts';
import { ground, onLoopback, stop, up } from '../fixtures/node/spawned.ts';

const pkg = new URL('../../', import.meta.url).pathname;
const fixtures = new URL('../fixtures/', import.meta.url).pathname;

const npm = (args: readonly string[], cwd: string): string => {
  const run = spawnSync('npm', args, { cwd, encoding: 'utf8' });
  assert.equal(run.status, 0, `npm ${args.join(' ')}\n${run.stdout}\n${run.stderr}`);
  return run.stdout;
};

test('The packed tarball ships dist alone, and runs a written ground and the guides’ folders from an empty folder', { timeout: 60_000 }, async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'nervur-packed-'));
  const stranger = join(folder, 'stranger');
  mkdirSync(join(stranger, 'node'), { recursive: true });
  mkdirSync(join(stranger, 'world'));
  let far: Awaited<ReturnType<typeof ground>> | undefined;
  t.after(async () => {
    if (far !== undefined) await stop(far.child);
    rmSync(folder, { recursive: true, force: true });
  });

  // npm 11 answers a list of packs, and npm 12 an object keyed by the package's name.
  type Pack = { filename: string; files: { path: string }[] };
  const answered = JSON.parse(npm(['pack', '--json', '--pack-destination', folder], pkg)) as Pack[] | Record<string, Pack>;
  const packed = Array.isArray(answered) ? answered[0] : answered.nervur;
  const shipped = packed.files.map((file) => file.path);
  assert.deepEqual(
    shipped.filter((path) => !path.startsWith('dist/')),
    ['AUTHORING.md', 'COMMAND.md', 'FACES.md', 'FACULTIES.md', 'GROUNDS.md', 'KIT-SPEC.md', 'LICENSE', 'NOTICE', 'README.md', 'WORLD.md', 'package.json'],
  );
  for (const entry of ['index', 'being/index', 'node/index', 'bench/index', 'browser/index', 'app/index']) {
    assert.ok(shipped.includes(`dist/${entry}.js`) && shipped.includes(`dist/${entry}.d.ts`), entry);
  }

  npm(['install', '--offline', '--no-audit', '--no-fund', '--no-package-lock', join(folder, packed.filename)], stranger);
  npm(['pkg', 'set', 'type=module'], stranger);
  const bin = spawnSync(join(stranger, 'node_modules/.bin/nervur'), ['ask', 'main', 'whoami'], { encoding: 'utf8', env: { ...process.env, NERVUR_HAND: join(folder, 'no-hand') } });
  assert.equal(bin.status, 2, 'the command is installed, and says so where no hand answers');
  assert.match(bin.stderr, /does not answer/);
  copyFileSync(join(fixtures, 'node/ground.ts'), join(stranger, 'node/ground.ts'));
  copyFileSync(join(fixtures, 'world/steward.ts'), join(stranger, 'world/steward.ts'));
  const port = String(40_000 + Math.floor(Math.random() * 20_000));
  far = await ground('node/ground.ts', { cwd: stranger, env: { NERVUR_KEY: 'c'.repeat(64), GROUND_PORT: port, GROUND_MEMORY: join(folder, 'far.memory'), GROUND_OFFER: '1' } });

  const near = await (await groundOne(t, { dials: true })).open('near');
  const standing = (await hand(near.ask, 'adopt', { invitation: far.line.offered!.result.handle })) as string;
  assert.equal(await hand(near.ask, 'relay', { standing }), 'far');

  // The command a stranger runs, in the folder of the ground it asks.
  const cli = join(stranger, 'node_modules/.bin/nervur');
  const nervur = (cwd: string, ...args: string[]) => {
    const { NERVUR_HAND: _hand, ...env } = process.env;
    const run = spawnSync(cli, args, { cwd, encoding: 'utf8', env });
    return { code: run.status, out: run.stdout.trim() };
  };

  // The README's folder, copied as a stranger copies it, greets once an ask,
  // across a restart. A short folder keeps the socket's path short.
  const readme = join(stranger, 'r');
  mkdirSync(join(readme, 'house'), { recursive: true });
  for (const file of ['greeter.ts', 'house/index.ts']) copyFileSync(join(fixtures, 'readme', file), join(readme, file));
  const readmeEnv = { env: {}, cwd: readme };
  await onLoopback(readme, join(readme, 'state'));
  let greeter = await up(cli, '.', readmeEnv);
  t.after(() => stop(greeter.child));
  assert.equal(nervur(readme, 'houses', 'add', 'name=main', 'classes={"faculty":"folder","at":"house"}').code, 0);
  assert.deepEqual(nervur(readme, 'ask', 'main', 'hello', 'name=Ada'), { code: 0, out: '{"result":"Hello, Ada. You are number 1."}' });
  await stop(greeter.child);
  greeter = await up(cli, '.', readmeEnv);
  assert.deepEqual(nervur(readme, 'ask', 'main', 'hello', 'name=Ada'), { code: 0, out: '{"result":"Hello, Ada. You are number 2."}' }, 'the ledger kept the count');
  await stop(greeter.child);

  // The guide's shop, copied beside the install, opens an order by the hand
  // and keeps it across a restart. A short folder keeps the socket's path short.
  const shop = join(stranger, 'g');
  mkdirSync(join(shop, 'classes'), { recursive: true });
  for (const file of ['recipe.ts', 'payments.ts', 'classes/index.ts', 'classes/order.ts', 'classes/shop.ts', 'classes/lobby.ts']) copyFileSync(join(fixtures, 'guides', file), join(shop, file));
  const shopEnv = { env: {}, cwd: shop };
  await onLoopback(shop, join(shop, 'state'));
  let guide = await up(cli, '.', shopEnv);
  t.after(() => stop(guide.child));
  assert.equal(nervur(shop, 'faculties', 'add', 'name=recipe', 'from=folder', 'make=module', 'args={"at":"recipe.ts"}').code, 0);
  assert.equal(nervur(shop, 'faculties', 'add', 'name=payments', 'from=recipe', 'make=payments').code, 0);
  assert.equal(nervur(shop, 'houses', 'add', 'name=shop', 'classes={"faculty":"folder","at":"classes"}', 'faculties=["payments"]').code, 0);
  assert.equal(nervur(shop, 'ask', 'shop', 'open', 'id=first').code, 0);
  await stop(guide.child);
  guide = await up(cli, '.', shopEnv);
  assert.deepEqual(nervur(shop, 'ask', 'shop', 'orders'), { code: 0, out: '{"result":["first"]}' }, 'the ledger kept the order across a restart');
  await stop(guide.child);
});
