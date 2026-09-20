// SPDX-License-Identifier: Apache-2.0
// `nervur/node`: the Node ground. A harbor keeps its seed and sealed
// memory in a folder, its DNA among it, runs a module's source by
// importing it, hands its carriers Node's sockets and HTTP server, and
// serves the root line on a local
// socket, so the `nervur` command reaches it while it stands.
//
//   <dir>/seed        the harbor's seed
//   <dir>/<place>/    its sealed memory
//   <dir>/root.sock   the root line while the harbor is served, open to
//                     this user alone, or in the temporary folder for a
//                     folder too deep for a socket path
//
// One run holds a folder: a terrain refuses a folder another run serves.
import { createHash } from 'node:crypto';
import { chmod, rm } from 'node:fs/promises';
import { connect, createServer, type Server } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { JsonObject } from '../being/index.ts';
import { FolderCustody, FolderMemory } from '../folder/index.ts';
import type { Defaults, GroundProbe, Harbor, RootRequest } from '../harbor/index.ts';
import { webServe } from '../http/index.ts';
import { CryptoEntropy, PointerTerrain, SourceLoader } from '../pointer/index.ts';
import { NodeSockets } from '../tcp/index.ts';

export const NODE = 'node';

// Where a harbor of this user lives unless named: $NERVUR_DIR, then
// ~/.nervur.
export const harborDir = (env: Record<string, string | undefined> = process.env): string => env.NERVUR_DIR ?? join(homedir(), '.nervur');

// A socket path has a hundred bytes or so on every system, so a folder too
// deep for one puts its socket in this user's temporary folder, under a
// name drawn from the folder's own path.
const SOCKET_PATH = 100;
export const socketOf = (dir: string): string => {
  const beside = join(resolve(dir), 'root.sock');
  if (Buffer.byteLength(beside) <= SOCKET_PATH) return beside;
  return join(tmpdir(), `nervur-${createHash('sha256').update(resolve(dir)).digest('hex').slice(0, 32)}.sock`);
};

// One root request over a served harbor's socket, or undefined where none
// is served.
export const askServed = (dir: string, request: RootRequest): Promise<JsonObject | undefined> =>
  new Promise((done, fail) => {
    const socket = connect(socketOf(dir));
    let text = '';
    socket.once('connect', () => socket.write(`${JSON.stringify(request)}\n`));
    socket.on('data', (chunk: Buffer) => {
      text += chunk.toString('utf8');
      const end = text.indexOf('\n');
      if (end < 0) return;
      socket.end();
      done(JSON.parse(text.slice(0, end)) as JsonObject);
    });
    socket.once('error', (e: NodeJS.ErrnoException) => (e.code === 'ENOENT' || e.code === 'ECONNREFUSED' ? done(undefined) : fail(e)));
  });

export type NodeParts = {
  readonly dir: string;
  readonly defaults: Defaults;
  // Whether its carriers wake, and whether it serves the root line.
  readonly wakes?: boolean;
  readonly serves?: boolean;
};

export class NodeTerrain extends PointerTerrain {
  readonly dir: string;
  readonly serves: boolean;
  #server: Server | undefined;

  constructor(parts: NodeParts) {
    const entropy = new CryptoEntropy();
    super({
      entropy,
      loader: new SourceLoader(),
      custody: new FolderCustody(parts.dir, entropy),
      memory: new FolderMemory(parts.dir),
      tcp: () => new NodeSockets(),
      web: webServe,
      defaults: parts.defaults,
      wakes: parts.wakes ?? true,
    });
    this.dir = parts.dir;
    this.serves = parts.serves ?? true;
  }

  override async claim(): Promise<void> {
    if ((await askServed(this.dir, {})) !== undefined) throw new Error(`a harbor is already served from ${this.dir}`);
  }

  // The root line on the socket. A socket file nobody answers on is a
  // stale one, and is replaced.
  override async stand(harbor: Harbor): Promise<void> {
    if (!this.serves) return;
    const root = socketOf(this.dir);
    await rm(root, { force: true });
    const server = createServer((socket) => {
      let text = '';
      socket.on('data', (chunk: Buffer) => {
        text += chunk.toString('utf8');
        for (let end = text.indexOf('\n'); end >= 0; end = text.indexOf('\n')) {
          const line = text.slice(0, end);
          text = text.slice(end + 1);
          let value: unknown;
          try {
            value = JSON.parse(line);
          } catch {
            value = undefined;
          }
          void harbor
            .ask(value)
            .catch(() => ({ error: 'the harbor threw' }))
            .then((answer) => socket.write(`${JSON.stringify(answer)}\n`));
        }
      });
      socket.on('error', () => socket.destroy());
    });
    await new Promise<void>((done) => server.listen(root, done));
    await chmod(root, 0o600);
    this.#server = server;
  }

  override async release(): Promise<void> {
    const server = this.#server;
    if (!server) return;
    this.#server = undefined;
    await new Promise((done) => server.close(done));
    await rm(socketOf(this.dir), { force: true });
  }
}

// Node, and the engines that answer as Node does.
export const nodeGround: GroundProbe = {
  name: NODE,
  fits: () => typeof process !== 'undefined' && typeof process.versions?.node === 'string',
  terrain: ({ where }, defaults) => new NodeTerrain({ dir: where ?? harborDir(), defaults }),
};
