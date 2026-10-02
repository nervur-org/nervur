// A faculty a test writes in one line: the blueprint it offers, and the
// object its `up` opens, whose every method the body answers with. A
// hand-written ground fills its foundation so, and a test hands a body
// living so. Its parts, where it has them, are set at `up` too.
import { Faculty, OK, type FacultyClass, type ForHouse, type Made, type OpenedContext, type Status } from 'nervur';
import type { Handler } from 'nervur';

/** The parts a body carries beside its object, and what it lets go of. */
export interface Parts {
  readonly schemes?: readonly string[];
  readonly handler?: Handler;
  readonly window?: number;
  readonly takes?: FacultyClass['takes'];
  house?(options: ForHouse): unknown;
  opened?(context: OpenedContext): void | Promise<void>;
  down?(): void | Promise<void>;
}

// Every method an object holds, its own and its class's, bound to it, set on a body that has none of that name.
const forward = (body: Faculty, object: object): void => {
  for (let at: object | null = object; at !== null && at !== Object.prototype; at = Object.getPrototypeOf(at) as object | null) {
    for (const name of Object.getOwnPropertyNames(at)) {
      const value = (object as Record<string, unknown>)[name];
      if (name !== 'constructor' && typeof value === 'function' && !(name in body)) (body as unknown as Record<string, unknown>)[name] = (value as (...args: unknown[]) => unknown).bind(object);
    }
  }
};

/** A faculty offering `blueprint`, whose body answers with the object `open` answers at its `up`. */
export const serving = (blueprint: unknown, open: (made: Made) => object | Promise<object> = () => ({}), parts: Parts = {}): FacultyClass =>
  class Serving extends Faculty {
    static override readonly blueprint = blueprint;
    static override readonly takes = parts.takes;
    static override readonly window = parts.window;
    override async up(): Promise<Status> {
      const object = await open(this.made);
      forward(this, object);
      if (parts.schemes !== undefined) this.schemes = parts.schemes;
      // A handler the object holds joins the ground's listener, as one its parts name does.
      const held = (object as { handler?: Handler }).handler;
      if (parts.handler !== undefined || held !== undefined) this.handler = parts.handler ?? held;
      if (parts.house !== undefined) this.house = parts.house;
      if (parts.opened !== undefined) this.opened = parts.opened;
      return OK;
    }
    override async down(): Promise<void> {
      await parts.down?.();
    }
  };
