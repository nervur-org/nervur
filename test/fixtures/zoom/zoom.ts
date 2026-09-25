// A house whose person zooms. The steward arms the face with a handle to
// her `enroll`, which bears a person and hands the face a door on her. The
// person asks her steward for a door on another being, carries the
// invitation unopened, and answers it to whoever asked: the face that
// holds her door, or a house the door was carried home to.
import { Being, need, s, type Args } from 'nervur/being';

const Front = need('front', {
  arm: { args: s.object({ signup: s.handle() }), hints: { idempotent: true } },
});

/** A being the face reaches: she declares it, so its tokens reach her. */
const Reached = need('front', {});

export class Zoom extends Being.of({
  kind: 'org.example.zoom.steward',
  needs: { front: Front },
  asks: {
    arm: { for: 'root', hints: { idempotent: true } },
    enroll: { for: 'handle', args: s.object({ name: s.string() }), result: s.object({ door: s.handle() }) },
    doorOn: { for: 'being', hints: { idempotent: true }, args: s.object({ target: s.string() }), result: s.object({ invitation: s.invitation() }) },
  },
}) {
  // The face armed, and the shop a person zooms to borne.
  async arm() {
    this.powers!.bear({ kind: 'org.example.zoom.shop', id: 'shop' });
    await this.front.arm({ signup: this.handle('enroll') });
  }

  enroll({ name }: Args<Zoom, 'enroll'>) {
    const id = `person-${name}`;
    this.powers!.bear({ kind: 'org.example.zoom.person', id });
    return { door: this.powers!.invite({ id, occupant: 'browser' }) };
  }

  // A door on the target for the person who asks, one occupant of the target's per person.
  doorOn({ target }: Args<Zoom, 'doorOn'>) {
    return { invitation: this.powers!.invite({ id: target, occupant: `zoom-${this.asker.id}` }) };
  }
}

export class Person extends Being.of({
  kind: 'org.example.zoom.person',
  needs: { front: Reached },
  asks: {
    zoom: { args: s.object({ target: s.optional(s.string()) }), result: s.object({ door: s.handle() }) },
  },
}) {
  // The steward's invitation, carried unopened: its form is decided where the answer goes.
  async zoom({ target }: Args<Person, 'zoom'>) {
    const { invitation } = (await this.steward!.doorOn({ target: target ?? 'shop' })) as { invitation: unknown };
    return { door: invitation as never };
  }
}

export class Shop extends Being.of({
  kind: 'org.example.zoom.shop',
  needs: { front: Reached },
  asks: {
    hello: { hints: { readOnly: true }, result: s.string() },
  },
}) {
  hello() {
    return `hello, ${this.asker.id}`;
  }
}

export const steward = Zoom;
export const beings = [Person, Shop];
