// The invitation flows between two real machines. Bob's ground runs on a
// device with a public address, installed from the packed tarball. Alice's
// ground runs here, behind whatever router this machine sits behind, and
// dials with the private-address rule on, as every real ground does. Bob's
// owner reaches his hand through a socket forwarded over SSH, never over
// the network. The device is named by NERVUR_DEVICE (user@host),
// NERVUR_DEVICE_KEY (the SSH key) and NERVUR_DEVICE_PORT (a port its
// firewall lets in). Everything made on the device is removed after.
import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { after, before, describe, test } from 'node:test';
import { ClassList, House, SeedKeys, type Opened } from 'nervur';
import { FakeMemory } from 'nervur/bench';
import { TcpCarry } from 'nervur/node';
import { being, failed, hand, land, paper, type Ask } from '../test/fixtures/node/grounds.ts';
import { handAt } from '../test/fixtures/node/hand-client.ts';
import { Guest } from '../test/fixtures/world/guest.ts';
import { Host } from '../test/fixtures/world/host.ts';
import { Steward } from '../test/fixtures/world/steward.ts';

const device = process.env.NERVUR_DEVICE ?? '';
const key = process.env.NERVUR_DEVICE_KEY ?? '';
const port = process.env.NERVUR_DEVICE_PORT ?? '';
const host = device.split('@').at(-1)!;
const pkg = new URL('../', import.meta.url).pathname;
const ssh = ['-i', key, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15'];

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

void describe('Invitations between this machine and a real device', { timeout: 600_000 }, () => {
  const here = mkdtempSync(join(tmpdir(), 'nd-'));
  const socket = join(here, 'hand');
  let folder = '';
  let bob: { child: ChildProcess; close: () => void } | undefined;
  let bobs: Ask = async () => ({ error: { message: 'Bob’s ground is down' } });
  let alice: Opened;
  const carry = new TcpCarry({ host: '127.0.0.1' });

  // Bob's ground started on the device, its hand forwarded to a socket here.
  const up = async () => {
    const env = `GROUND_PORT=${port} GROUND_HOST=${host} NERVUR_SEED=${'b'.repeat(64)} GROUND_MEMORY=${folder}/memory GROUND_HAND=${folder}/hand`;
    const child = spawn(
      'ssh',
      [...ssh, '-o', 'ExitOnForwardFailure=yes', '-o', 'StreamLocalBindUnlink=yes', '-L', `${socket}:${folder}/hand`, device, `cd ${folder} && ${env} exec node ${folder}/deep/fixtures/bob-ground.ts`],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    const line = await new Promise<string>((resolve, reject) => {
      createInterface({ input: child.stdout }).once('line', resolve);
      child.once('exit', (code) => reject(new Error(`Bob’s ground exited with ${code}`)));
    });
    const owner = await handAt(socket);
    bob = { child, close: owner.close };
    bobs = owner.ask;
    return JSON.parse(line) as { ward: string; at: string[] };
  };

  const down = async () => {
    if (bob === undefined) return;
    bob.close();
    const exited = new Promise<void>((resolve) => (bob!.child.exitCode !== null ? resolve() : bob!.child.once('exit', () => resolve())));
    remote(`pkill -INT -f '${folder}/deep/fixtures/bob-ground.ts' || true`);
    await exited;
    bob = undefined;
    bobs = async () => ({ error: { message: 'Bob’s ground is down' } });
  };

  before(async () => {
    assert.ok(device !== '' && key !== '' && port !== '', 'NERVUR_DEVICE, NERVUR_DEVICE_KEY and NERVUR_DEVICE_PORT name the device');
    const [packed] = JSON.parse(local('npm', ['pack', '--json', '--pack-destination', here], pkg)) as { filename: string }[];
    folder = remote('mktemp -d "$HOME/nervur-deep-XXXXXX"');
    remote(`mkdir -p ${folder}/deep/fixtures ${folder}/test/fixtures/world`);
    local('scp', [...ssh, join(here, packed.filename), `${device}:${folder}/`]);
    local('scp', [...ssh, join(pkg, 'deep/fixtures/bob-ground.ts'), `${device}:${folder}/deep/fixtures/`]);
    local('scp', [...ssh, ...['steward', 'host', 'guest'].map((name) => join(pkg, `test/fixtures/world/${name}.ts`)), `${device}:${folder}/test/fixtures/world/`]);
    remote(`cd ${folder} && npm init -y >/dev/null && npm pkg set type=module && npm install --no-audit --no-fund --no-package-lock ./${packed.filename} >/dev/null`);
    const opened = await up();
    assert.deepEqual(opened.at, [`tcp://${host}:${port}`], 'Bob’s house names the address the device is reached at');
    await hand(bobs, 'bear', { kind: 'org.example.host', id: 'bob' });
    alice = await House.open({ keys: new SeedKeys('a'.repeat(64)), memory: new FakeMemory(), classes: new ClassList({ steward: Steward, beings: [Host, Guest] }), carry });
  });

  after(async () => {
    await down().catch(() => undefined);
    await carry.close();
    if (folder !== '') remote(`rm -rf '${folder}'`);
    rmSync(here, { recursive: true, force: true });
  });

  for (const known of [true, false]) {
    const id = known ? 'alice-known' : 'alice-newborn';
    void test(`Alice here, ${known ? 'known' : 'newborn'}: her owner lands Bob's paper, and she greets him across the internet`, async () => {
      if (known) await hand(alice.ask, 'bear', { kind: 'org.example.guest', id });
      const given = await paper(bobs, 'bob', `for-${id}`);
      assert.deepEqual(addressesOf(given), [`tcp://${host}:${port}`], 'the paper names the device’s public address alone');
      if (!known) await hand(alice.ask, 'bear', { kind: 'org.example.guest', id });
      await land(alice.ask, given, id);
      assert.equal(await being(alice.ask, id, 'greetHost'), `bob greets for-${id}`);
      assert.ok(((await being(bobs, 'bob', 'occupantsList')) as string[]).includes(`for-${id}`));
    });
  }

  void test('Bob’s ground down is silence to Alice, and once it is back her asks reach him', async () => {
    const id = 'alice-patient';
    await hand(alice.ask, 'bear', { kind: 'org.example.guest', id });
    await land(alice.ask, await paper(bobs, 'bob', `for-${id}`), id);
    assert.equal(await being(alice.ask, id, 'greetHost'), `bob greets for-${id}`);
    await down();
    assert.equal(await failed(alice.ask, id, 'greetHost'), 'greet answered nothing');
    await up();
    assert.equal(await being(alice.ask, id, 'greetHost'), `bob greets for-${id}`);
  });
});
