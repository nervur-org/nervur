// SPDX-License-Identifier: Apache-2.0
// The shell: a command run on the ground's machine, as its owner runs one
// at a terminal. Its body offers one method, granted to the dock's steward
// alone, so the hand reaches it and no being does. A command's environment
// holds only the variables its entry names from the process's, and never
// one of the ground's: no key, no secret and no `NERVUR_` variable.
import { spawn } from 'node:child_process';
import { isAbsolute, resolve } from 'node:path';
import type { Json } from '../being/being.ts';
import type { Body } from '../ground/ground.ts';
import { ShellNeed } from '../ground/dock.ts';

export interface ShellOptions {
  /** The folder a command runs in where it names none, and against which a relative one is read. */
  readonly root: string;
  /** The process's variables a command's environment holds. */
  readonly env: readonly string[];
  /** The process's environment, which the entry's names are read from. */
  readonly from?: Readonly<Record<string, string | undefined>>;
}

/** The ground's names, which no command's environment holds whatever the entry names. */
const OWN = /^NERVUR_/;

/** The shell as a body: its blueprint, and the object its one method is called on. */
export const shell = ({ root, env, from = process.env }: ShellOptions): Body => {
  const passed: Record<string, string> = {};
  for (const name of env) {
    const value = from[name];
    if (value !== undefined && !OWN.test(name)) passed[name] = value;
  }
  return {
    blueprint: ShellNeed,
    object: {
      run: ({ command, args = [], cwd, stdin }: { command: string; args?: readonly string[]; cwd?: string; stdin?: string }) =>
        new Promise<{ result: Json } | { error: { message: string } }>((settle) => {
          const child = spawn(command, [...args], { cwd: cwd === undefined ? root : isAbsolute(cwd) ? cwd : resolve(root, cwd), env: passed, stdio: ['pipe', 'pipe', 'pipe'] });
          let stdout = '';
          let stderr = '';
          child.stdout.on('data', (chunk) => (stdout += String(chunk)));
          child.stderr.on('data', (chunk) => (stderr += String(chunk)));
          child.on('error', (error) => settle({ error: { message: `${command} did not run: ${error.message}` } }));
          child.on('close', (code, signal) => settle({ result: { code: code ?? -1, stdout, stderr: signal === null ? stderr : `${stderr}${command} stopped on ${signal}` } }));
          child.stdin.end(stdin ?? '');
        }),
    },
  };
};
