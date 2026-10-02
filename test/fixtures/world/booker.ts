// A booking and the one who plans around it, in two houses. The booker
// hands a door to move one booking, its `what` bound. The planner takes
// the door, reads what it shows, and moves the booking by its date alone.
import { Being, s, type Args } from 'nervur/being';
import { house, world } from '../house.ts';
import { Steward } from './steward.ts';

export class Booker extends Being.of({
  kind: 'org.example.booker',
  cells: { bookings: [] as { what: string; date: string }[] },
  asks: {
    book: { for: 'root', args: s.object({ what: s.string(), date: s.string() }), result: s.object({ door: s.handle() }) },
    move: { for: 'handle', args: s.object({ what: s.string(), date: s.string() }) },
    bookings: { for: 'root', readOnly: true, result: s.array(s.string()) },
  },
}) {
  book({ what, date }: Args<Booker, 'book'>) {
    this.cells.bookings = [...this.cells.bookings, { what, date }];
    return { door: this.handle('move', { bind: { what } }) };
  }

  move({ what, date }: Args<Booker, 'move'>) {
    this.cells.bookings = this.cells.bookings.map((one) => (one.what === what ? { what, date } : one));
  }

  bookings() {
    return this.cells.bookings.map(({ what, date }) => `${what}@${date}`);
  }
}

export class Planner extends Being.of({
  kind: 'org.example.planner',
  cells: { booking: '' },
  asks: {
    take: { for: 'root', idempotent: true, args: s.object({ booking: s.handle() }) },
    // What the door shows her of `move`: the args she sends.
    shows: { for: 'root', idempotent: true, result: s.array(s.string()) },
    move: { for: 'root', args: s.object({ date: s.string() }) },
    // A door taken and asked in one ask.
    takeAndMove: { for: 'root', args: s.object({ booking: s.handle(), date: s.string() }) },
  },
}) {
  take({ booking }: Args<Planner, 'take'>) {
    this.cells.booking = booking;
  }

  async shows() {
    const { result, error } = await this.held(this.cells.booking).describe();
    if (error) this.fail(error.message);
    const args = result.asks.find(({ method }) => method === 'move')?.args as { properties: Record<string, unknown>; required: string[] };
    return [...Object.keys(args.properties), ...args.required.map((key) => `${key}!`)];
  }

  move({ date }: Args<Planner, 'move'>) {
    return this.#move(this.cells.booking, date);
  }

  takeAndMove({ booking, date }: Args<Planner, 'takeAndMove'>) {
    this.cells.booking = booking;
    return this.#move(booking, date);
  }

  async #move(booking: string, date: string) {
    const door = this.held(booking);
    const { error } = await door.describe();
    if (error) this.fail(error.message);
    const moved = await door.ask('move', { date });
    if (moved?.error) this.fail(moved.error.message);
  }
}

// The shop and the home each load this module, which holds the booker and the planner, beside the steward.
export const shop = house(Steward, [world('steward'), world('booker')]);
export const home = shop;
