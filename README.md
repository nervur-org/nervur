# nervur

`nervur` is a library for writing beings and opening the house that holds
them. It is the first kit of [Quo](https://quo.systems), a protocol where
a door is one function: bytes in, bytes or nothing out.

This version is a prerelease, and the API moves until 1.0.0. Install it
with `npm i nervur@next`. It runs on Node 22.18 or later.
[AUTHORING.md](AUTHORING.md) teaches beings, faculties and grounds.
[KIT-SPEC.md](KIT-SPEC.md) answers every choice Quo leaves to a kit.

## Words

A **being** is an instance of a class you write. She keeps **cells**,
which are JSON values, and answers **asks**, which are the methods others
may call. The **house** holds beings, keeps their cells, and seals every
ask that crosses its door. A **ground** is the process houses run in. It
hands each house a seed, somewhere to keep rows, its classes, a way to
carry bytes, and the **faculties** its beings may call.

## A being

Every ask declares its arguments and its result, and may carry examples.
The house refuses arguments that do not match.

```ts
// greeter.ts
import { Being, s, type Args } from 'nervur/being';

export class Greeter extends Being.of({
  kind: 'org.example.greeter',
  description: 'Greets whoever asks, and counts them.',
  cells: { greeted: 0 },
  asks: {
    hello: {
      args: s.object({ name: s.string() }),
      result: s.string(),
      examples: [{ cells: { greeted: 2 }, args: { name: 'Ada' }, gives: { result: 'Hello, Ada. You are number 3.' } }],
    },
  },
}) {
  hello({ name }: Args<Greeter, 'hello'>) {
    this.cells.greeted += 1;
    return `Hello, ${name}. You are number ${this.cells.greeted}.`;
  }
}
```

## A test

The bench opens two houses in one process, so every ask crosses a door
as it would in production. `Bench.check` runs every example twice and
describes every state to every role.

```ts
// greeter.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bench } from 'nervur/bench';
import { Greeter } from './greeter.ts';

test('Greeter keeps her examples and her table', async () => {
  await Bench.check(Greeter);
});

test('Greeter counts whoever she greets', async () => {
  const bench = await Bench.open({ classes: [Greeter] });
  const greeter = await bench.place(Greeter);
  assert.deepEqual(await greeter.ask('hello', { name: 'Ada' }), { result: 'Hello, Ada. You are number 1.' });
  assert.deepEqual(await greeter.cells(), { greeted: 1 });
});
```

## A ground

A ground is the process houses run in, and you write none. `nervur up`
runs one on a folder. Each house's code is a folder of its own, whose
index names its steward. Here the greeter is the steward.

```ts
// house/index.ts
export { Greeter as steward } from '../greeter.ts';
```

Run the ground in the folder, and leave it running.

```bash
npx nervur up .
```

In a second shell, add the house once. The ground keeps it in its record,
and opens it again at every start.

```bash
npx nervur houses add name=main memory='{"body":"ledger"}' classes='{"body":"folder","at":"house"}'
```

Then ask the steward through the ground's hand.

```bash
npx nervur ask main hello name=Ada
```

Each ask greets Ada once more, since the count lands in the house's
ledger before the answer, and it outlives a restart. The ground keeps
the house's seed, its ledger and its record in `state/`, readable by
you alone. Keep that folder secret: a house opens on no other seed.
`npx nervur help` lists everything the ground offers.

## Entries

| Entry | For |
| --- | --- |
| `nervur/being` | writing a being: `Being`, `s`, `need`, `Args`, `Result` |
| `nervur` | any engine: `Ground`, `House` and the bodies they take |
| `nervur/node` | a ground on Node: `NodeGround`, the `nervur` command, and its bodies |
| `nervur/bench` | tests: `Bench`, `BenchGround`, `FakeNetwork` and the fakes of every body |

## License

Apache-2.0, © Bookarest Digital SRL. Quo is a separate work, under its
own license. See `NOTICE`.
