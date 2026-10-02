// The leaf's blueprint, which the peeler needs and the top rung offers. It
// stands apart from the rungs, so the house's code loads nothing of Node's.
import { need, s } from 'nervur/being';

export const Leaf = need('org.example.onion.leaf', {
  greet: { args: s.object({ name: s.string() }), result: s.string(), idempotent: true },
});
