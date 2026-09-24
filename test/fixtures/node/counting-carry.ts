// A carry a hand-written ground hooks its doors to, which counts every send
// and every box each listener's door takes: how a test tells whether an
// ask ever left the process, and which listener heard it.
import type { Carry, Hooked, Sent } from 'nervur';

type Door = Parameters<Hooked['listen']>[0]['door'];

/** A listener a door is hooked to by its ward. */
interface Listening {
  listen(options: { ward: string; door: Door }): void | Promise<void>;
  unlisten(options: { ward: string }): void;
}

export class CountingCarry implements Hooked {
  readonly #sending: Carry;
  readonly #listeners: Readonly<Record<string, Listening>>;
  #sends = 0;
  /** The boxes each listener's doors took, by the listener's name. */
  readonly heard: Record<string, number>;

  /** `sending` carries every box out; each of `listeners` takes every door, counted under its name. */
  constructor(sending: Carry, listeners: Readonly<Record<string, Listening>>) {
    this.#sending = sending;
    this.#listeners = listeners;
    this.heard = Object.fromEntries(Object.keys(listeners).map((name) => [name, 0]));
  }

  get sends(): number {
    return this.#sends;
  }

  async listen({ ward, door }: { ward: string; door: Door }): Promise<void> {
    for (const [name, listener] of Object.entries(this.#listeners)) {
      await listener.listen({
        ward,
        door: (box) => {
          this.heard[name] += 1;
          return door(box);
        },
      });
    }
  }

  unlisten({ ward }: { ward: string }): void {
    for (const listener of Object.values(this.#listeners)) listener.unlisten({ ward });
  }

  send(options: { ward: string; at: readonly string[]; box: Uint8Array }): Promise<Sent> {
    this.#sends += 1;
    return this.#sending.send(options);
  }

  at(options: { toward?: string } = {}): readonly string[] {
    return this.#sending.at(options);
  }
}
