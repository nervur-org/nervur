// The invitation flows between two real machines, each a NodeGround. Bob's
// runs on a device with a public address, `nervur up` from the packed
// tarball. Alice's runs here, behind whatever router this machine sits
// behind, and dials with the private-address rule on, as every real ground
// does. Bob's owner reaches his ground's hand through a socket forwarded
// over SSH, never over the network. The device is named by NERVUR_DEVICE
// (user@host), NERVUR_DEVICE_KEY (the SSH key) and NERVUR_DEVICE_PORT (a
// port its firewall lets in). Everything made on the device is removed
// after.
import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { after, before, describe, test } from 'node:test';
import type { Opened } from 'nervur';
import { NodeGround } from 'nervur/node';
import { being, failed, hand, land, paper, type Ask } from '../test/fixtures/node/grounds.ts';
import { handAt } from '../test/fixtures/node/hand-client.ts';

const device = process.env.NERVUR_DEVICE ?? '';
const key = process.env.NERVUR_DEVICE_KEY ?? '';
const port = process.env.NERVUR_DEVICE_PORT ?? '';
const host = device.split('@').at(-1)!;
const pkg = new URL('../', import.meta.url).pathname;
const ssh = ['-i', key, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15'];
// The folder of each ground: its classes, the same on both machines.
const GROUND = 'deep/fixtures/ground';
const house = { classes: { faculty: 'folder', at: 'classes' } };
// A hook or a test here crosses SSH and the internet, where the runner's default would call a slow line a freeze.
const REMOTE = { timeout: 300_000 };

// One command on the device, and what it printed.
const remote = (command: string): string => {
  const run = spawnSync('ssh', [...ssh, device, command], { encoding: 'utf8' });
  assert.equal(run.status, 0, `${command}\n${run.stdout}\n${run.stderr}`);
  return run.stdout.trim();
};

const local = (command: string, args: readonly string[], cwd?: string): string => {
  const run = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(run.status, 0, `${command} ${args.join(' ')}\n${run.stdout}\n${run.stderr}`);
  return run.stdout;
};

// What a paper names: the addresses its house is reached at.
const addressesOf = (hex: string) => (JSON.parse(Buffer.from(hex, 'hex').toString('utf8')) as { at: string[] }).at;

type HandRequest = Parameters<Opened['ask']>[0] & { house?: string; faculty?: string };

void describe('Invitations between this machine and a real device', { timeout: 600_000 }, () => {
  const here = mkdtempSync(join(tmpdir(), 'nd-'));
  const socket = join(here, 'hand');
  let folder = '';
  let bob: { child: ChildProcess; close: () => void } | undefined;
  let bobs: Ask = async () => ({ error: { message: 'Bob’s ground is down' } });
  let alice: NodeGround;
  let alices: Ask;

  // Bob's ground started on the device, its hand forwarded to a socket here, and its house added once.
  const up = async () => {
    const env = `NERVUR_STATE=${folder}/state NERVUR_TCP_PORT=${port} NERVUR_ADDRESSES=tcp://${host}:${port} NERVUR_HAND=${folder}/hand`;
    const child = spawn(
      'ssh',
      [...ssh, '-o', 'ExitOnForwardFailure=yes', '-o', 'StreamLocalBindUnlink=yes', '-L', `${socket}:${folder}/hand`, device, `cd ${folder} && ${env} exec ${folder}/node_modules/.bin/nervur up ${folder}/${GROUND}`],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    const line = await new Promise<string>((resolve, reject) => {
      createInterface({ input: child.stdout }).once('line', resolve);
      child.once('exit', (code) => reject(new Error(`Bob’s ground exited with ${code}`)));
    });
    const owner = await handAt<HandRequest>(socket);
    bob = { child, close: owner.close };
    bobs = (request) => owner.ask({ house: 'bob', ...request });
    const { houses } = JSON.parse(line) as { houses: { name: string }[] };
    if (!houses.some(({ name }) => name === 'bob')) {
      const added = await owner.ask({ faculty: 'houses', method: 'add', args: { name: 'bob', ...house } });
      assert.ok('result' in added, JSON.stringify(added));
    }
  };

  const down = async () => {
    if (bob === undefined) return;
    bob.close();
    const exited = new Promise<void>((resolve) => (bob!.child.exitCode !== null ? resolve() : bob!.child.once('exit', () => resolve())));
    remote(`pkill -INT -f 'nervur up ${folder}/${GROUND}' || true`);
    await exited;
    bob = undefined;
    bobs = async () => ({ error: { message: 'Bob’s ground is down' } });
  };

  before(async () => {
    assert.ok(device !== '' && key !== '' && port !== '', 'NERVUR_DEVICE, NERVUR_DEVICE_KEY and NERVUR_DEVICE_PORT name the device');
    // npm 11 answers a list of packs, and npm 12 an object keyed by the package's name.
    const answered = JSON.parse(local('npm', ['pack', '--json', '--pack-destination', here], pkg)) as { filename: string }[] | Record<string, { filename: string }>;
    const packed = Array.isArray(answered) ? answered[0] : answered.nervur;
    folder = remote('mktemp -d "$HOME/nervur-deep-XXXXXX"');
    remote(`mkdir -p ${folder}/${GROUND}/classes ${folder}/test/fixtures/world`);
    local('scp', [...ssh, join(here, packed.filename), `${device}:${folder}/`]);
    local('scp', [...ssh, join(pkg, GROUND, 'classes/index.ts'), `${device}:${folder}/${GROUND}/classes/`]);
    local('scp', [...ssh, ...['steward', 'host', 'guest'].map((name) => join(pkg, `test/fixtures/world/${name}.ts`)), `${device}:${folder}/test/fixtures/world/`]);
    remote(`cd ${folder} && npm init -y >/dev/null && npm pkg set type=module && npm install --no-audit --no-fund --no-package-lock ./${packed.filename} >/dev/null`);
    await up();
    await hand(bobs, 'bear', { kind: 'org.example.host', id: 'bob' });
    // Alice's ground, here: it dials alone, with no private address allowed.
    alice = await NodeGround.open({ folder: join(pkg, GROUND), state: join(here, 'alice'), env: { NERVUR_TCP_PORT: '0', NERVUR_BIND: '127.0.0.1', NERVUR_HAND: join(here, 'alice-hand') } });
    const added = await alice.ground.hand({ faculty: 'houses', method: 'add', args: { name: 'alice', ...house } });
    assert.ok('result' in added, JSON.stringify(added));
    alices = (request) => alice.ground.ask({ house: 'alice', ...request });
  }, REMOTE);

  after(async () => {
    await down().catch(() => undefined);
    await alice?.close();
    if (folder !== '') remote(`rm -rf '${folder}'`);
    rmSync(here, { recursive: true, force: true });
  }, REMOTE);

  for (const known of [true, false]) {
    const id = known ? 'alice-known' : 'alice-newborn';
    void test(`Alice here, ${known ? 'known' : 'newborn'}: her owner lands Bob's paper, and she greets him across the internet`, REMOTE, async () => {
      if (known) await hand(alices, 'bear', { kind: 'org.example.guest', id });
      const given = await paper(bobs, 'bob', `for-${id}`);
      assert.deepEqual(addressesOf(given), [`tcp://${host}:${port}`], 'the paper names the device’s public address alone');
      if (!known) await hand(alices, 'bear', { kind: 'org.example.guest', id });
      await land(alices, given, id);
      assert.equal(await being(alices, id, 'greetHost'), `bob greets for-${id}`);
      assert.ok(((await being(bobs, 'bob', 'occupantsList')) as string[]).includes(`for-${id}`));
    });
  }

  void test('Bob’s ground down is silence to Alice, and once it is back her asks reach him', REMOTE, async () => {
    const id = 'alice-patient';
    await hand(alices, 'bear', { kind: 'org.example.guest', id });
    await land(alices, await paper(bobs, 'bob', `for-${id}`), id);
    assert.equal(await being(alices, id, 'greetHost'), `bob greets for-${id}`);
    await down();
    assert.equal(await failed(alices, id, 'greetHost'), 'greet answered nothing');
    await up();
    assert.equal(await being(alices, id, 'greetHost'), `bob greets for-${id}`);
  });
});
