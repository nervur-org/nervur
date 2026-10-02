// recipe.ts
import { Faculty, type FacultyContext } from 'nervur';
import { Payments, PaymentsBlueprint } from './payments.ts';

/** The payment provider as a faculty: its blueprint, a week's memory of call ids, and the provider behind it. */
class PaymentsFaculty extends Faculty {
  static override readonly blueprint = PaymentsBlueprint;
  static override readonly window = 7 * 86_400_000;
  readonly #payments = new Payments();

  charge(args: { order: string; amount: number; notify: string }, context: FacultyContext) {
    return this.#payments.charge(args, context);
  }
}

// A registry: the ground makes each faculty an entry names from its class here.
export const faculties = { payments: PaymentsFaculty };
