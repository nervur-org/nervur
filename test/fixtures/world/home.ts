// A person's own house: her avatar takes a door she carried home from a
// shop's face, and asks the shop through it.
import { Being, need, s, type Args } from 'nervur/being';
import { Steward } from './steward.ts';

/** The member she is at the shop, as her avatar asks her. */
const Membership = need('membership', {
  hello: { result: s.string(), hints: { readOnly: true } },
  who: { result: s.string(), hints: { readOnly: true } },
});

/** A shop's front door, as a stranger asks it: the door it hands back is taken as her standing. */
const Signup = need('signup', { signup: { hints: { idempotent: true }, result: s.object({ invitation: s.handle() }) } });

export class Avatar extends Being.of({
  kind: 'org.example.avatar',
  cells: { shop: '' },
  asks: {
    accept: { for: 'root', args: s.object({ invitation: s.handle() }), hints: { idempotent: true } },
    greet: { for: 'root', hints: { idempotent: true }, result: s.string() },
    // What the shop shows her, and any ask it shows, asked with no need declared for it.
    look: { for: 'root', hints: { idempotent: true }, result: s.array(s.string()) },
    use: { for: 'root', hints: { idempotent: true }, args: s.object({ method: s.string() }), result: s.string() },
    // Continue with Nervur: she signs up at a shop's lobby as a stranger, and holds the door it hands back.
    join: { for: 'root', hints: { idempotent: true }, args: s.object({ ward: s.string(), at: s.array(s.string()) }), result: s.string() },
    whoAt: { for: 'root', hints: { idempotent: true }, args: s.object({ standing: s.string() }), result: s.string() },
    // A lobby she declared no need for: what it shows a stranger, then its signup by name.
    browse: { for: 'root', hints: { idempotent: true }, args: s.object({ ward: s.string(), at: s.array(s.string()) }), result: s.array(s.string()) },
    enter: { for: 'root', hints: { idempotent: true }, args: s.object({ ward: s.string(), at: s.array(s.string()), method: s.string() }), result: s.string() },
  },
}) {
  accept({ invitation }: Args<Avatar, 'accept'>) {
    this.cells.shop = invitation;
  }

  greet() {
    return this.held(this.cells.shop, Membership).hello({});
  }

  async join({ ward, at }: Args<Avatar, 'join'>) {
    const { invitation } = await this.stranger({ ward, at }, Signup).signup({});
    this.cells.shop = invitation;
    return invitation;
  }

  whoAt({ standing }: Args<Avatar, 'whoAt'>) {
    return this.held(standing, Membership).who({});
  }

  async browse({ ward, at }: Args<Avatar, 'browse'>) {
    const { asks } = await this.stranger({ ward, at }).describe();
    return asks.map(({ method }) => method).sort();
  }

  async enter({ ward, at, method }: Args<Avatar, 'enter'>) {
    const lobby = this.stranger({ ward, at });
    await lobby.describe();
    try {
      // The lobby's describe says an invitation comes back, which she carries on and never keeps.
      const answered = (await lobby.ask(method, {})) as Record<string, unknown>;
      return Object.keys(answered).join();
    } catch (error) {
      return `refused: ${(error as Error).message}`;
    }
  }

  async look() {
    const { asks } = await this.held(this.cells.shop).describe();
    return asks.map(({ method }) => method).sort();
  }

  // An ask the describe marks idempotent is awaited, and any other leaves as an effect once she lands.
  async use({ method }: Args<Avatar, 'use'>) {
    const shop = this.held(this.cells.shop);
    await shop.describe();
    try {
      return JSON.stringify((await shop.ask(method, {})) ?? 'sent');
    } catch (error) {
      return `refused: ${(error as Error).message}`;
    }
  }
}

export const steward = Steward;
export const beings = [Avatar];
