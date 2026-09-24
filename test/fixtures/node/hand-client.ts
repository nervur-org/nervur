// The owner's side of a hand served on a local socket: one request a line
// out, one answer a line back, in order, as the `nervur` command speaks it.
import { connect } from 'node:net';
import { createInterface } from 'node:readline';
import type { Opened } from 'nervur';

/**
 * The hand at `path`, and closed when done. `Request` is what the hand
 * takes: a house's own ask by default, or the whole request a ground's
 * hand takes, naming a house, a faculty or describe.
 */
export const handAt = async <Request extends object = Parameters<Opened['ask']>[0]>(path: string): Promise<{ ask: (request: Request) => ReturnType<Opened['ask']>; close: () => void }> => {
  const socket = connect(path);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  const waiting: ((line: string) => void)[] = [];
  createInterface({ input: socket }).on('line', (line) => waiting.shift()?.(line));
  const ask = (request: Request): ReturnType<Opened['ask']> =>
    new Promise((resolve) => {
      waiting.push((line) => resolve(JSON.parse(line)));
      socket.write(`${JSON.stringify(request)}\n`);
    });
  return { ask, close: () => socket.destroy() };
};
