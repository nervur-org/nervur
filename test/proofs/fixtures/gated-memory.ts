// A memory whose writes touching a held place wait until the test lets
// them through, so a test sees what lands while one write is held.
import type { Memory } from 'nervur';
import { FakeMemory } from 'nervur/bench';

type Write = Parameters<Memory['write']>[0];

export class GatedMemory extends FakeMemory {
  readonly #held = new Set<string>();
  readonly #waiting: (() => void)[] = [];

  /** Writes touching this place wait from now on. */
  hold(place: string): void {
    this.#held.add(place);
  }

  /** Every held write goes through, and no place is held after. */
  release(): void {
    this.#held.clear();
    for (const go of this.#waiting.splice(0)) go();
  }

  override async write(options: Write): ReturnType<Memory['write']> {
    if (Object.keys(options.writes).some((place) => this.#held.has(place))) await new Promise<void>((go) => this.#waiting.push(go));
    return super.write(options);
  }
}
