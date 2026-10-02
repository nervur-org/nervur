// Classes that try what the house refuses, each answering the refusal it
// met: a being reaching past her position, keeping a handle in her cells,
// noting a standing she was never given, taking an occupant id the house
// reserves, a public being inviting, a steward reading a being's cells, a
// class with an ask it never wrote, and two classes claiming one kind.
import { Being, need, s, type Args, type Reply } from 'nervur/being';

/** A faculty she looks through, awaited, and pokes, as an effect. */
export const Probe = need('probe', {
  look: { idempotent: true, args: s.object({ n: s.number() }), result: s.string() },
  poke: {},
});

/**
 * A being who calls the probe and says what she met: an awaited look's
 * answer or its failure, and the replies to her pokes, which only her
 * keeper may ask.
 */
export class Looker extends Being.of({
  kind: 'org.example.looker',
  needs: { probe: Probe },
  cells: { heard: 0 },
  roles: { keeper: (asker) => asker.steward.keeper === true },
  asks: {
    look: { idempotent: true, args: s.object({ n: s.number() }), result: s.string() },
    glance: { idempotent: true, args: s.object({ n: s.number() }), result: s.string() },
    poke: {},
    nudge: {},
    nudged: { for: 'probe', args: s.reply(Probe.poke) },
    heard: { for: 'keeper', args: s.reply(Probe.poke) },
    count: { for: 'keeper', readOnly: true, result: s.integer() },
    stare: { args: s.object({ n: s.number() }) },
  },
}) {
  async look({ n }: Args<Looker, 'look'>) {
    const { result, error } = await this.probe.look({ n });
    return error ? `failed: ${error.message}` : result;
  }

  // An awaited call she never awaits: whatever it answers, it is data, and nothing is thrown.
  glance({ n }: Args<Looker, 'glance'>) {
    void this.probe.look({ n });
    return 'went on';
  }

  poke() {
    this.probe.poke({}, { reply: 'heard' });
  }

  // A poke whose answer the probe alone may bring, since her reply names it.
  nudge() {
    this.probe.poke({}, { reply: 'nudged' });
  }

  // An awaited look given a reply, which fails her ask: her need declared it awaited.
  stare({ n }: Args<Looker, 'stare'>) {
    void (this.probe.look as (args: { n: number }, options: { reply: string }) => unknown)({ n }, { reply: 'heard' });
  }

  nudged() {
    this.cells.heard += 1;
  }

  heard() {
    this.cells.heard += 1;
  }

  count() {
    return this.cells.heard;
  }
}

// What she met: the message of the refusal, or `none` where nothing refused her.
const met = (attempt: () => unknown): string => {
  try {
    attempt();
    return 'none';
  } catch (error) {
    return (error as Error).message;
  }
};

/** Every member a being might reach for, the foundation's names among them. */
const REACHES = ['id', 'asker', 'cells', 'house', 'standings', 'occupants', 'steward', 'powers', 'held', 'stranger', 'handle', 'invite', 'fail', 'keys', 'memory', 'classes', 'carry', 'clock', 'crypto', 'tools'];

export class Prober extends Being.of({
  kind: 'org.example.prober',
  cells: { kept: null as unknown as string | null },
  asks: {
    reach: { readOnly: true, result: s.object({ members: s.array(s.string()), house: s.array(s.string()), standings: s.array(s.string()) }) },
    keep: { args: s.object({ ask: s.enum(['ping']) }) },
    ping: { for: 'handle' },
    note: { readOnly: true, args: s.object({ standing: s.string() }), result: s.string() },
    occupy: { readOnly: true, args: s.object({ id: s.string() }), result: s.string() },
    twice: { result: s.string() },
    hoard: { args: s.object({ size: s.integer() }) },
    hush: {},
  },
}) {
  // She writes, then answers nothing: her silence lands none of it.
  hush() {
    this.cells.kept = 'heard';
    this.silence();
  }

  // Her cells grown to the size asked, which the house bounds.
  hoard({ size }: Args<Prober, 'hoard'>) {
    this.cells.kept = 'x'.repeat(size);
  }

  reach() {
    const self = this as unknown as Record<string, unknown>;
    return {
      members: REACHES.filter((name) => self[name] !== undefined),
      house: Object.keys(this.house).sort(),
      standings: Object.keys(this.standings).sort(),
    };
  }

  // A handle kept in her cells, which fails her ask where it would land.
  keep({ ask }: Args<Prober, 'keep'>) {
    (this.cells as Record<string, unknown>).kept = this.handle(ask);
  }

  ping() {}

  note({ standing }: Args<Prober, 'note'>) {
    return met(() => this.standings.note(standing, { mine: true }));
  }

  occupy({ id }: Args<Prober, 'occupy'>) {
    return met(() => this.invite(id));
  }

  twice() {
    return met(() => {
      this.invite('guest');
      this.invite('guest');
    });
  }
}

/** A public being who tries to invite. */
export class Lectern extends Being.of({
  kind: 'org.example.lectern',
  asks: { open: { idempotent: true, result: s.string() } },
}) {
  open() {
    return met(() => this.invite('reader'));
  }
}

/** A steward who asks her powers for a being's cells, and says which keys came back. */
export class Peeker extends Being.of({
  kind: 'org.example.peeker',
  roles: { pilot: (asker) => asker.id === 'root' },
  asks: {
    bear: { for: 'pilot', args: s.object({ kind: s.string(), id: s.string() }) },
    peek: { for: 'pilot', args: s.object({ id: s.string() }), result: s.array(s.string()) },
  },
}) {
  bear({ kind, id }: Args<Peeker, 'bear'>) {
    this.powers!.bear({ kind, id });
  }

  async peek({ id }: Args<Peeker, 'peek'>) {
    const shown = (await this.powers!.ask({ id, cells: true } as never)) as Reply;
    if (shown.error) this.fail(shown.error.message);
    return Object.keys(shown.result as object).sort();
  }
}

/** A class whose table names an ask she never wrote. */
export class Broken extends Being.of({
  kind: 'org.example.broken',
  asks: { ghost: {} },
}) {}

// Written as hints, the two flags that change what the house does.
export class FlagsAsHints extends Being.of({ kind: 'org.example.hint', asks: { go: { hints: { readOnly: true, idempotent: true } as never } } }) {
  go() {}
}
