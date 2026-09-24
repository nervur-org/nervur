// SPDX-License-Identifier: Apache-2.0
// One instance per folder. The lock is a file named `lock` holding the
// process id that took it. A lock whose process is gone is taken over.
import { link, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gone } from './gone.ts';

export interface Lock {
  /** Lets the lock go, where this process still holds it. */
  release(): Promise<void>;
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const holder = async (path: string): Promise<number | null> => {
  try {
    const pid = Number((await readFile(path, 'utf8')).trim());
    return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};

/**
 * Takes the lock of `dir`, or refuses where a living process holds it.
 * The file is written whole beside the lock and linked into place, so a
 * lock is never seen half written, and two takers never both land.
 */
export const takeLock = async (dir: string): Promise<Lock> => {
  const path = join(dir, 'lock');
  const mine = join(dir, `lock.${process.pid}`);
  await writeFile(mine, `${process.pid}\n`, { mode: 0o600 });
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await link(mine, path);
        return {
          release: async () => {
            if ((await holder(path)) === process.pid) await gone(path);
          },
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
      const pid = await holder(path);
      if (pid !== null && alive(pid)) throw new Error(`process ${pid} holds the lock of ${dir}`);
      // Set aside what stands; where a living lock was set aside instead,
      // it goes back and this taker refuses.
      const aside = join(dir, `lock.stale.${process.pid}`);
      try {
        await rename(path, aside);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw error;
      }
      const took = await holder(aside);
      if (took !== pid && took !== null && alive(took)) {
        await link(aside, path).catch(() => undefined);
        await gone(aside);
        throw new Error(`process ${took} holds the lock of ${dir}`);
      }
      await gone(aside);
    }
    throw new Error(`the lock of ${dir} is contended`);
  } finally {
    await gone(mine);
  }
};
