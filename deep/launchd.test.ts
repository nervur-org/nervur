// A NodeGround on this Mac as launchd keeps it. The packed package is
// installed in a folder, `nervur service` prints its job, and the job is
// placed in the user's LaunchAgents and loaded. The owner reaches the
// ground through its hand. Then the ground is killed, launchd starts it
// again, and the house it held still answers. Everything placed is
// removed after.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, watch, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import type { Opened } from 'nervur';
import { being, hand, paper, type Ask } from '../test/fixtures/node/grounds.ts';
import { handAt } from '../test/fixtures/node/hand-client.ts';

const pkg = new URL('../', import.meta.url).pathname;
const GROUND = 'deep/fixtures/ground';
const LABEL = 'org.nervur.ground';
const domain = `gui/${userInfo().uid}`;
const plist = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
// Packing builds the package, which the runner's default would call a freeze.
const SLOW = { timeout: 300_000 };

type HandRequest = Parameters<Opened['ask']>[0] & { house?: string };

const local = (command: string, args: readonly string[], cwd?: string): string => {
  const run = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(run.status, 0, `${command} ${args.join(' ')}\n${run.stdout}\n${run.stderr}`);
  return run.stdout;
};

// The hand answering at `socket`, heard as the ground writes it: a connect that fails waits for the next change.
// A ground standing already is its own answer; after a kill, only a socket written again is.
const answering = (socket: string, { fresh = false } = {}) =>
  new Promise<{ ask: (request: HandRequest) => ReturnType<Opened['ask']>; close: () => void }>((resolve) => {
    const dir = join(socket, '..');
    let written = !fresh;
    const watcher = watch(dir, (_, name) => {
      if (name === 'hand') written = true;
      if (written) void attempt();
    });
    let done = false;
    const attempt = async () => {
      if (done || !existsSync(socket)) return;
      const probe = connect(socket);
      const alive = await new Promise<boolean>((settle) => {
        probe.once('connect', () => settle(true));
        probe.once('error', () => settle(false));
      });
      probe.destroy();
      if (!alive || done) return;
      done = true;
      watcher.close();
      resolve(await handAt<HandRequest>(socket));
    };
    if (written) void attempt();
  });

void describe('A ground on this Mac as launchd keeps it', { skip: process.platform !== 'darwin' }, () => {
  const root = mkdtempSync('/tmp/nl-');
  const folder = join(root, GROUND);
  const socket = join(folder, 'state', 'hand');
  let owner: Awaited<ReturnType<typeof answering>> | undefined;
  const asks: Ask = (request) => owner!.ask({ house: 'bob', ...request });

  before(() => {
    // A red run stops before its `after`, so what it placed is removed here; a job this suite did not place is refused.
    if (existsSync(plist)) {
      assert.match(readFileSync(plist, 'utf8'), /\/tmp\/nl-/, `${plist} stands already, and this run places its own`);
      spawnSync('launchctl', ['bootout', `${domain}/${LABEL}`]);
      rmSync(plist);
    }
    for (const stale of readdirSync('/tmp').filter((name) => name.startsWith('nl-') && join('/tmp', name) !== root)) rmSync(join('/tmp', stale), { recursive: true, force: true });
    // npm 11 answers a list of packs, and npm 12 an object keyed by the package's name.
    const answered = JSON.parse(local('npm', ['pack', '--json', '--pack-destination', root], pkg)) as { filename: string }[] | Record<string, { filename: string }>;
    const packed = Array.isArray(answered) ? answered[0] : answered.nervur;
    mkdirSync(join(folder, 'classes'), { recursive: true });
    mkdirSync(join(root, 'test/fixtures/world'), { recursive: true });
    mkdirSync(join(folder, 'state'), { mode: 0o700 });
    copyFileSync(join(pkg, GROUND, 'classes/index.ts'), join(folder, 'classes/index.ts'));
    for (const name of ['steward', 'host', 'guest']) copyFileSync(join(pkg, `test/fixtures/world/${name}.ts`), join(root, `test/fixtures/world/${name}.ts`));
    local('npm', ['init', '-y'], root);
    local('npm', ['pkg', 'set', 'type=module'], root);
    local('npm', ['install', '--no-audit', '--no-fund', '--no-package-lock', `./${packed.filename}`], root);
    writeFileSync(plist, local(join(root, 'node_modules/.bin/nervur'), ['service', folder]));
  }, SLOW);

  after(() => {
    owner?.close();
    spawnSync('launchctl', ['bootout', `${domain}/${LABEL}`]);
    rmSync(plist, { force: true });
    rmSync(root, { recursive: true, force: true });
  });

  void test('launchd starts the ground its job names, and the owner opens a house through its hand', SLOW, async () => {
    const heard = answering(socket);
    local('launchctl', ['bootstrap', domain, plist]);
    owner = await heard;
    const added = await owner.ask({ method: 'housesAdd', args: { name: 'bob', classes: { faculty: 'folder', at: 'classes' } } });
    assert.ok('result' in added && (added.result as { ward?: string }).ward !== undefined, JSON.stringify(added));
    await hand(asks, 'bear', { kind: 'org.example.host', id: 'bob' });
    await paper(asks, 'bob', 'for-mac');
    assert.ok(((await being(asks, 'bob', 'occupantsList')) as string[]).includes('for-mac'));
  });

  void test('A ground killed is started again by launchd, and its house still answers', SLOW, async () => {
    owner!.close();
    const heard = answering(socket, { fresh: true });
    local('launchctl', ['kill', 'SIGKILL', `${domain}/${LABEL}`]);
    owner = await heard;
    const houses = (await owner.ask({ method: 'housesList', args: {} })) as { result: { name: string; ward?: string }[] };
    assert.ok(houses.result.some(({ name, ward }) => name === 'bob' && ward !== undefined), JSON.stringify(houses));
    assert.ok(((await being(asks, 'bob', 'occupantsList')) as string[]).includes('for-mac'), 'the occupant minted before the kill stands');
  });
});
