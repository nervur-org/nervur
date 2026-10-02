// SPDX-License-Identifier: Apache-2.0
// The bench's own beings, written as any author writes hers. The steward
// keeps the author's house where the test brings no steward of its own:
// it bears, invites and introduces through its powers, and asks as her
// steward. The caller asks through a standing, as a stranger, or as a
// being introduced to her. Each keeps the answers her effects' replies
// bring, so the bench reads what an effect answered once it lands.
import { Being, need, s, type Args, type Json, type Reply } from '../being/index.ts';

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
  readonly readOnly?: boolean;
  readonly idempotent?: boolean;
}

const failed = (error: unknown): Outcome => ({ answer: { error: { message: error instanceof Error ? error.message : String(error) } } });

/** An awaited call's reply as one ask's outcome, or `queued` where it left as an effect. */
const outcomeOf = (answered: Reply | void | undefined): Outcome =>
  answered === undefined ? { queued: true } : { answer: answered.error !== undefined ? { error: answered.error } : { result: (answered.result ?? null) as Json } };

// A need for one ask a describe showed, whose result is read as the JSON it is.
const needFor = (shown: Shown) => {
  const required = (shown.args as { required?: unknown } | undefined)?.required;
  const readOnly = shown.readOnly === true;
  return need('asked', {
    [shown.method]: {
      args: { type: 'object', ...(Array.isArray(required) ? { required } : {}) },
      result: ANY,
      readOnly,
      idempotent: readOnly || shown.idempotent === true,
    },
  });
};

/** This module, which a house of the bench's loads its own beings from in its runner. */
export const STEWARDS = import.meta.url;

export class BenchSteward extends Being.of({
  kind: 'org.nervur.bench.steward',
  cells: { heard: [] as Json[] },
  asks: {
    bear: { for: 'root', args: s.object({ kind: s.string(), id: s.string(), args: s.optional(ANY) }) },
    door: { for: 'root', args: s.object({ id: s.string(), occupant: s.string(), role: s.optional(s.string()) }), result: s.object({ door: s.handle() }) },
    introduce: { for: 'root', args: s.object({ from: s.string(), to: s.string(), notes: s.optional(ANY) }) },
    ask: {
      for: 'root',
      idempotent: true,
      args: s.object({ id: s.string(), method: s.string(), args: s.optional(ANY), invitations: s.optional(s.array(s.invitation())), at: s.optional(s.array(s.string())) }),
      result: ANY,
    },
    shows: { for: 'root', idempotent: true, args: s.object({ id: s.string() }), result: ANY },
    heard: { for: 'powers', args: ANSWER },
    replies: { for: 'root', readOnly: true, result: s.array(ANY) },
    dead: { for: 'root', readOnly: true, args: s.object({ id: s.string() }), result: s.array(ANY) },
  },
}) {
  bear({ kind, id, args }: Args<BenchSteward, 'bear'>) {
    this.powers!.bear({ kind, id, ...(args === undefined ? {} : { args }) });
  }

  // A new occupant of hers, whose steward notes hold the role the bench plays.
  door({ id, occupant, role }: Args<BenchSteward, 'door'>) {
    return { door: this.powers!.invite({ id, occupant, notes: role === undefined ? {} : { [role]: true } }) };
  }

  introduce({ from, to, notes }: Args<BenchSteward, 'introduce'>) {
    this.powers!.introduce({ from, to, ...(notes === undefined ? {} : { notes }) });
  }

  // As her steward: awaited where her entry says so, an effect otherwise, whose answer lands as a reply.
  // Each invitation it carries unopened goes under the arg `at` names, for her to take.
  async ask({ id, method, args, invitations = [], at = [] }: Args<BenchSteward, 'ask'>): Promise<Outcome> {
    try {
      const carried = invitations.length === 0 ? args : { ...((args ?? {}) as Record<string, Json>), ...Object.fromEntries(at.map((name, index) => [name, invitations[index]])) };
      return outcomeOf(await this.powers!.ask({ id, method, ...(carried === undefined ? {} : { args: carried }) }, { reply: 'heard' }));
    } catch (error) {
      return failed(error);
    }
  }

  async shows({ id }: Args<BenchSteward, 'shows'>) {
    const shown = await this.powers!.ask({ id });
    if (shown.error !== undefined) this.fail(shown.error.message);
    return shown.result as unknown as Json;
  }

  heard(answer: Args<BenchSteward, 'heard'>) {
    this.cells.heard = [...this.cells.heard, answer];
  }

  replies() {
    return this.cells.heard;
  }

  // The replies her table refused, kept for her steward.
  async dead({ id }: Args<BenchSteward, 'dead'>) {
    return ((await this.powers!.list()).find((being) => being.id === id)?.dead ?? []) as unknown as Json[];
  }
}

export class BenchCaller extends Being.of({
  kind: 'org.nervur.bench.caller',
  cells: { heard: [] as Json[] },
  asks: {
    adopt: { for: 'root', args: s.object({ invitation: s.handle() }), result: s.string() },
    ask: { for: 'root', idempotent: true, args: s.object({ standing: s.string(), method: s.string(), args: s.optional(ANY) }), result: ANY },
    describe: { for: 'root', idempotent: true, args: s.object({ standing: s.string() }), result: ANY },
    visit: { for: 'root', idempotent: true, args: s.object({ ...CARD, method: s.string(), args: s.optional(ANY) }), result: ANY },
    looks: { for: 'root', idempotent: true, args: s.object(CARD), result: ANY },
    heard: { for: 'standing', args: ANSWER },
    replies: { for: 'root', readOnly: true, result: s.array(ANY) },
  },
}) {
  adopt({ invitation }: Args<BenchCaller, 'adopt'>) {
    return invitation;
  }

  // Through a standing she holds: what it shows her, then the ask by a need that describe covers.
  async ask({ standing, method, args }: Args<BenchCaller, 'ask'>): Promise<Outcome> {
    try {
      const described = await this.held(standing).describe();
      if (described.error !== undefined) return { answer: { error: described.error } };
      const shown = described.result.asks.find((one) => one.method === method);
      if (shown === undefined) return failed('no such ask');
      const face = this.held(standing, needFor(shown)) as unknown as Record<string, (args: unknown, options?: { reply: string }) => Promise<Reply> | undefined>;
      const awaited = shown.idempotent === true || shown.readOnly === true;
      return outcomeOf(await face[method](args ?? {}, awaited ? undefined : { reply: 'heard' }));
    } catch (error) {
      return failed(error);
    }
  }

  async describe({ standing }: Args<BenchCaller, 'describe'>) {
    const shown = await this.held(standing).describe();
    if (shown.error !== undefined) this.fail(shown.error.message);
    return shown.result as unknown as Json;
  }

  // As a stranger to a far public being: what she shows a stranger, then the ask.
  async visit({ ward, at, method, args }: Args<BenchCaller, 'visit'>): Promise<Outcome> {
    try {
      const described = await this.stranger({ ward, at }).describe();
      if (described.error !== undefined) return { answer: { error: described.error } };
      const shown = described.result.asks.find((one) => one.method === method);
      if (shown === undefined) return failed('no such ask');
      const face = this.stranger({ ward, at }, needFor(shown)) as unknown as Record<string, (args: unknown) => Promise<Reply>>;
      return outcomeOf(await face[method](args ?? {}));
    } catch (error) {
      return failed(error);
    }
  }

  async looks({ ward, at }: Args<BenchCaller, 'looks'>) {
    const shown = await this.stranger({ ward, at }).describe();
    if (shown.error !== undefined) this.fail(shown.error.message);
    return shown.result as unknown as Json;
  }

  heard(answer: Args<BenchCaller, 'heard'>) {
    this.cells.heard = [...this.cells.heard, answer];
  }

  replies() {
    return this.cells.heard;
  }
}
