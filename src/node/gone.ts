// SPDX-License-Identifier: Apache-2.0
import { unlink } from 'node:fs/promises';

/** Removes a file, and is content where it is already gone. */
export const gone = (path: string): Promise<void> =>
  unlink(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
