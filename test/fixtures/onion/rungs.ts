// The onion's registries, three rungs above the ground's own. This module
// is the first, stood by the folder's faculty `module`. Its `b-reg`
// carries the second, whose `c-reg` carries the third, whose `leaf` offers
// beings a greeting signed by the body of `b-reg`, which it calls through
// its entry. Each rung declares what it takes, args and a secret, and
// notes its `up` in `ups`, so a test reads the ladder's order. `side`
// serves each house that names it a ledger of its own, in the folder its
// args name.
import { join } from 'node:path';
import type { Faculty, Registry } from 'nervur';
import { need, s } from 'nervur/being';
import { LedgerMemory } from 'nervur/node';

/** The name of each rung, in the order the ladder raised it. */
export const ups: string[] = [];

export const Signer = need('org.example.onion.signer', {
  sign: { args: s.object({ text: s.string() }), result: s.string(), hints: { idempotent: true } },
});

export const Leaf = need('org.example.onion.leaf', {
  greet: { args: s.object({ name: s.string() }), result: s.string(), hints: { idempotent: true } },
});

type Signing = { sign(args: { text: string }): Promise<{ result: string }> };

const leaf: Faculty = {
  takes: { args: s.object({ greeting: s.string() }), secrets: { 'leaf-key': 'the seal it keeps' } },
  up: ({ name, args, faculties }) => {
    ups.push(name);
    const signer = faculties.b as Signing;
    return {
      blueprint: Leaf,
      object: { greet: async ({ name: who }: { name: string }) => ({ result: (await signer.sign({ text: `${String(args.greeting)}, ${who}` })).result }) },
    };
  },
};

const third: Registry = { faculties: { leaf } };

const cReg: Faculty = {
  takes: { args: s.object({ depth: s.integer() }), secrets: { 'c-key': 'the key of the third rung' } },
  up: ({ name }) => {
    ups.push(name);
    return { registry: third };
  },
};

const second: Registry = { faculties: { 'c-reg': cReg } };

// The second rung signs: its body carries a registry and offers a blueprint, and a signature says only how long its key is.
const bReg: Faculty = {
  takes: { args: s.object({ depth: s.integer() }), secrets: { 'b-key': 'the key the rung signs with' } },
  up: ({ name, secrets }) => {
    ups.push(name);
    return {
      registry: second,
      blueprint: Signer,
      object: { sign: async ({ text }: { text: string }) => ({ result: `${text} (signed with ${secrets['b-key'].length})` }) },
    };
  },
};

const side: Faculty = {
  takes: { args: s.object({ path: s.string() }) },
  up: ({ args }) => ({ serves: 'memory', house: ({ house }) => new LedgerMemory(join(String(args.path), `${house}.ledger`)) }),
};

export const faculties: Registry['faculties'] = { 'b-reg': bReg, side };
