// SPDX-License-Identifier: Apache-2.0
// A network in the process. Grounds join it under a host, names point at
// hosts as DNS points them, and every box between hosts crosses it. A test
// makes it slow, drops, loses and repeats boxes on it, cuts it one way or
// both, turns a host off and points a name elsewhere, as the world does.
// It keeps the one clock every ground on it reads, which the test alone
// moves, and its chance is drawn from a seed, so a run goes the same way
// twice.
import { vouchesOf, type Hooked, type Sent } from '../index.ts';

type Door = Parameters<Hooked['listen']>[0]['door'];
import { FakeClock } from './fake-clock.ts';
import { stream } from './seeded.ts';
import { settle } from './settle.ts';

interface Host {
  readonly doors: Map<string, Door>;
  readonly listens: boolean;
  up: boolean;
  /** Its one listener, which answers a request over the web at its names. */
  serve?: (request: Request) => Promise<Response>;
}

/** How one link behaves, each way: its latency in milliseconds, and the share of boxes dropped, of replies lost, and of boxes delivered twice. */
export interface Link {
  readonly latency?: number;
  readonly drop?: number;
  readonly lose?: number;
  readonly duplicate?: number;
}

/** What became of one box: dropped before its door, delivered, its reply lost, or delivered twice. */
export interface Crossing {
  readonly from: string;
  readonly to: string;
  readonly ward: string;
  readonly outcome: 'dropped' | 'answered' | 'silent' | 'lost' | 'twice' | 'late';
}

const SCHEME = 'bench://';
const LATE = Symbol('late');
const pair = (a: string, b: string) => [a, b].sort().join('\n');

// Each network's clock, which the grounds on it and the bench read, and no entry exports.
const clocks = new WeakMap<FakeNetwork, FakeClock>();

/** The clock of a network, as a BenchGround reads it. */
export const clockOf = (network: FakeNetwork): FakeClock => clocks.get(network)!;

export class FakeNetwork {
  readonly #hosts = new Map<string, Host>();
  readonly #names = new Map<string, string>();
  // One-way cuts, `from` then `to`.
  readonly #cuts = new Set<string>();
  readonly #links = new Map<string, Link>();
  readonly #clock: FakeClock;
  readonly #chance: (length: number) => Uint8Array;
  #drop = 0;
  #lose = 0;
  #twice = 0;
  #waits = 0;
  /** Every box that crossed between two hosts, in order. A box by pointer inside a host crosses nothing. */
  readonly crossings: Crossing[] = [];

  /** `seed` draws every chance; `start` is the time its clock starts at. */
  constructor({ seed = 'network', start }: { seed?: string; start?: number } = {}) {
    this.#clock = new FakeClock(start);
    clocks.set(this, this.#clock);
    this.#chance = stream(`network:${seed}`);
  }

  /** The time on its clock, which every ground on it reads. */
  now(): number {
    return this.#clock.now();
  }

  /** Every ask, effect and reply the grounds started, run to where it waits on the clock or ends. */
  settle(): Promise<void> {
    return settle();
  }

  /** The clock moved on by `ms` at once, every wait it passes fired, and what came due run. */
  async advance(ms: number): Promise<void> {
    this.#clock.advance(ms);
    await settle();
  }

  /** A host's carry. One that listens is dialled at its names; one that does not only dials, as a device. */
  join(host: string, { names = [], listens = true, serve }: { names?: readonly string[]; listens?: boolean; serve?: (request: Request) => Promise<Response> } = {}): Hooked {
    const held: Host = this.#hosts.get(host) ?? { doors: new Map<string, Door>(), listens, up: true };
    if (serve !== undefined) held.serve = serve;
    this.#hosts.set(host, held);
    for (const name of names) this.#names.set(name, host);
    return {
      listen: ({ ward, door }) => void held.doors.set(ward, door),
      unlisten: ({ ward }) => void held.doors.delete(ward),
      send: (options) => this.#send(host, options),
      at: () => (held.listens ? [...this.#names].filter(([, to]) => to === host).map(([name]) => SCHEME + name) : []),
      // Each name its addresses write is a domain, read at the listener of the host it points at.
      vouched: ({ ward, at }) => vouchesOf({ fetcher: (url) => this.#get(host, url), ward, at, schemes: ['bench'] }),
    };
  }

  // A GET over the web from one host to the host a name points at, which a cut or a host off stops.
  async #get(from: string, url: string): Promise<Response> {
    const to = this.#names.get(new URL(url).hostname);
    const held = to === undefined ? undefined : this.#hosts.get(to);
    if (to === undefined || held?.serve === undefined || !held.up || this.#cuts.has(`${from}\n${to}`)) throw new TypeError('fetch failed');
    return held.serve(new Request(url));
  }

  /** A name pointed at a host, as a DNS record moved. */
  point(name: string, host: string): void {
    this.#names.set(name, host);
  }

  /** How the link between two hosts behaves, both ways, until it is set again. */
  link(a: string, b: string, link: Link): void {
    for (const share of [link.drop, link.lose, link.duplicate]) if (share !== undefined && !(share >= 0 && share <= 1)) throw new TypeError('a share is between 0 and 1');
    this.#links.set(pair(a, b), link);
  }

  /** No box crosses from `from` to `to` until `heal`; the other way stands. */
  cut(from: string, to: string): void {
    this.#cuts.add(`${from}\n${to}`);
  }

  /** No box crosses between the two hosts, either way, until `heal`. */
  partition(a: string, b: string): void {
    this.cut(a, b);
    this.cut(b, a);
  }

  /** Every cut mended. Links keep how they behave. */
  heal(): void {
    this.#cuts.clear();
  }

  /** The host answers nothing, its doors forgotten, until `up`. */
  down(host: string): void {
    const held = this.#hosts.get(host);
    if (held === undefined) return;
    held.up = false;
    held.doors.clear();
  }

  up(host: string): void {
    const held = this.#hosts.get(host);
    if (held !== undefined) held.up = true;
  }

  /** The next `count` boxes between hosts are dropped before their door. */
  dropNext(count = 1): void {
    this.#drop += count;
  }

  /** The next `count` replies are lost after the far door answered. */
  loseNext(count = 1): void {
    this.#lose += count;
  }

  /** The next `count` boxes are delivered twice, and the first reply returns. */
  duplicateNext(count = 1): void {
    this.#twice += count;
  }

  /**
   * The clock moved on by `ms` in steps of `step`, the bench settling after
   * each, so latencies end, retries leave and replies land as time passes.
   */
  async elapse(ms: number, { step = 1_000 }: { step?: number } = {}): Promise<void> {
    await settle();
    for (let left = ms; left > 0; left -= step) {
      this.#clock.advance(Math.min(step, left));
      await settle();
    }
  }

  // Whether a chance of `share` comes up, drawn from the seed.
  #roll(share: number | undefined): boolean {
    if (share === undefined || share <= 0) return false;
    const [a, b] = this.#chance(2);
    return (a * 256 + b) / 65_536 < share;
  }

  async #delay(ms: number | undefined): Promise<void> {
    if (ms === undefined || ms <= 0) return;
    await this.#clock.wait({ id: `network:${++this.#waits}`, ms });
  }

  // A door's answer, or LATE where the box's wait on the network's clock runs out first.
  async #within(answer: Promise<Uint8Array | null>, wait: number | undefined): Promise<Uint8Array | null | typeof LATE> {
    if (wait === undefined) return answer;
    const id = `network:late:${++this.#waits}`;
    const late = this.#clock.wait({ id, ms: wait }).then((fired) => (fired ? LATE : new Promise<never>(() => undefined)));
    try {
      return await Promise.race([answer, late]);
    } finally {
      this.#clock.cancel({ id });
    }
  }

  async #send(from: string, { ward, at, box, wait }: { ward: string; at: readonly string[]; box: Uint8Array; wait?: number }): Promise<Sent> {
    const own = this.#hosts.get(from);
    if (own === undefined || !own.up) return { reply: null, heard: false };
    // A ward on this host takes the box by pointer, before any address, and crosses nothing.
    const near = own.doors.get(ward);
    if (near !== undefined) {
      const reply = await near(box);
      if (reply !== null) return { reply };
    }
    for (const address of at) {
      if (!address.startsWith(SCHEME)) continue;
      const to = this.#names.get(address.slice(SCHEME.length));
      const host = to === undefined ? undefined : this.#hosts.get(to);
      if (to === undefined || host === undefined || !host.up || !host.listens || this.#cuts.has(`${from}\n${to}`)) continue;
      const link = this.#links.get(pair(from, to)) ?? {};
      const log = (outcome: Crossing['outcome']) => this.crossings.push({ from, to, ward, outcome });
      await this.#delay(link.latency);
      if (this.#drop > 0 || this.#roll(link.drop)) {
        if (this.#drop > 0) this.#drop--;
        log('dropped');
        continue;
      }
      // The door is read again after the latency: a host may have gone down, or a cut come, meanwhile.
      const door = host.up && !this.#cuts.has(`${from}\n${to}`) ? host.doors.get(ward) : undefined;
      if (door === undefined) continue;
      const twice = this.#twice > 0 || this.#roll(link.duplicate);
      if (this.#twice > 0) this.#twice--;
      const reply = await this.#within(door(box), wait);
      // A door that answered past the box's wait may have heard it.
      if (reply === LATE) {
        log('late');
        return { reply: null, heard: true };
      }
      if (twice) await door(box);
      await this.#delay(link.latency);
      // A reply lost after the door answered was heard, so no other address is tried.
      if (this.#lose > 0 || this.#roll(link.lose) || this.#cuts.has(`${to}\n${from}`)) {
        if (this.#lose > 0) this.#lose--;
        log('lost');
        return { reply: null, heard: true };
      }
      if (reply === null) {
        log('silent');
        continue;
      }
      log(twice ? 'twice' : 'answered');
      return { reply, via: address };
    }
    return { reply: null, heard: false };
  }
}
