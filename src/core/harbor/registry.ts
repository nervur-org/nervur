// SPDX-License-Identifier: Apache-2.0
// The catalogue's index: every kind the harbor runs, from the kit's own
// classes and the modules the catalogue loaded. It resolves a kind a row
// keeps, and decides nothing about what stands. It refuses any set of
// modules two readings could split:
//
//   a module whose name is no kind, or is the kit's, or two of one name
//   a class with no kind of its own, or one outside its module's domain
//   two classes of one kind, or one kind in two modules
//   a contract with no kind of its own, or one kind for two contracts
//   a class above a module's class of a kit kind that the kit does not ship
//   a kind that is a class and a contract
//
// A module's domain is its name's first two segments: `com.acme.shop`
// stands classes under `com.acme.` alone. A contract may be any domain's,
// so a faculty fulfils a contract another module declares. A module's
// class may extend any class or contract the kit ships, and never declares
// one of a kit kind itself. Two harbors hold two registries, and nothing
// between them names a class.
import { Faculty, isKind, KIT, kindOf, ownKind, shipped, ships, type BeingClass } from '../being/index.ts';
import type { Module } from '../contract/index.ts';

const domainOf = (name: string): string => `${name.split('.').slice(0, 2).join('.')}.`;

export const REGISTRY = 'org.nervur.registry';

// The registry faculty: a faculty of the box ward that resolves the kind a
// row keeps to a class. The catalogue is the core's, and resolves through
// the DNA. Any other is an owner's, stood by the registry named on its row,
// and each being of the box, and each hosted ward whole, names the registry
// its classes come from.
export abstract class RegistryFaculty extends Faculty {
  static override readonly kind: string = REGISTRY;
  static {
    ships(this);
  }
  abstract classOf(kind: string): BeingClass | undefined;
}

// Whether a class is a registry faculty's.
export const registers = (C: unknown): C is typeof RegistryFaculty => typeof C === 'function' && C.prototype instanceof RegistryFaculty;

export class Registry {
  readonly #classes = new Map<string, BeingClass>();
  readonly #modules = new Map<string, string[]>();

  // `kit` holds the kit's own classes, which alone may be of its kinds.
  constructor(kit: readonly BeingClass[], modules: readonly Module[]) {
    const contracts = new Map<string, unknown>();
    const owners = new Map<string, string>();
    const add = (C: BeingClass, kind: string): void => {
      if (this.#classes.has(kind) && this.#classes.get(kind) !== C) throw new Error(`two classes are of kind ${kind}`);
      this.#classes.set(kind, C);
    };
    for (const C of kit) add(C, kindOf(C));
    for (const m of modules) {
      if (!isKind(m.module) || m.module.startsWith(KIT)) throw new Error(`module ${String(m.module)} is no name a module may take`);
      if (this.#modules.has(m.module)) throw new Error(`two modules are named ${m.module}`);
      if (typeof m.version !== 'string' || m.version === '') throw new Error(`module ${m.module} declares no version`);
      const kinds: string[] = [];
      for (const C of m.classes) {
        if (typeof C !== 'function') throw new Error(`module ${m.module} holds something that is no class`);
        const kind = kindOf(C);
        if (!kind.startsWith(domainOf(m.module))) throw new Error(`kind ${kind} is outside module ${m.module}`);
        const owner = owners.get(kind);
        if (owner !== undefined && owner !== m.module) throw new Error(`kind ${kind} is in modules ${owner} and ${m.module}`);
        owners.set(kind, m.module);
        add(C as BeingClass, kind);
        kinds.push(kind);
        for (let c: unknown = Object.getPrototypeOf(C); typeof c === 'function'; c = Object.getPrototypeOf(c)) {
          if (ownKind(c)?.startsWith(KIT) && !shipped(c)) throw new Error(`kind ${ownKind(c)!} is the kit's`);
        }
        if (!Faculty.fulfils(C)) continue;
        for (let c: unknown = Object.getPrototypeOf(C); c !== Faculty; c = Object.getPrototypeOf(c)) {
          const contract = kindOf(c);
          if (shipped(c)) continue;
          if (contracts.has(contract) && contracts.get(contract) !== c) throw new Error(`two contracts are of kind ${contract}`);
          contracts.set(contract, c);
        }
      }
      this.#modules.set(m.module, kinds);
    }
    for (const kind of contracts.keys()) {
      if (this.#classes.has(kind)) throw new Error(`kind ${kind} is a class and a contract`);
    }
  }

  // Why a registry of these modules would be refused, or null.
  static refusal(kit: readonly BeingClass[], modules: readonly Module[]): string | null {
    try {
      const registry = new Registry(kit, modules);
      void registry;
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  classOf(kind: string): BeingClass | undefined {
    return this.#classes.get(kind);
  }

  // The kinds a module stands, or none.
  kindsOf(module: string): string[] {
    return [...(this.#modules.get(module) ?? [])];
  }
}
