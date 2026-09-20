#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// The `nervur` program: `core/cli/command.ts` over this process's
// arguments, its harbors running the defaults of the Node entry. A command
// that cannot run exits 2 and says why on stderr.
import { main, SERVING } from './core/cli/command.ts';
import { DEFAULTS } from './node.ts';

try {
  const code = await main(process.argv.slice(2), process.env, (line) => process.stdout.write(`${line}\n`), DEFAULTS);
  if (code !== SERVING) process.exitCode = code;
} catch (e) {
  process.stderr.write(`nervur: ${(e as Error).message}\n`);
  process.exitCode = 2;
}
