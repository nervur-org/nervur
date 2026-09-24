# Writing for nervur

This guide teaches the two things you write with `nervur`. A **being**
holds logic and state. A **faculty** reaches the world outside. A
**ground** runs them on a machine, and the library ships it. The
examples build one small shop, and every file here is a file the
package's own tests run.

The shop has three classes and one faculty.

- `Order` is one order, from its first item to its shipping.
- `Shop` is the steward, the being that runs the house.
- `Lobby` is the public being, which strangers may ask.
- `Payments` is a faculty that charges money, which the ground's
  `recipe.ts` makes.

## Words

| Word | What it is |
| --- | --- |
| being | an instance of a class, born for one ask and dropped after it |
| cells | her state, JSON values, kept when an ask lands |
| ask | a method others may call on her, with its entry |
| asker | who calls her now: an id and notes |
| occupant | someone who may ask her, by id |
| standing | someone she may ask, by id |
| blueprint | the shape of what can be called: a name and its methods |
| need | the blueprint she calls, at its minimum, under a member of her own |
| faculty | anything outside the house that answers a blueprint |
| offer | a faculty the ground hands the house: its blueprint and its object |
| role | a named test over the asker and her cells |
| state | a name read from her cells that decides which asks exist |
| house | what holds beings, keeps their cells, and seals every ask |
| ground | the process houses run in, holding their seeds, faculties and hands |

## A being

A being is pure logic over her cells. She never knows where she runs,
who carries her asks, or how her cells are kept. The house does all of
it, and she trusts it.

```ts
// classes/order.ts
import { Being, s, need, type Args } from 'nervur/being';

export const Payments = need('payments', {
  charge: {
    args: s.object({ order: s.string(), amount: s.number(), notify: s.handle() }),
    result: s.object({ pending: s.boolean() }),
  },
});

export const Courier = need('courier', {
  pickup: { args: s.object({ items: s.array(s.string()) }) },
});

export class Order extends Being.of({
  kind: 'com.acme.order',
  description: 'One order, from its first item to its shipping.',
  needs: { pay: Payments },
  cells: {
    items: [] as string[],
    total: 0,
    state: 'open',
    paidAt: 0,
    courier: '',
  },
  roles: { owner: (asker) => asker.steward.owner === true },
  state: (me) => me.cells.state,
  asks: {
    hire: {
      for: 'steward',
      hints: { idempotent: true },
      args: s.object({ courier: s.handle() }),
      result: s.string(),
    },
    add: {
      in: 'open',
      for: 'owner',
      to: 'open',
      args: s.object({ sku: s.string(), price: s.number() }),
      result: s.object({ total: s.number() }),
    },
    checkout: { in: 'open', for: 'owner', to: 'paying' },
    charged: { in: 'paying', args: s.reply(Payments.charge), to: ['paying', 'open'] },
    settled: { in: 'paying', for: 'handle', to: 'paid' },
    ship: { in: 'paid', for: 'owner', to: 'shipped' },
  },
}) {
  // The courier's invitation arrives as her standing. The same one twice is the same standing.
  hire({ courier }: Args<Order, 'hire'>) {
    this.cells.courier = courier;
    return courier;
  }

  add({ sku, price }: Args<Order, 'add'>) {
    this.cells.items = [...this.cells.items, sku];
    this.cells.total += price;
    return { total: this.cells.total };
  }

  checkout() {
    if (this.cells.items.length === 0) this.fail('Add an item first.');
    const notify = this.handle('settled', { once: true });
    this.pay.charge({ order: this.id, amount: this.cells.total, notify }, { reply: 'charged' });
    this.cells.state = 'paying';
  }

  charged({ error }: Args<Order, 'charged'>) {
    if (error) this.cells.state = 'open';
  }

  settled() {
    this.cells.state = 'paid';
    this.cells.paidAt = this.house.now();
  }

  ship() {
    if (this.cells.courier === '') this.fail('Hire a courier first.');
    this.held(this.cells.courier, Courier).pickup({ items: this.cells.items });
    this.cells.state = 'shipped';
  }
}
```

The order wrote no retry, no catch, no key and no address. `charge` is
an effect, so it leaves only once `checkout` has landed. Its answer comes
back to `charged`, and a refused charge opens the order again. The
provider calls `settled` through the handle once the money arrives.
`hire` takes a courier's invitation as her standing, and `ship` asks the
courier through it. `shipped` is a terminal state, and nothing leaves it.

### The declaration

A class extends `Being.of({ … })`. That one object declares the class,
and TypeScript reads from it the types of her cells and her needs.

| Field | What it is |
| --- | --- |
| `kind` | the code's name: a reversed domain you own, then a name |
| `description` | one line for readers and agents |
| `cells` | the state and its defaults, written where a key is missing |
| `needs` | blueprints she calls, each under a member name she chooses |
| `roles` | named tests over the asker and her cells |
| `state` | a function of the being that names her current state |
| `asks` | one entry per method she answers |
| `view` | markup as text over her asks, which a screen renders |

A view is data, at most 64 KiB, carried in her describe to every asker.
It holds no script, and a renderer loads nothing it names, so a view
neither acts nor tracks. The library defines no markup: a renderer
speaks its own.

Every field is optional but `kind` and `asks`. A class with no `state`
has one state, named `ready`. The kind is how the house finds her code
again, so a bundler that renames classes changes nothing.

A method in TypeScript names its args with `Args<Class, 'method'>`,
since a subclass's method takes no type from its base. A method in
JavaScript writes nothing.

### An ask's entry

| Field | What it says |
| --- | --- |
| `in` | the states where the ask exists; omitted, every state |
| `for` | the roles that may call it; omitted, every occupant but handles |
| `to` | the states it may land in; omitted, the state it began in |
| `args` | the schema of what it takes; omitted, the empty object alone |
| `result` | the schema of what it answers; omitted, nothing |
| `hints` | `readOnly`, `idempotent`, `destructive` |
| `examples` | cells, a role, args, fakes, and what it gives |
| `description` | one line for readers and agents |
| `wait` | milliseconds she may run; omitted, thirty seconds |

`in`, `for` and `to` each take one name or a list of names. A method
with no entry is never reached. An entry with no method is refused when
the house first loads the class.

Five roles are the house's. `handle` is whoever holds a handle to this
ask. `stranger` is the asker of a public being. `steward` is her
steward. `being` is another being her steward introduced to her. `root`
is the owner, through the house's hand. Every other role is yours, a
function of `(asker, me)`.

The house checks the table when it first loads the class. It refuses a
state no ask reaches, an ask no role reaches, and a role no ask names.
After a method runs, a state outside the entry's `to` fails the ask, and
nothing lands.

### What she reaches

| Member | What it is |
| --- | --- |
| `this.id` | her own id |
| `this.position` | `steward`, `public` or `normal` |
| `this.asker` | `{ id, notes, steward }` of who asks now; `signer` for a stranger |
| `this.cells` | her values |
| `this.house.now()` | the time, in milliseconds since the epoch |
| `this.house.random({ length })` | random bytes |
| `this.house.alarm({ at, ask, args, key })` | one of her asks, at that time |
| `this.house.cancelAlarm({ key })` | an alarm removed |
| `this.<need>.<method>({…}, { reply? })` | an awaited call, or an effect |
| `this.held(id, Need).<ask>({…}, { reply?, after? })` | the same, on a standing, and a watch where `after` is given |
| `this.standings` | `list()`, `note(id, notes)` and `drop(id)` |
| `this.handle(ask, { bind?, notes?, once?, expires? })` | a handle to one of her asks |
| `this.invite(id, { notes?, expires? })` | a new occupant, as a handle |
| `this.occupants` | `list()`, `note(id, notes)` and `dismiss(id)` |
| `this.steward` | her steward, where she is not one |
| `this.powers` | the house's powers, where she is the steward |
| `this.fail(message)` | an error the asker can act on |

An alarm lives in the house's rows and survives every restart. A second
alarm under one key replaces the first. When its time comes, the house
asks her named ask as her steward would.

### Awaited calls and effects

The callee decides how it is called, with one flag. A method or ask
marked `idempotent` is safe to repeat, so the caller awaits it during
her ask. Everything else is an effect. `readOnly` is stricter: it writes
nothing, it implies `idempotent`, and the house holds it.

An awaited call answers during her ask. `await this.fx.rate({…})`
returns the answer, and a failure throws an error she may catch. It
waits thirty seconds unless its entry says otherwise, and never more
than five minutes.

An awaited call never comes back to a being in its own chain. While she
awaits, she holds her queue. A call back to her, other than a
`readOnly` one, waits behind the ask that waits for it, until the wait
runs out and the call fails as `answered nothing`. Call back with an
effect instead.

An effect leaves after her ask lands. She calls it and it returns
nothing. The house writes it in the same write as her cells, then sends
it with one call id until it is answered. So an effect acts at most
once. Its answer comes back to the ask `reply` names, as `{ result }` or
`{ error: { message } }`.

An effect gives up at its deadline, seven days for a standing and the
offer's window for a faculty. The reply then hears an error. Effects to
one receiver leave one at a time, in the order she called them.

Asks to one being run one at a time, in the order they arrive. A
`readOnly` ask runs beside that queue, on the cells last landed.

### Watching an answer

A watch is a `readOnly` ask asked with `after`, the answer you already
hold. The house answers at once where the answer differs. Where it is
the same, the house holds the ask and runs it again each time an ask of
that being lands. It answers the first answer that differs, or the same
one when the wait runs out. So a chat, an order's status or a dashboard
is a loop of watches, and nothing polls.

Through the hand, pass `after` beside the method, as the answer you
hold: `{ result: [...] }`. From a being, pass the result she holds:
`this.held(room, Messages).messages({}, { after: seen })`, inside a
`readOnly` ask of her own, so she stays free while she waits. Only a
`readOnly` ask is watched, and a watch on anything else is refused where
she makes it.

A watch moves only on what its asker could read, since it runs as that
asker. One asker holds one watch on one ask with the same args, and a
second answers the first at once. A watch across a door holds its
relation until it answers, since Quo moves a relation one ask at a time.
So watch a far being through a handle to the watched ask alone, a
relation of its own, and ask everything else on your other standing.

### Relations

An **occupant** is someone who may ask her. She mints one with
`this.invite(id, { notes })`, which answers a handle, and lets one go with
`dismiss`.

A **standing** is someone she may ask. She receives one where an ask's
args carry an invitation under `s.handle`, or where her steward
introduces one. She asks through it with `this.held(id, Need)`, which
checks the standing's describe covers the need.

Every relation carries two sets of notes. `notes` are hers alone.
`steward` are her steward's, written when the steward made the relation,
and she reads them and never writes them. The order's `owner` role reads
the steward's notes, so only the steward decides who owns an order.

A **handle** is the only way a relation leaves her. `this.handle(ask)`
admits its holder to that one ask. `once` dismisses it after its first
ask lands, and `bind` fixes args the holder cannot change. The house
turns a handle into an invitation for a far house, or a token for a
faculty. A handle never enters her cells.

`expires`, on `this.handle`, `this.invite` and the steward's `invite`,
gives each invitation minted from the handle that many milliseconds to
be taken. Its first knock lands within that time, or it hears silence.
One taken in time never expires, and one without `expires` waits for
ever. Give it to every invitation a being mints on each answer, so the
unspent ones go.

### The steward

Every house has one steward, with the id `steward`. The holder of the
house's hand asks her as the occupant `root`, which no sealed box can
forge. She alone holds `this.powers`.

```ts
// classes/shop.ts
import { Being, s, type Args } from 'nervur/being';

export class Shop extends Being.of({
  kind: 'com.acme.shop',
  description: 'The shop’s steward: opens orders, and enrols whoever signs up.',
  cells: { opened: 0 },
  roles: { pilot: (asker) => asker.id === 'root' },
  asks: {
    open: {
      for: 'pilot',
      description: 'Opens an order, and hands back an invitation for its owner.',
      args: s.object({ id: s.string() }),
      result: s.object({ owner: s.invitation() }),
    },
    orders: { for: 'pilot', hints: { readOnly: true }, result: s.array(s.string()) },
    hire: {
      for: 'pilot',
      description: 'Hands a courier’s invitation to an order, which takes it.',
      hints: { idempotent: true },
      args: s.object({ order: s.string(), courier: s.invitation() }),
      result: s.string(),
    },
    enroll: {
      for: 'being',
      hints: { idempotent: true },
      args: s.object({ signer: s.bytes() }),
      result: s.object({ invitation: s.invitation() }),
    },
  },
}) {
  open({ id }: Args<Shop, 'open'>) {
    this.powers!.bear({ kind: 'com.acme.order', id });
    this.cells.opened += 1;
    return { owner: this.powers!.invite({ id, occupant: 'owner', notes: { owner: true } }) };
  }

  async orders() {
    return (await this.powers!.list()).filter((being) => being.kind === 'com.acme.order').map((being) => being.id);
  }

  // She carries the invitation unopened, and the order she names takes it.
  async hire({ order, courier }: Args<Shop, 'hire'>) {
    return (await this.powers!.ask({ id: order, method: 'hire', args: { courier } })) as string;
  }

  // One order a signer: asked twice, the same id is borne once.
  enroll({ signer }: Args<Shop, 'enroll'>) {
    const id = `order-${Array.from(signer.subarray(0, 8), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    this.powers!.bear({ kind: 'com.acme.order', id });
    const occupant = `owner-${Array.from(this.house.random({ length: 4 }), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    return { invitation: this.powers!.invite({ id, occupant, notes: { owner: true } }) };
  }
}
```

| Power | What it does |
| --- | --- |
| `bear({ kind, id, args })` | places a new being; the same id twice answers the first |
| `remove({ id })` | removes a being and everything of hers |
| `list()` | every being, her kind, whether she is absent, and her dead letters |
| `ask({ id, method, args }, { reply? })` | asks any being as her occupant `steward` |
| `introduce({ from, to, notes })` | gives `from` a standing on `to`, and `to` an occupant |
| `invite({ id, occupant, notes, expires? })` | gives a being a new occupant, and the steward its handle |

`bear`, `remove`, `introduce` and `invite` land in the steward's own
write. If her ask fails, none of them happened. A being borne runs her
`born` ask first, where her class declares one.

Every other being is placed as `normal`. She holds the standing
`steward` and the occupant `steward`, and can drop neither.

An invitation from outside lands where the owner says. The courier's
invitation reaches the owner by any road, a mail or a link. The owner
hands it to the steward's `hire` with the order it is for. `hire`
declares it `s.invitation`, so the steward carries it unopened and never
holds it. The order's `hire` declares it `s.handle`, so the order takes
it, and the standing is hers.

Taking an invitation is safe to repeat. The same invitation taken again
gives the same standing, so the order's `hire` is `idempotent`, and the
steward awaits it. The owner hears the standing, or why it was refused.
A steward that bears a being for an invitation bears her first, then
hands it to her the same way.

### A public being

A house may name one public being, with the id `public`. She answers
strangers: every asker with no relation is the occupant `stranger`, and
`this.asker.signer` is the key the ask was signed with.

```ts
// classes/lobby.ts
import { Being, need, s } from 'nervur/being';

/** What the lobby asks of her steward. */
const Signup = need('signup', {
  enroll: {
    hints: { idempotent: true },
    args: s.object({ signer: s.bytes() }),
    result: s.object({ invitation: s.invitation() }),
  },
});

export class Lobby extends Being.of({
  kind: 'com.acme.lobby',
  description: 'The shop’s front door: a stranger signs up and receives an order of their own.',
  asks: {
    signup: { for: 'stranger', result: s.object({ invitation: s.invitation() }) },
  },
}) {
  signup() {
    return this.held('steward', Signup).enroll({ signer: this.asker.signer! });
  }
}
```

A public being's asks are idempotent by default, since a stranger's box
may arrive twice. The house answers a replayed stranger's box from a
cache for ten minutes, and nothing runs twice. An ask marked
`hints: { idempotent: false }` is refused to strangers.

Signup awaits the steward. The lobby asks `enroll`, which is
`idempotent`, so the lobby awaits its answer and returns the invitation
unopened. A stranger who signs up twice holds one order.

Signup is this shop's choice, not the house's. A house is its owner's,
and a public being does only what its owner wrote. One may answer who
the house is and nothing more. A house with no public being answers
strangers silence.

### Schemas

One builder gives the schema and the TypeScript type: `s.object`,
`s.string`, `s.number`, `s.integer`, `s.boolean`, `s.array`, `s.enum`,
`s.const`, `s.bytes`, `s.optional`, `s.handle`, `s.invitation` and
`s.reply`. They write JSON Schema 2020-12, in a subset the house checks
on every ask.

- `s.bytes` is a `Uint8Array` in the process and lowercase hex across a
  door.
- `s.handle` carries a relation. A handle leaves as an invitation, and
  an invitation arrives as a new standing id.
- `s.invitation` carries an invitation unopened, as the lobby does.
  Passed on under `s.handle`, it is taken by the being that receives
  it. Taking one is safe to repeat: the same invitation gives the same
  standing.
- `s.reply(method)` is the args of an effect's reply: `{ result }` or
  `{ error: { message } }`.

### Needs

A need is a blueprint at its minimum: what she will call, never what a
faculty offers. `need(name, methods)` writes one, and she binds it to a
member of her own in `needs`. An offer covers a need when four things
hold.

1. The blueprint's name is the same.
2. Every method the need names is offered. More are allowed.
3. The offer requires no property the need does not require.
4. Each method is `idempotent` in both, or in neither.

Every need is covered, or she is absent. An absent being answers silence
and keeps her cells, and answers again once an offer covers her needs.

### Testing on the bench

The bench opens two houses in one process, on fake memory, keys, clock
and carry. So every ask crosses a door as it would in production.

```ts
// order.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bench } from 'nervur/bench';
import { Order } from './classes/order.ts';
import { Payments, paymentsOffer } from './payments.ts';

test('Order keeps her table: every state and role shows what it owes', async () => {
  await Bench.check(Order);
});

test('An order is paid once the provider calls the handle it was given', async () => {
  const payments = new Payments();
  const bench = await Bench.open({ classes: [Order], offers: [paymentsOffer(payments)] });
  const order = await bench.place(Order, { id: 'first' });

  assert.deepEqual(await order.ask('checkout'), { error: { message: 'Add an item first.' } });
  assert.deepEqual(await order.ask('add', { sku: 'tea', price: 4 }), { result: { total: 4 } });
  assert.deepEqual(await order.ask('checkout'), { result: null });
  await bench.settle();
  assert.equal((await order.cells())!.state, 'paying', 'the charge left once checkout landed, and answered pending');

  assert.deepEqual(await payments.settle('first'), { result: null });
  await bench.settle();
  assert.equal((await order.cells())!.state, 'paid');
  assert.deepEqual(await order.ask('add', { sku: 'jam', price: 1 }), { error: { message: 'not in this state' } });
});
```

`place(Class, { id, cells })` bears a being and starts her from those
cells. A placed being is asked with `ask(method, args, { role })`,
described with `describe({ role })`, and read with `cells()`. `settle()`
lets every effect and reply run, and `advance(ms)` moves the fake clock.

The bench plays a role with an occupant named for it, whose own notes and
steward notes both hold the role as `true`.

A steward and a public being are placed where the house places them.
`Bench.open({ steward: Shop, public: Lobby, classes: [Order] })` opens the
author's house with them there, and `place(Shop)` and `place(Lobby)` find
them. A role `root` holds is played through the hand, on any being. On
the public being, a role a stranger holds is played by a box with no
relation, signed with a key drawn from the bench's seed.
`Bench.check(Shop, { position: 'steward' })` and `Bench.check(Lobby, {
position: 'public', steward: Shop })` check them.

An entry's `examples` are tests the bench runs. Each is one ask on a
fresh bench: `cells` start her, `role` asks, `args` are the ask's,
`fakes` answer her needs, and `gives` is the answer owed. `Bench.check`
runs every example twice from one seed and flags a class that answers
differently. It then describes every state to every role, and names every
finding that failed.

## A faculty

A faculty is anything a being may call that is not a being: a payment
provider, a mail sender, a model, a sensor. The ground hands it to the
house as an offer, and the house matches it to every need it covers.

```ts
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
 * provider that changes the world keeps these where a restart keeps them.
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
```

An offer is `{ blueprint, object, kinds?, window?, handler?, stop? }`.

- **The object has the blueprint's methods.** Each takes one args object
  and a context, and answers `{ result }` or `{ error: { message } }`. A
  throw is a failure to answer, and the house tries again.
- **The context holds the call id.** An effect arrives again with the same
  call id when an answer was lost. A faculty that changes the world
  answers a call id it has seen with the answer it gave.
- **A handle arrives as a token.** The faculty calls it with
  `context.call({ token, args, id })`. Its own `id` makes that call run
  once, however often it is sent.
- **`kinds` is the ground's grant.** It lists the classes that may hold
  the offer. Without it, every class whose need it covers holds it.
- **`window` is how long the faculty remembers a call id.** It is seven
  days where omitted, and the house gives up on an effect at it.
- **`handler` answers HTTP on the ground's one listener.** It takes a
  `Request` and answers a `Response`, or `null` where the request is not
  its own. A site, an API or an MCP server is a faculty with a handler.
- **`stop` is called when the ground stops**, faculties in the reverse of
  the order they were made.

The object arrives living. The ground makes and starts the faculty, and
the house never starts, stops or restarts it. Every being whose need it
covers holds the same object.

A faculty is the ground's, never a house's. The ground's recipe makes
each one by name, from the settings the ground hands it. `env` is the
ground's environment, so a secret stays on its machine and out of the
code. `dir(name)` answers a folder of the faculty's own.

```ts
// recipe.ts
import { Payments, paymentsOffer } from './payments.ts';

export const faculties = () => ({
  payments: paymentsOffer(new Payments()),
});
```

Policy over a faculty is written as a being. Limits, approvals and
quotas are not the faculty's. One being holds the raw faculty through
`kinds`, and every other being reaches her through a standing.

## A ground

A ground is the process houses run in, and you write none. `nervur up`
runs one on a folder: the recipe of its faculties, and a folder of code
for each house. It keeps a record of its houses, and opens each on the
bodies the record names.

### The shop's folder

```text
nervur-ground/
  recipe.ts
  payments.ts
  classes/index.ts, order.ts, shop.ts, lobby.ts
  state/        made by the ground, its owner's alone
```

A house's folder names what the house holds.

```ts
// classes/index.ts
export { Shop as steward } from './shop.ts';
export { Lobby as public } from './lobby.ts';
import { Order } from './order.ts';

export const beings = [Order];
```

### Running it

```bash
npx nervur up .
```

The ground boots in one order, and a stop is that order reversed, on an
interrupt and on `SIGTERM`.

1. **Lock.** One ground to its state.
2. **Its own.** Its seeds and its record open.
3. **Faculties.** The recipe makes each, in its order.
4. **Houses.** Each house of the record opens on its bodies.
5. **Hook.** The listeners, then the hand on its socket.
6. **Ready.** It tells systemd it is up, where systemd waits.

It is set by its environment.

| Setting | What it sets |
| --- | --- |
| `NERVUR_TCP_PORT` | its TCP port, 7300 where unset |
| `NERVUR_HTTP_PORT` | its HTTP port, for Quo over the web and every handler; no HTTP where unset |
| `NERVUR_ADDRESSES` | the public addresses it writes into invitations, by commas |
| `NERVUR_BIND` | the address it listens on, `0.0.0.0` where unset |
| `NERVUR_STATE` | its state, `state/` in its folder where unset |
| `NERVUR_KEYCHAIN` | a keychain service holding its seeds on macOS, in place of files |
| `NERVUR_WAIT` | its bound on every ask, in milliseconds |

The state holds each house's seed in a file its owner alone reads, and
each house's ledger. A ledger appends every write and never rewrites
one, and one behind its witness is refused, so a restored backup cannot
replay what a house already answered. A lost seed is a lost house.

A house is added once, and the ground opens it again at every start.

```bash
npx nervur houses add name=shop memory='{"body":"ledger"}' classes='{"body":"folder","at":"classes"}' faculties='["payments"]'
```

`memory` and `classes` name the bodies the house is handed. `ledger` and
`folder` are the ground's own, and a recipe may add more, a git registry
or another store among them. `faculties` names what the house receives,
and within it each offer's `kinds` names the classes that hold it.

### The hand

The command is a face on the ground's hand. It holds no word of its own
beyond `up` and `service`, and reads every other from what the ground
describes.

```bash
npx nervur help
```

A faculty's method is called as its owner calls it, and a faculty named
alone shows its methods. Args are one JSON object, or words `key=value`.

```bash
npx nervur houses list
```

`ask` asks a being in a house as `root`: the steward, or the being
`--id` names. The owner lands a paper in a being with one ask, and her
`accept` names `root` in its `for`, or names no `for`.

```bash
npx nervur ask shop open id=first
```

```bash
npx nervur ask shop --id alice accept invitation=7b22…
```

Each prints one JSON value. It exits 0 on a result and 1 on an error
answered. It exits 2 where nothing was asked, so a script tells a
refusal from a ground that is down. The hand is `state/hand` in the
folder where the command runs, or the socket `--at` or `NERVUR_HAND`
names.

### Running it as a service

`nervur service` writes the unit that runs a folder: a systemd user unit
on Linux, started again after any exit, and a launchd agent on macOS.

```bash
npx nervur service . > ~/.config/systemd/user/nervur-ground.service
```

```bash
systemctl --user enable --now nervur-ground
```

A user unit stops when its user logs out, unless lingering is enabled
with `loginctl enable-linger`. On macOS, the agent goes to
`~/Library/LaunchAgents/` and is started with `launchctl bootstrap`.

### In a page

`BrowserGround.open({ recipe })` from `nervur/browser` runs the same
houses in a page. Every tab and the service worker of one origin share
one ground: the one holding the Web Lock runs it, and the others reach
its hand over a `BroadcastChannel`. When it closes, the next opens the
ground from the same storage. `hand` answers the same three requests
the command sends: `describe`, a faculty's method, and an ask of a being
in a named house.

Its bodies are the browser's. Seeds are sealed under an AES key that
IndexedDB holds unextractable, and memory is IndexedDB, named
`indexeddb` in an entry. Classes load from the page's own origin through
the `origin` body, `{ body: 'origin', at: '/house/index.js' }`, and a
path off the origin is refused. The recipe is the object you pass: its
faculties, made by a function, and any custom body.

Any script on the origin can use the ground's keys, so the ground is
whoever serves the origin's script. Give it an origin of its own, serve
nothing a stranger wrote there, and set a strict content security
policy. The page and the house's module must share one copy of
`nervur/being`, since a house knows a class by a mark that module gives.
A bundler's shared chunk or an import map gives the one copy.

A service worker opens the ground the same way, on a push, where no tab
runs it. It may not `import()`, so hand it the modules it imported
itself: `platform: { load: (href) => modules[new URL(href).pathname] }`.

### In an app

`AppGround.open({ shell })` from `nervur/app` is a BrowserGround in the
app's web view, on two interfaces the shell fills in native code:

- `NativeSecrets`: `get(name)` and `set(name, value)`, text kept by the
  iOS Keychain or the Android Keystore on this device alone.
- `NativeStore`: `get(key)`, `keys(prefix)`, and `swap(writes, expect)`,
  which lands every write only where each key in `expect` still holds
  what it names, and answers whether it landed.

The library holds the rest. Each house's seed goes into the secret
store, and each memory into the native store, which the system never
evicts as it may a web view's storage. A push token reaches the ground
through a faculty your recipe makes.

## What the house guarantees

1. **Every need is covered, or she is absent.** An absent being answers
   silence and keeps her cells.
2. **The asker's id is true.** Wherever the asker lives, the id she reads
   is who asked.
3. **Her notes are hers.** No one else writes them, and she never writes
   her steward's.
4. **She never holds an invitation's bytes.** Handles leave, standing ids
   arrive, and `s.invitation` passes through unopened.
5. **One ask at a time.** Asks to one being run in order, and `readOnly`
   asks run beside them.
6. **An ask lands whole or not at all.** Her cells, her relations, her
   effects and her call ids land in one write.
7. **An effect acts at most once, and its outcome is known.** Its answer,
   or its giving up, reaches her through `reply`.
8. **Her class is checked before her first ask.** A class that fails
   leaves her absent, and the refusal says why.

A failed ask changed nothing she owns, so asking again is safe.
