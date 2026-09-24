// SPDX-License-Identifier: Apache-2.0
// The hand on a local socket, or on Windows a named pipe: one JSON object
// a line in, one answer a line out, in order. It is open to the ground's
// user alone.
import { createHash } from 'node:crypto';
import { chmod } from 'node:fs/promises';
import { createServer, type Socket } from 'node:net';
import { join, resolve as absolute } from 'node:path';
import { createInterface } from 'node:readline';
import type { Json } from '../being/being.ts';
import type { Answer } from '../house/rows-shape.ts';
import { gone } from './gone.ts';

export interface Hand {
  /** Stops listening, and removes the socket. */
  close(): Promise<void>;
}

/**
 * One line to the hand. On a house's own hand, an ask of a being. On a
 * ground's, an ask of a being in the house it names, a method of one of
 * its faculties, or `describe` for all it holds.
 */
export interface HandRequest {
  readonly house?: string;
  readonly faculty?: string;
  readonly describe?: true;
  readonly id?: string;
  readonly method?: string;
  readonly args?: { readonly [key: string]: Json };
  /** The answer the owner holds, which makes a `readOnly` ask a watch. */
  readonly after?: Answer;
  /** Her cells read, and nothing asked. */
  readonly cells?: true;
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const request = (line: string): HandRequest | null => {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!object(value)) return null;
  const { house, faculty, describe, id, method, args, after, cells, ...rest } = value;
  if (Object.keys(rest).length > 0) return null;
  for (const text of [house, faculty, id, method]) if (text !== undefined && typeof text !== 'string') return null;
  if (args !== undefined && !object(args)) return null;
  if (describe !== undefined && describe !== true) return null;
  if (cells !== undefined && cells !== true) return null;
  // An answer is `{ result }` or `{ error }`, and nothing else.
  if (after !== undefined && !(object(after) && Object.keys(after).length === 1 && ('result' in after || 'error' in after))) return null;
  return Object.fromEntries(Object.entries({ house, faculty, describe, id, method, args, after, cells }).filter(([, field]) => field !== undefined));
};

const serve = (ask: (request: HandRequest) => Promise<unknown>, socket: Socket) => {
  let turn = Promise.resolve();
  createInterface({ input: socket }).on('line', (line) => {
    turn = turn.then(async () => {
      const asked = request(line);
      const answer = asked === null ? { error: { message: 'bad request' } } : await ask(asked);
      if (!socket.destroyed) socket.write(`${JSON.stringify(answer)}\n`);
    });
  });
  socket.on('error', () => undefined);
};

// A local socket's path fits the kernel's address: 103 bytes on macOS and
// the BSDs, 107 on Linux, with the closing zero beyond.
const LONGEST = process.platform === 'linux' ? 107 : 103;

const PIPE = /^\\\\[.?]\\pipe\\/;

/**
 * Where a ground's hand stands for its state folder: a socket inside it,
 * or on Windows a named pipe, which has no place in a folder, named for
 * the folder's path.
 */
export const handAt = (state: string, platform: NodeJS.Platform = process.platform): string =>
  platform === 'win32' ? `\\\\.\\pipe\\nervur-${createHash('sha256').update(absolute(state).toLowerCase()).digest('hex').slice(0, 16)}` : join(state, 'hand');

/**
 * Serves `ask` at `path`: a house's own hand, or a ground's, which also
 * reads `house` and changes its record. A socket left there by a process
 * that is gone is replaced. A named pipe on Windows is open to its user
 * alone, as the operating system makes it, and leaves nothing behind.
 */
export const serveHand = async (ask: (request: HandRequest) => Promise<unknown>, path: string): Promise<Hand> => {
  if (PIPE.test(path)) return listen(ask, path, false);
  const length = Buffer.byteLength(path);
  if (length > LONGEST) throw new Error(`a socket's path is at most ${LONGEST} bytes here, and ${path} is ${length}: serve the hand from a shorter folder`);
  await gone(path);
  return listen(ask, path, true);
};

const listen = async (ask: (request: HandRequest) => Promise<unknown>, path: string, file: boolean): Promise<Hand> => {
  const server = createServer((socket) => serve(ask, socket));
  const sockets = new Set<Socket>();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    if (!file) return void server.listen(path, () => resolve());
    // Closed to everyone from the first moment, then opened to the user.
    const mask = process.umask(0o177);
    try {
      server.listen(path, () => resolve());
    } finally {
      process.umask(mask);
    }
  });
  if (file) await chmod(path, 0o600);
  return {
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (file) await gone(path);
    },
  };
};
