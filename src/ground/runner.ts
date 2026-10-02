// SPDX-License-Identifier: Apache-2.0
// A house contained: opened in a thread of its own, its bodies held on the
// ground's side. Every body crosses the thread's edge as a message: the
// house's calls on its keys, its memory, its carry, its clock's waits, the
// curves of its crypto and its offers go out, and the door, the hand and a
// faculty's calls on its tokens come in. What the house reads at once, the
// time and the carry's addresses, rides on every message in. The ground
// heartbeats the thread, and one that answers none within its bound is
// ended and the house opened again from memory, which holds everything it
// keeps. So a ground may also let an idle house sleep, its thread ended,
// and open it again when anything reaches it or a wait it set comes due.
import type { Json } from '../being/being.ts';
import { WAIT_BOUND } from '../being/need.ts';
import { offered } from '../being/table.ts';
import type { ClassesSource } from '../foundation.ts';
import type { Answer, FacultyContext, Foundation, Offer, Opened, Options } from '../house/house.ts';

/** One thread a runner runs in, as its engine starts one. */
export interface Thread {
  post(message: unknown): void;
  /** Each message out of it, and its end where it ends by itself. */
  listen(heard: (message: unknown) => void, ended: (why: string) => void): void;
  end(): void;
  /** Whether the thread holds its engine open, where the engine asks: while something waits on it. */
  hold?(held: boolean): void;
}

/** What starts a runner's thread on one engine. */
export type Start = () => Thread;

/** How a ground contains its houses. */
export interface Runner {
  readonly start: Start;
  /** Sixty-four hex digits each thread's randomness is drawn from, drawn once for each opening, where its randomness must repeat, as the bench's does. */
  readonly seed?: () => string;
  /** How long a house may stand idle before it sleeps, in milliseconds: its thread ends until anything reaches it. It never sleeps where none is named. */
  readonly idle?: number;
}

/** The module each thread starts from, built beside this one. */
const ENTRY = new URL(`./entry.${import.meta.url.endsWith('.ts') ? 'ts' : 'js'}`, import.meta.url);

interface NodeWorker {
  postMessage(message: unknown): void;
  on(event: 'message' | 'error' | 'exit', listener: (value: unknown) => void): void;
  terminate(): Promise<number>;
  ref(): void;
  unref(): void;
}

interface NodeThreads {
  Worker: new (url: URL) => NodeWorker;
}

interface WebWorker {
  postMessage(message: unknown): void;
  addEventListener(type: string, listener: (event: { readonly data?: unknown; readonly message?: string }) => void): void;
  terminate(): void;
}

// A thread of this engine: Node's worker threads, reached at run time so `nervur` imports nothing of Node's, or a Web Worker.
const startOne = (): Thread => {
  const threads = (globalThis as { process?: { getBuiltinModule?(id: string): unknown } }).process?.getBuiltinModule?.('node:worker_threads') as NodeThreads | undefined;
  if (threads !== undefined) {
    const worker = new threads.Worker(ENTRY);
    // A thread holds the process open only while something waits on it.
    worker.unref();
    return {
      post: (message) => worker.postMessage(message),
      listen: (heard, ended) => {
        worker.on('message', heard);
        worker.on('error', (error) => ended(error instanceof Error ? error.message : String(error)));
        worker.on('exit', (code) => ended(`it exited with ${String(code)}`));
      },
      end: () => void worker.terminate(),
      hold: (held) => (held ? worker.ref() : worker.unref()),
    };
  }
  const Web = (globalThis as { Worker?: new (url: URL, options: { type: 'module' }) => WebWorker }).Worker;
  if (Web === undefined) throw new Error('this engine starts no thread for a runner');
  const worker = new Web(ENTRY, { type: 'module' });
  return {
    post: (message) => worker.postMessage(message),
    listen: (heard, ended) => {
      worker.addEventListener('message', (event) => heard(event.data));
      worker.addEventListener('error', (event) => ended(event.message ?? 'it failed'));
    },
    end: () => worker.terminate(),
  };
};

// Threads started ahead, so a house opens on a runner that has loaded already: a ground opens its houses a few at a time.
const AHEAD = 2;
const ahead: Thread[] = [];

/** A thread of this engine for each house, a few always started ahead of the next. */
export const engineStart: Start = () => {
  const thread = ahead.shift() ?? startOne();
  try {
    while (ahead.length < AHEAD) ahead.push(startOne());
  } catch {
    // An engine that starts no thread ahead starts each as it is asked for.
  }
  return thread;
};

/** A house contained, as the ground holds it: an opened house it also closes. */
export interface Contained extends Opened {
  close(): void;
}

/** The shortest a runner may go unanswering before the ground ends it, in milliseconds, so a busy thread is never taken for a stuck one. */
const FLOOR = 1_000;

const SILENT: Answer = Object.freeze({ error: Object.freeze({ message: 'the house answered nothing' }) });

/** What each body lets the runner call, and nothing else. */
const CALLS: Readonly<Record<string, ReadonlySet<string>>> = {
  keys: new Set(['ward', 'sign', 'agree', 'decapsulate', 'derive']),
  memory: new Set(['read', 'list', 'write']),
  carry: new Set(['send', 'vouched']),
  clock: new Set(['wait', 'cancel']),
  crypto: new Set(['signingPublic', 'sign', 'verify', 'agreePublic', 'agree', 'lockPair', 'encapsulate', 'decapsulate']),
};

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

interface Said {
  readonly t: string;
  readonly id?: number;
  readonly [field: string]: unknown;
}

/**
 * A house opened in a runner of its own on the foundation and offers a
 * ground holds, its classes loaded there from their source.
 */
export const contain = async (runner: Runner, foundation: Omit<Foundation, 'classes'>, source: ClassesSource, offers: readonly Offer[], options: Options = {}): Promise<Contained> => {
  // What the house refuses of its offers is refused here, before any thread starts.
  const references = new Set<unknown>(Object.values(foundation));
  const specs = offers.map((offer) => {
    const bp = offered(offer.blueprint);
    if (references.has(offer.object)) throw new TypeError(`the offer ${bp.name} is a reference of the house's foundation`);
    for (const name of Object.keys(bp.methods)) {
      if (typeof (offer.object as Record<string, unknown>)[name] !== 'function') throw new TypeError(`the offer ${bp.name} has no method ${name}`);
    }
    return { blueprint: bp as unknown as Json, ...(offer.kinds === undefined ? {} : { kinds: offer.kinds }), ...(offer.window === undefined ? {} : { window: offer.window }), opened: offer.opened !== undefined };
  });
  const house = new House(runner, foundation, source, offers, specs, options);
  await house.open();
  return house;
};

interface Waiting {
  readonly settle: (value: unknown) => void;
  readonly fail: (error: Error) => void;
  readonly silent: unknown;
}

class House implements Contained {
  readonly #runner: Runner;
  readonly #foundation: Omit<Foundation, 'classes'>;
  readonly #source: ClassesSource;
  readonly #offers: readonly Offer[];
  readonly #specs: readonly Json[];
  readonly #options: Options;
  /** The bound where no wait is outstanding: the ground's on every ask. */
  readonly #bound: number;
  ward = '';
  #thread: Thread | undefined;
  /** The thread's life: a message from an ended one is heard by no one. */
  #life = 0;
  #next = 0;
  readonly #waiting = new Map<number, Waiting>();
  /** The house's clock waits outstanding, by id, with the milliseconds each was set for. */
  readonly #waits = new Map<string, number>();
  /** The calls the house made on the ground's side not yet answered, a clock's waits aside. */
  #calling = 0;
  #opening: Promise<void> | undefined;
  #pinged: number | undefined;
  /** The shortest wait the house set since the runner last answered a beat: a wait that ran out still bounds an ask that has not ended. */
  #tight = Number.POSITIVE_INFINITY;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #idle: ReturnType<typeof setTimeout> | undefined;
  #closed = false;
  #asleep = false;
  /** Whether the house stands open in the thread, and the last message sent and the last whose work ended. */
  #standing = false;
  #sent = 0;
  #done = 0;

  constructor(runner: Runner, foundation: Omit<Foundation, 'classes'>, source: ClassesSource, offers: readonly Offer[], specs: readonly Json[], options: Options) {
    this.#runner = runner;
    this.#foundation = foundation;
    this.#source = source;
    this.#offers = offers;
    this.#specs = specs;
    this.#options = options;
    this.#bound = Math.max(FLOOR, Math.min(options.wait ?? WAIT_BOUND, WAIT_BOUND));
  }

  /** A thread started and the house opened in it: its ward, or why it did not open. */
  open(): Promise<void> {
    const opening = this.#start();
    this.#opening = opening.catch(() => undefined);
    return opening;
  }

  async #start(): Promise<void> {
    const life = ++this.#life;
    const thread = this.#runner.start();
    this.#thread = thread;
    this.#asleep = false;
    this.#pinged = undefined;
    this.#tight = Number.POSITIVE_INFINITY;
    let standing = false;
    const opened = new Promise<string>((resolve, reject) => {
      thread.listen(
        (heard) => {
          if (life !== this.#life) return;
          const said = heard as Said;
          if (said.t === 'opened') {
            standing = true;
            resolve(said.ward as string);
          } else if (said.t === 'failed') reject(new Error(said.message as string));
          else this.#heard(said);
        },
        (why) => {
          if (life !== this.#life) return;
          // A runner that ends while it opens fails the opening; one that ends once open opens again.
          if (standing) this.#ended();
          else reject(new Error(`its runner ended: ${why}`));
        },
      );
    });
    this.#watch();
    this.#standing = false;
    this.#post({ t: 'open', source: this.#source, offers: this.#specs, ...(this.#options.wait === undefined ? {} : { wait: this.#options.wait }), ...(this.#runner.seed === undefined ? {} : { seed: this.#runner.seed() }) });
    let ward: string;
    try {
      ward = await opened;
      this.#standing = true;
      this.#hold();
    } catch (error) {
      if (life === this.#life) this.#end(false);
      throw error;
    }
    if (this.ward !== '' && this.ward !== ward) throw new Error('the house opened again on another ward');
    this.ward = ward;
  }

  // Every message in carries the time and the carry's addresses, which the house reads at once.
  #post(message: Said): void {
    if (this.#thread === undefined) return;
    // Each message but a ping begins work, which the runner says it ended.
    const begins = message.t === 'ping' ? {} : { s: ++this.#sent };
    this.#thread.post({ ...message, ...begins, now: this.#foundation.clock.now(), at: this.#foundation.carry.at({}) });
    if (message.t !== 'ping') this.#hold();
  }

  // The thread holds its engine open while it opens and while work it began has not ended: what it waits on holds the engine itself.
  #hold(): void {
    this.#thread?.hold?.(!this.#standing || this.#done < this.#sent);
    const idle = this.#standing && this.#waiting.size === 0 && this.#done >= this.#sent && this.#calling === 0;
    this.#rest(idle ? this.#runner.idle : undefined);
  }

  // The idle house's sleep, set to come once it has stood idle that long, or let go while it works.
  #rest(after: number | undefined): void {
    clearTimeout(this.#idle);
    this.#idle = undefined;
    if (after === undefined || this.#closed || this.#thread === undefined) return;
    this.#idle = setTimeout(() => this.#sleep(), after);
    (this.#idle as { unref?: () => void }).unref?.();
  }

  // One request into the house, answered, or its silence where the runner ends first.
  #request(message: Said, silent: unknown): Promise<unknown> {
    const id = ++this.#next;
    return new Promise((settle, fail) => {
      this.#waiting.set(id, { settle, fail, silent });
      this.#post({ ...message, id });
    });
  }

  async door(box: Uint8Array): Promise<Uint8Array | null> {
    if (!(await this.#ready())) return null;
    return (await this.#request({ t: 'door', box }, null)) as Uint8Array | null;
  }

  async ask(request: Parameters<Opened['ask']>[0]): Promise<Answer | { readonly describe: Json }> {
    if (!(await this.#ready())) return SILENT;
    return (await this.#request({ t: 'ask', request }, SILENT)) as Answer | { readonly describe: Json };
  }

  // Whether the house stands open now, woken where it sleeps, once any opening has ended.
  async #ready(): Promise<boolean> {
    if (this.#closed) return false;
    if (this.#asleep) this.#wake();
    await this.#opening;
    return !this.#closed && this.#thread !== undefined;
  }

  close(): void {
    this.#closed = true;
    this.#end(true);
  }

  // ---- what comes out ----

  #heard(said: Said): void {
    if (said.t === 'pong') {
      this.#pinged = undefined;
      this.#tight = Number.POSITIVE_INFINITY;
      return;
    }
    if (said.t === 'end') {
      this.#done = Math.max(this.#done, said.s as number);
      this.#hold();
      return;
    }
    if (said.t === 'answer') {
      const waiting = this.#waiting.get(said.id!);
      if (waiting === undefined) return;
      this.#waiting.delete(said.id!);
      this.#hold();
      if (typeof said.error === 'string') waiting.fail(new Error(said.error));
      else waiting.settle(said.value);
      return;
    }
    if (said.t !== 'call') return;
    const life = this.#life;
    const reply = (fields: Record<string, unknown>) => {
      if (said.id !== 0 && life === this.#life) this.#post({ t: 'reply', id: said.id, ...fields });
    };
    const counted = said.body !== 'clock';
    if (counted) this.#calling++;
    this.#called(said)
      .then(
        (value) => reply({ value }),
        (error: unknown) => reply({ error: reason(error) }),
      )
      .finally(() => {
        if (counted) this.#calling--;
        if (life === this.#life) this.#hold();
      });
  }

  // A call the house made on a body or an offer, answered on the ground's side.
  async #called(said: Said): Promise<unknown> {
    const body = said.body as string;
    const method = said.method as string;
    const args = said.args as unknown[];
    if (body === 'offer') return this.#offer(said.offer as number, method, args);
    if (body === 'opened') return this.#opened(said.offer as number, args[0] as string);
    if (!CALLS[body]?.has(method)) throw new Error(`no body answers ${body}.${method}`);
    if (body === 'clock') return this.#clock(method, args[0] as { id: string; ms?: number });
    const target = this.#foundation[body as 'keys' | 'memory' | 'carry' | 'crypto'] as unknown as Record<string, (...values: unknown[]) => unknown>;
    return target[method](...args);
  }

  // A clock's wait, whose milliseconds bound how long the runner may go unanswering while it stands. One that comes due while the house sleeps wakes it.
  async #clock(method: string, { id, ms = 0 }: { id: string; ms?: number }): Promise<unknown> {
    const clock = this.#foundation.clock;
    if (method === 'cancel') return clock.cancel({ id });
    const life = this.#life;
    const key = `${life}\n${id}`;
    this.#waits.set(key, ms);
    this.#tight = Math.min(this.#tight, ms);
    this.#watch();
    try {
      const fired = await clock.wait({ id, ms });
      if (fired && this.#asleep && life !== this.#life) this.#wake();
      return fired;
    } finally {
      this.#waits.delete(key);
    }
  }

  // The context an offer's method or its opening is handed: its calls go back into the house.
  #context(offer: number, n?: number, watch?: { until: number }): Pick<FacultyContext, 'call' | 'describe' | 'watch'> {
    return {
      call: (options) => this.#reached(() => this.#request({ t: 'context', kind: 'call', offer, options }, SILENT)) as Promise<Answer>,
      describe: (options) => this.#reached(() => this.#request({ t: 'context', kind: 'describe', offer, options }, SILENT)) as Promise<{ describe: Json } | { error: { message: string } }>,
      ...(watch === undefined ? {} : { watch: { until: watch.until, same: (answer: Answer) => this.#request({ t: 'context', kind: 'same', n, answer }, false) as Promise<boolean> } }),
    };
  }

  // A faculty's call into the house, woken where it sleeps. A faculty told
  // the house opened calls it while it opens, so a thread that runs takes
  // the call at once, and waits for no opening.
  async #reached(request: () => Promise<unknown>): Promise<unknown> {
    if (this.#closed) return SILENT;
    if ((this.#thread === undefined || this.#asleep) && !(await this.#ready())) return SILENT;
    return request();
  }

  #offer(index: number, method: string, [args, context]: unknown[]): Promise<unknown> {
    const offer = this.#offers[index];
    const told = context as { n: number; id: string; watch?: { until: number } };
    const object = offer?.object as Record<string, (args: unknown, context: FacultyContext) => Promise<unknown>> | undefined;
    if (object === undefined || typeof object[method] !== 'function') return Promise.reject(new Error(`no offer answers ${method}`));
    return object[method](args, { id: told.id, ...this.#context(index, told.n, told.watch) });
  }

  async #opened(index: number, ward: string): Promise<null> {
    await this.#offers[index]?.opened?.({ ward, ...this.#context(index) });
    return null;
  }

  // ---- the heartbeat ----

  // The bound on the runner's silence: the shortest wait it set since it last answered a beat, or has outstanding, the ground's where it has none.
  #limit(): number {
    return Math.max(FLOOR, Math.min(this.#bound, this.#tight, ...this.#waits.values()));
  }

  // One beat now and then: a ping, and the runner ended where the last went unanswered past the bound.
  #watch(): void {
    if (this.#closed || this.#thread === undefined) return;
    clearTimeout(this.#timer);
    const limit = this.#limit();
    this.#timer = setTimeout(() => this.#beat(), limit / 2);
    (this.#timer as { unref?: () => void }).unref?.();
  }

  #beat(): void {
    if (this.#pinged !== undefined && Date.now() - this.#pinged >= this.#limit()) {
      this.#ended();
      return;
    }
    if (this.#pinged === undefined) {
      this.#pinged = Date.now();
      this.#post({ t: 'ping' });
    }
    this.#watch();
  }

  // ---- the end ----

  // The thread ended and every call into it silent. A house closed or asleep is told so first, and keeps its waits where it sleeps.
  #end(whole: boolean, sleeping = false): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#rest(undefined);
    const thread = this.#thread;
    if (whole && this.#standing) thread?.post({ t: 'close' });
    this.#thread = undefined;
    this.#standing = false;
    this.#life++;
    this.#done = this.#sent;
    this.#calling = 0;
    thread?.end();
    if (!sleeping) for (const key of this.#waits.keys()) this.#foundation.clock.cancel({ id: key.slice(key.indexOf('\n') + 1) });
    this.#waits.clear();
    const waiting = [...this.#waiting.values()];
    this.#waiting.clear();
    for (const one of waiting) one.settle(one.silent);
  }

  // A runner that stopped answering, or ended by itself: ended, and the house opened again from memory.
  #ended(): void {
    this.#end(false);
    if (this.#closed) return;
    this.#opening = this.#start().catch(() => {
      // A house that does not open again stands silent until it is closed.
      this.#end(false);
    });
  }

  // An idle house asleep: its thread ended whole, its waits kept, so the first thing that reaches it or comes due opens it again.
  #sleep(): void {
    if (this.#closed || this.#thread === undefined || this.#waiting.size > 0 || this.#done < this.#sent || this.#calling > 0) return;
    this.#end(true, true);
    this.#asleep = true;
  }

  #wake(): void {
    if (!this.#asleep || this.#closed) return;
    this.#asleep = false;
    this.#opening = this.#start().catch(() => {
      this.#end(false);
    });
  }
}
