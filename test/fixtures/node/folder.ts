// A program's folder, as a test reads it: the lines a file holds, and the
// moment it holds some count of them, heard as the file changes and never
// waited for on a clock.
import { existsSync, mkdtempSync, readFileSync, rmSync, watch } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

/** Node's words that run a program of the garage's fixtures from its source. */
export const program = (name: string) => ['--conditions=nervur-source', fileURLToPath(new URL(`../garage/${name}`, import.meta.url))];

export const folder = (t: TestContext) => {
  const cwd = mkdtempSync(join(tmpdir(), 'nervur-program-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const lines = (file: string) => (existsSync(join(cwd, file)) ? readFileSync(join(cwd, file), 'utf8').trim().split('\n') : []);
  /** Resolves once `file` holds `count` lines. */
  const until = (file: string, count: number) =>
    new Promise<void>((resolve) => {
      const done = () => lines(file).length >= count;
      const watcher = watch(cwd, () => {
        if (!done()) return;
        watcher.close();
        resolve();
      });
      t.after(() => watcher.close());
      if (!done()) return;
      watcher.close();
      resolve();
    });
  return { cwd, lines, until };
};
