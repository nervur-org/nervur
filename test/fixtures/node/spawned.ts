// A ground script started in its own process, as an owner starts one, and
// stopped as an owner stops one.
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';

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

/** SIGINT, and the exit it ends in. */
export const stop = (child: ChildProcess) =>
  new Promise<void>((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill('SIGINT');
  });
