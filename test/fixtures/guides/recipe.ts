// recipe.ts
import { Payments, paymentsOffer } from './payments.ts';

// A registry: the ground raises each faculty an entry names by its `up` here.
export const faculties = {
  payments: { up: () => paymentsOffer(new Payments()) },
};
