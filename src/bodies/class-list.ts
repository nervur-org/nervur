// SPDX-License-Identifier: Apache-2.0
// Classes from a plain list, each kind from the one class that declares it,
// or from the modules a source names, loaded where the house runs.
import { declarationOf } from '../being/being.ts';
import type { BeingClass, Classes, ClassesSource } from '../foundation.ts';

/** What loads a module by its URL: the engine's `import()` where none is handed. */
export type Load = (href: string) => Promise<unknown>;

const kindOf = (value: unknown): string | undefined => (typeof value === 'function' ? declarationOf(value)?.kind : undefined);

export class ClassList implements Classes {
  readonly #kinds = new Map<string, BeingClass>();
  readonly #steward: string;
  readonly #public: string | undefined;

  constructor({ steward, public: open, beings = [] }: { steward: BeingClass; public?: BeingClass; beings?: readonly BeingClass[] }) {
    const listed = (Class: BeingClass) => {
      const kind = declarationOf(Class)?.kind;
      if (typeof kind !== 'string') throw new TypeError('a class in the list is not a class of Being.of');
      const held = this.#kinds.get(kind);
      if (held !== undefined && held !== Class) throw new TypeError(`two classes claim the kind ${kind}`);
      this.#kinds.set(kind, Class);
      return kind;
    };
    this.#steward = listed(steward);
    this.#public = open === undefined ? undefined : listed(open);
    for (const Class of beings) listed(Class);
  }

  /**
   * The classes a source names, each module loaded once: every class of
   * `Being.of` it exports, the steward and the public being by the kinds
   * the source names, or as the first module exporting each names them.
   */
  static async load(source: ClassesSource, load: Load = (href) => import(href)): Promise<ClassList> {
    const { found, steward, open } = await ClassList.#read(source, load);
    const named = (kind: string) => {
      const Class = found.find((one) => kindOf(one) === kind);
      if (Class === undefined) throw new Error(`the modules export no class of the kind ${kind}`);
      return Class;
    };
    const chosenSteward = source.steward === undefined ? steward : named(source.steward);
    if (kindOf(chosenSteward) === undefined) throw new Error(`${source.modules[0] ?? 'no module'} exports no steward`);
    const chosenPublic = source.public === undefined ? open : named(source.public);
    return new ClassList({ steward: chosenSteward as BeingClass, ...(kindOf(chosenPublic) === undefined ? {} : { public: chosenPublic as BeingClass }), beings: found });
  }

  /** Every class of `Being.of` the modules a source names export, each once, with no steward chosen: the dock joins them to its own. */
  static async found(source: ClassesSource, load: Load = (href) => import(href)): Promise<readonly BeingClass[]> {
    return [...new Set((await ClassList.#read(source, load)).found)];
  }

  static async #read(source: ClassesSource, load: Load): Promise<{ found: BeingClass[]; steward: unknown; open: unknown }> {
    const found: BeingClass[] = [];
    let steward: unknown;
    let open: unknown;
    for (const href of source.modules) {
      const module = (await load(href)) as Record<string, unknown>;
      const beings = module.beings;
      if (beings !== undefined && !Array.isArray(beings)) throw new Error(`${href} exports beings that are not a list`);
      for (const value of [...Object.values(module), ...((beings as unknown[] | undefined) ?? [])]) if (kindOf(value) !== undefined) found.push(value as BeingClass);
      steward ??= module.steward;
      open ??= module.public;
    }
    return { found, steward, open };
  }

  /** Every class the list holds, each once. */
  list(): readonly BeingClass[] {
    return [...new Set(this.#kinds.values())];
  }

  async resolve({ kind }: { kind: string }): Promise<BeingClass | undefined> {
    return this.#kinds.get(kind);
  }

  steward(): string {
    return this.#steward;
  }

  public(): string | undefined {
    return this.#public;
  }
}
