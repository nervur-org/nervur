// recipe.ts
import { Payments, paymentsOffer } from './payments.ts';

// A registry: the ground makes each faculty an entry names, by its maker here.
export const faculties = {
  payments: () => paymentsOffer(new Payments()),
};
