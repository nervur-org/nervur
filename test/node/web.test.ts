// A NodeGround reached over the web: its invitations name TCP and the web,
// in that order, and a ground that dials the web alone reaches it.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ClassList, Ground, WebCarry } from 'nervur';
import { FileMemory, FileUnlock, NodeGround } from 'nervur/node';
import { Steward } from '../fixtures/world/steward.ts';

const folder = new URL('../fixtures/node/', import.meta.url).pathname;

test('A holder that dials only the web reaches a NodeGround whose invitation names TCP first', { timeout: 20_000 }, async (t) => {
  const state = await mkdtemp(join(tmpdir(), 'ground-'));
  t.after(() => rm(state, { recursive: true, force: true }));
  const far = await NodeGround.open({ folder, state, env: { NERVUR_TCP_PORT: '0', NERVUR_HTTP_PORT: '0', NERVUR_BIND: '127.0.0.1', NERVUR_ALLOW_PRIVATE: '1' } });
  t.after(() => far.close());
  assert.ok((await far.ground.add('main', { classes: { faculty: 'folder', at: 'two' } })).ward !== undefined);

  // A ground whose one carry is the web, as a page or a service worker has.
  const web = new WebCarry({ allowPrivate: true });
  const near = await Ground.open({
    registry: {
      faculties: {
        'file-unlock': { up: () => ({ serves: 'unlock', object: new FileUnlock(join(state, 'near', 'key')) }) },
        drawer: { up: () => ({ serves: 'memory', object: new FileMemory(join(state, 'near', 'drawer')) }) },
        web: { up: () => ({ serves: 'carry', schemes: ['https', 'http', 'wss', 'ws'], object: web, down: () => web.close() }) },
        steward: { up: () => ({ serves: 'classes', house: () => new ClassList({ steward: Steward }) }) },
      },
    },
    primordial: { unlock: { make: 'file-unlock' }, memory: { make: 'drawer' }, crypto: { make: 'noble' }, tools: { make: 'strict' } },
    entries: { clock: { make: 'clock' }, web: { make: 'web' }, steward: { make: 'steward' } },
  });
  t.after(() => near.close());
  await near.add('near', { classes: { faculty: 'steward' } });

  const offered = await far.ground.ask({ house: 'main', method: 'offer' });
  assert.ok('result' in offered);
  const handle = (offered.result as { handle: string }).handle;
  const { at } = JSON.parse(Buffer.from(handle, 'hex').toString('utf8')) as { at: string[] };
  assert.equal(at.length, 2);
  assert.match(at[0], /^tcp:\/\/127\.0\.0\.1:\d+$/, 'TCP first');
  assert.equal(at[1], `http://127.0.0.1:${far.httpPort}/quo`, 'then the web, on the ground’s one listener');

  const standing = await near.ask({ house: 'near', method: 'adopt', args: { invitation: handle } });
  assert.ok('result' in standing);
  const relayed = await near.ask({ house: 'near', method: 'relay', args: { standing: standing.result } });
  assert.deepEqual(relayed, { result: 'far' }, 'the tcp address was passed unheard, and the web one answered');
});
