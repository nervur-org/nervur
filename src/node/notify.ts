// SPDX-License-Identifier: Apache-2.0
// Tells systemd the ground is up. Node speaks no datagram on a local
// socket, so `systemd-notify` carries the word, and the unit says
// `Type=notify` and `NotifyAccess=all`. Where no systemd waits, it does
// nothing and answers `false`.
import { execFile } from 'node:child_process';

export const notifyReady = (): Promise<boolean> => {
  if (!process.env.NOTIFY_SOCKET) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    execFile('systemd-notify', ['--ready', `MAINPID=${process.pid}`], (error) => {
      if (error === null) resolve(true);
      else reject(new Error(`systemd-notify refused: ${error.message}`));
    });
  });
};
