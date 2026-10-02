// The relay as one contained faculty: what its entry hands it, what it
// needs of the Pi, its version, the stand-in a bench raises in its place,
// and the examples the relay and its stand-in both answer. The ground
// meets its need through an installer its entry names, then raises it.
import { fileURLToPath } from 'node:url';
import { Faculty, OK, type FacultyContext, type Status } from 'nervur';
import { s, type Json } from 'nervur/being';
import { bridge } from 'nervur/node';
import { Relay } from './garage.ts';

const program = fileURLToPath(new URL('./relay.py', import.meta.url));

/** The bench's relay: the same blueprint, a count kept in the process, no pin and no Python. */
export class FakeRelay extends Faculty {
  static override readonly blueprint = Relay;
  readonly #seen = new Map<string, number>();

  async pulse(_args: Json, { id }: FacultyContext) {
    if (!this.#seen.has(id)) this.#seen.set(id, this.#seen.size + 1);
    return { result: this.#seen.get(id)! };
  }
}

/** The relay: the Python program behind the bridge, started at its `up` and stopped at its `down`. */
export class RelayFaculty extends Faculty {
  static override readonly blueprint = Relay;
  static override readonly takes = { args: s.object({ folder: s.string() }) };
  static override readonly needs = { packages: { apt: 'python3', brew: 'python' } };
  static override readonly version = '1';
  static override readonly fake = FakeRelay;
  // A pulse answers its count, and a call id sent again answers the count it gave.
  static override readonly examples = [
    { method: 'pulse', id: 'one', gives: { result: 1 } },
    { method: 'pulse', id: 'two', gives: { result: 2 } },
  ];
  #program: { pulse(args: Json, context: FacultyContext): Promise<unknown>; stop(): unknown } | undefined;

  override async up(): Promise<Status> {
    const { object, down } = await bridge({ command: 'python3', args: [program], cwd: this.made.args.folder as string, memory: this.made.memory });
    this.#program = { pulse: (object as { pulse: (args: Json, context: FacultyContext) => Promise<unknown> }).pulse, stop: () => down?.() };
    return OK;
  }

  pulse(args: Json, context: FacultyContext): Promise<unknown> {
    return this.#program!.pulse(args, context);
  }

  override async down(): Promise<void> {
    await this.#program?.stop();
  }
}
