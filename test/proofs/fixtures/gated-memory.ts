// A memory whose writes touching a held place wait until the test lets
// them through, so a test sees what lands while one write is held. One
// read can be held too, answering late what it took early.
import type { Memory } from 'nervur';
import { FakeMemory } from '../../../src/bench/fake-memory.ts';

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

  #lateRead: { place: string; go?: () => void; stalled?: () => void } | undefined;

  /** The next read of this place takes what stands, then waits to answer until `answerRead`. Resolves once it waits. */
  holdNextRead(place: string): Promise<void> {
    return new Promise((stalled) => (this.#lateRead = { place, stalled }));
  }

  /** The held read answers what it took, however old it is by now. */
  answerRead(): void {
    this.#lateRead?.go?.();
    this.#lateRead = undefined;
  }

  override async read(options: { place: string }): ReturnType<Memory['read']> {
    const read = await super.read(options);
    const late = this.#lateRead;
    if (late?.place === options.place && late.go === undefined) {
      await new Promise<void>((go) => {
        late.go = go;
        late.stalled?.();
      });
    }
    return read;
  }

  override async write(options: Write): ReturnType<Memory['write']> {
    if (Object.keys(options.writes).some((place) => this.#held.has(place))) await new Promise<void>((go) => this.#waiting.push(go));
    return super.write(options);
  }
}
