// A garage read as the world paper reads it. The door's mirror stands on a
// station, where anyone granted may ask it to open. The door's twin stands
// on the Pi, which only dials: it watches the mirror as a reply, and
// pulses its relay once for each opening it hears.
import { Being, need, s, type Args } from 'nervur/being';
import { Steward } from './steward.ts';

/** The mirror, as the Pi's twin watches it. */
export const Openings = need('openings', {
  openings: { hints: { readOnly: true }, result: s.integer() },
});

/** The relay, as the Pi's ground offers it: one pulse, acted once for each call id. */
export const Relay = need('relay', { pulse: {} });

export class Mirror extends Being.of({
  kind: 'org.example.garage-mirror',
  description: 'The door as the family reaches it: every opening asked of it, counted.',
  cells: { openings: 0 },
  asks: {
    open: {},
    openings: { hints: { readOnly: true }, result: s.integer() },
  },
}) {
  open() {
    this.cells.openings += 1;
  }

  openings() {
    return this.cells.openings;
  }
}

export class Twin extends Being.of({
  kind: 'org.example.garage-twin',
  description: 'The door on the Pi: it hears the mirror, and pulses once for each opening.',
  needs: { relay: Relay },
  cells: { mirror: '', heard: 0 },
  asks: {
    accept: { for: 'root', args: s.object({ invitation: s.handle() }), hints: { idempotent: true } },
    watch: { for: 'root' },
    heard: { for: 'steward', args: s.reply(Openings.openings) },
  },
}) {
  accept({ invitation }: Args<Twin, 'accept'>) {
    this.cells.mirror = invitation;
  }

  watch() {
    this.held(this.cells.mirror, Openings).openings({}, { after: this.cells.heard, reply: 'heard' });
  }

  // What she heard lands, each opening she had not heard pulses once, and she watches again.
  heard({ result }: Args<Twin, 'heard'>) {
    if (result !== undefined) {
      for (let opening = this.cells.heard; opening < result; opening++) this.relay.pulse({});
      this.cells.heard = Math.max(this.cells.heard, result);
    }
    this.held(this.cells.mirror, Openings).openings({}, { after: this.cells.heard, reply: 'heard' });
  }
}

/** The relay's program, in the Pi's ground: it keeps each call id, so a pulse sent twice acts once. */
export class Pulses {
  readonly #seen = new Set<string>();
  #heard: (() => void)[] = [];

  get count(): number {
    return this.#seen.size;
  }

  pulse(_args: unknown, context: { id: string }) {
    if (!this.#seen.has(context.id)) {
      this.#seen.add(context.id);
      for (const told of this.#heard) told();
    }
    return Promise.resolve({ result: null });
  }

  /** Settles once the relay has pulsed `count` times. */
  reached(count: number): Promise<void> {
    return new Promise((resolve) => {
      const told = () => {
        if (this.count < count) return;
        this.#heard = this.#heard.filter((one) => one !== told);
        resolve();
      };
      this.#heard.push(told);
      told();
    });
  }
}

export const station = { steward: Steward, beings: [Mirror] };
export const outpost = { steward: Steward, beings: [Twin] };
