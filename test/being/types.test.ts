// The types an author reads from her declaration. The type checker is the
// proof, and the suite runs so the file is named by the runner too.
import { test } from 'node:test';
import type { Args, Result } from 'nervur/being';
import { Order } from '../fixtures/guides/classes/order.ts';
import { Clocked } from '../fixtures/world/clocked.ts';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const holds = <T extends true>(): T | undefined => undefined;

test('A method names its args by one type', () => {
  holds<Equal<Args<Order, 'add'>, { sku: string; price: number }>>();
  // @ts-expect-error the measure tells two types apart
  holds<Equal<Args<Order, 'add'>, { sku: number; price: number }>>();
  holds<Equal<Result<Order, 'add'>, { total: number }>>();
  holds<Equal<Args<Order, 'checkout'>, Record<string, never>>>();
  holds<Equal<Args<Order, 'charged'>, { result: { pending: boolean }; error?: undefined } | { error: { message: string }; result?: undefined }>>();
});

test('TypeScript reads from the declaration the types of her cells and her needs', () => {
  const order = Object.create(Order.prototype) as Order;
  holds<Equal<typeof order.cells, { items: string[]; total: number; state: string; paidAt: number; courier: string }>>();
  holds<Equal<ReturnType<typeof order.pay.charge>, void>>();
  // Read by the type checker, and never run.
  const unrun = () => {
    // @ts-expect-error a reply names one of her asks
    order.pay.charge({ order: '', amount: 1, notify: { id: 'handle:x' } }, { reply: 'nothing' });
    // @ts-expect-error a handle leaves as a handle, never as a string
    order.pay.charge({ order: '', amount: 1, notify: 'handle:x' });
  };
  holds<Equal<typeof unrun, () => void>>();
});

test('An awaited call answers during her ask', () => {
  const clocked = Object.create(Clocked.prototype) as Clocked;
  holds<Equal<ReturnType<typeof clocked.fx.rate>, Promise<{ rate: number }>>>();
  holds<Equal<ReturnType<typeof clocked.fx.book>, void>>();
});
