// SPDX-License-Identifier: Apache-2.0
// A module's `'nervur'` is the kit already running. An author writes
// `import { Being } from 'nervur'`, and a loader rewrites each such import
// into a read of this copy's exports before it runs the source, so a
// class the module declares extends the very `Being` the harbor checks it
// against. Each copy of the kit a process holds keeps its exports under
// its own token in one registered map, since two copies in one process are
// two sets of classes. The entry binds them once it has evaluated.
import type { Module } from './index.ts';

const KITS = 'org.nervur.kits';

type Kits = Map<string, object>;
const kits = (): Kits => {
  const holder = globalThis as unknown as Record<symbol, Kits | undefined>;
  return (holder[Symbol.for(KITS)] ??= new Map());
};

// This copy's token, the count of copies bound before it, since an edge
// draws no random bytes while its script loads.
let token: string | undefined;

// This copy's exports, as a module's `'nervur'` reads them.
export const bindKit = (kit: object): void => {
  const all = kits();
  token ??= `kit${String(all.size)}`;
  all.set(token, kit);
};

const IMPORT = /\bimport\s*(\{[^}]*\}|\*\s*as\s+[A-Za-z_$][\w$]*)\s*from\s*(['"])nervur\2\s*;?/g;
const OTHER = /(^|[\n;{}])\s*(import\s*[\w{*'"]|export\s*(\*|\{[^}]*\})\s*from\b)/;

// A module's source with its `'nervur'` imports read from this copy, or a
// throw where it imports anything else.
export const linked = (source: string): string => {
  if (token === undefined) throw new Error('no kit is bound to link a module against');
  const kit = `globalThis[Symbol.for(${JSON.stringify(KITS)})].get(${JSON.stringify(token)})`;
  const out = source.replace(IMPORT, (_all, names: string) => {
    if (names.startsWith('*')) return `const ${names.replace(/^\*\s*as\s+/, '')} = ${kit};`;
    const fields = names
      .slice(1, -1)
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n !== '')
      .map((n) => n.replace(/\s+as\s+/, ': '));
    return `const { ${fields.join(', ')} } = ${kit};`;
  });
  if (OTHER.test(out)) throw new Error("a module imports nothing but 'nervur'");
  return out;
};

// What a module's code exported, read as a module, or a throw saying what
// it lacks.
export const moduleOf = (exported: unknown): Module => {
  const { module, version, classes } = (exported ?? {}) as { module?: unknown; version?: unknown; classes?: unknown };
  if (typeof module !== 'string' || typeof version !== 'string' || !Array.isArray(classes)) throw new Error('the code exports no module: module, version and classes');
  return { module, version, classes };
};
