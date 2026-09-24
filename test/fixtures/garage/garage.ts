// The garage door's twin, on the Pi's ground, and the remote on Alice's
// phone. The twin alone holds the relay; it keeps who opened the door and
// which pulse did it, and rings a bell when a pulse is answered. The
// remote holds a standing on the twin and taps it by an effect.
import { Being, need, s, type Args } from 'nervur/being';

/** The relay, as the Python program offers it: one pulse, answered with its count. */
export const Relay = need('relay', { pulse: { result: s.integer() } });

/** A bell the twin rings once a pulse is answered, so a test waits on it. */
export const Bell = need('bell', { ring: { args: s.object({ pulses: s.integer() }) } });

/** The twin, as the remote asks it. */
export const Door = need('garage', { open: {} });

export class Garage extends Being.of({
  kind: 'org.example.garage',
  description: 'The twin of a garage door: who opened it, and which pulse did.',
  needs: { relay: Relay, bell: Bell },
  cells: { openers: [] as string[], pulses: [] as number[], failed: [] as string[] },
  asks: {
    open: {},
    pulsed: { args: s.reply(Relay.pulse) },
    log: { hints: { readOnly: true }, result: s.object({ openers: s.array(s.string()), pulses: s.array(s.integer()), failed: s.array(s.string()) }) },
  },
}) {
  open() {
    this.cells.openers = [...this.cells.openers, this.asker.id];
    this.relay.pulse({}, { reply: 'pulsed' });
  }

  pulsed({ result, error }: Args<Garage, 'pulsed'>) {
    if (error === undefined) this.cells.pulses = [...this.cells.pulses, result];
    else this.cells.failed = [...this.cells.failed, error.message];
    this.bell.ring({ pulses: this.cells.pulses.length });
  }

  log() {
    return this.cells;
  }
}

export class Remote extends Being.of({
  kind: 'org.example.remote',
  description: 'A garage remote on a phone: one tap, one opening.',
  cells: { garage: '', heard: 0, failed: [] as string[] },
  asks: {
    accept: { args: s.object({ invitation: s.handle() }), hints: { idempotent: true } },
    tap: {},
    opened: { args: s.reply(Door.open) },
    heard: { hints: { readOnly: true }, result: s.integer() },
  },
}) {
  accept({ invitation }: Args<Remote, 'accept'>) {
    this.cells.garage = invitation;
  }

  tap() {
    this.held(this.cells.garage, Door).open({}, { reply: 'opened' });
  }

  opened({ error }: Args<Remote, 'opened'>) {
    if (error === undefined) this.cells.heard += 1;
    else this.cells.failed = [...this.cells.failed, error.message];
  }

  heard() {
    return this.cells.heard;
  }
}
