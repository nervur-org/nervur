// SPDX-License-Identifier: Apache-2.0
// The stand program: one JSON request a line on stdin, one answer a line on
// stdout, until stdin closes.
import { createInterface } from 'node:readline';
import { Stand } from './stand.ts';

const stand = new Stand((n) => globalThis.crypto.getRandomValues(new Uint8Array(n)));
const pending: Promise<void>[] = [];

for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  if (line === '') continue;
  pending.push(
    stand.handle(line).then(
      (answer) => void process.stdout.write(`${JSON.stringify(answer)}\n`),
      (error: unknown) => void process.stderr.write(`${String(error)}\n`),
    ),
  );
}
await Promise.all(pending);
await stand.close();
