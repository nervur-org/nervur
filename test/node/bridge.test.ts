// The bridge holds its program to the blueprint it described at the boot.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { FacultyContext } from 'nervur';
import { bridge } from 'nervur/node';
import { folder, program } from '../fixtures/node/folder.ts';

type Methods = Record<string, (args: object, context: FacultyContext) => Promise<unknown>>;

const context = (id: string): FacultyContext => ({
  id,
  call: async () => ({ error: { message: 'no handle is held here' } }),
  describe: async () => ({ error: { message: 'no handle is held here' } }),
});

test('A program started again that describes another blueprint is refused and stopped', { timeout: 30_000 }, async (t) => {
  const { cwd, until } = folder(t);
  const turncoat = await bridge({ command: process.execPath, args: program('turncoat.ts'), cwd });
  t.after(() => turncoat.down?.());
  const methods = turncoat.object as Methods;
  assert.deepEqual(await methods.ring({}, context('first')), { result: null });
  // Its next life describes a knocker, not the bell it was at the boot.
  writeFileSync(join(cwd, 'turn'), '');
  await assert.rejects(methods.quit({}, context('quit')), /exited/);
  await until('lives', 2);
  assert.deepEqual(await methods.ring({}, context('second')), {
    error: { message: `the program ${process.execPath} describes another blueprint than it did at the boot, and is stopped` },
  });
});
