// A ground script started in its own process, as an owner starts one, and
// stopped as an owner stops one.
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { NodeGround } from 'nervur/node';

export interface Started {
  readonly child: ChildProcess;
  readonly line: { ward: string; offered: { result: { handle: string } } | null };
}

interface Options {
  readonly env: Record<string, string>;
  readonly cwd?: string;
  readonly conditions?: readonly string[];
}

/** The script started with `node` and its words, and the first line it prints, as printed. */
export const started = async (script: string, options: Options, words: readonly string[] = []): Promise<{ child: ChildProcess; line: string }> => {
  const conditions = (options.conditions ?? []).map((name) => `--conditions=${name}`);
  const child = spawn(process.execPath, [...conditions, script, ...words], { cwd: options.cwd, env: { ...process.env, ...options.env }, stdio: ['ignore', 'pipe', 'inherit'] });
  const line = await new Promise<string>((resolve, reject) => {
    createInterface({ input: child.stdout }).once('line', resolve);
    child.once('exit', (code) => reject(new Error(`the ground exited with ${code}`)));
  });
  return { child, line };
};

/** A test's ground, whose first line says its ward and what it offered. */
export const ground = async (script: string, options: Options): Promise<Started> => {
  const { child, line } = await started(script, options);
  return { child, line: JSON.parse(line) };
};

/** A NodeGround started as an owner starts one, `nervur up <folder>`, and the line it prints once it is up. */
export const up = async (cli: string, folder: string, options: Options): Promise<{ child: ChildProcess; line: { hand: string; houses: { name: string; ward?: string }[] } }> => {
  const { child, line } = await started(cli, options, ['up', folder]);
  return { child, line: JSON.parse(line) };
};

/**
 * A NodeGround in this process, its carries moved onto the loopback through
 * the hand after it boots, as an owner moves the terrain's entries. The
 * terrain's TCP listens on the loopback at 9110, which grounds run side by
 * side share: where another holds it, its body stands down until the move
 * mends it. `web` gives the web carry a port of the system's choosing.
 */
export const loopbackGround = async (folder: string, state: string, { port = 0, web = false, env = {} }: { port?: number; web?: boolean; env?: Readonly<Record<string, string>> } = {}): Promise<NodeGround> => {
  const ground = await NodeGround.open({ folder, state, env });
  try {
    const loopback = { bind: '127.0.0.1', allowPrivate: true };
    // The web carry listens through the ground's one listener, which its entry names.
    const moves: { name: string; args: Record<string, string | number | boolean>; faculties: string[] }[] = [
      { name: 'tcp', args: { ...loopback, port }, faculties: [] },
      ...(web ? [{ name: 'web', args: { ...loopback, port: 0 }, faculties: ['listener'] }] : []),
    ];
    for (const { name, args, faculties } of moves) {
      const moved = await ground.ground.hand({ method: 'facultiesUpdate', args: { name, make: name, args, faculties } });
      if (!('result' in moved)) throw new Error(JSON.stringify(moved));
    }
    return ground;
  } catch (error) {
    await ground.close();
    throw error;
  }
};

/** A state whose drawer holds its TCP carry on the loopback, at `port` or any, landed through the hand before `nervur up` opens it. */
export const onLoopback = async (folder: string, state: string, port = 0): Promise<void> => {
  await (await loopbackGround(folder, state, { port })).close();
};

/** SIGINT, and the exit it ends in. */
export const stop = (child: ChildProcess) =>
  new Promise<void>((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill('SIGINT');
  });
