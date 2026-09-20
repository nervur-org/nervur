// SPDX-License-Identifier: Apache-2.0
// The paths an ordinary world seldom walks: what stands behind a door
// throwing, a stranger whose lid takes no seal, a zero-head ask reaching a
// ward's public being, and the small refusals of the lower layers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decapsulate, hex, unhex, utf8 } from '../../src/core/crypto/index.ts';
import { readValue } from '../../src/core/crypto/json.ts';
import { FolderMemory } from '../../src/core/folder/index.ts';
import { Door, GONE, MemoryRelations, readReply, SigningKey, WardKey, writePayload, type Behind } from '../../src/core/quo/index.ts';
import { Ephemeral } from '../../src/core/quo/keys.ts';
import { openReply, sealAsk, signBody, splitBody, ZERO_EDGE, ZERO_HEAD } from '../../src/core/quo/seal.ts';
import { Package } from '../../src/core/harbor/index.ts';
import { CryptoEntropy, NoCarrier, PointerTerrain, VolatileMemory, World } from '../../src/core/pointer/index.ts';
import { Faculty, type JsonObject, type Stance } from '../../src/core/being/index.ts';
import { TEST } from './classes.ts';
import { holds } from '../claims.ts';
import { draw, Holder, Scene } from './quo/scene.ts';
import { scratch } from './contract/suites.ts';
import { Wards } from './ward/beings.ts';

test(holds('door.silence', 'edges: a behind that throws is silence to the asker'), async () => {
  const scene = new Scene();
  const alice = await scene.ward('alice');
  const { invitation } = await alice.door.invite();
  const broken: Behind = { zero: false, answer: () => Promise.reject(new Error('broken')) };
  (alice.door as { behind: Behind }).behind = broken;
  assert.deepEqual(await new Holder(scene, invitation).ask('hello'), { silence: true });
});

test('[edges] a stranger whose lid takes no seal, where the door draws none either, still gets its silence', async () => {
  const zeros = (n: number) => new Uint8Array(n);
  const door = new Door(await WardKey.from('z'), new MemoryRelations(), { zero: false, answer: () => Promise.resolve({ silence: true }) }, zeros);
  const judged = await door.arrive(new Uint8Array(40));
  assert.equal(judged.case, 1);
  assert.equal(judged.bytes.length, 112 + 16);
});

// A zero-head ask, sealed by hand, since a standing always names a heir.
const zeroAsk = async (ward: string, method: string) => {
  const by = await SigningKey.draw(draw);
  const lid = await Ephemeral.draw(draw);
  const body = await signBody(utf8(writePayload({ to: null, by: by.id, next: null, seq: 1, method })), by);
  const bytes = (await sealAsk(lid, unhex(ward.slice(64)), ZERO_HEAD, ZERO_EDGE, body))!;
  return { bytes, lid };
};

test(holds('door.zero-head', 'edges: the zero head reaches the public being of a ward as nobody, and nothing where there is none'), async () => {
  const wards = new Wards();
  const alice = await wards.stand('alice');
  await alice.root('boot', { key: 'host', class: 'org.example.host' });
  const ask = async () => {
    const { bytes, lid } = await zeroAsk(alice.pk, 'greet');
    const judged = await alice.door.arrive(bytes);
    const opened = (await openReply(judged.bytes, lid))!;
    return { case: judged.case, reply: readReply(splitBody(opened.bytes)!.text) };
  };
  assert.equal((await ask()).case, 4);
  await alice.root('public', { key: 'host' });
  const out = await ask();
  assert.equal(out.case, 12);
  assert.deepEqual(out.reply && 'object' in out.reply ? JSON.parse(out.reply.object) : out.reply, { hello: null, args: {} });
});

test('[edges] a faculty retracts an offer nobody took, and only that one', async () => {
  let offers: Record<string, string> = {};
  const removed: string[] = [];
  const stance: Stance = {
    key: 'f',
    cells: {
      get offers() {
        return offers as unknown as JsonObject;
      },
      set offers(v) {
        offers = v as unknown as Record<string, string>;
      },
    } as JsonObject,
    occupants: { invite: (id) => Promise.resolve(id === 'lent:2' ? null : ({ ward: 'w', heir: `heir-${id}`, secret: '', lock: '' } as never)), notes: () => undefined, ids: () => [], remove: (id) => (removed.push(id), true) },
    standings: { take: () => Promise.resolve(null), get: () => undefined, ids: () => [], remove: () => false },
    boot: () => Promise.resolve(null),
    lend: () => Promise.resolve(null),
  };
  const faculty = new Faculty(stance);
  assert.deepEqual(await faculty.answer({ id: 'ward' }, 'offer', {}), { invitation: { ward: 'w', heir: 'heir-lent:1', secret: '', lock: '' } });
  assert.deepEqual(await faculty.answer({ id: 'ward' }, 'offer', {}), { error: 'not invited' });
  assert.deepEqual(await faculty.answer({ id: 'ward' }, 'retract', { heir: 'nobody' }), { retracted: null });
  assert.deepEqual(await faculty.answer({ id: 'ward' }, 'retract', { heir: 'heir-lent:1' }), { retracted: 'lent:1' });
  assert.deepEqual(removed, ['lent:1']);
  assert.deepEqual(faculty.describe({}).asks, []);
});

test('[edges] a decapsulation key that is no key opens nothing', () => {
  assert.equal(decapsulate(new Uint8Array(3), new Uint8Array(1088)), null);
  assert.equal(decapsulate(new Uint8Array(2400), new Uint8Array(3)), null);
});

test('[edges] an unterminated string is no value', () => {
  assert.equal(readValue('"abc', 1), undefined);
  assert.equal(readValue(Uint8Array.of(0xff), 1), undefined);
});

test('[edges] a folder whose entry cannot be read refuses to read, and a name the kit did not choose is refused', async () => {
  const root = scratch();
  await mkdir(join(root, 'aa', '01'), { recursive: true });
  const memory = new FolderMemory(root);
  assert.deepEqual(await memory.read('aa'), new Map());
  await writeFile(join(root, 'file'), '');
  await assert.rejects(new FolderMemory(join(root, 'file')).read('bb'), { code: 'ENOTDIR' });
  await assert.rejects(memory.read('../up'), /not a name/);
  await assert.rejects(memory.read(''), /not a name/);
  await assert.rejects(memory.write('aa', new Map([['..', null]])), /not a name/);
  await assert.rejects(memory.write('a/', new Map()), /not a name/);
});

test(holds('package.sealed', 'edges: the package refuses an entry too short to be sealed, or moved under another name'), async () => {
  const memory = new VolatileMemory();
  const entropy = new CryptoEntropy();
  const seed = entropy.draw(32);
  const pack = await Package.open(memory, entropy, seed);
  const rows = await pack.rows('w');
  rows.rows.beings = { a: { class: 'A' }, b: { class: 'B' } };
  rows.told('a');
  rows.told('b');
  assert.equal(await rows.kept(), true);
  assert.deepEqual(Object.keys((await pack.rows('w')).rows.beings as object).sort(), ['a', 'b']);
  const where = hex(await pack.derive(['place', 'w'], 16));
  const [[first, one], [second, two]] = [...(await memory.read(where))];
  await memory.write(where, new Map([[first!, two!], [second!, one!]]));
  await assert.rejects(pack.rows('w'), /did not seal/);
  await memory.write(where, new Map([[first!, Uint8Array.of(1, 2)], [second!, null]]));
  await assert.rejects(pack.rows('w'), /did not seal/);
});

test(holds('relations.gone', 'edges: the last removed relations are kept, the oldest out, and nothing else counts'), () => {
  const relations = new MemoryRelations();
  const keys = { held: 'h', vouched: null, open: 'o', offered: 'f' };
  relations.set('live', { state: 'spent', highest: 1, honoured: [], ...keys });
  relations.set('new', { state: 'fresh' });
  for (let i = 0; i < GONE; i++) relations.set(`gone${i}`, { state: 'kept', ...keys });
  assert.equal(relations.get('gone0')?.state, 'kept');
  relations.set('one more', { state: 'kept', ...keys });
  assert.equal(relations.get('gone0'), undefined);
  assert.equal(relations.get('gone1')?.state, 'kept');
  assert.equal(relations.get('one more')?.state, 'kept');
  assert.equal(relations.get('live')?.state, 'spent');
  assert.equal(relations.get('new')?.state, 'fresh');
});

test(holds('carrier.none', 'edges: a pointer terrain alone reaches nobody, and a world restarts only what it holds'), async () => {
  assert.equal(await new NoCarrier().carry(), null);
  assert.ok(new PointerTerrain({ defaults: TEST }).carrier instanceof NoCarrier);
  const world = new World(TEST);
  await assert.rejects(world.restart('nobody'), /no harbor/);
  assert.throws(() => world.get('nobody'), /no harbor/);
  await world.harbor('h');
  await assert.rejects(world.harbor('h'), /stands/);
  assert.equal(await world.carry(hex(new Uint8Array(64)), new Uint8Array(0)), null);
});
