// A house whose entry grants it the `ground` manages the other houses of
// the ground it stands on: it adds, lists and removes them, and invites a
// being of hers onto a house's steward, with a pilot's reach and never
// root's. A house without the grant holds none of it, no house reaches
// herself or the dock through it, and the hand and a pilot invite through
// the dock's `housesInvite` alone.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';

type Json = NonNullable<Parameters<BenchGround['hand']>[0]['args']>;

const modules = {
  hosting: new URL('../fixtures/ground/hosting.ts', import.meta.url),
  tenant: new URL('../fixtures/ground/tenant.ts', import.meta.url),
  control: new URL('../fixtures/node/piloting/pilot/index.ts', import.meta.url),
};

const open = async (t: { after(done: () => unknown): void }, network = new FakeNetwork(), host = 'home') => {
  const ground = await BenchGround.open({ network, host, modules });
  t.after(() => ground.down());
  const hosting = (method: string, args?: Json) => ground.ask({ house: 'hosting', method, ...(args === undefined ? {} : { args }) });
  const raw = async (method: string, args: Json) => (await hosting('raw', { method, args })) as { result: { result?: unknown; error?: string } };
  return { ground, hosting, raw };
};

test('A house granted the ground adds a house, lists it, and invites a being of hers onto its steward, who asks it; removing the house ends her standing', async (t) => {
  const { ground, hosting } = await open(t);
  await ground.add('hosting', 'hosting', { faculties: ['ground'] });
  assert.deepEqual(await ground.hand({ method: 'housesList' }), { result: [{ name: 'hosting', entry: { classes: { faculty: 'module', name: 'hosting' }, faculties: ['ground'] }, ward: ground.list().find(({ name }) => name === 'hosting')?.ward }] }, 'the grant stands in her entry');
  assert.deepEqual(await hosting('bear', { id: 'keeper' }), { result: null });

  const opened = (await hosting('open', { name: 'acme' })) as { result: { ward: string } };
  assert.equal(opened.result.ward, ground.list().find(({ name }) => name === 'acme')?.ward, 'she opened a house as a pilot would');
  assert.deepEqual(await hosting('tenants'), { result: ['acme', 'hosting'] }, 'and lists every house of her ground');

  assert.ok('result' in (await hosting('admit', { name: 'acme', id: 'keeper-acme', keeper: 'keeper' })));
  assert.deepEqual(await ground.ask({ house: 'hosting', id: 'keeper', method: 'whoami' }), { result: 'keeper-acme {"by":"ground","house":"hosting"}' }, 'her keeper asks the steward, whose notes name the house that invited');

  assert.deepEqual(await hosting('raw', { method: 'housesRemove', args: { name: 'acme' } }), { result: { result: null } });
  assert.deepEqual(await hosting('tenants'), { result: ['hosting'] });
  const gone = await ground.ask({ house: 'hosting', id: 'keeper', method: 'whoami' });
  assert.ok('error' in gone, `the removed house takes her standing with it: ${JSON.stringify(gone)}`);
});

test('It refuses a granted house asking anything of herself through the `ground`, or reaching another ground’s houses: a house whose entry does not grant it holds none of it, and neither the dock nor a house not open takes an invitation', async (t) => {
  const { ground, raw } = await open(t);
  const plain = await ground.add('plain', 'hosting');
  assert.match(plain.why ?? '', /no offer covers her need/, 'an ungranted house holds no ground, so a species that needs it stands nowhere');

  await ground.add('hosting', 'hosting', { faculties: ['ground'] });
  await ground.add('acme', 'tenant');
  const herself = 'the house hosting asks nothing of herself through the ground';
  for (const [method, args] of [
    ['housesUpdate', { name: 'hosting', classes: { faculty: 'module', name: 'hosting' }, faculties: ['ground'] }],
    ['housesRemove', { name: 'hosting' }],
    ['housesInvite', { name: 'hosting', id: 'mine' }],
    ['housesAdd', { name: 'hosting', classes: { faculty: 'module', name: 'hosting' } }],
  ] as const) {
    assert.deepEqual((await raw(method, args)).result, { error: herself }, method);
  }
  assert.deepEqual((await raw('housesInvite', { name: 'dock', id: 'mine' })).result, { error: 'no house dock is here' }, 'the dock is no house');
  assert.deepEqual((await raw('housesInvite', { name: 'absent', id: 'mine' })).result, { error: 'no house absent is here' });
  assert.deepEqual((await raw('housesInvite', { name: 'acme', id: 'root' })).result, { error: "the occupant id root is the house's" }, 'an id the house reserves');
  assert.ok('result' in (await raw('housesInvite', { name: 'acme', id: 'twice' })).result);
  assert.deepEqual((await raw('housesInvite', { name: 'acme', id: 'twice' })).result, { error: 'the steward holds twice already' });
  assert.deepEqual((await raw('facultiesList', {})).result, undefined, 'no faculty ask is offered');

  // A house that stands closed with why is open nowhere, so no one stands on it.
  await ground.hand({ method: 'housesAdd', args: { name: 'broken', classes: { faculty: 'module', name: 'missing' } } });
  assert.deepEqual((await raw('housesInvite', { name: 'broken', id: 'mine' })).result, { error: 'no house broken is open here' });
});

test('It refuses a pilot naming the house that invites, and the hand minting an occupant but through `housesInvite`: the hand and a pilot invite onto a house’s steward through the dock', async (t) => {
  const { ground } = await open(t);
  await ground.add('acme', 'tenant');
  await ground.add('hosting', 'hosting', { faculties: ['ground'] });
  await ground.ask({ house: 'hosting', method: 'bear', args: { id: 'keeper' } });

  const invited = (await ground.hand({ method: 'housesInvite', args: { name: 'acme', id: 'ada' } })) as { result: { invitation: string } };
  assert.equal(typeof invited.result.invitation, 'string', 'the hand holds its hex');
  assert.ok('result' in (await ground.ask({ house: 'hosting', id: 'keeper', method: 'take', args: { invitation: invited.result.invitation } })));
  assert.deepEqual(await ground.ask({ house: 'hosting', id: 'keeper', method: 'whoami' }), { result: 'ada {"by":"root"}' });

  await ground.add('control', 'control');
  const pilots = (await ground.hand({ method: 'pilotsInvite', args: { id: 'bea' } })) as { result: { invitation: string } };
  assert.ok('result' in (await ground.ask({ house: 'control', method: 'accept', args: { invitation: pilots.result.invitation } })));
  const pilot = (args: Json) => ground.ask({ house: 'control', method: 'pilot', args: { method: 'housesInvite', args } });
  assert.ok('result' in (await pilot({ name: 'acme', id: 'cid' })), 'a pilot invites as the hand does');
  assert.deepEqual(await pilot({ name: 'acme', id: 'eve', by: 'hosting' }), { error: { message: 'only the ground names the house that invites' } }, 'and never in a granted house’s name');
  assert.deepEqual(await ground.hand({ method: 'housesInvite', args: { name: 'acme', id: 'eve', by: 'acme' } }), { error: { message: 'the house acme invites nothing onto herself' } });

  assert.deepEqual(await ground.hand({ invite: { occupant: 'eve' } } as never), { error: { message: 'the hand invites through the dock’s housesInvite alone' } }, 'nor onto the dock');
  assert.deepEqual(await ground.hand({ house: 'acme', invite: { occupant: 'eve' } } as never), { error: { message: 'the hand invites through the dock’s housesInvite alone' } });
});

test('It refuses a granted house asking anything of herself through the `ground`, or reaching another ground’s houses: she reaches the houses of her own ground alone', async (t) => {
  const network = new FakeNetwork();
  const { ground, hosting } = await open(t, network, 'home');
  const { ground: far } = await open(t, network, 'far');
  await far.add('elsewhere', 'tenant');
  await ground.add('hosting', 'hosting', { faculties: ['ground'] });
  assert.deepEqual(await hosting('tenants'), { result: ['hosting'] }, 'the far ground’s house is none of hers');
});

test('It refuses an entry granting the ground twice, or naming it for its code or its memory', async (t) => {
  const { ground } = await open(t);
  const work = 'the ground is the library’s: no faculty entry names it or makes it, and a house’s faculties alone grant it';
  for (const [args, message] of [
    [{ name: 'x', classes: { faculty: 'module', name: 'hosting' }, faculties: ['ground', 'ground'] }, 'the house x is refused: it names the ground twice'],
    [{ name: 'x', classes: { faculty: 'ground' } }, work],
    [{ name: 'x', classes: { faculty: 'module', name: 'hosting' }, memory: { faculty: 'ground' } }, work],
  ] as const) {
    assert.deepEqual(await ground.hand({ method: 'housesAdd', args }), { error: { message } }, JSON.stringify(args));
  }
});
