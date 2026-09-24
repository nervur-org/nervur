// SPDX-License-Identifier: Apache-2.0
import { open } from 'node:fs/promises';

/**
 * Makes a file's creation or renaming in `folder` durable. On POSIX the
 * folder is synced. Windows opens no folder for syncing, and NTFS journals
 * a creation and a rename itself, so there it does nothing.
 */
export const syncFolder = async (folder: string, platform: NodeJS.Platform = process.platform): Promise<void> => {
  if (platform === 'win32') return;
  const handle = await open(folder, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
};
