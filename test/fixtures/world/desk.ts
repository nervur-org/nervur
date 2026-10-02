// A house whose people arrive through a face. The steward arms the face
// with a handle to her `enroll`; each person enrolled is a member being,
// and the face holds a door on her whose steward notes say `person`.
import { Being, need, s, type Args } from 'nervur/being';

const Front = need('front', {
  arm: { args: s.object({ signup: s.handle() }), idempotent: true },
});

/** A member reached through the face: she declares the face, so its tokens reach her. */
const Reached = need('front', {});

/** What the lobby asks of the steward for a stranger who signs up. */
const Welcome = need('welcome', {
  welcome: { idempotent: true, args: s.object({ signer: s.bytes() }), result: s.object({ invitation: s.invitation() }) },
});

export class Desk extends Being.of({
  kind: 'org.example.desk',
  needs: { front: Front },
  asks: {
    arm: { for: 'root', idempotent: true },
    enroll: { for: 'handle', args: s.object({ name: s.string() }), result: s.object({ door: s.handle() }) },
    welcome: { for: 'being', idempotent: true, args: s.object({ signer: s.bytes() }), result: s.object({ invitation: s.invitation() }) },
  },
}) {
  async arm() {
    const { error } = await this.front.arm({ signup: this.handle('enroll') });
    if (error) this.fail(error.message);
  }

  enroll({ name }: Args<Desk, 'enroll'>) {
    const id = `member-${name}`;
    this.powers!.bear({ kind: 'org.example.member-of-desk', id });
    return { door: this.powers!.invite({ id, occupant: 'web', notes: { person: true } }) };
  }

  // One member for one signer: a house that signs up again lands on the member it has.
  welcome({ signer }: Args<Desk, 'welcome'>) {
    const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const id = `member-${hex(signer.subarray(0, 8))}`;
    this.powers!.bear({ kind: 'org.example.member-of-desk', id });
    return { invitation: this.powers!.invite({ id, occupant: `home-${hex(this.house.random({ length: 4 }))}`, notes: { person: true } }) };
  }
}

/** The desk's front door to strangers: a house that signs up receives a door on its member. */
export class Lobby extends Being.of({
  kind: 'org.example.desk-lobby',
  cells: { notes: 0 },
  asks: {
    signup: { for: 'stranger', idempotent: true, result: s.object({ invitation: s.invitation() }) },
    // A guestbook: no idempotent ask, which her author lets a stranger repeat.
    note: { for: 'stranger', replayable: true, args: s.object({ text: s.string() }), result: s.integer() },
    notes: { for: 'root', readOnly: true, result: s.integer() },
  },
}) {
  note() {
    this.cells.notes += 1;
    return this.cells.notes;
  }

  notes() {
    return this.cells.notes;
  }

  async signup() {
    const { result, error } = await this.held('steward', Welcome).welcome({ signer: this.asker.signer! });
    if (error) this.fail(error.message);
    return result;
  }
}

export class Member extends Being.of({
  kind: 'org.example.member-of-desk',
  needs: { front: Reached },
  cells: { count: 0, doors: 0 },
  // The door the steward made says `person` in her notes; a door she made herself says it in her own.
  roles: { person: (asker) => asker.steward.person === true || asker.notes.person === true, auditor: (asker) => asker.steward.auditor === true },
  asks: {
    hello: { for: 'person', readOnly: true, result: s.string() },
    // Another door on her, for a device, an agent or a house of the person's own.
    connect: { for: 'person', result: s.object({ door: s.handle() }) },
    count: { for: 'person', readOnly: true, result: s.integer() },
    bump: { for: 'person' },
    leave: { for: 'person' },
    audit: { for: 'auditor', readOnly: true, result: s.integer() },
    who: { for: 'person', readOnly: true, result: s.string() },
  },
}) {
  hello() {
    return `hello, ${this.asker.id}`;
  }

  who() {
    return this.id;
  }

  // A door taken past ten minutes never binds, so bytes carried home and lost on the way go stale.
  connect() {
    this.cells.doors += 1;
    return { door: this.invite(`door-${this.cells.doors}`, { notes: { person: true }, expires: 600_000 }) };
  }

  count() {
    return this.cells.count;
  }

  bump() {
    this.cells.count += 1;
  }

  // The person lets their own door go.
  leave() {
    this.occupants.dismiss(this.asker.id);
  }

  audit() {
    return this.cells.count;
  }
}

export const steward = Desk;
export { Lobby as public };
export const beings = [Member];
