// The grounds of the Node scenarios, and the owner's hand on them. Ground
// one is written by hand in the test's process: TCP and HTTP joined, shared
// by its houses, dialling no private address unless asked, so a box between
// its own houses goes only by pointer. Ground two is a NodeGround in its own
// process, `nervur up` on a folder, piloted through its hand on a socket.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ClassList, Ground, JoinedCarry, WebCarry, type Body, type Faculty, type Opened } from 'nervur';
import { FileMemory, FileUnlock, serveHttp, TcpCarry } from 'nervur/node';
import { Guest } from '../world/guest.ts';
import { Host } from '../world/host.ts';
import { Steward } from '../world/steward.ts';
import { CountingCarry } from './counting-carry.ts';
import { handAt } from './hand-client.ts';
import { onLoopback, stop, up as nervurUp } from './spawned.ts';

/** A house's own ask, as its ground's hand reaches it. */
export type Ask = Opened['ask'];
type Json = NonNullable<Parameters<Ask>[0]['args']>;
type Beings = ConstructorParameters<typeof ClassList>[0]['beings'];

/** The command, as the package's `bin` names it, run from the source that bin is built from. */
export const cli = (() => {
  const { bin } = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as { bin: { nervur: string } };
  return fileURLToPath(new URL(`../../../${bin.nervur.replace(/^dist/, 'src').replace(/\.js$/, '.ts')}`, import.meta.url));
})();

/** The owner, through the hand: what the steward answered. */
export const hand = async (ask: Ask, method: string, args: Json = {}) => {
  const answer = await ask({ method, args });
  assert.ok('result' in answer, `${method}: ${JSON.stringify(answer)}`);
  return answer.result;
};

/** The owner lands a paper in the being named, asking her `accept` through the hand. */
export const land = async (ask: Ask, invitation: string, id: string) => {
  const answer = await ask({ id, method: 'accept', args: { invitation } });
  assert.ok('result' in answer, `accept: ${JSON.stringify(answer)}`);
};

/** What a being answered, through her steward's `forward`. */
export const being = async (ask: Ask, id: string, method: string, args?: Readonly<Record<string, string | number>>) => {
  const { answered } = (await hand(ask, 'forward', { id, method, ...(args === undefined ? {} : { args }) })) as { answered?: string };
  return answered === undefined ? undefined : JSON.parse(answered);
};

/** What the owner hears when a being's ask fails: the message alone. */
export const failed = async (ask: Ask, id: string, method: string) => {
  const answer = await ask({ method: 'forward', args: { id, method } });
  assert.ok('error' in answer, `${id}.${method} answered ${JSON.stringify(answer)}`);
  return answer.error.message;
};

/** A paper on a being, minted by the owner for an occupant it names. */
export const paper = async (ask: Ask, being: string, occupant: string) => ((await hand(ask, 'offerFor', { being, occupant })) as { handle: string }).handle;

/**
 * Ground one. `carry.sends` counts every box its houses sent, and `heard`
 * the boxes each listener's door took. `dials` lets it dial another ground
 * on this machine, and proves no pointer then. `faculties` are the ground's,
 * each stood by its entry, and granted to a house by name when it opens.
 */
export const groundOne = async (t: TestContext, { dials = false, faculties = {} }: { dials?: boolean; faculties?: Readonly<Record<string, Body>> } = {}) => {
  const tcp = new TcpCarry({ host: '127.0.0.1', allowPrivate: dials });
  t.after(() => tcp.close());
  let httpAt = '';
  const web = new WebCarry({ addresses: () => [httpAt], allowPrivate: dials });
  const served = await serveHttp({ host: '127.0.0.1' }, [web]);
  t.after(() => served.close());
  httpAt = `http://127.0.0.1:${served.port}/quo`;
  const carry = new CountingCarry(new JoinedCarry({ tcp, http: web }), { tcp, http: web });
  // Its key and its memory in a folder of its own, as an owner's hand-written ground keeps them.
  const state = mkdtempSync(join(tmpdir(), 'ground-one-'));
  t.after(() => rmSync(state, { recursive: true, force: true }));
  // Each house's classes, by its name, as the entry that opens it names them.
  const classes = new Map<string, ClassList>();
  const own: Record<string, Faculty> = {
    'file-unlock': { up: () => ({ serves: 'unlock', object: new FileUnlock(join(state, 'key')) }) },
    drawer: { up: () => ({ serves: 'memory', object: new FileMemory(join(state, 'drawer')) }) },
    counted: { up: () => ({ serves: 'carry', schemes: ['tcp', 'http'], object: carry }) },
    file: { up: () => ({ serves: 'memory', house: ({ house }) => new FileMemory(join(state, `${house}.memory`)) }) },
    named: { up: () => ({ serves: 'classes', house: ({ house }) => classes.get(house)! }) },
  };
  const ground = await Ground.open({
    registry: { faculties: { ...own, ...Object.fromEntries(Object.entries(faculties).map(([name, body]) => [name, { up: () => body }])) } },
    primordial: { unlock: { make: 'file-unlock' }, memory: { make: 'drawer' }, crypto: { make: 'noble' }, tools: { make: 'strict' }, clock: { make: 'clock' } },
    entries: { carry: { make: 'counted' }, file: { make: 'file' }, named: { make: 'named' } },
  });
  t.after(() => ground.close());
  for (const name of Object.keys(faculties)) {
    const { why } = await ground.stand(name, { make: name });
    assert.equal(why, undefined, `the faculty ${name} did not stand`);
  }
  const open = async (name: string, { beings = [Host, Guest], granted = [] }: { beings?: Beings; granted?: readonly string[] } = {}) => {
    classes.set(name, new ClassList({ steward: Steward, beings }));
    const standing = await ground.add(name, { memory: { faculty: 'file' }, classes: { faculty: 'named' }, faculties: [...granted] });
    assert.ok(standing.ward !== undefined, `the house ${name} did not open: ${standing.why}`);
    const ask: Ask = (request) => ground.ask({ house: name, ...request });
    return { ask, ward: standing.ward };
  };
  return { open, carry, heard: carry.heard };
};

/**
 * Ground two: a NodeGround on `fixtures/node`, one house `main` from the
 * folder `two` in its view of the ground's ledger, and its owner's hand.
 * `down` stops its process, and `up` starts it again on the same state and
 * port, which opens the house again from its drawer.
 */
export const groundTwo = async (t: TestContext) => {
  const folder = new URL('./', import.meta.url).pathname;
  const state = mkdtempSync(join(tmpdir(), 'nv-'));
  const env = { NERVUR_STATE: state };
  // Its TCP carry on the loopback at one port, which the drawer keeps across a restart.
  await onLoopback(folder, state, 40_000 + Math.floor(Math.random() * 20_000));
  let running: { child: Awaited<ReturnType<typeof nervurUp>>['child']; close: () => void } | undefined;
  let current: Ask = async () => ({ error: { message: 'ground two is down' } });
  const up = async () => {
    const ground = await nervurUp(cli, folder, { env, conditions: ['nervur-source'] });
    const owner = await handAt<Parameters<Ground['hand']>[0]>(ground.line.hand);
    running = { child: ground.child, close: owner.close };
    current = (request) => owner.ask({ house: 'main', ...request });
    return owner;
  };
  const down = async () => {
    running?.close();
    if (running !== undefined) await stop(running.child);
    running = undefined;
  };
  t.after(async () => {
    await down();
    rmSync(state, { recursive: true, force: true });
  });
  const owner = await up();
  const added = await owner.ask({ method: 'housesAdd', args: { name: 'main', classes: { faculty: 'folder', at: 'two' } } });
  assert.ok('result' in added, JSON.stringify(added));
  const ask: Ask = (request) => current(request);
  return { ask, up: async () => void (await up()), down };
};
