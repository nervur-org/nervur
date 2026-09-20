// SPDX-License-Identifier: Apache-2.0
// The classes the core's suites stand every harbor on: a dock, a ward, a
// memory faculty and a carrier written for these suites and named by no
// default, so what the core's suites prove is the core. Each fulfils its
// contract in the plainest way that contract allows, and adds nothing.
import { Dock, groundOf, CarrierFaculty, MemoryFaculty, ownerAsk, Ward, type AskSpec, type Defaults, type Dialed, type JsonObject, type Memory, type Stance } from '../../src/core.ts';
import { hex, utf8 } from '../../src/core/crypto/index.ts';

// The dock the box ward takes at genesis, and whenever hers does not stand.
export class TestDock extends Dock {
  static override readonly kind: string = 'org.example.test-dock';
}

// The ward a hosted ward takes where none is named.
export class TestWard extends Ward {
  static override readonly kind: string = 'org.example.test-ward';
}

// A place of the package is thirty-two hex digits.
const PLACE = 32;

// Places of the terrain's own memory behind the hex of `test:` and the
// faculty's key, so it survives a restart as the terrain's memory does,
// and never meets the root's places or another memory faculty's.
export class TestMemory extends MemoryFaculty {
  static override readonly kind: string = 'org.example.test-memory';
  readonly #memory: Memory;

  constructor(stance: Stance) {
    super(stance);
    this.#memory = groundOf(stance).terrain.memory;
  }

  get #prefix(): string {
    return hex(utf8(`test:${this.stance.key}`));
  }

  override occupies(place: string): boolean {
    return place.length === this.#prefix.length + PLACE && place.startsWith(this.#prefix);
  }

  read(place: string): Promise<Map<string, Uint8Array>> {
    return this.#memory.read(this.#prefix + place);
  }

  write(place: string, entries: ReadonlyMap<string, Uint8Array | null>): Promise<void> {
    return this.#memory.write(this.#prefix + place, entries);
  }

  async places(): Promise<string[]> {
    return (await this.#memory.places()).filter((place) => this.occupies(place)).map((place) => place.slice(this.#prefix.length));
  }

  forget(place: string): Promise<void> {
    return this.#memory.forget(this.#prefix + place);
  }
}

// A carrier of `test:` addresses over the terrain's own carrier, which in
// the pointer world finds any harbor of the world by pk. It listens where
// its cells say, which is only a name to hand in an invitation's `at`.
export class TestCarrier extends CarrierFaculty {
  static override readonly kind: string = 'org.example.test-carrier';
  static override asks: Record<string, AskSpec> = {
    listen: ownerAsk('listen at a test address', { required: ['at'] }),
  };

  accepts(address: string): boolean {
    return address.startsWith('test://');
  }

  async dial(_address: string, pk: string, bytes: Uint8Array): Promise<Dialed> {
    return groundOf(this.stance).terrain.carrier.carry(pk, bytes);
  }

  override listening(): string[] {
    return typeof this.cells.at === 'string' ? [this.cells.at] : [];
  }

  listen(args: JsonObject): JsonObject {
    if (typeof args.at !== 'string' || !this.accepts(args.at)) return { error: 'at is a test address' };
    this.cells.at = args.at;
    return { at: args.at };
  }
}

// What every harbor of the core's suites runs.
export const TEST: Defaults = { dock: TestDock, ward: TestWard, classes: [TestMemory, TestCarrier] };
