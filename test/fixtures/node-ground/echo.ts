// The echo blueprint, shared by the recipe that offers it and the being that needs it.
import { need, s } from 'nervur/being';

export const Echo = need('echo', {
  say: { args: s.object({ text: s.string() }), result: s.string(), hints: { readOnly: true } },
});
