// SPDX-License-Identifier: Apache-2.0
// A kind: the name a row keeps for the class a being is born of, and the
// name a contract is lent by. It is declared on the class, never taken from
// the name the language gives it, because a bundler renames classes.
//
//   static kind = 'com.acme.shop'
//
// A kind is a reversed domain its author owns, then a name: at least three
// segments joined by `.`, each lowercase letters, digits and `-`, starting
// with a letter or digit. `org.nervur.` is the kit's own. A class declares
// its own kind: one it inherits names its parent, so it is none.
export const KIT = 'org.nervur.';

const KIND = /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*){2,}$/;

export const isKind = (text: unknown): text is string => typeof text === 'string' && KIND.test(text);

// The kind a class declares on itself, or undefined.
export const ownKind = (C: unknown): string | undefined => {
  if (typeof C !== 'function' || !Object.hasOwn(C, 'kind')) return undefined;
  const kind = (C as { kind?: unknown }).kind;
  return isKind(kind) ? kind : undefined;
};

// The classes the kit ships. Each is marked on itself as it is declared,
// under a registered symbol, so the mark holds for a class of any copy of
// the kit a module was built against, and a subclass inherits no mark.
const SHIPS = Symbol.for('org.nervur.ships');
export const ships = (C: object): void => void Object.defineProperty(C, SHIPS, { value: true });
export const shipped = (C: unknown): boolean => typeof C === 'function' && Object.hasOwn(C, SHIPS);

// The kind a class declares on itself, or a throw naming the class.
export const kindOf = (C: unknown): string => {
  const kind = ownKind(C);
  if (kind === undefined) throw new Error(`class ${typeof C === 'function' ? C.name : String(C)} declares no kind of its own`);
  return kind;
};
