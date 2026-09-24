// desk.ts
import { Being, need, s, type Args } from 'nervur/being';

/** The face, as the steward arms it with a handle to her signup. */
const Face = need('face', {
  arm: { args: s.object({ signup: s.handle() }), hints: { idempotent: true } },
});

/** A member declares the face, so its doors reach her. */
const Reached = need('face', {});

export class Desk extends Being.of({
  kind: 'com.example.desk',
  needs: { face: Face },
  asks: {
    arm: { for: 'root', hints: { idempotent: true } },
    signup: { for: 'handle', args: s.object({ name: s.string() }), result: s.object({ door: s.handle() }) },
  },
}) {
  async arm() {
    await this.face.arm({ signup: this.handle('signup') });
  }

  // Each person is one member, and the face holds one door on her.
  signup({ name }: Args<Desk, 'signup'>) {
    const id = `member-${name}`;
    this.powers!.bear({ kind: 'com.example.member', id });
    return { door: this.powers!.invite({ id, occupant: 'web', notes: { person: true } }) };
  }
}

export class Member extends Being.of({
  kind: 'com.example.member',
  needs: { face: Reached },
  cells: { visits: 0 },
  roles: { person: (asker) => asker.steward.person === true },
  asks: {
    hello: { for: 'person', hints: { readOnly: true }, description: 'Greets the person.', result: s.string() },
    visit: { for: 'person', description: 'Counts one visit.', result: s.integer() },
    leave: { for: 'person', description: 'Lets this door go.' },
  },
}) {
  hello() {
    return `hello, ${this.id}`;
  }

  visit() {
    this.cells.visits += 1;
    return this.cells.visits;
  }

  leave() {
    this.occupants.dismiss(this.asker.id);
  }
}

export const steward = Desk;
export const beings = [Member];
