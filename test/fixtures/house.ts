// A house module as a test composes one from the fixtures: the modules its
// classes stand in, which load in the house's own runner, and its steward
// and public being by class.
import type { ClassesSource } from 'nervur';
import { tableOf } from 'nervur/being';

type BeingClass = Parameters<typeof tableOf>[0];

/** A module of the world's fixtures, by its name. */
export const world = (name: string): URL => new URL(`./world/${name}.ts`, import.meta.url);

/** A house of every class the modules export, its steward and its public being the ones named. */
export const house = (steward: BeingClass, modules: readonly URL[], { public: open }: { public?: BeingClass } = {}): ClassesSource => ({
  modules: modules.map((module) => module.href),
  steward: tableOf(steward).kind,
  ...(open === undefined ? {} : { public: tableOf(open).kind }),
});
