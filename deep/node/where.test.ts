// Where a relation between two beings is carried over TCP between two
// grounds, the far one a process of its own. Inside one house and between
// two houses on one ground is `test/node/where.test.ts`.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { groundOne, hand } from '../../test/fixtures/node/grounds.ts';
import { ground, stop } from '../../test/fixtures/node/spawned.ts';

const script = new URL('../../test/fixtures/node/ground.ts', import.meta.url).pathname;

test('Two grounds over TCP: a being on ground one asks a being on ground two, over the carry', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'nervur-where-'));
  const far = await ground(script, { env: { NERVUR_KEY: 'c'.repeat(64), GROUND_MEMORY: join(folder, 'far.memory'), GROUND_OFFER: '1' }, conditions: ['nervur-source'] });
  t.after(async () => {
    await stop(far.child);
    rmSync(folder, { recursive: true, force: true });
  });
  const one = await groundOne(t, { dials: true });
  const near = await one.open('d');
  const standing = (await hand(near.ask, 'adopt', { invitation: far.line.offered!.result.handle })) as string;
  assert.deepEqual(await near.ask({ method: 'relay', args: { standing } }), { result: 'far' }, 'the far ground, in its own process, answered over TCP');
  assert.ok(one.carry.sends >= 1, 'the ask crossed the carry to reach the other ground');
});
