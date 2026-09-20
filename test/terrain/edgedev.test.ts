// SPDX-License-Identifier: Apache-2.0
// `nervur edge dev` as a stranger meets it: a harbor made and set up by the
// command in a folder, packed under its name into a worker's own folder
// beside its wrangler.toml, run by the worker's wrangler dev under the
// secret it keeps there, piloted over the web from a second harbor, handed
// a module the worker was not deployed with, and found again, with what
// the pilot set up, once wrangler dev runs again on the same folder under
// the same secret.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../src/core/cli/command.ts';
import { edgeDev } from '../../src/core/cli/edge.ts';
import { DEFAULTS, type JsonObject } from '../../src/index.ts';
import { holds } from '../claims.ts';
import { scratch } from '../core/contract/suites.ts';
import { bin } from '../where.mjs';

const PACKAGE = fileURLToPath(new URL('../../', import.meta.url));
const MAIN = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));
const WRANGLER = bin('wrangler');

const GREETINGS = `import { Faculty } from 'nervur';
export const module = 'org.example.greetings';
export const version = '1.0.0';
class Greeter extends Faculty {
  static kind = 'org.example.greeter';
  static asks = { hello: {} };
  hello() {
    return { hello: 'from the edge' };
  }
}
export const classes = [Greeter];
`;

const WORKER = `import { harborShell, harborWorker } from 'nervur/edge';
import kit from 'nervur/edge/kit';
import pack from './pack.edge.json';

export const Harbor = harborShell({ kit, pack });
export default harborWorker();
`;

const WRANGLER_TOML = `name = "edge-dev"
main = "worker.js"
compatibility_date = "2026-09-01"

[[durable_objects.bindings]]
name = "HARBOR"
class_name = "Harbor"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["Harbor"]

[[worker_loaders]]
binding = "LOADER"
`;

const freePort = (): Promise<number> =>
  new Promise((done, fail) => {
    const server = createServer();
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => done(port));
    });
  });

const command = async (argv: string[]): Promise<JsonObject> => {
  const lines: string[] = [];
  await main(argv, {}, (line) => lines.push(line), DEFAULTS);
  return JSON.parse(lines.at(-1) ?? '{}') as JsonObject;
};

// Two wrangler dev runs, each a second or two of starting a workerd and
// bundling the worker before it answers, more than the default allows.
test(holds('edge.dev', 'edge dev: a harbor packed into a worker runs under its wrangler dev, is piloted over the web, and stands again across a restart'), { timeout: 30_000 }, async () => {
  const worker = scratch();
  await mkdir(join(worker, 'node_modules', '.bin'), { recursive: true });
  await symlink(PACKAGE, join(worker, 'node_modules', 'nervur'));
  await symlink(WRANGLER, join(worker, 'node_modules', '.bin', 'wrangler'));
  await writeFile(join(worker, 'package.json'), '{ "type": "module" }\n');
  await writeFile(join(worker, 'greetings.js'), GREETINGS);
  await writeFile(join(worker, 'worker.js'), WORKER);
  await writeFile(join(worker, 'wrangler.toml'), WRANGLER_TOML);

  const edge = join(worker, 'harbor');
  const mine = scratch();
  const port = await freePort();
  const at = `http://127.0.0.1:${String(port)}/main/quo`;
  await command(['init', '--dir', edge]);
  assert.equal(((await command(['module', 'add', join(worker, 'greetings.js'), '--dir', edge])) as { answer: { answer: JsonObject } }).answer.answer.added, 'org.example.greetings');
  const places = Object.keys(((await command(['export', '--dir', edge])) as { places: JsonObject }).places).length;
  await command(['reach', at, '--dir', edge]);
  const owner = ((await command(['own', 'me', '--dir', edge])) as { answer: JsonObject }).answer;

  // A folder with no wrangler.toml: wrangler dev exits at once, and edge
  // dev says so with what wrangler said, leaving nothing running. It runs
  // beside the first wrangler dev, since neither waits on the other.
  const bare = scratch();
  await mkdir(join(bare, 'node_modules', '.bin'), { recursive: true });
  await symlink(WRANGLER, join(bare, 'node_modules', '.bin', 'wrangler'));
  const refused = assert.rejects(edgeDev(edge, join(bare, 'pack.edge.json'), 'main', bare, await freePort()), /wrangler dev exited: .+/s);

  const first = await edgeDev(edge, join(worker, 'pack.edge.json'), 'main', worker, port);
  try {
    assert.equal(first.at, at);
    await command(['init', '--dir', mine]);
    assert.deepEqual(await command(['pilot', 'edge', JSON.stringify(owner), '--dir', mine]), { piloting: 'edge', ward: owner.ward });
    assert.deepEqual(await command(['host', 'shop', '--via', 'edge', '--dir', mine]), { answer: { hosted: 'shop' } });
    assert.deepEqual(await command(['open', 'g', 'org.example.greeter', '--via', 'edge', '--dir', mine]), { answer: { opened: 'g' } }, 'the module live holds runs in the child the shell loaded');
    assert.deepEqual(await command(['ask', 'g', 'hello', '--via', 'edge', '--dir', mine]), { answer: { answer: { hello: 'from the edge' } } });
    const other = join(worker, 'greetings-2.js');
    await writeFile(other, GREETINGS.replace("'1.0.0'", "'1.0.1'").replace("'from the edge'", "'again, with no deploy'"));
    const added = (await command(['module', 'add', other, '--via', 'edge', '--dir', mine])) as { answer: { answer: JsonObject } };
    assert.equal(added.answer.answer.version, '1.0.1', 'a module the worker was not deployed with');
    assert.deepEqual(await command(['ask', 'g', 'hello', '--via', 'edge', '--dir', mine]), { answer: { answer: { hello: 'again, with no deploy' } } });
  } finally {
    await first.close();
  }

  await refused;

  // Again, as the command runs it from the worker's folder, stopped as a
  // terminal stops it.
  const again = spawn(process.execPath, [MAIN, 'edge', 'dev', 'pack.edge.json', 'main', '--dir', edge, '--port', String(port)], { cwd: worker, stdio: ['ignore', 'pipe', 'pipe'] });
  const printed = await new Promise<JsonObject>((done, fail) => {
    let text = '';
    let err = '';
    again.stderr!.on('data', (d: Buffer) => (err += d.toString()));
    again.stdout!.on('data', (d: Buffer) => {
      text += d.toString();
      if (text.includes('\n')) done(JSON.parse(text) as JsonObject);
    });
    again.once('exit', (code) => fail(new Error(`edge dev exited ${String(code)}: ${err}`)));
  });
  const gone = new Promise<number | null>((done) => again.once('exit', done));
  try {
    assert.deepEqual(printed, { at, places });
    assert.deepEqual(await command(['host', 'shop', '--via', 'edge', '--dir', mine]), { answer: { error: 'shop is hosted already' } }, 'the ward stood again');
    assert.deepEqual(await command(['host', 'yard', '--via', 'edge', '--dir', mine]), { answer: { hosted: 'yard' } }, 'the pilot still pilots');
    assert.deepEqual(await command(['ask', 'g', 'hello', '--via', 'edge', '--dir', mine]), { answer: { answer: { hello: 'again, with no deploy' } } }, 'the module added stands again');
  } finally {
    again.kill('SIGTERM');
  }
  assert.equal(await gone, 0, 'edge dev stops whole on a terminal stop');
});
