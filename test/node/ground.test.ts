// Two grounds ask each other over TCP: one written by hand, a script in its
// own process, and one here.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { groundOne, hand } from '../fixtures/node/grounds.ts';
import { ground, stop } from '../fixtures/node/spawned.ts';

const script = new URL('../fixtures/node/ground.ts', import.meta.url).pathname;

test('Two grounds ask each other over TCP, and a restart loses nothing that landed', { timeout: 30_000 }, async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'nervur-ground-'));
  const port = String(40_000 + Math.floor(Math.random() * 20_000));
  const env = { NERVUR_KEY: 'a'.repeat(64), GROUND_PORT: port, GROUND_MEMORY: join(folder, 'a.memory') };
  const start = (extra: Record<string, string> = {}) => ground(script, { env: { ...env, ...extra }, conditions: ['nervur-source'] });
  let far = await start({ GROUND_OFFER: '1' });
  t.after(async () => {
    await stop(far.child);
    rmSync(folder, { recursive: true, force: true });
  });

  const one = await groundOne(t, { dials: true });
  const near = await one.open('near');
  const standing = (await hand(near.ask, 'adopt', { invitation: far.line.offered!.result.handle })) as string;
  assert.equal(await hand(near.ask, 'relay', { standing }), 'far');

  await stop(far.child);
  far = await start();
  assert.equal(await hand(near.ask, 'relay', { standing }), 'far', 'the far ground restarted on its file, and the relation stood');
});
