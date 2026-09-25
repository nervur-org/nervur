// payments.ts
import type { FacultyContext, Offer } from 'nervur';
import { need, s } from 'nervur/being';

/** What the faculty offers. An order's need is covered by it. */
export const PaymentsBlueprint = need('payments', {
  charge: {
    description: 'Charges an order, and calls notify once the money arrives.',
    args: s.object({ order: s.string(), amount: s.number(), notify: s.handle() }),
    result: s.object({ pending: s.boolean() }),
  },
});

type Answer = { result: { pending: boolean } } | { error: { message: string } };

/**
 * A payment provider in the ground's process. It answers a call id it has
 * seen with the answer it gave, so an effect sent twice charges once. A
 * provider that changes the world keeps these in the memory its maker
 * receives, where a restart and a move keep them.
 */
export class Payments {
  readonly #answered = new Map<string, Answer>();
  readonly #waiting = new Map<string, { notify: string; context: FacultyContext }>();

  async charge({ order, amount, notify }: { order: string; amount: number; notify: string }, context: FacultyContext): Promise<Answer> {
    const seen = this.#answered.get(context.id);
    if (seen !== undefined) return seen;
    const answer: Answer = amount > 0 ? { result: { pending: true } } : { error: { message: 'Nothing to charge.' } };
    if (amount > 0) this.#waiting.set(order, { notify, context });
    this.#answered.set(context.id, answer);
    return answer;
  }

  /** The money for an order arrived: the provider calls the handle it was given. */
  settle(order: string) {
    const waiting = this.#waiting.get(order);
    if (waiting === undefined) throw new Error(`no charge waits for ${order}`);
    this.#waiting.delete(order);
    return waiting.context.call({ token: waiting.notify, id: `settle:${order}` });
  }
}

/** The offer a ground hands: the blueprint, the object, and a week's memory of call ids. */
export const paymentsOffer = (payments: Payments): Offer => ({ blueprint: PaymentsBlueprint, object: payments, window: 7 * 86_400_000 });
