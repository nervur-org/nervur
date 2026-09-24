// SPDX-License-Identifier: Apache-2.0
// The bench's own beings, written as any author writes hers. The steward
// keeps the author's house where the test brings no steward of its own:
// it bears, invites and introduces through its powers, and asks as her
// steward. The caller asks through a standing, as a stranger, or as a
// being introduced to her. Each keeps the answers her effects' replies
// bring, so the bench reads what an effect answered once it lands.
import { Being, need, s, type Args, type Json } from '../being/index.ts';

/** Any JSON value: a schema with no keyword. */
const ANY = Object.freeze({});

/** A reply's args: the answer an effect brought, a result or an error. */
const ANSWER = Object.freeze({ type: 'object' });

/** A card and one ask, as the caller asks a far public being. */
const CARD = { ward: s.string(), at: s.array(s.string()) };

/** One ask's outcome: its answer, or `queued` where it left as an effect whose reply lands later. */
type Outcome = { answer: { result: Json } | { error: { message: string } } } | { queued: true };

/** One method as a describe shows it. */
interface Shown {
  readonly method: string;
  readonly args?: Json;
  readonly hints?: { readonly readOnly?: boolean; readonly idempotent?: boolean };
}

const failed = (error: unknown): Outcome => ({ answer: { error: { message: error instanceof Error ? error.message : String(error) } } });

// A need for one ask a describe showed, whose result is read as the JSON it is.
const needFor = (shown: Shown) => {
  const required = (shown.args as { required?: unknown } | undefined)?.required;
  const readOnly = shown.hints?.readOnly === true;
  return need('asked', {
    [shown.method]: {
      args: { type: 'object', ...(Array.isArray(required) ? { required } : {}) },
      result: ANY,
      hints: { readOnly, idempotent: readOnly || shown.hints?.idempotent === true },
    },
  });
};

export class BenchSteward extends Being.of({
  kind: 'org.nervur.bench.steward',
  cells: { heard: [] as Json[] },
  asks: {
    bear: { for: 'root', args: s.object({ kind: s.string(), id: s.string(), args: s.optional(ANY) }) },
    door: { for: 'root', args: s.object({ id: s.string(), occupant: s.string(), role: s.optional(s.string()) }), result: s.object({ door: s.handle() }) },
    introduce: { for: 'root', args: s.object({ from: s.string(), to: s.string() }) },
    ask: { for: 'root', hints: { idempotent: true }, args: s.object({ id: s.string(), method: s.string(), args: s.optional(ANY) }), result: ANY },
    shows: { for: 'root', hints: { idempotent: true }, args: s.object({ id: s.string() }), result: ANY },
    heard: { for: 'steward', args: ANSWER },
    replies: { for: 'root', hints: { readOnly: true }, result: s.array(ANY) },
  },
}) {
  bear({ kind, id, args }: Args<BenchSteward, 'bear'>) {
    this.powers!.bear({ kind, id, ...(args === undefined ? {} : { args }) });
  }

  // A new occupant of hers, whose steward notes hold the role the bench plays.
  door({ id, occupant, role }: Args<BenchSteward, 'door'>) {
    return { door: this.powers!.invite({ id, occupant, notes: role === undefined ? {} : { [role]: true } }) };
  }

  introduce({ from, to }: Args<BenchSteward, 'introduce'>) {
    this.powers!.introduce({ from, to });
  }

  // As her steward: awaited where her entry says so, an effect otherwise, whose answer lands as a reply.
  async ask({ id, method, args }: Args<BenchSteward, 'ask'>): Promise<Outcome> {
    try {
      const answered = await this.powers!.ask({ id, method, ...(args === undefined ? {} : { args }) }, { reply: 'heard' });
      return answered === undefined ? { queued: true } : { answer: { result: (answered ?? null) as Json } };
    } catch (error) {
      return failed(error);
    }
  }

  shows({ id }: Args<BenchSteward, 'shows'>) {
    return this.powers!.ask({ id }) as unknown as Promise<Json>;
  }

  heard(answer: Args<BenchSteward, 'heard'>) {
    this.cells.heard = [...this.cells.heard, answer];
  }

  replies() {
    return this.cells.heard;
  }
}

export class BenchCaller extends Being.of({
  kind: 'org.nervur.bench.caller',
  cells: { heard: [] as Json[] },
  asks: {
    adopt: { for: 'root', args: s.object({ invitation: s.handle() }), result: s.string() },
    ask: { for: 'root', hints: { idempotent: true }, args: s.object({ standing: s.string(), method: s.string(), args: s.optional(ANY) }), result: ANY },
    describe: { for: 'root', hints: { idempotent: true }, args: s.object({ standing: s.string() }), result: ANY },
    visit: { for: 'root', hints: { idempotent: true }, args: s.object({ ...CARD, method: s.string(), args: s.optional(ANY) }), result: ANY },
    looks: { for: 'root', hints: { idempotent: true }, args: s.object(CARD), result: ANY },
    heard: { for: 'steward', args: ANSWER },
    replies: { for: 'root', hints: { readOnly: true }, result: s.array(ANY) },
  },
}) {
  adopt({ invitation }: Args<BenchCaller, 'adopt'>) {
    return invitation;
  }

  // Through a standing she holds: what it shows her, then the ask by a need that describe covers.
  async ask({ standing, method, args }: Args<BenchCaller, 'ask'>): Promise<Outcome> {
    try {
      const { asks } = await this.held(standing).describe();
      const shown = asks.find((one) => one.method === method);
      if (shown === undefined) return failed('no such ask');
      const face = this.held(standing, needFor(shown)) as unknown as Record<string, (args: unknown, options: { reply: string }) => Promise<unknown> | undefined>;
      const answered = await face[method](args ?? {}, { reply: 'heard' });
      return answered === undefined ? { queued: true } : { answer: { result: (answered ?? null) as Json } };
    } catch (error) {
      return failed(error);
    }
  }

  async describe({ standing }: Args<BenchCaller, 'describe'>) {
    return (await this.held(standing).describe()) as unknown as Json;
  }

  // As a stranger to a far public being: what she shows a stranger, then the ask.
  async visit({ ward, at, method, args }: Args<BenchCaller, 'visit'>): Promise<Outcome> {
    try {
      const { asks } = await this.stranger({ ward, at }).describe();
      const shown = asks.find((one) => one.method === method);
      if (shown === undefined) return failed('no such ask');
      const face = this.stranger({ ward, at }, needFor(shown)) as unknown as Record<string, (args: unknown) => Promise<unknown>>;
      return { answer: { result: ((await face[method](args ?? {})) ?? null) as Json } };
    } catch (error) {
      return failed(error);
    }
  }

  async looks({ ward, at }: Args<BenchCaller, 'looks'>) {
    return (await this.stranger({ ward, at }).describe()) as unknown as Json;
  }

  heard(answer: Args<BenchCaller, 'heard'>) {
    this.cells.heard = [...this.cells.heard, answer];
  }

  replies() {
    return this.cells.heard;
  }
}
