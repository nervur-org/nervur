// relay.test.ts
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Bench } from 'nervur/bench';
import { RelayFaculty } from './relay.ts';

test('The relay and its stand-in answer its examples alike', { timeout: 30_000 }, async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'relay-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const findings = await Bench.check(RelayFaculty, { made: { args: { folder } } });
  assert.ok(findings.some(({ what }) => what.startsWith('its fake: ')) && findings.some(({ what }) => what.startsWith('the faculty: ')), 'both were walked');
  assert.equal(readFileSync(join(folder, 'pulses'), 'utf8').trim().split('\n').length, 2, 'the real relay pulsed twice, since each call id came three times');
});
