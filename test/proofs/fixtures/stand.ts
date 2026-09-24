// The room under quo/vectors/HARNESS.md: one JSON value a line on stdin and
// stdout. It stands the room alone, with no house around it, so the
// verifier judges the room as a door and as an asker. Part two carries its
// boxes over TcpCarry and WebCarry: `tcp`, `http` and `ws`, the web's two on
// one listener, and every address dialled through one joined carry.
import { createInterface } from 'node:readline';
import { JoinedCarry } from '../../../src/bodies/joined-carry.ts';
import { NobleCrypto } from '../../../src/bodies/noble-crypto.ts';
import { SeedKeys } from '../../../src/bodies/seed-keys.ts';
import { StrictTools } from '../../../src/bodies/strict-tools.ts';
import { WebCarry } from '../../../src/bodies/web-carry.ts';
import { serveHttp, type Served } from '../../../src/node/http.ts';
import { parseAddress, TcpCarry } from '../../../src/node/tcp-carry.ts';
import { Room, type Occupant, type Pending, type Standing } from '../../../src/quo/room.ts';

type Reach = 'echo' | 'marked' | 'moved' | 'null' | 'silent';
const REACHES = new Set(['echo', 'marked', 'moved', 'null', 'silent']);
const OPS = new Set(['ward', 'invite', 'release', 'arrive', 'ask', 'read', 'listen', 'route', 'send']);

interface Ward {
  readonly room: Room;
  readonly zero: Reach | undefined;
  readonly occupants: Map<string, Occupant>;
  readonly reaches: Map<string, Reach>;
  readonly names: Map<string, string>;
  readonly standings: Map<string, { standing: Standing; pending: Pending | null }>;
  /** One change to this ward at a time, as a door admits by what holds when it chooses. */
  turn: Promise<unknown>;
}

const crypto = new NobleCrypto();
const tools = new StrictTools();
const wards = new Map<string, Ward>();
const routes = new Map<string, string>();
const tcp = new TcpCarry({ host: '127.0.0.1', allowPrivate: true, wait: 10_000 });
const web = new WebCarry({ allowPrivate: true, wait: 10_000 });
const dial = new JoinedCarry({ tcp, http: web, https: web, ws: web, wss: web });
let listeningTcp = false;
let served: Served | undefined;

const locked = <T>(ward: Ward, work: () => Promise<T>): Promise<T> => {
  const turn = ward.turn.then(work);
  ward.turn = turn.catch(() => undefined);
  return turn;
};

// A box at a ward's door, answered by what stands behind it.
const arriveAt = (ward: Ward, box: Uint8Array): Promise<Uint8Array | null> =>
  locked(ward, async () => {
    const arrival = await ward.room.arrive(box, { occupant: (heir) => ward.occupants.get(heir), zero: ward.zero !== undefined });
    if (arrival.refused) return arrival.reply;
    const reach = arrival.heir === null ? ward.zero! : ward.reaches.get(arrival.heir)!;
    const { reply, occupant } = await arrival.choose(answer(reach, arrival.method, arrival.args));
    if (occupant !== null) ward.occupants.set(occupant.heir, occupant);
    return reply;
  });

// A ward's door on the web handler from its start, and on TCP once that listens.
const listenFor = async (name: string, ward: Ward) => {
  const door = (box: Uint8Array) => arriveAt(ward, box);
  web.listen({ ward: name, door });
  if (listeningTcp) await tcp.listen({ ward: name, door });
};

// An address of the web carrier, as it writes one: a host, and no user or fragment.
const webAddress = (at: string): boolean => {
  try {
    const url = new URL(at);
    return ['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && url.hostname !== '' && url.username === '' && url.password === '' && url.hash === '';
  } catch {
    return false;
  }
};

const shown = (read: Awaited<ReturnType<Room['read']>>['read']) => ('object' in read ? { object: read.object, seen: read.seen } : read);

class Answer extends Error {}
const refuse = (error: string): never => {
  throw new Answer(error);
};
const string = (value: unknown) => (typeof value === 'string' ? value : refuse('bad request'));
const reachOf = (value: unknown): Reach | undefined => {
  if (value === undefined) return undefined;
  const reach = string(value);
  return REACHES.has(reach) ? (reach as Reach) : refuse('not reached');
};
const wardOf = (value: unknown): Ward => {
  const name = string(value);
  if (!/^[0-9a-f]{128}$/.test(name)) refuse('bad request');
  return wards.get(name) ?? refuse('no such ward');
};

// What answers behind the door, as the harness names it.
const answer = (reach: Reach, method: string | undefined, args: string) => {
  if (reach === 'silent') return { silence: true as const };
  const seen = reach === 'marked' ? '1' : null;
  const at = reach === 'moved' ? { at: ['tcp://127.0.0.1:9'] } : {};
  if (method === undefined) return { object: '{"asks":[]}', seen, ...at };
  return { object: reach === 'null' ? 'null' : args, seen, ...at };
};

const handle = async (request: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const op = string(request.op);
  if (!OPS.has(op)) refuse('no such op');
  switch (op) {
    case 'ward': {
      const seed = string(request.seed);
      const reach = request.reach === undefined ? undefined : string(request.reach);
      const hash = await crypto.sha256(tools.utf8(seed));
      const room = new Room(new SeedKeys(tools.hex(hash), crypto), crypto, tools);
      const zero = reachOf(reach);
      const name = await room.ward();
      if (wards.has(name)) refuse('ward stood');
      const ward: Ward = { room, zero, occupants: new Map(), reaches: new Map(), names: new Map(), standings: new Map(), turn: Promise.resolve() };
      wards.set(name, ward);
      await listenFor(name, ward);
      return { ward: name };
    }
    case 'listen': {
      const scheme = request.scheme === undefined ? 'tcp' : string(request.scheme);
      if (scheme === 'tcp') {
        if (!listeningTcp) {
          listeningTcp = true;
          for (const [name, ward] of wards) await listenFor(name, ward);
          if (wards.size === 0) await tcp.listen({ ward: '', door: async () => null });
        }
        return { at: tcp.at({})[0] };
      }
      if (scheme !== 'http' && scheme !== 'ws') refuse('bad request');
      served ??= await serveHttp({ port: 0, host: '127.0.0.1' }, [web]);
      return { at: `${scheme}://127.0.0.1:${served.port}/quo` };
    }
    case 'route': {
      const far = string(request.far);
      const at = string(request.at);
      if (!/^[0-9a-f]{128}$/.test(far) || (parseAddress(at) === null && !webAddress(at))) refuse('bad request');
      routes.set(far, at);
      return { routed: far };
    }
    case 'send': {
      if (request.method !== undefined) string(request.method);
      const args = request.args;
      if (args !== undefined && (typeof args !== 'object' || args === null || Array.isArray(args))) refuse('bad request');
      if (request.invitation === undefined) refuse('bad request');
      const ward = wardOf(request.ward);
      const invitation = (await ward.room.invitation(request.invitation)) ?? refuse('bad request');
      const key = `${invitation.ward}:${invitation.heir}`;
      const sealed = await locked(ward, async () => {
        const held = ward.standings.get(key) ?? { standing: ward.room.standing(invitation), pending: null };
        const next = await ward.room.seal(held.standing, {
          ...(request.method === undefined ? {} : { method: request.method as string }),
          ...(args === undefined ? {} : { args: JSON.stringify(args) }),
        });
        ward.standings.set(key, { standing: next.standing, pending: next.pending });
        return next;
      });
      const route = routes.get(invitation.ward);
      const at = route !== undefined ? [route] : (invitation.at ?? []);
      const { reply } = await dial.send({ ward: invitation.ward, at, box: sealed.box });
      return locked(ward, async () => {
        const held = ward.standings.get(key)!;
        const { read, standing } = await ward.room.read(held.standing, sealed.pending, reply);
        held.standing = standing;
        return { read: shown(read) };
      });
    }
    case 'invite': {
      const name = string(request.heir);
      if (request.reach !== undefined) string(request.reach);
      const ward = wardOf(request.ward);
      const reach = reachOf(request.reach) ?? 'echo';
      if (ward.names.has(name)) refuse('name held');
      const { invitation, occupant } = await ward.room.invite();
      ward.names.set(name, occupant.heir);
      ward.occupants.set(occupant.heir, occupant);
      ward.reaches.set(occupant.heir, reach);
      return { invitation };
    }
    case 'release': {
      const name = string(request.heir);
      const ward = wardOf(request.ward);
      const heir = ward.names.get(name);
      if (heir === undefined) return { released: null };
      ward.names.delete(name);
      const kept = ward.room.release(ward.occupants.get(heir)!);
      if (kept === null) ward.occupants.delete(heir);
      else ward.occupants.set(heir, kept);
      return { released: name };
    }
    case 'arrive': {
      const box = tools.bytes(string(request.box)) ?? refuse('bad request');
      const reply = await arriveAt(wardOf(request.ward), box);
      return { reply: reply === null ? null : tools.hex(reply) };
    }
    case 'ask': {
      if (request.method !== undefined) string(request.method);
      const args = request.args;
      if (args !== undefined && (typeof args !== 'object' || args === null || Array.isArray(args))) refuse('bad request');
      if (request.invitation === undefined) refuse('bad request');
      const ward = wardOf(request.ward);
      const invitation = (await ward.room.invitation(request.invitation)) ?? refuse('bad request');
      const key = `${invitation.ward}:${invitation.heir}`;
      const held = ward.standings.get(key) ?? { standing: ward.room.standing(invitation), pending: null };
      const sealed = await ward.room.seal(held.standing, {
        ...(request.method === undefined ? {} : { method: request.method as string }),
        ...(args === undefined ? {} : { args: JSON.stringify(args) }),
      });
      ward.standings.set(key, { standing: sealed.standing, pending: sealed.pending });
      return { box: tools.hex(sealed.box) };
    }
    case 'read': {
      const reply = request.reply === null ? null : (tools.bytes(string(request.reply)) ?? refuse('bad request'));
      if (request.invitation === undefined) refuse('bad request');
      const ward = wardOf(request.ward);
      const invitation = (await ward.room.invitation(request.invitation)) ?? refuse('bad request');
      const held = ward.standings.get(`${invitation.ward}:${invitation.heir}`);
      if (held === undefined || held.pending === null) refuse('bad request');
      const { read, standing } = await ward.room.read(held!.standing, held!.pending!, reply);
      held!.standing = standing;
      return { read: shown(read) };
    }
    default:
      return refuse('bad request');
  }
};

const write = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`);
};

// Requests run side by side and are answered in any order, as the harness allows.
const lines = createInterface({ input: process.stdin });
const running = new Set<Promise<void>>();
lines.on('close', () =>
  void Promise.allSettled(running)
    .then(() => Promise.allSettled([tcp.close(), web.close(), served?.close()]))
    .then(() => process.exit(0)),
);
lines.on('line', (line) => {
  if (line.trim() === '') return;
  const work = (async () => {
    let request: unknown;
    try {
      request = JSON.parse(line);
    } catch {
      return write({ id: null, error: 'bad request' });
    }
    if (typeof request !== 'object' || request === null || Array.isArray(request)) return write({ id: null, error: 'bad request' });
    const id = (request as { id?: unknown }).id;
    if (typeof id !== 'string') return write({ id: null, error: 'bad request' });
    try {
      write({ id, ...(await handle(request as Record<string, unknown>)) });
    } catch (error) {
      if (error instanceof Answer) write({ id, error: error.message });
      else {
        process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
        write({ id, error: 'bad request' });
      }
    }
  })();
  running.add(work);
  void work.finally(() => running.delete(work));
});
