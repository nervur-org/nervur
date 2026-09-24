// SPDX-License-Identifier: Apache-2.0
// Classes from a plain list, each kind from the one class that declares it.
import { declarationOf } from '../being/being.ts';
import type { BeingClass, Classes } from '../foundation.ts';

export class ClassList implements Classes {
  readonly #kinds = new Map<string, BeingClass>();
  readonly #steward: string;
  readonly #public: string | undefined;

  constructor({ steward, public: open, beings = [] }: { steward: BeingClass; public?: BeingClass; beings?: readonly BeingClass[] }) {
    const kindOf = (Class: BeingClass) => {
      const kind = declarationOf(Class)?.kind;
      if (typeof kind !== 'string') throw new TypeError('a class in the list is not a class of Being.of');
      const held = this.#kinds.get(kind);
      if (held !== undefined && held !== Class) throw new TypeError(`two classes claim the kind ${kind}`);
      this.#kinds.set(kind, Class);
      return kind;
    };
    this.#steward = kindOf(steward);
    this.#public = open === undefined ? undefined : kindOf(open);
    for (const Class of beings) kindOf(Class);
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
