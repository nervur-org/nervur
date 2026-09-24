// SPDX-License-Identifier: Apache-2.0
// A network in the process. Grounds join it under a host, names point at
// hosts as DNS points them, and every box between hosts crosses it. A test
// makes it slow, drops, loses and repeats boxes on it, cuts it one way or
// both, turns a host off and points a name elsewhere, as the world does.
// Its time is the bench's clock, and its chance is drawn from a seed, so a
// run goes the same way twice.
import type { Door, Hooked } from '../ground/ground.ts';
import type { Clock, Sent } from '../foundation.ts';
import { stream } from './seeded.ts';
import { settle } from './settle.ts';

interface Host {
  readonly doors: Map<string, Door>;
  readonly listens: boolean;
  up: boolean;
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
  readonly outcome: 'dropped' | 'answered' | 'silent' | 'lost' | 'twice';
}

const SCHEME = 'bench://';
const pair = (a: string, b: string) => [a, b].sort().join('\n');

export class FakeNetwork {
  readonly #hosts = new Map<string, Host>();
  readonly #names = new Map<string, string>();
  // One-way cuts, `from` then `to`.
  readonly #cuts = new Set<string>();
  readonly #links = new Map<string, Link>();
  readonly #clock: Clock | undefined;
  readonly #chance: (length: number) => Uint8Array;
  #drop = 0;
  #lose = 0;
  #twice = 0;
  #waits = 0;
  /** Every box that crossed between two hosts, in order. A box by pointer inside a host crosses nothing. */
  readonly crossings: Crossing[] = [];

  /** `clock` is the bench's, and times every latency; `seed` draws every chance. */
  constructor({ clock, seed = 'network' }: { clock?: Clock; seed?: string } = {}) {
    this.#clock = clock;
    this.#chance = stream(`network:${seed}`);
  }

  /** A host's carry. One that listens is dialled at its names; one that does not only dials, as a device. */
  join(host: string, { names = [], listens = true }: { names?: readonly string[]; listens?: boolean } = {}): Hooked {
    const held = this.#hosts.get(host) ?? { doors: new Map<string, Door>(), listens, up: true };
    this.#hosts.set(host, held);
    for (const name of names) this.#names.set(name, host);
    return {
      listen: ({ ward, door }) => void held.doors.set(ward, door),
      unlisten: ({ ward }) => void held.doors.delete(ward),
      send: (options) => this.#send(host, options),
      at: () => (held.listens ? [...this.#names].filter(([, to]) => to === host).map(([name]) => SCHEME + name) : []),
    };
  }

  /** A name pointed at a host, as a DNS record moved. */
  point(name: string, host: string): void {
    this.#names.set(name, host);
  }

  /** How the link between two hosts behaves, both ways, until it is set again. */
  link(a: string, b: string, link: Link): void {
    if (link.latency !== undefined && link.latency > 0 && this.#clock === undefined) throw new TypeError('a network with latency is made with the bench’s clock');
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
    const clock = this.#clock;
    if (clock === undefined || !('advance' in clock) || typeof clock.advance !== 'function') throw new TypeError('a network elapses on the bench’s clock');
    const advance = clock.advance.bind(clock) as (ms: number) => void;
    await settle();
    for (let left = ms; left > 0; left -= step) {
      advance(Math.min(step, left));
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
    if (ms === undefined || ms <= 0 || this.#clock === undefined) return;
    await this.#clock.wait({ id: `network:${++this.#waits}`, ms });
  }

  async #send(from: string, { ward, at, box }: { ward: string; at: readonly string[]; box: Uint8Array }): Promise<Sent> {
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
      const reply = await door(box);
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
