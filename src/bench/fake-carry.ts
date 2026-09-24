// SPDX-License-Identifier: Apache-2.0
// A carry in the process: every door on one network, each at an address of
// its own. A test may lose replies, as a network does.
import type { Carry, Sent } from '../foundation.ts';

export type Door = (box: Uint8Array) => Promise<Uint8Array | null>;

export class FakeCarry implements Carry {
  readonly #network: Map<string, Door>;
  readonly #address: string;
  readonly #at: readonly string[] | undefined;
  /** The next `lose` replies are lost after the far door answered. */
  lose = 0;
  /** Every address a box was carried to, in order. */
  readonly tried: string[] = [];

  /** `at` names the addresses written into invitations, as a ground names its own; omitted, the one it listens at. */
  constructor({ network, address, at }: { network: Map<string, Door>; address: string; at?: readonly string[] }) {
    this.#network = network;
    this.#address = address;
    this.#at = at;
  }

  readonly #doors = new Map<string, Door>();

  /** A house's door answers at this carry's address, and by pointer to whoever sends through this carry. */
  listen({ ward, door }: { ward: string; door: Door }): void {
    this.#doors.set(ward, door);
    this.#network.set(this.#address, door);
  }

  /** A ward this carry answers no more, by pointer or at its address. */
  unlisten({ ward }: { ward: string }): void {
    const door = this.#doors.get(ward);
    this.#doors.delete(ward);
    if (door !== undefined && this.#network.get(this.#address) === door) this.#network.delete(this.#address);
  }

  async send({ ward, at, box }: { ward: string; at: readonly string[]; box: Uint8Array }): Promise<Sent> {
    const held = this.#doors.get(ward);
    if (held !== undefined) {
      const reply = await held(box);
      if (reply !== null) return { reply };
    }
    for (const address of at) {
      const door = this.#network.get(address);
      if (door === undefined) continue;
      this.tried.push(address);
      const reply = await door(box);
      // A reply lost after the door answered was heard, so no other address is tried.
      if (this.lose > 0) {
        this.lose--;
        return { reply: null, heard: true };
      }
      // A door that gives nothing was not delivered to, so the next address may be.
      if (reply === null) continue;
      return { reply, via: address };
    }
    return { reply: null, heard: false };
  }

  at(_options: { toward?: string } = {}): readonly string[] {
    return this.#at ?? [this.#address];
  }
}
