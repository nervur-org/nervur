// A faculty the test writes in a few lines and breaks on purpose. Each
// method answers what the test gives it; the next calls may throw, which is
// a failure to answer and tried again, refuse with an error, which is
// final, or never answer. Every call is kept, with its call id.
import type { Faculty, FacultyContext } from 'nervur';
import type { Json } from 'nervur/being';

type Method = (args: Json) => Json | Promise<Json>;

/** One call the faculty received. */
export interface Called {
  readonly method: string;
  readonly args: Json;
  readonly id: string;
}

export class FakeFaculty {
  /** Every call, in the order it came, repeats of one call id among them. */
  readonly calls: Called[] = [];
  readonly #blueprint: unknown;
  readonly #methods: Readonly<Record<string, Method>>;
  #throw = 0;
  #refuse: string[] = [];
  #hang = 0;

  /** `blueprint` is a need or a blueprint; `methods` answer each method's args with its result. */
  constructor(blueprint: unknown, methods: Readonly<Record<string, Method>>) {
    this.#blueprint = blueprint;
    this.#methods = methods;
  }

  /** The next `count` calls throw, as a crash does. */
  throwNext(count = 1): void {
    this.#throw += count;
  }

  /** The next call answers `{ error: { message } }`, which is final. */
  refuseNext(message: string): void {
    this.#refuse.push(message);
  }

  /** The next `count` calls never answer. */
  hangNext(count = 1): void {
    this.#hang += count;
  }

  /** The offer a ground hands: the blueprint, and an object whose methods take args and a context. */
  get offer(): Faculty {
    const object = Object.fromEntries(
      Object.entries(this.#methods).map(([method, answer]) => [
        method,
        async (args: Json, context: FacultyContext) => {
          this.calls.push({ method, args, id: context.id });
          if (this.#hang > 0) {
            this.#hang--;
            return new Promise<never>(() => undefined);
          }
          if (this.#throw > 0) {
            this.#throw--;
            throw new Error('the fake faculty crashed');
          }
          const refused = this.#refuse.shift();
          if (refused !== undefined) return { error: { message: refused } };
          return { result: await answer(args) };
        },
      ]),
    );
    return { blueprint: this.#blueprint, object };
  }
}
