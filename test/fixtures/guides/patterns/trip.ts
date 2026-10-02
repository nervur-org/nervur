// patterns/trip.ts
import { Being, need, s, type Args } from 'nervur/being';

export const Hotel = need('hotel', {
  hold: { args: s.object({ trip: s.string() }) },
  release: { args: s.object({ trip: s.string() }) },
});

export const Flight = need('flight', {
  book: { args: s.object({ trip: s.string(), seats: s.integer() }) },
});

// A saga: each step is an effect, and a step that fails undoes the ones before it.
export class Trip extends Being.of({
  kind: 'org.example.trip',
  cells: { state: 'planning', seats: 0 },
  state: (me) => me.cells.state,
  asks: {
    book: { in: 'planning', for: 'root', to: 'holding', args: s.object({ seats: s.integer() }) },
    roomHeld: { in: 'holding', for: 'standing', args: s.reply(Hotel.hold), to: ['booking', 'planning'] },
    flown: { in: 'booking', for: 'standing', args: s.reply(Flight.book), to: ['booked', 'planning'] },
  },
}) {
  book({ seats }: Args<Trip, 'book'>) {
    this.cells.seats = seats;
    this.held('hotel', Hotel).hold({ trip: this.id }, { reply: 'roomHeld' });
    this.cells.state = 'holding';
  }

  roomHeld({ error }: Args<Trip, 'roomHeld'>) {
    if (error) {
      this.cells.state = 'planning';
      return;
    }
    this.held('flight', Flight).book({ trip: this.id, seats: this.cells.seats }, { reply: 'flown' });
    this.cells.state = 'booking';
  }

  flown({ error }: Args<Trip, 'flown'>) {
    if (error) {
      // The room is held and the flight is not: the saga lets the room go.
      this.held('hotel', Hotel).release({ trip: this.id });
      this.cells.state = 'planning';
      return;
    }
    this.cells.state = 'booked';
  }
}
