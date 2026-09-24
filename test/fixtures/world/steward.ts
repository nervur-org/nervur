// The steward of every test house, piloted by the owner through the hand:
// she bears beings, lists them, introduces them, mints invitations on
// herself and on the beings she stewards, forwards one ask to a being, and
// enrols a stranger her public being signs up.
import { Being, s, need, type Args } from 'nervur/being';
import type { Gauge } from './gauge.ts';

/** What one steward calls on another, across houses. */
export const Visit = need('visit', {
  whoami: { result: s.string(), hints: { readOnly: true } },
  ping: {},
});

export class Steward extends Being.of({
  kind: 'org.example.steward',
  cells: { borne: 0, pings: 0 },
  roles: { pilot: (asker) => asker.id === 'root', visitor: (asker) => asker.id === 'far' },
  asks: {
    bear: { for: 'pilot', args: s.object({ kind: s.string(), id: s.string(), args: s.optional(s.object({ start: s.optional(s.number()) })) }) },
    beings: { for: 'pilot', hints: { readOnly: true }, result: s.array(s.string()) },
    remove: { for: 'pilot', args: s.object({ id: s.string() }) },
    introduce: { for: 'pilot', args: s.object({ from: s.string(), to: s.string(), trusted: s.optional(s.boolean()) }) },
    list: {
      for: 'pilot',
      hints: { readOnly: true },
      result: s.array(s.object({ id: s.string(), kind: s.string(), absent: s.boolean(), dead: s.array(s.string()) })),
    },
    count: { for: 'pilot', hints: { readOnly: true }, result: s.number() },
    // An invitation on herself, to the occupant `far`.
    offer: { for: 'pilot', result: s.object({ handle: s.handle() }) },
    // An invitation to a new occupant of a being she stewards.
    offerFor: { for: 'pilot', args: s.object({ being: s.string(), occupant: s.string() }), result: s.object({ handle: s.handle() }) },
    adopt: { for: 'pilot', args: s.object({ invitation: s.handle() }), result: s.string() },
    // An invitation minted on one being, carried by a second and taken by a
    // third, all inside this ask, and answered to the owner as it stands.
    spend: {
      for: 'pilot',
      args: s.object({ on: s.string(), carrier: s.string(), taker: s.string() }),
      result: s.object({ invitation: s.invitation(), taken: s.string() }),
    },
    relay: { for: 'pilot', args: s.object({ standing: s.string() }), result: s.string() },
    pingFar: { for: 'pilot', args: s.object({ standing: s.string() }) },
    ping: { for: 'visitor' },
    pings: { for: 'pilot', hints: { readOnly: true }, result: s.number() },
    // One ask to a being, answered as JSON text, so one ask forwards every
    // shape. Two minutes, so the being it asks waits her own time under it.
    forward: {
      for: 'pilot',
      wait: 120_000,
      hints: { idempotent: true },
      args: s.object({
        id: s.string(),
        method: s.string(),
        args: s.optional(
          s.object({ id: s.optional(s.string()), by: s.optional(s.number()), amount: s.optional(s.number()), at: s.optional(s.string()), in: s.optional(s.number()), why: s.optional(s.string()) }),
        ),
      }),
      result: s.object({ answered: s.optional(s.string()) }),
    },
    // What a being shows her steward: the asks of the empty ask.
    shows: { for: 'pilot', hints: { idempotent: true }, args: s.object({ id: s.string() }), result: s.array(s.string()) },
    whoami: { for: ['pilot', 'being', 'visitor'], hints: { readOnly: true }, result: s.string() },
    enroll: { for: 'being', hints: { idempotent: true }, args: s.object({ signer: s.bytes() }), result: s.object({ invitation: s.invitation() }) },
  },
}) {
  bear({ kind, id, args }: Args<Steward, 'bear'>) {
    this.powers!.bear({ kind, id, ...(args === undefined ? {} : { args }) });
    this.cells.borne += 1;
  }

  async beings() {
    return (await this.powers!.list()).map(({ id }) => id);
  }

  remove({ id }: Args<Steward, 'remove'>) {
    this.powers!.remove({ id });
  }

  introduce({ from, to, trusted }: Args<Steward, 'introduce'>) {
    this.powers!.introduce({ from, to, notes: { trusted: trusted === true } });
  }

  // Each being, with the reason each of her dead letters died.
  async list() {
    return (await this.powers!.list()).map(({ id, kind, absent, dead }) => ({ id, kind, absent, dead: dead.map((letter) => `${letter.ask}: ${letter.why}`) }));
  }

  count() {
    return this.cells.borne;
  }

  offer() {
    return { handle: this.invite('far', { notes: { visitor: true } }) };
  }

  offerFor({ being, occupant }: Args<Steward, 'offerFor'>) {
    return { handle: this.powers!.invite({ id: being, occupant }) };
  }

  adopt({ invitation }: Args<Steward, 'adopt'>) {
    return invitation;
  }

  async spend({ on, carrier, taker }: Args<Steward, 'spend'>) {
    const handle = this.powers!.invite({ id: on, occupant: 'spent' });
    const { invitation } = (await this.powers!.ask({ id: carrier, method: 'carry', args: { invitation: handle } })) as Args<Gauge, 'carry'>;
    const taken = await this.powers!.ask({ id: taker, method: 'take', args: { invitation } });
    return { invitation, taken: String(taken) };
  }

  async relay({ standing }: Args<Steward, 'relay'>) {
    return this.held(standing, Visit).whoami({});
  }

  pingFar({ standing }: Args<Steward, 'pingFar'>) {
    this.held(standing, Visit).ping({});
  }

  ping() {
    this.cells.pings += 1;
  }

  pings() {
    return this.cells.pings;
  }

  async forward({ id, method, args }: Args<Steward, 'forward'>) {
    const answered = await this.powers!.ask({ id, method, ...(args === undefined ? {} : { args }) });
    return answered === undefined ? {} : { answered: JSON.stringify(answered) };
  }

  async shows({ id }: Args<Steward, 'shows'>) {
    const { asks } = await this.powers!.ask({ id });
    return asks.map(({ method }) => method).sort();
  }

  whoami() {
    return this.asker.id;
  }

  // One member a signer, and a new owner of her on every signup.
  enroll({ signer }: Args<Steward, 'enroll'>) {
    const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const id = `member-${hex(signer).slice(0, 16)}`;
    this.powers!.bear({ kind: 'org.example.member', id });
    const invitation = this.powers!.invite({ id, occupant: `owner-${hex(this.house.random({ length: 4 }))}`, notes: { owner: true } });
    return { invitation };
  }
}
