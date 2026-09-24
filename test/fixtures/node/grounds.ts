// The grounds of the Node scenarios, and the owner's hand on them. Ground
// one is written by hand in the test's process: TCP and HTTP joined, shared
// by its houses, dialling no private address unless asked, so a box between
// its own houses goes only by pointer. Ground two is a NodeGround in its own
// process, `nervur up` on a folder, piloted through its hand on a socket.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ClassList, Ground, JoinedCarry, WebCarry, type Faculty, type Opened } from 'nervur';
import { FakeCustody, FakeMemory } from 'nervur/bench';
import { serveHttp, TcpCarry } from 'nervur/node';
import { Guest } from '../world/guest.ts';
import { Host } from '../world/host.ts';
import { Steward } from '../world/steward.ts';
import { CountingCarry } from './counting-carry.ts';
import { handAt } from './hand-client.ts';
import { stop, up as nervurUp } from './spawned.ts';

/** A house's own ask, as its ground's hand reaches it. */
export type Ask = Opened['ask'];
type Json = NonNullable<Parameters<Ask>[0]['args']>;
type Beings = ConstructorParameters<typeof ClassList>[0]['beings'];

/** The command, as `nervur` runs it from the package's source. */
export const cli = new URL('../../../src/node/cli.ts', import.meta.url).pathname;

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
 * granted to a house by name when it opens.
 */
export const groundOne = async (t: TestContext, { dials = false, faculties = {} }: { dials?: boolean; faculties?: Readonly<Record<string, Faculty>> } = {}) => {
  const tcp = new TcpCarry({ host: '127.0.0.1', allowPrivate: dials });
  let httpAt = '';
  const web = new WebCarry({ addresses: () => [httpAt], allowPrivate: dials });
  const served = await serveHttp({ host: '127.0.0.1' }, [web]);
  httpAt = `http://127.0.0.1:${served.port}/quo`;
  const carry = new CountingCarry(new JoinedCarry({ tcp, http: web }), { tcp, http: web });
  // Each house's classes, by its name, as the entry that opens it names them.
  const classes = new Map<string, ClassList>();
  const ground = await Ground.open({
    custody: new FakeCustody('ground one'),
    memory: new FakeMemory(),
    carry,
    faculties,
    bodies: {
      memory: { fake: () => new FakeMemory() },
      classes: { named: ({ house }) => classes.get(house)! },
    },
  });
  t.after(async () => {
    await ground.close();
    await tcp.close();
    await served.close();
  });
  const open = async (name: string, { beings = [Host, Guest], granted = [] }: { beings?: Beings; granted?: readonly string[] } = {}) => {
    classes.set(name, new ClassList({ steward: Steward, beings }));
    const standing = await ground.add(name, { memory: { body: 'fake' }, classes: { body: 'named' }, faculties: [...granted] });
    assert.ok(standing.ward !== undefined, `the house ${name} did not open: ${standing.why}`);
    const ask: Ask = (request) => ground.ask({ house: name, ...request });
    return { ask, ward: standing.ward };
  };
  return { open, carry, heard: carry.heard };
};

/**
 * Ground two: a NodeGround on `fixtures/node`, one house `main` on a ledger
 * from the folder `two`, and its owner's hand. `down` stops its process, and
 * `up` starts it again on the same state and port, which opens the house
 * again from its record.
 */
export const groundTwo = async (t: TestContext) => {
  const folder = new URL('./', import.meta.url).pathname;
  const state = mkdtempSync(join(tmpdir(), 'nv-'));
  const env = { NERVUR_STATE: state, NERVUR_TCP_PORT: String(40_000 + Math.floor(Math.random() * 20_000)), NERVUR_BIND: '127.0.0.1', NERVUR_ALLOW_PRIVATE: '1' };
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
  const added = await owner.ask({ faculty: 'houses', method: 'add', args: { name: 'main', memory: { body: 'ledger' }, classes: { body: 'folder', at: 'two' } } });
  assert.ok('result' in added, JSON.stringify(added));
  const ask: Ask = (request) => current(request);
  return { ask, up: async () => void (await up()), down };
};
