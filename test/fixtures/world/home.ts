// A person's own house: her avatar takes a door she carried home from a
// shop's face, and asks the shop through it.
import { Being, need, s, type Args } from 'nervur/being';
import { Steward } from './steward.ts';

/** The member she is at the shop, as her avatar asks her. */
const Membership = need('membership', {
  hello: { result: s.string(), readOnly: true },
  who: { result: s.string(), readOnly: true },
});

/** A shop's front door, as a stranger asks it: the door it hands back is taken as her standing. */
const Signup = need('signup', { signup: { idempotent: true, result: s.object({ invitation: s.handle() }) } });

/** A lobby's guestbook: a note is no idempotent ask, so she commits it. */
const Guestbook = need('guestbook', { note: { args: s.object({ text: s.string() }), result: s.integer() } });

export class Avatar extends Being.of({
  kind: 'org.example.avatar',
  cells: { shop: '', noted: 0 },
  asks: {
    // A note left at a lobby as a stranger, and the answer its house brings back.
    sign: { for: 'root', args: s.object({ ward: s.string(), at: s.array(s.string()) }) },
    noted: { for: 'house', args: s.reply(Guestbook.note) },
    heard: { for: 'root', readOnly: true, result: s.integer() },
    accept: { for: 'root', args: s.object({ invitation: s.handle() }), idempotent: true },
    greet: { for: 'root', idempotent: true, result: s.string() },
    // What the shop shows her, and any ask it shows, asked with no need declared for it.
    look: { for: 'root', idempotent: true, result: s.array(s.string()) },
    use: { for: 'root', idempotent: true, args: s.object({ method: s.string() }), result: s.string() },
    // Continue with Nervur: she signs up at a shop's lobby as a stranger, and holds the door it hands back.
    join: { for: 'root', idempotent: true, args: s.object({ ward: s.string(), at: s.array(s.string()) }), result: s.string() },
    whoAt: { for: 'root', idempotent: true, args: s.object({ standing: s.string() }), result: s.string() },
    // A lobby she declared no need for: what it shows a stranger, then its signup by name.
    browse: { for: 'root', idempotent: true, args: s.object({ ward: s.string(), at: s.array(s.string()) }), result: s.array(s.string()) },
    enter: { for: 'root', idempotent: true, args: s.object({ ward: s.string(), at: s.array(s.string()), method: s.string() }), result: s.string() },
  },
}) {
  sign({ ward, at }: Args<Avatar, 'sign'>) {
    this.stranger({ ward, at }, Guestbook).note({ text: 'was here' }, { reply: 'noted' });
  }

  noted({ result }: Args<Avatar, 'noted'>) {
    if (result !== undefined) this.cells.noted = result;
  }

  heard() {
    return this.cells.noted;
  }

  accept({ invitation }: Args<Avatar, 'accept'>) {
    this.cells.shop = invitation;
  }

  async greet() {
    const { result, error } = await this.held(this.cells.shop, Membership).hello({});
    if (error) this.fail(error.message);
    return result;
  }

  async join({ ward, at }: Args<Avatar, 'join'>) {
    const { result, error } = await this.stranger({ ward, at }, Signup).signup({});
    if (error) this.fail(error.message);
    this.cells.shop = result.invitation;
    return result.invitation;
  }

  async whoAt({ standing }: Args<Avatar, 'whoAt'>) {
    const { result, error } = await this.held(standing, Membership).who({});
    if (error) this.fail(error.message);
    return result;
  }

  async browse({ ward, at }: Args<Avatar, 'browse'>) {
    const { result, error } = await this.stranger({ ward, at }).describe();
    if (error) this.fail(error.message);
    return result.asks.map(({ method }) => method).sort();
  }

  async enter({ ward, at, method }: Args<Avatar, 'enter'>) {
    const lobby = this.stranger({ ward, at });
    await lobby.describe();
    // The lobby's describe says an invitation comes back, which she carries on and never keeps.
    const answered = await lobby.ask(method, {});
    if (answered === undefined) return 'sent';
    return answered.error ? `refused: ${answered.error.message}` : Object.keys(answered.result as Record<string, unknown>).join();
  }

  async look() {
    const { result, error } = await this.held(this.cells.shop).describe();
    if (error) this.fail(error.message);
    return result.asks.map(({ method }) => method).sort();
  }

  // An ask the describe marks idempotent is awaited, and any other leaves as an effect once she lands.
  async use({ method }: Args<Avatar, 'use'>) {
    const shop = this.held(this.cells.shop);
    await shop.describe();
    const answered = await shop.ask(method, {});
    if (answered === undefined) return JSON.stringify('sent');
    return answered.error ? `refused: ${answered.error.message}` : JSON.stringify(answered.result ?? 'sent');
  }
}

export const steward = Steward;
export const beings = [Avatar];
