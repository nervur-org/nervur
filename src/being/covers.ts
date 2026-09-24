// SPDX-License-Identifier: Apache-2.0
// Whether an offer covers a need. Four rules, and types are left to each
// call, since whether one schema contains another is costly to decide.
import type { Blueprint } from './need.ts';

/** Covered, or the first rule that fails, as a sentence. */
export type Cover = { readonly covered: true } | { readonly covered: false; readonly why: string };

const requiredOf = (schema: object): readonly string[] => {
  const required = (schema as { required?: unknown }).required;
  return Array.isArray(required) ? required : [];
};

export const covers = (offer: Blueprint, want: Blueprint): Cover => {
  if (offer.name !== want.name) return { covered: false, why: `the offer is ${offer.name}, and the need is ${want.name}` };
  for (const [name, wanted] of Object.entries(want.methods)) {
    const offered = offer.methods[name];
    if (offered === undefined) return { covered: false, why: `${want.name} offers no ${name}` };
    const sent = new Set(requiredOf(wanted.args));
    const extra = requiredOf(offered.args).find((key) => !sent.has(key));
    if (extra !== undefined) return { covered: false, why: `${want.name}.${name} requires ${extra}, which the need does not send` };
    if (offered.hints.idempotent !== wanted.hints.idempotent) {
      return { covered: false, why: `${want.name}.${name} is idempotent in one and not the other` };
    }
  }
  return { covered: true };
};
