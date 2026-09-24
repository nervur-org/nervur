// A payment faculty in the process: it records each call id, answers a
// call id it has seen with the answer it gave, and settles by the handle
// it was handed.
import { need, s } from 'nervur/being';
import type { FacultyContext } from 'nervur';

export const PaymentsOffer = need('payments', {
  charge: {
    args: s.object({ order: s.string(), amount: s.number(), notify: s.handle(), currency: s.optional(s.string()) }),
    result: s.object({ pending: s.boolean() }),
  },
  refund: { args: s.object({ order: s.string() }) },
});

export class FakePayments {
  readonly calls: string[] = [];
  readonly answered = new Map<string, unknown>();
  readonly tokens: string[] = [];
  failures = 0;
  refusing = false;
  /** While set, a charge answers only once it is released. */
  holding = false;
  #release: (() => void) | undefined;
  #context: FacultyContext | undefined;

  release() {
    this.#release?.();
  }

  async charge(args: { order: string; amount: number; notify: string }, context: FacultyContext) {
    this.calls.push(context.id);
    if (this.holding) await new Promise<void>((resolve) => (this.#release = resolve));
    if (this.failures > 0) {
      this.failures--;
      throw new Error('the provider is down');
    }
    const seen = this.answered.get(context.id);
    if (seen !== undefined) return seen;
    this.tokens.push(args.notify);
    this.#context = context;
    const answer = this.refusing ? { error: { message: 'card declined' } } : { result: { pending: true } };
    this.answered.set(context.id, answer);
    return answer;
  }

  async refund() {
    return { result: null };
  }

  /** The money arrived: the provider calls the handle it holds. */
  settle(id = 'settle-1') {
    return this.#context!.call({ token: this.tokens.at(-1)!, id });
  }
}
