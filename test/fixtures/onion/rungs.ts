// The onion's registries, three rungs above the ground's own. This module
// is the first, stood by the folder's faculty `module`. Its `b-reg`
// carries the second, whose `c-reg` carries the third, whose `leaf` offers
// beings a greeting signed by the body of `b-reg`, which it calls through
// its entry. Each rung declares what it takes, args and a secret, reads
// its secret at its `up`, and notes the `up` in `ups` once the secret is
// read, so a test reads the ladder's order. `side`
// serves each house that names it a ledger of its own, in the folder its
// args name.
import { join } from 'node:path';
import { Faculty, Memory, OK, Rung, type ForHouse, type Registry, type Status } from 'nervur';
import { need, s } from 'nervur/being';
import { LedgerMemory } from 'nervur/node';
import { Leaf } from './leaf.ts';

/** The name of each rung, in the order the ladder raised it. */
export const ups: string[] = [];

export const Signer = need('org.example.onion.signer', {
  sign: { args: s.object({ text: s.string() }), result: s.string(), idempotent: true },
});

export { Leaf };

class LeafFaculty extends Faculty {
  static override readonly blueprint = Leaf;
  static override readonly takes = { args: s.object({ greeting: s.string() }), secrets: { 'leaf-key': 'the seal it keeps' } };
  #seal = '';
  override up(): Status {
    this.#seal = this.made.secrets['leaf-key'];
    ups.push(this.made.name);
    return OK;
  }
  override health(): Status {
    return { ok: this.#seal.length > 0 };
  }
  async greet({ name: who }: { name: string }) {
    const signed = await this.made.call({ faculty: 'b', method: 'sign', args: { text: `${String(this.made.args.greeting)}, ${who}` } });
    return signed;
  }
}

const third: Registry = { faculties: { leaf: LeafFaculty } };

class CReg extends Faculty {
  static override readonly blueprint = Rung;
  static override readonly takes = { args: s.object({ depth: s.integer() }), secrets: { 'c-key': 'the key of the third rung' } };
  #key = '';
  override readonly registry = third;
  override up(): Status {
    this.#key = this.made.secrets['c-key'];
    ups.push(this.made.name);
    return OK;
  }
  override health(): Status {
    return { ok: this.#key.length > 0 };
  }
}

const second: Registry = { faculties: { 'c-reg': CReg } };

// The second rung signs: its body carries a registry and offers a blueprint, and a signature says only how long its key is.
class BReg extends Faculty {
  static override readonly blueprint = Signer;
  static override readonly takes = { args: s.object({ depth: s.integer() }), secrets: { 'b-key': 'the key the rung signs with' } };
  override readonly registry = second;
  override up(): Status {
    ups.push(this.made.name);
    return OK;
  }
  async sign({ text }: { text: string }) {
    return { result: `${text} (signed with ${this.made.secrets['b-key'].length})` };
  }
}

class Side extends Faculty {
  static override readonly blueprint = Memory;
  static override readonly takes = { args: s.object({ path: s.string() }) };
  override house({ house }: ForHouse): LedgerMemory {
    return new LedgerMemory(join(String(this.made.args.path), `${house}.ledger`));
  }
}

export const faculties: Registry['faculties'] = { 'b-reg': BReg, side: Side };
