# nervur

`nervur` is a library for writing beings and opening the house that holds
them. It is the first kit of [Quo](https://quo.systems), a protocol where
a door is one function: bytes in, bytes or nothing out.

Install it with `npm i nervur`. It runs on Node 22.18 or later. The API
moves until 1.0.0.
[Reading a world](WORLD.md) reads a real situation into the four pieces.
[Writing for nervur](AUTHORING.md) teaches beings and grounds.
[Writing a faculty](FACULTIES.md) teaches faculties, in any language.
[Faces](FACES.md) teaches the sites, APIs and tools people reach a being
through. [Grounds](GROUNDS.md) says what each terrain's ground does, and
[the command](COMMAND.md) drives one on your machine.
[nervur's answers to KIT-SPEC](KIT-SPEC.md) answers every choice Quo
leaves to a kit.

## Words

A **being** is an instance of a class you write. She keeps **cells**,
which are JSON values, and answers **asks**, which are the methods others
may call. The **house** holds beings, keeps their cells, and seals every
ask that crosses its door. A **ground** is the process houses run in. It
hands each house its keys, somewhere to keep rows, its classes, a way to
carry bytes, and the **faculties** its beings may call. The ground holds
one key outside itself, and seals everything else under it: each house's
seed, its rows and your secrets. No seed ever enters a house.

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
      examples: [{ given: [{ ask: 'hello', args: { name: 'Bo' } }, { ask: 'hello', args: { name: 'Cy' } }], args: { name: 'Ada' }, gives: { result: 'Hello, Ada. You are number 3.' } }],
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
  assert.deepEqual(await greeter.ask('hello', { name: 'Bo' }), { result: 'Hello, Bo. You are number 2.' });
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

In a second shell, add the house once. The ground keeps its entry as a
sealed cell of its dock, and opens it again at every start.

```bash
npx nervur houses add name=main classes='{"faculty":"folder","at":"house"}'
```

Then ask the steward through the ground's hand.

```bash
npx nervur ask main hello name=Ada
```

Each ask greets Ada once more, since the count lands in the ground's
ledger before the answer, and it outlives a restart. The ground keeps
its key and its ledger in `state/`, readable by you alone. Everything
in the ledger is sealed under the key. Keep that folder as you keep an
ssh key: without the key, the ledger opens nothing. `npx nervur help`
lists everything the ground offers.

## A ground in a page

The same house runs in a browser. Bundle the house's module and serve it
on your origin, beside a page that opens the ground.

```ts
// page.ts
import { BrowserGround } from 'nervur/browser';

// Every tab of this origin joins one ground, and the tab holding its lock runs it.
const ground = await BrowserGround.open();

// The house's code is a module on this origin, and its rows rest sealed in IndexedDB.
await ground.hand({
  method: 'housesAdd',
  args: { name: 'main', classes: { faculty: 'origin', at: '/house/index.js' } },
});

console.log(await ground.hand({ house: 'main', method: 'hello', args: { name: 'Ada' } }));
```

Every tab of the origin reaches the one ground, and when the tab running
it closes, the next opens it from the same storage. Its key is sealed
under one the browser never hands out. Any script on the origin can use
that key, so give the ground an origin of its own, with a strict content
security policy. The page and the house's module must share one copy of
`nervur/being`, as a bundler's shared chunk gives.

An app on a phone opens the same ground with `AppGround` from
`nervur/app`, on the Keychain or the Keystore and a store the system
keeps. [Writing for nervur](AUTHORING.md) shows both.

## Entries

| Entry | For |
| --- | --- |
| `nervur/being` | writing a being: `Being`, `s`, `need`, `tableOf`, `Args`, `Result`, `Json`, `Table` |
| `nervur` | any engine: `Ground`, `House`, `DockPilot`, `vouchesOf` and the bodies they take |
| `nervur/node` | a ground on Node: `NodeGround`, the `nervur` command, and its bodies |
| `nervur/browser` | a ground in a page or its service worker: `BrowserGround` and its bodies |
| `nervur/edge` | a ground on the edge, a Worker and its Durable Object: `EdgeGround` and its bodies |
| `nervur/app` | a ground in a phone's app: `AppGround`, and the three interfaces its shell fills: `NativeShell`, `NativeSecrets` and `NativeStore` |
| `nervur/serve` | a faculty's program in JavaScript: `serve` |
| `nervur/bench` | tests: `Bench`, `BenchGround` and `FakeNetwork` |

## License

Apache-2.0, © Bookarest Digital SRL. Quo is a separate work, under its
own license. See `NOTICE`.
