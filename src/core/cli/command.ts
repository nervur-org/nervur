// SPDX-License-Identifier: Apache-2.0
// `nervur`: a harbor on this machine. Each command is one root request, the
// same the root line carries from any front, printed as one JSON line.
//
//   nervur init   [--dir D] [--no-tcp]              the harbor made: its seed drawn,
//                                                   its catalogue stood, the tcp
//                                                   carrier opened unless --no-tcp,
//                                                   and an owner invitation for
//                                                   whoever made it
//   nervur serve  [--dir D] [--host H] [--port P]   the harbor served: Quo over the
//                                                   tcp carrier it holds, and the
//                                                   root line on its socket
//   nervur module add <file>                        the module's source committed on
//                                                   live, and live moved to it
//   nervur module remove <module>                   its file committed away, and live
//                                                   moved
//   nervur modules                                  what live runs
//   nervur live   [commit | ref]                    live moved there, or the commit
//                                                   that stands
//   nervur log                                      the commits from live back
//   nervur origin <url | none>                      where fetch reads
//   nervur fetch                                    every ref of origin and all it
//                                                   reaches, kept
//   nervur gc                                       every object live and the
//                                                   fetched refs reach no more, gone
//   nervur census [--ward W]                        the empty ask
//   nervur stand  [--ward W]                        what does not stand yet, stood:
//                                                   the dock's faculties and wards,
//                                                   or one ward's beings; every
//                                                   command asks it of the harbor
//                                                   it opens
//   nervur sweep                                    every place of the folder this
//                                                   harbor does not name, gone
//   nervur export [--with-seed]                     the harbor as one JSON line, to
//                                                   carry it to another ground; with
//                                                   --with-seed the seed goes too
//   nervur import <file>                            a carried harbor into an empty
//                                                   folder, `-` being this input
//   nervur edge pack <file> <name>                  the harbor for an edge, under its
//                                                   name, in the pack the file holds:
//                                                   its seed sealed under
//                                                   $NERVUR_SECRET, and its places,
//                                                   its code among them
//   nervur edge dev <file> <name> [--port P]        the harbor packed so, and the pack
//                                                   run by the worker's own wrangler
//                                                   dev, from this folder, at
//                                                   http://127.0.0.1:P/<name>/quo
//   nervur open   <key> <kind> [--registry R]       a faculty stands in the box ward,
//                                                   her class resolved through the
//                                                   registry faculty R or the catalogue
//   nervur host   <ward> [--seed S] [--memory K]    a hosted ward stands, kept by the
//                 [--class C] [--registry R]        root memory or the memory faculty K,
//                                                   its ward of the ward class C, every
//                                                   class of it resolved through R
//   nervur move   <ward> <memory | root>            a hosted ward carried to a memory
//                                                   faculty, or back to the root memory
//   nervur route  <ward pk> <address... | none>     where a ward is reached, in order
//   nervur reach  <address...>                      where this harbor is reached, as
//                                                   every invitation it gives says
//   nervur boot   [--ward W] <key> <kind>           a being stands
//   nervur unboot [--ward W] <being>                a being goes
//   nervur public [--ward W] <key | none>           the being a stranger reaches
//   nervur invite [--ward W] <being> <id>           an invitation on a being
//   nervur ask    [--ward W] [being] [method] [args] a being, asked as the owner
//   nervur own    [--ward W] <id>                   an invitation for an owner
//   nervur disown [--ward W] <id>                   an owner no more
//   nervur become [--ward W] <kind>                 the ward born again of that class;
//                 [--registry R]                    the dock's resolved through R
//   nervur pilot  <name> <invitation> [address]     a far being held as its owner by the
//                                                   dock, under the name, at the address
//                                                   or the invitation's at, the web
//                                                   carrier opened first where it is on
//                                                   the web and none stands
//   nervur <command> --via <name> ...               the command asked of the far being
//                                                   the dock holds under that name, as
//                                                   its owner
//
// D is --dir, then $NERVUR_DIR, then ~/.nervur. A module file is named from
// where the command runs, and its text is what the harbor keeps. No --ward is the box
// ward, and a name holds one far being, so --via takes no --ward. The exit
// is 1 when the answer is an error.
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { JsonObject } from '../being/index.ts';
import { carrierIn, type Defaults, type RootRequest } from '../harbor/index.ts';
import { harborDir } from '../node/index.ts';
import { readAt, webAddress } from '../quo/index.ts';
import { edgeDev } from './edge.ts';
import { carry, census, isServed, land, open, pack, request, serve } from './harbor.ts';

// Where `edge dev` answers unless --port names another, wrangler's own.
const EDGE_PORT = 8787;

const USAGE = 'usage: nervur <init|serve|module|modules|live|log|origin|fetch|gc|census|stand|sweep|open|host|move|route|reach|boot|unboot|public|invite|ask|own|disown|become|pilot|export|import|edge> [args] [--dir D] [--ward W] [--via V] [--seed S] [--memory K] [--class C] [--registry R] [--with-seed] [--no-tcp] [--host H] [--port P]';
const FLAGS = new Set(['dir', 'ward', 'via', 'seed', 'memory', 'class', 'registry', 'host', 'port']);
// The flags that stand alone, since what each names is a yes.
const ALONE = 'with-seed';
const NO_TCP = 'no-tcp';
const YES = new Set([ALONE, NO_TCP]);

export const parse = (argv: string[]): { command?: string; words: string[]; flags: Record<string, string> } => {
  const flags: Record<string, string> = {};
  const words: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const name = arg.startsWith('--') ? arg.slice(2) : undefined;
    if (name === undefined) words.push(arg);
    else if (YES.has(name)) flags[name] = 'yes';
    else if (!FLAGS.has(name) || argv[i + 1] === undefined) throw new Error(`--${name} is no flag with a value`);
    else flags[name] = argv[(i += 1)]!;
  }
  const [command, ...rest] = words;
  return { ...(command === undefined ? {} : { command }), words: rest, flags };
};

// What this command was handed on its input, for `import -`.
const standingIn = async (): Promise<string> => {
  let text = '';
  for await (const chunk of process.stdin) text += (chunk as Buffer).toString('utf8');
  return text;
};

const none = (word: string): string | null => (word === 'none' ? null : word);
const json = (word: string | undefined): JsonObject | undefined => (word === undefined ? undefined : (JSON.parse(word) as JsonObject));
const catalogue = (method: string, args: JsonObject = {}): RootRequest => ({ method: 'ask', args: { being: 'catalogue', method, args } });

// The root request a command names, or a throw saying what it lacks.
export const requestOf = (command: string, words: string[], flags: Record<string, string>): RootRequest => {
  const need = (n: number): string[] => {
    if (words.length !== n) throw new Error(`${command} takes ${n} argument${n === 1 ? '' : 's'}`);
    return words;
  };
  const at = flags.ward === undefined ? {} : { ward: flags.ward };
  const through: JsonObject = flags.registry === undefined ? {} : { registry: flags.registry };
  switch (command) {
    case 'module': {
      const [verb, what] = need(2);
      if (verb === 'add') return catalogue('add', { source: readFileSync(resolve(what!), 'utf8') });
      if (verb === 'remove') return catalogue('remove', { module: what! });
      throw new Error('module is add or remove');
    }
    case 'modules':
      return (need(0), catalogue('modules'));
    case 'live':
      if (words.length > 1) throw new Error('live takes a commit, or nothing');
      return catalogue('live', words[0] === undefined ? {} : { commit: words[0] });
    case 'log':
      return (need(0), catalogue('log'));
    case 'origin':
      return catalogue('origin', { url: none(need(1)[0]!) });
    case 'fetch':
      return (need(0), catalogue('fetch'));
    case 'gc':
      return (need(0), catalogue('gc'));
    case 'sweep':
      return (need(0), { method: 'sweep', args: {} });
    case 'census':
      return (need(0), at);
    case 'open': {
      const [key, kind] = need(2);
      return { method: 'open', args: { key: key!, class: kind!, ...through } };
    }
    case 'host': {
      const [ward] = need(1);
      return { method: 'host', args: { ward: ward!, ...(flags.seed === undefined ? {} : { seed: flags.seed }), ...(flags.memory === undefined ? {} : { memory: flags.memory }), ...(flags.class === undefined ? {} : { class: flags.class }), ...through } };
    }
    case 'move': {
      const [ward, memory] = need(2);
      return { method: 'move', args: { ward: ward!, memory: memory === 'root' ? null : memory! } };
    }
    case 'route': {
      const [ward, ...where] = words;
      if (ward === undefined || where.length === 0) throw new Error('route takes a ward pk and its addresses, or none');
      return { method: 'route', args: { ward, at: where.length === 1 && where[0] === 'none' ? null : where } };
    }
    case 'reach':
      if (words.length === 0) throw new Error('reach takes the addresses this harbor is reached at');
      return { method: 'reach', args: { at: words } };
    case 'boot': {
      const [key, kind] = need(2);
      return { ...at, method: 'boot', args: { key: key!, class: kind! } };
    }
    case 'unboot':
      return { ...at, method: 'unboot', args: { being: need(1)[0]! } };
    case 'public':
      return { ...at, method: 'public', args: { key: none(need(1)[0]!) } };
    case 'invite': {
      const [being, id] = need(2);
      return { ...at, method: 'invite', args: { being: being!, id: id! } };
    }
    case 'ask': {
      if (words.length > 3) throw new Error('ask takes at most a being, a method and its args');
      const [being, method, args] = words;
      return { ...at, method: 'ask', args: { ...(being === undefined ? {} : { being }), ...(method === undefined ? {} : { method }), ...(args === undefined ? {} : { args: json(args)! }) } };
    }
    case 'own':
    case 'disown':
      return { ...at, method: command, args: { id: need(1)[0]! } };
    case 'stand':
      return (need(0), { ...at, method: 'stand', args: {} });
    case 'become':
      return { ...at, method: 'become', args: { class: need(1)[0]!, ...through } };
    default:
      throw new Error(USAGE);
  }
};

// An error answer at any depth the root line or an ask carries it.
const failed = (answer: unknown): boolean => {
  if (typeof answer !== 'object' || answer === null) return false;
  const a = answer as JsonObject;
  return 'error' in a || failed(a.answer);
};

// The command, over the harbors of this machine, each running the defaults
// its entry hands it.
export const main = async (argv: string[], env: Record<string, string | undefined>, print: (line: string) => void, defaults: Defaults): Promise<number> => {
  const { command, words, flags } = parse(argv);
  if (command === undefined) throw new Error(USAGE);
  const dir = flags.dir ?? harborDir(env);
  const out = (answer: JsonObject): number => {
    print(JSON.stringify(answer));
    return failed(answer) ? 1 : 0;
  };
  if (command === 'init') {
    if (words.length > 0) throw new Error('init takes no argument');
    if (existsSync(join(dir, 'seed'))) return out({ error: `a harbor stands at ${dir}` });
    const harbor = await open(dir, defaults);
    try {
      if (flags[NO_TCP] === undefined) {
        const tcp = carrierIn((await census(harbor)).beings, defaults.classes, 'tcp');
        if (tcp === null) return out({ error: 'no class this command runs carries tcp' });
        const opened = tcp.open === undefined ? {} : ((await harbor.ask(tcp.open)).answer as JsonObject);
        if (opened.error !== undefined) return out(opened);
      }
      const owner = (await harbor.ask({ method: 'own', args: { id: 'owner' } })).answer as JsonObject;
      return out({ pk: (await census(harbor)).pk, owner });
    } finally {
      await harbor.close();
    }
  }
  if (command === 'export' || command === 'import') {
    if (words.length !== (command === 'import' ? 1 : 0)) throw new Error(`${command} takes ${command === 'import' ? 'one file' : 'no argument'}`);
    if (flags.via !== undefined) throw new Error(`${command} reads this folder, so it takes no --via`);
    if (await isServed(dir)) throw new Error(`a harbor is served from ${dir}: stop it first`);
    if (command === 'export') return out((await carry(dir, flags[ALONE] !== undefined)) as unknown as JsonObject);
    const text = words[0] === '-' ? await standingIn() : await readFile(words[0]!, 'utf8');
    return out({ landed: await land(dir, JSON.parse(text)) });
  }
  if (command === 'edge') {
    if ((words[0] !== 'pack' && words[0] !== 'dev') || words.length !== 3) throw new Error('edge takes pack or dev, a file, and the harbor name');
    if (flags.via !== undefined) throw new Error(`edge ${words[0]} reads this folder, so it takes no --via`);
    if (await isServed(dir)) throw new Error(`a harbor is served from ${dir}: stop it first`);
    if (words[0] === 'pack') return out(await pack(dir, words[1]!, words[2]!, env.NERVUR_SECRET));
    const dev = await edgeDev(dir, words[1]!, words[2]!, process.cwd(), flags.port === undefined ? EDGE_PORT : Number(flags.port), env.NERVUR_SECRET);
    const stop = (): void => void dev.close().then(() => process.exit(0));
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    print(JSON.stringify({ at: dev.at, places: dev.places }));
    return SERVING;
  }
  if (command === 'serve') {
    if (words.length > 0) throw new Error('serve takes no argument');
    const served = await serve(dir, defaults, flags.host, flags.port === undefined ? undefined : Number(flags.port));
    const stop = (): void => void served.close().then(() => process.exit(0));
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    print(JSON.stringify({ pk: served.pk, at: served.at, listening: served.listening, root: served.root }));
    return SERVING;
  }
  if (command === 'pilot') {
    if (words.length !== 2 && words.length !== 3) throw new Error('pilot takes a name, an invitation, and an address where the invitation carries none');
    const [name, invitation, at] = words as [string, string, string | undefined];
    const held = JSON.parse(invitation) as JsonObject;
    const asked = (await request(dir, defaults, {})) as { answer?: { notes?: { beings?: Record<string, { class: string }> } } };
    const web = carrierIn(asked.answer?.notes?.beings ?? {}, defaults.classes, 'web')?.open;
    for (const req of pilotRequests(name, held, at, web)) {
      const answer = await request(dir, defaults, req);
      if (failed(answer)) return out(answer);
    }
    return out({ piloting: name, ward: held.ward! });
  }
  if (flags.via === undefined) return out(await request(dir, defaults, requestOf(command, words, flags)));
  if (flags.ward !== undefined) throw new Error('--via takes no --ward');
  return out(farAnswer(await request(dir, defaults, via(flags.via, requestOf(command, words, flags)))));
};

// The root requests that hold a far ward: the web carrier opened, where the
// far ward is reached on the web and `web` is the open this harbor still
// needs; then the dock's `hold`, at the address named, else where the
// invitation's `at` says.
export const pilotRequests = (name: string, invitation: JsonObject, at?: string, web?: RootRequest): RootRequest[] => [
  ...(web !== undefined && readAt([...(at === undefined ? [] : [at]), ...readAt(invitation.at)]).some((a) => webAddress(a) !== null) ? [web] : []),
  { method: 'hold', args: { name, invitation, ...(at === undefined ? {} : { at }) } },
];

// A root request, asked of the far being the dock holds under a name.
export const via = (name: string, far: RootRequest): RootRequest => ({
  method: 'pilot',
  args: { name, ...(far.method === undefined ? {} : { method: far.method }), ...(far.args === undefined ? {} : { args: far.args }) },
});

// The far being's answer out of the dock's, or the local error.
export const farAnswer = (local: JsonObject): JsonObject => {
  const inner = local.answer;
  return typeof inner === 'object' && inner !== null && !Array.isArray(inner) ? (inner as JsonObject) : local;
};

// What `main` answers for a harbor it keeps serving: no exit yet.
export const SERVING = -1;
