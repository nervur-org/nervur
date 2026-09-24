// SPDX-License-Identifier: Apache-2.0
// Several carries as one, each named by the scheme of the addresses it
// speaks. An address goes to the carry of its scheme, one at a time, in the
// order given. A box that may have been heard goes to no second address,
// whichever carry it would take. The invitation names every carry's
// addresses, in the order the carries are named.
import type { Carry, Sent } from '../foundation.ts';

interface Listening {
  listen(options: { ward: string; door: (box: Uint8Array) => Promise<Uint8Array | null> }): void | Promise<void>;
  unlisten(options: { ward: string }): void;
}

export class JoinedCarry implements Carry {
  readonly #carries: ReadonlyMap<string, Carry>;
  // Each carry once, where one serves two schemes, as the web serves http and https.
  readonly #each: readonly Carry[];

  /** `carries` by scheme: `{ tcp: tcpCarry, https: webCarry }`. */
  constructor(carries: Readonly<Record<string, Carry>>) {
    this.#carries = new Map(Object.entries(carries));
    this.#each = [...new Set(this.#carries.values())];
  }

  /** A ward's door, hooked to every carry here that listens. */
  async listen(options: { ward: string; door: (box: Uint8Array) => Promise<Uint8Array | null> }): Promise<void> {
    for (const carry of this.#each) await (carry as Partial<Listening>).listen?.(options);
  }

  /** A ward unhooked from every carry here that listens. */
  unlisten(options: { ward: string }): void {
    for (const carry of this.#each) (carry as Partial<Listening>).unlisten?.(options);
  }

  async send({ ward, at, box }: { ward: string; at: readonly string[]; box: Uint8Array }): Promise<Sent> {
    // A carry that listens for the ward hands it the box by pointer, and no address is dialled.
    for (const carry of this.#each) {
      const sent = await carry.send({ ward, at: [], box });
      if (sent.reply !== null) return sent;
    }
    for (const address of at) {
      // A scheme is read in any case, as a URI's is.
      const scheme = address.slice(0, Math.max(0, address.indexOf('://'))).toLowerCase();
      const carry = this.#carries.get(scheme);
      if (carry === undefined) continue;
      const sent = await carry.send({ ward, at: [address], box });
      if (sent.reply !== null || sent.heard) return sent;
    }
    return { reply: null, heard: false };
  }

  at(options: { toward?: string } = {}): readonly string[] {
    return this.#each.flatMap((carry) => carry.at(options));
  }
}
