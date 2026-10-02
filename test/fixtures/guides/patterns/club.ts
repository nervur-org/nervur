// patterns/club.ts
import { Being, need, s, type Args } from 'nervur/being';

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

export class Club extends Being.of({
  kind: 'org.example.club',
  roles: {
    guest: (asker) => typeof asker.notes.pin === 'string',
    member: (asker) => asker.notes.member === true,
  },
  asks: {
    admit: {
      for: 'root',
      args: s.object({ name: s.string() }),
      result: s.object({ invitation: s.handle(), pin: s.string() }),
    },
    claim: { for: 'guest', idempotent: true, args: s.object({ pin: s.string() }) },
    enter: { for: 'member', readOnly: true, result: s.string() },
  },
}) {
  // The invitation travels by one road and the pin by another.
  admit({ name }: Args<Club, 'admit'>) {
    const pin = hex(this.house.random({ length: 4 }));
    const invitation = this.invite(`guest-${name}`, { notes: { pin, name }, expires: 86_400_000 });
    return { invitation, pin };
  }

  // Whoever took the invitation proves they are the one it was meant for.
  claim({ pin }: Args<Club, 'claim'>) {
    if (pin !== this.asker.notes.pin) this.fail('That is not the pin.');
    this.occupants.note(this.asker.id, { member: true, name: this.asker.notes.name ?? '' });
  }

  enter() {
    return `Welcome, ${String(this.asker.notes.name)}.`;
  }
}

const Claim = need('claim', {
  claim: { idempotent: true, args: s.object({ pin: s.string() }) },
});

const Entry = need('entry', {
  enter: { readOnly: true, result: s.string() },
});

export class Guest extends Being.of({
  kind: 'org.example.guest',
  cells: { club: '' },
  asks: {
    join: { for: 'root', idempotent: true, args: s.object({ invitation: s.handle() }) },
    claim: { for: 'root', idempotent: true, args: s.object({ pin: s.string() }) },
    enter: { for: 'root', idempotent: true, result: s.string() },
  },
}) {
  join({ invitation }: Args<Guest, 'join'>) {
    this.cells.club = invitation;
  }

  async claim({ pin }: Args<Guest, 'claim'>) {
    this.must(await this.held(this.cells.club, Claim).claim({ pin }));
  }

  async enter() {
    return this.must(await this.held(this.cells.club, Entry).enter());
  }
}
