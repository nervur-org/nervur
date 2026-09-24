import assert from 'node:assert/strict';
import { test } from 'node:test';
import { need } from '../../../src/being/need.ts';
import { offered, Refused, resolve } from '../../../src/being/table.ts';
import { Order } from '../../fixtures/guides/classes/order.ts';
import { Clocked } from '../../fixtures/world/clocked.ts';
import * as refused from '../fixtures/refused.ts';

const reasons = (Class: unknown): readonly string[] => {
  try {
    resolve(Class);
  } catch (error) {
    assert.ok(error instanceof Refused);
    return error.reasons;
  }
  assert.fail('the class resolved');
};

test('A class extends Being.of, and the one object declares it', () => {
  const table = resolve(Order);
  assert.equal(table.kind, 'com.acme.order');
  assert.equal(table.first, 'open');
  assert.deepEqual(table.states, ['open', 'paying', 'paid', 'shipped']);
  assert.deepEqual(Object.keys(table.needs), ['pay']);
  assert.equal(table.needs.pay.name, 'payments');
  assert.deepEqual(table.asks.charged.to, ['paying', 'open']);
  assert.equal(table.asks.checkout.in![0], 'open');
});

test('Every field is optional but kind and asks', () => {
  const table = resolve(Clocked);
  assert.equal(table.first, 'ready', 'a class with no state has one state, named ready');
  const quote = table.asks.quote;
  assert.equal(quote.in, null, 'omitted, every state');
  assert.equal(quote.for, null, 'omitted, every occupant but handles');
  assert.equal(quote.to, null, 'omitted, the state it began in');
  assert.equal(quote.hints.idempotent, true);
  assert.deepEqual(table.asks.booked.hints, { readOnly: false, idempotent: false, destructive: false });
});

test('The kind lives in the declaration', () => {
  assert.deepEqual(reasons(refused.BadKind), ['its kind is not a reversed domain and a name']);
  assert.deepEqual(reasons(Date), ['it is not a class of Being.of']);
});

test('It refuses two member names that clash', () => {
  assert.deepEqual(reasons(refused.NeedAndAsk), ['its need pay and its ask pay share a name', 'its need pay and its method pay share a name']);
  assert.deepEqual(reasons(refused.NeedAndMethod), ['its need pay and its method pay share a name']);
  assert.deepEqual(reasons(refused.AskAndBeing), ['its ask cells has no method', "its ask cells and Being's cells share a name"]);
  assert.deepEqual(reasons(refused.AskOfEveryObject), ['its ask toString is a member of every object']);
});

test('A view is text of at most 64 KiB', () => {
  assert.deepEqual(reasons(refused.WideView), ['its view is not text of at most 64 KiB']);
  assert.deepEqual(reasons(refused.WideInBytes), ['its view is not text of at most 64 KiB']);
  assert.equal(resolve(refused.FullView).kind, 'org.example.wide.full');
});

test('It refuses an ask with no entry: a method with no entry is never reached, and an entry with no method is refused', () => {
  assert.deepEqual(reasons(refused.NoMethod), ['its ask stay has no method']);
});

test('It refuses a state no ask reaches, an ask no role reaches, and a role unused: the house checks the table when it first resolves her class', async (t) => {
  await t.test('a state no ask reaches', () => assert.deepEqual(reasons(refused.Unreached), ['no ask reaches the state b']));
  await t.test('an ask no role reaches', () => assert.deepEqual(reasons(refused.NoSuchRole), ['its ask go is for owner, which is no role']));
  await t.test('a role no ask names', () => assert.deepEqual(reasons(refused.UnusedRole), ['its role owner is named by no ask']));
  await t.test('a terminal state is allowed', () => assert.deepEqual(resolve(refused.Terminal).states, ['open', 'closed']));
  await t.test('a state named by a class with no state', () =>
    assert.deepEqual(reasons(refused.Stateless), ['it names the state done and has no state of its own']));
});

test('Five roles are the house’s', () => {
  assert.deepEqual(reasons(refused.HouseRole), ["its role steward is the house's"]);
});

test('A blueprint that names any other keyword is refused where it arrives', () => {
  assert.deepEqual(reasons(refused.Outside), ['its ask go.args names format, outside the subset']);
  assert.deepEqual(reasons(refused.ArgsNotObject), ['its ask go.args is not an object schema']);
  // An offer, as a need or as a program describes one.
  const refusal = (value: unknown) => {
    try {
      offered(value);
    } catch (error) {
      assert.ok(error instanceof Refused);
      return error.reasons;
    }
    assert.fail('the offer was taken');
  };
  assert.deepEqual(refusal(need('mail', { send: { args: { type: 'object', format: 'email' } as never } })), ['the offer.send.args names format, outside the subset']);
  assert.deepEqual(refusal({ name: 'relay', methods: { pulse: { result: { type: 'integer', minItems: 1 } } } }), ['the offer.pulse.result names minItems, outside the subset']);
  assert.equal(offered({ name: 'relay', methods: { pulse: { result: { type: 'integer' } } } }).methods.pulse.wait, 30_000);
});

test('A need is held as its author wrote it', () => {
  assert.deepEqual(reasons(refused.WrittenNeed), ['its need m.go names wiat, which is no field', 'its need m.far.wait is not a count of milliseconds within five minutes']);
});

test('readOnly implies idempotent', () => {
  assert.deepEqual(reasons(refused.ReadOnlyWrites), ['its ask go is readOnly and not idempotent']);
});

test('Cells are JSON values', () => {
  assert.deepEqual(reasons(refused.NotJson), ['its cells are not a JSON object']);
});
