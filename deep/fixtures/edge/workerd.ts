// A Worker on workerd, as `wrangler dev` runs one: its module built as a
// deploy builds it, its config copied beside the bundle, and workerd
// started there. The port is read from what workerd says once it listens,
// or named, so a Worker started again answers where it answered before.
// Its `store` folder stays across starts in one folder.
import { spawn, type ChildProcess } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { createServer, type AddressInfo } from 'node:net';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { build } from 'esbuild';
import workerd from 'workerd';

const here = new URL('./', import.meta.url).pathname;

export interface Running {
  readonly origin: string;
  readonly port: number;
  /** Killed at once, as an evicted object is: nothing it held in memory survives. */
  kill(): Promise<void>;
}

/** The Worker's module and its config, by their names in this folder, built into `out`. */
export const built = async (out: string, module: string, config: string): Promise<void> => {
  await build({
    entryPoints: { [module]: join(here, `${module}.ts`) },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    conditions: ['nervur-source', 'workerd', 'worker'],
    external: ['cloudflare:*'],
    outdir: out,
    logLevel: 'silent',
  });
  copyFileSync(join(here, config), join(out, 'config.capnp'));
  mkdirSync(join(out, 'store'), { recursive: true });
};

/** A port nothing on this machine listens on now. */
export const freePort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
};

/** workerd started on what `built` wrote, on `port`, or on any where none is named, with `env` for its bindings to read. */
export const started = async (out: string, port?: number, env: Readonly<Record<string, string>> = {}): Promise<Running> => {
  const args = ['serve', 'config.capnp', '--control-fd=3', ...(port === undefined ? [] : [`--socket-addr=http=127.0.0.1:${port}`])];
  const engine: ChildProcess = spawn(workerd.default, args, { cwd: out, env: { ...process.env, ...env }, stdio: ['ignore', 'inherit', 'inherit', 'pipe'] });
  const listening = await new Promise<number>((resolve, reject) => {
    let said = '';
    (engine.stdio[3] as Readable).on('data', (chunk: Buffer) => {
      said += chunk.toString();
      for (const line of said.split('\n')) {
        const event = line.trim() === '' ? null : (JSON.parse(line) as { event?: string; socket?: string; port?: number });
        if (event?.event === 'listen' && event.socket === 'http') resolve(event.port!);
      }
    });
    engine.once('exit', (code) => reject(new Error(`workerd exited ${code}`)));
  });
  const gone = new Promise<void>((resolve) => engine.once('exit', () => resolve()));
  return {
    origin: `http://127.0.0.1:${listening}`,
    port: listening,
    kill: async () => {
      engine.kill('SIGKILL');
      await gone;
    },
  };
};
