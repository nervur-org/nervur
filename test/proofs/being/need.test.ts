import assert from 'node:assert/strict';
import { test } from 'node:test';
import { need, s } from 'nervur/being';
import { covers } from '../../../src/being/covers.ts';
import { blueprintOf, type Blueprint } from '../../../src/being/need.ts';

const of = (value: unknown): Blueprint => blueprintOf(value)!;

const Mail = need('mail', {
  send: { args: s.object({ to: s.string(), body: s.string(), cc: s.optional(s.string()) }) },
  status: { args: s.object({ id: s.string() }), result: s.string(), hints: { readOnly: true } },
});

test('A need is a blueprint at its minimum', () => {
  const blueprint = of(Mail);
  assert.equal(blueprint.name, 'mail');
  assert.deepEqual(Object.keys(blueprint.methods), ['send', 'status']);
  assert.equal(Mail.send.args, blueprint.methods.send.args, 'the member reads the method as its author wrote it');
  assert.deepEqual(of(need('ping', { ping: {} })).methods.ping.args, s.object({}), 'omitted args are the empty object alone');
});

test('Each method of a need is awaited or an effect', () => {
  const { send, status } = of(Mail).methods;
  assert.deepEqual(send.hints, { readOnly: false, idempotent: false, destructive: false });
  assert.deepEqual(status.hints, { readOnly: true, idempotent: true, destructive: false }, 'readOnly implies idempotent');
});

test('An offer covers a need when four things hold', async (t) => {
  const offer = of(
    need('mail', {
      send: { args: s.object({ to: s.string(), body: s.string(), cc: s.optional(s.string()), bcc: s.optional(s.string()) }) },
      status: { args: s.object({ id: s.string() }), result: s.string(), hints: { idempotent: true } },
      purge: { hints: { destructive: true } },
    }),
  );
  await t.test('More methods are allowed', () => assert.deepEqual(covers(offer, of(Mail)), { covered: true }));
  await t.test('The blueprint name is the same', () => {
    const clock = of(need('clock', { now: { hints: { readOnly: true } } }));
    const counter = of(need('counter', { now: { hints: { readOnly: true } } }));
    assert.deepEqual(covers(clock, counter), { covered: false, why: 'the offer is clock, and the need is counter' });
  });
  await t.test('Every method the need names is offered', () => {
    const wants = of(need('mail', { send: { args: Mail.send.args }, archive: {} }));
    assert.deepEqual(covers(offer, wants), { covered: false, why: 'mail offers no archive' });
  });
  await t.test('The offer requires no property the need does not require', () => {
    const wants = of(need('mail', { send: { args: s.object({ to: s.string(), body: s.optional(s.string()) }) } }));
    assert.deepEqual(covers(offer, wants), { covered: false, why: 'mail.send requires body, which the need does not send' });
  });
  await t.test('It refuses a need and an offer that disagree on idempotent: each method is idempotent in both, or in neither', () => {
    const wants = of(need('mail', { send: { args: s.object({ to: s.string(), body: s.string() }), hints: { idempotent: true } } }));
    assert.deepEqual(covers(offer, wants), { covered: false, why: 'mail.send is idempotent in one and not the other' });
  });
});

test('Types are checked on each call, never at the match', () => {
  const offer = of(need('fx', { rate: { args: s.object({ pair: s.number() }), hints: { readOnly: true } } }));
  const wants = of(need('fx', { rate: { args: s.object({ pair: s.string() }), hints: { readOnly: true } } }));
  assert.deepEqual(covers(offer, wants), { covered: true });
});
