// Classes that try what the house refuses, each answering the refusal it
// met: a being reaching past her position, keeping a handle in her cells,
// noting a standing she was never given, taking an occupant id the house
// reserves, a public being inviting, a steward reading a being's cells, a
// class with an ask it never wrote, and two classes claiming one kind.
import { Being, need, s, type Args } from 'nervur/being';

/** A faculty she looks through, awaited, and pokes, as an effect. */
export const Probe = need('probe', {
  look: { hints: { idempotent: true }, args: s.object({ n: s.number() }), result: s.string() },
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
    look: { hints: { idempotent: true }, args: s.object({ n: s.number() }), result: s.string() },
    poke: {},
    heard: { for: 'keeper', args: s.reply(Probe.poke) },
    count: { for: 'keeper', hints: { readOnly: true }, result: s.integer() },
  },
}) {
  async look({ n }: Args<Looker, 'look'>) {
    try {
      return await this.probe.look({ n });
    } catch (error) {
      return `failed: ${(error as Error).message}`;
    }
  }

  poke() {
    this.probe.poke({}, { reply: 'heard' });
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
const REACHES = ['id', 'position', 'asker', 'cells', 'house', 'standings', 'occupants', 'steward', 'powers', 'held', 'stranger', 'handle', 'invite', 'fail', 'keys', 'memory', 'classes', 'carry', 'clock', 'crypto', 'tools'];

export class Prober extends Being.of({
  kind: 'org.example.prober',
  cells: { kept: null as unknown as string | null },
  asks: {
    reach: { hints: { readOnly: true }, result: s.object({ members: s.array(s.string()), house: s.array(s.string()), standings: s.array(s.string()) }) },
    keep: { args: s.object({ ask: s.enum(['ping']) }) },
    ping: { for: 'handle' },
    note: { hints: { readOnly: true }, args: s.object({ standing: s.string() }), result: s.string() },
    occupy: { hints: { readOnly: true }, args: s.object({ id: s.string() }), result: s.string() },
    twice: { result: s.string() },
  },
}) {
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
  asks: { open: { hints: { idempotent: true }, result: s.string() } },
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
    return Object.keys((await this.powers!.ask({ id, cells: true } as never)) as object).sort();
  }
}

/** A class whose table names an ask she never wrote. */
export class Broken extends Being.of({
  kind: 'org.example.broken',
  asks: { ghost: {} },
}) {}

/** Two classes that claim one kind. */
export class TwinOne extends Being.of({ kind: 'org.example.twin', asks: { hi: {} } }) {
  hi() {}
}
export class TwinTwo extends Being.of({ kind: 'org.example.twin', asks: { hi: {} } }) {
  hi() {}
}
