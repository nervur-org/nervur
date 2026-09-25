#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// The package's command: a face on a ground's hand, holding no business of
// its own. Two words start things on this machine; every other word is
// read from what the running ground describes.
//
//   nervur up <folder>                         runs a NodeGround on its folder until it is stopped
//   nervur service <folder>                    prints its systemd unit, or its launchd job on macOS
//   nervur help                                what the ground holds: its faculties, their methods, its houses
//   nervur <faculty> [<method> [args]]         a faculty's method; with none, its methods
//   nervur ask <house> [--id <being>] [<method> [args]]   an ask of a being; with no method, its describe
//   nervur ask <house> [--id <being>] --cells            her cells, read and nothing asked
//
// Args are one JSON object, or words `key=value`, each value read as JSON
// where it reads and as text where it does not, or `-`, one JSON object
// read from standard input, so no secret stands in a shell's history.
// `--at <socket>` or `NERVUR_HAND` names the hand, and `state/hand` in
// this folder is it where neither does. Each prints one JSON value and exits 0 on a result, 1 on
// an error answered, and 2 where nothing was asked.
import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { basename, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { handAt } from './hand.ts';
import { NodeGround } from './node-ground.ts';
import { notifyReady } from './notify.ts';

const USAGE = 'nervur up <folder> | service <folder> | [--at <socket>] help | ask <house> [--id <being>] [--cells | <method> [args | -]] | <faculty> [<method> [args | -]]';

const fail = (message: string): never => {
  process.stderr.write(`${message}\n${USAGE}\n`);
  process.exit(2);
};

// One JSON object, or nothing where the text is none.
const objectOf = (text: string): Record<string, unknown> | undefined => {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    // No JSON: the caller says why.
  }
  return undefined;
};

// Standard input, whole.
const stdin = async (): Promise<string> => {
  let text = '';
  for await (const chunk of process.stdin) text += String(chunk);
  return text;
};

// Args as one JSON object, as words `key=value`, or as one JSON object on standard input.
const argsOf = async (words: readonly string[]): Promise<Record<string, unknown> | undefined> => {
  if (words.length === 0) return undefined;
  if (words.length === 1 && words[0] === '-') return objectOf(await stdin()) ?? fail('standard input holds no JSON object');
  if (words.length === 1 && words[0].startsWith('{')) return objectOf(words[0]) ?? fail('args are one JSON object');
  return Object.fromEntries(
    words.map((word) => {
      const at = word.indexOf('=');
      if (at <= 0) return fail(`${word} is not key=value`);
      const text = word.slice(at + 1);
      try {
        return [word.slice(0, at), JSON.parse(text) as unknown];
      } catch {
        return [word.slice(0, at), text];
      }
    }),
  );
};

// One line to the hand; its answer printed, or shaped first by `shape`.
const send = (at: string | undefined, line: Record<string, unknown>, shape: (answer: Record<string, unknown>) => Record<string, unknown> = (answer) => answer) => {
  if (at === undefined || at === '') return fail('no socket: pass --at or set NERVUR_HAND');
  const socket = connect(at);
  socket.on('error', (error) => fail(`the hand at ${at} does not answer: ${error.message}`));
  socket.on('connect', () => socket.write(`${JSON.stringify(line)}\n`));
  createInterface({ input: socket }).once('line', (text) => {
    socket.end();
    const answer = shape(JSON.parse(text) as Record<string, unknown>);
    process.stdout.write(`${JSON.stringify(answer)}\n`);
    // A result and a describe are what was asked; an error answered is the one refusal.
    process.exitCode = 'error' in answer ? 1 : 0;
  });
};

const up = async (folder: string) => {
  const ground = await NodeGround.open({ folder }).catch((error: unknown) => {
    process.stderr.write(`the ground did not open: ${error instanceof Error ? error.message : String(error)}\n`);
    return process.exit(1);
  });
  await notifyReady();
  process.stdout.write(`${JSON.stringify({ hand: ground.hand, houses: ground.ground.list() })}\n`);
  // A stop is the boot reversed, on an interrupt or on the service manager's SIGTERM.
  const stop = async () => {
    await ground.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
};

const service = (folder: string) => {
  const cli = fileURLToPath(import.meta.url);
  const unit =
    process.platform === 'darwin'
      ? [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
          '<plist version="1.0">',
          '<dict>',
          '  <key>Label</key>',
          `  <string>org.nervur.${basename(folder).replace(/[^A-Za-z0-9.-]/g, '-')}</string>`,
          '  <key>ProgramArguments</key>',
          '  <array>',
          `    <string>${process.execPath}</string>`,
          `    <string>${cli}</string>`,
          '    <string>up</string>',
          `    <string>${folder}</string>`,
          '  </array>',
          '  <key>KeepAlive</key>',
          '  <true/>',
          '  <key>RunAtLoad</key>',
          '  <true/>',
          '</dict>',
          '</plist>',
        ]
      : [
          '[Unit]',
          `Description=A nervur ground on ${folder}`,
          'After=network-online.target',
          '',
          '[Service]',
          'Type=notify',
          'NotifyAccess=all',
          `ExecStart=${process.execPath} ${cli} up ${folder}`,
          'Restart=always',
          'RestartSec=1',
          '',
          '[Install]',
          'WantedBy=default.target',
        ];
  process.stdout.write(`${unit.join('\n')}\n`);
};

const words = process.argv.slice(2);
// The hand: named, or the one a ground in this folder serves.
let at = process.env.NERVUR_HAND ?? (existsSync(process.platform === 'win32' ? 'state' : join('state', 'hand')) ? handAt('state') : undefined);
if (words[0] === '--at') {
  at = words[1] ?? fail('--at names no socket');
  words.splice(0, 2);
}
const [command, ...rest] = words;
if (command === undefined) fail('no command');
else if (command === 'up' || command === 'service') {
  if (rest.length !== 1) fail(`${command} names one folder`);
  if (command === 'up') await up(resolve(rest[0]));
  else service(resolve(rest[0]));
} else if (command === 'help') send(at, { describe: true });
else if (command === 'ask') {
  const [house, ...more] = rest;
  if (house === undefined) fail('ask names a house');
  let id: string | undefined;
  if (more[0] === '--id') {
    id = more[1] ?? fail('--id names no being');
    more.splice(0, 2);
  }
  if (more[0] === '--cells') {
    if (more.length > 1) fail('--cells reads her cells alone');
    send(at, { house, ...(id === undefined ? {} : { id }), cells: true });
  } else {
    const [method, ...args] = more;
    send(at, { house, ...(id === undefined ? {} : { id }), ...(method === undefined ? {} : { method }), ...(args.length === 0 ? {} : { args: await argsOf(args) }) });
  }
} else {
  const [method, ...args] = rest;
  // A faculty named alone shows its methods, read from what the ground describes.
  if (method === undefined)
    send(at, { describe: true }, (answer) => {
      const faculty = (answer.result as { faculties?: Record<string, unknown> } | undefined)?.faculties?.[command];
      return faculty === undefined ? { error: { message: `no faculty ${command}` } } : { result: faculty };
    });
  else send(at, { faculty: command, method, ...(args.length === 0 ? {} : { args: await argsOf(args) }) });
}
