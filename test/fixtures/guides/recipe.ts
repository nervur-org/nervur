// recipe.ts
import { Payments, paymentsOffer } from './payments.ts';

export const faculties = () => ({
  payments: paymentsOffer(new Payments()),
});
