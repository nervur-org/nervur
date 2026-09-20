// SPDX-License-Identifier: Apache-2.0
// The default memory faculty: places of the terrain's own memory under the
// faculty's key, so a memory faculty stands wherever a harbor does. Its
// places are the package's, behind the hex of the faculty's key, so two
// memory faculties and the root never meet in one place.
import { ships, type Stance } from '../../core/being/index.ts';
import type { Memory } from '../../core/contract/index.ts';
import { hex, utf8 } from '../../core/crypto/index.ts';
import { groundOf, MemoryFaculty } from '../../core/harbor/index.ts';

// A place of the package is thirty-two hex digits.
const PLACE = 32;

export class GroundMemory extends MemoryFaculty {
  static override readonly kind: string = 'org.nervur.ground-memory';
  static {
    ships(this);
  }

  readonly #memory: Memory;

  constructor(stance: Stance) {
    super(stance);
    this.#memory = groundOf(stance).terrain.memory;
  }

  get #prefix(): string {
    return hex(utf8(this.stance.key));
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
