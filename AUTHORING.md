# Writing a species

A species is a class of beings you write. This guide teaches it whole:
how to declare one, how she calls others, how beings compose, and how you
prove her. An author who finishes it writes and proves a species alone.

You meet the library at three moments. Writing a species is this guide.
Writing a faculty, which reaches the world outside, is
[Writing a faculty](FACULTIES.md). Running a ground, the process houses
run in, is [Grounds](GROUNDS.md) and [the command](COMMAND.md).
[Reading a world](WORLD.md) says which pieces a situation needs.

The examples build one small shop, and every file here is one the
package's own tests run.

- `Order` is one order, from its first item to its shipping.
- `Shop` is the steward, the being who runs the house.
- `Lobby` is the public being, whom strangers may ask.

## A being is five things

A being is an instance of a species. She is five things, and nothing
else reaches her.

| Part | What it is |
| --- | --- |
| cells | her state, JSON values, kept when an ask lands |
| asks | the methods others may call on her, each with its entry |
| occupants | edges in: who may ask her, each by id |
| standings | edges out: other beings she may ask, each by id |
| bodies | edges out: faculties she calls through her needs |

Two edges every being holds. `house` is a default body: the time, random
bytes and alarms. `root` is a default occupant: the owner, through the
house's hand. A normal being also holds her steward, as a standing and as
an occupant.

A position adds one edge. A steward is a being plus the body `powers`. A
public being is a being plus the occupant `stranger`, who stands for
every asker with no relation. Every other rule is the same, so a species
never asks where she was placed.

## Declaring a species

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
      idempotent: true,
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
    charged: { in: 'paying', for: 'pay', args: s.reply(Payments.charge), to: ['paying', 'open'] },
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
`ship` asks the courier through the standing `hire` took. `shipped` is a
terminal state, and nothing leaves it.

A species extends `Being.of({ … })`, and TypeScript reads her types from
that one object. Every field is optional but `kind` and `asks`.

| Field | What it is |
| --- | --- |
| `kind` | her name for the house: a reversed domain you own, then a name |
| `description` | one line for readers and agents |
| `cells` | her state and its defaults |
| `needs` | blueprints she calls, each under a member name she chooses |
| `roles` | named tests over the asker and her cells |
| `state` | a function naming her current state; omitted, `ready` alone |
| `asks` | one entry per method she answers |
| `view` | markup as text over her asks, at most 64 KiB, which a screen renders |

A method in TypeScript names its args with `Args<Class, 'method'>`. A
method in JavaScript writes nothing.

### An ask's entry

| Field | What it says |
| --- | --- |
| `for` | the roles that may call it |
| `in` | the states where the ask exists; omitted, every state |
| `to` | the states it may land in; omitted, the state it began in |
| `args` | the schema of what it takes; omitted, the empty object |
| `result` | the schema of what it answers; omitted, nothing |
| `readOnly` | it writes nothing, and implies `idempotent`; the house holds it |
| `idempotent` | it is safe to repeat, so its caller awaits it |
| `hints` | `{ destructive }`, the one hint, which changes nothing in the house |
| `replayable` | your word that a stranger may repeat it, though it is not idempotent |
| `wait` | milliseconds she may run; omitted, thirty seconds, and never past five minutes |
| `examples` | histories the bench runs, each ending in one ask and what it gives |
| `description` | one line for readers and agents |

`in`, `for` and `to` each take one name or a list. A method with no entry
is never reached, and an entry with no method refuses the species.

### Roles

A role names who may ask. An omitted `for` means every occupant, and
never an edge out of her. Five roles are the house's, for occupants.

- `root` is the owner, through the hand.
- `steward` is her steward.
- `being` is a being her steward introduced to her.
- `stranger` is any asker of a public being with no relation.
- `handle` is whoever holds a handle she minted to this ask.

The rest are edges out of her, which answer her and ask nothing else.
Each need's member is a role, held by the body answering her effect on
it. `standing` is held by a standing answering hers. `powers` is held by
a being her steward's powers asked, and `house` by the house. So the
order's `charged` says `for: 'pay'`, and no occupant fakes the payment's
answer.

Every other role is yours, a function of `(asker, me)`. The order's
`owner` reads the steward's notes on the asker, so only the steward
decides who owns an order.

The house checks the table when it first loads the species. It refuses a
state no ask reaches, an ask no role reaches, and a role no ask names. A
method that lands in a state outside its `to` fails, and nothing lands.

### Schemas and needs

One builder gives the schema and the TypeScript type: `s.object`,
`s.string`, `s.number`, `s.integer`, `s.boolean`, `s.array`, `s.enum`,
`s.const`, `s.bytes`, `s.optional`, `s.handle`, `s.invitation` and
`s.reply`. The house checks every ask against them.

- `s.bytes` is a `Uint8Array` in the process and hex across a door.
- `s.handle` carries a relation. A handle leaves as an invitation, and
  an invitation arrives as a new standing id.
- `s.invitation` carries an invitation unopened, which she passes on.
- `s.reply(method)` is the args of an effect's reply.

A need is a blueprint at its minimum: what she calls, never what a
faculty offers. `need(name, methods)` writes one, and `needs` binds it to
a member of her own. A faculty covers it where the names match, every
method is offered, and each is `idempotent` in both or in neither. Every
need is covered, or she is absent: she answers silence and keeps her
cells until one is.

## How she calls

The callee decides how it is called, by one flag its describe shows. A
method marked `idempotent` or `readOnly` is harmless to repeat, so she
awaits it during her ask. Everything else changes the world, so she
commits it as an effect.

### Awaited calls answer as data

An awaited call never throws into her code. It answers a
`Reply<T>`, which is `{ result }` or `{ error: { message } }`. Silence
reads as an error saying the call answered nothing. She decides what an
error means.

- `this.must(reply)` gives the result, or fails her ask with the error.
- `this.fail(message)` refuses her ask with a message the asker can act
  on. Nothing of her ask lands.
- `this.silence()` answers nothing, as an absent being does, and nothing
  lands. A prober learns nothing from it.

A failed ask changed nothing she owns, so asking again is safe.

### Effects commit after she lands

An effect returns nothing. The house writes it in the same write as her
cells, then sends it with one call id until it is answered. So it acts
at most once, and never leaves where her ask failed. Its answer asks the
method `reply` names, as `{ result }` or `{ error }`. It gives up at its
deadline, seven days for a standing, and its reply hears why. Effects to
one receiver leave one at a time, in order.

### Who asks

Every ask arrives from one true id on her graph, never a disguise.

- An occupant asks as itself, and `this.asker` holds its id and notes.
- A reply comes from the edge that answered: a need's member, `standing`
  or `powers`.
- An alarm comes from `house`, so its ask names `house` in its `for`.
- An effect to a stranger's door answers as `house`, since that door is
  no edge of hers.

### What she reaches

| Member | What it is |
| --- | --- |
| `this.id`, `this.cells` | her id and her values |
| `this.asker` | `{ id, notes, steward }` of who asks now, and `signer` for a stranger |
| `this.house` | `now()`, `random({ length })`, `alarm({ at, ask, args, key })`, `cancelAlarm({ key })` |
| `this.<need>.<method>(args, { reply? })` | a call on a body |
| `this.held(id, Need).<ask>(args, { reply?, after? })` | a call on a standing matched to a need |
| `this.held(id).describe()`, `.ask(method, args)` | a standing she holds no need for, read first |
| `this.stranger({ ward, at }, Need).<ask>(args)` | a far house's public being, asked as a stranger |
| `this.standings` | `list()`, `note(id, notes)` and `drop(id)` |
| `this.occupants` | `list()`, `note(id, notes)` and `dismiss(id)` |
| `this.handle(ask, { bind?, notes?, once?, expires? })` | a handle to one of her asks |
| `this.invite(id, { notes?, expires? })` | a new occupant, as a handle |
| `this.steward` | her steward, where she is not one |
| `this.powers` | the steward's six powers |
| `this.fail`, `this.silence`, `this.must` | how an ask refuses or reads a reply |

An alarm lives in the house's rows and survives every restart. A second
alarm under one key replaces the first.

### Watching

A watch is a `readOnly` ask or body method asked with `after`, the
answer she holds. The house answers at once where the answer differs.
Otherwise it answers the first answer that differs, or the same one when
the wait runs out. So a chat or an order's status is a loop of watches,
and nothing polls.

From a being, a watch sits inside a `readOnly` ask of her own:
`this.held(room, Messages).messages({}, { after: seen })`. Given `reply`
beside `after`, it leaves as an effect, and its answer asks her `reply`,
where she watches again. A watch across a door holds its relation until
it answers. So watch a far ask through a handle to it alone.

## The graph

A relation is born in one of two ways. She mints an invitation, and
another takes it. Or her steward's `introduce` joins two beings of one
house. A being is born holding her steward and occupied by no one else.

Each end cuts its own side. `this.standings.drop` lets a standing go.
`this.occupants.dismiss` ends an occupant, and the far standing fails at
its next call with `the standing was removed`. A far side that answers
nothing is never read as gone.

A handle is the only way a relation leaves her. `this.handle(ask)` admits
its holder to that one ask. `once` dismisses it after its first ask, and
`bind` fixes args the holder cannot change. `this.invite(id)` mints a
whole occupant. `expires` gives each invitation that long to be taken. A
handle never enters her cells.

A standing arrives where an ask's args carry an invitation under
`s.handle`. Taking one is safe to repeat: the same invitation gives the
same standing. So the order's `hire` is `idempotent`. She asks a far
standing from the ask after the one that took it.

Every relation carries two sets of notes. `notes` are hers alone.
`steward` are her steward's, which she reads and never writes.

### The steward

Every house has one steward, with the id `steward`. The owner asks her as
`root`, and she alone holds `this.powers`.

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
    orders: { for: 'pilot', readOnly: true, result: s.array(s.string()) },
    hire: {
      for: 'pilot',
      description: 'Hands a courier’s invitation to an order, which takes it.',
      idempotent: true,
      args: s.object({ order: s.string(), courier: s.invitation() }),
      result: s.string(),
    },
    enroll: {
      for: 'being',
      idempotent: true,
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
    return this.must(await this.powers!.ask({ id: order, method: 'hire', args: { courier } })) as string;
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
| `ask({ id, method, args }, { reply? })` | asks a being as her occupant `steward` |
| `introduce({ from, to, notes })` | gives `from` a standing on `to`, and `to` an occupant |
| `invite({ id, occupant, notes, expires? })` | gives a being a new occupant, and the steward its handle |

The powers land in the steward's own write, so a failed ask did none of
them. A being borne runs her `born` ask first, where she declares one,
asked by `steward`. The steward's `hire` declares the courier
`s.invitation`, so she carries it unopened. The order's declares it
`s.handle`, so the order holds the standing.

### Strangers

A house may name one public being, with the id `public`. She is
sovereign: each ask follows its own flag, and she answers what her
author wrote. `this.asker.signer` is the key a stranger signed with.

```ts
// classes/lobby.ts
import { Being, need, s } from 'nervur/being';

/** What the lobby asks of her steward. */
const Signup = need('signup', {
  enroll: {
    idempotent: true,
    args: s.object({ signer: s.bytes() }),
    result: s.object({ invitation: s.invitation() }),
  },
});

export class Lobby extends Being.of({
  kind: 'com.acme.lobby',
  description: 'The shop’s front door: a stranger signs up and receives an order of their own.',
  asks: {
    signup: { for: 'stranger', idempotent: true, result: s.object({ invitation: s.invitation() }) },
  },
}) {
  async signup() {
    return this.must(await this.held('steward', Signup).enroll({ signer: this.asker.signer! }));
  }
}
```

A stranger holds no relation, so a stranger's box may arrive twice. The
house answers a replayed box from a cache for ten minutes. Beyond that,
make every ask a stranger reaches `idempotent`, or mark it
`replayable: true`. A stranger who signs up twice here holds one order.

She asks a far public being with `this.stranger({ ward, at }, Need)`. She
awaits its idempotent asks and commits any other as an effect. That
effect's answer reaches her `reply` as `house`.

## What the house holds

- **Cells stay small.** Cells past one mebibyte fail her ask, and
  nothing lands.
- **Some ids are the house's.** `root`, `stranger`, `steward`, `house`,
  `powers` and `standing` are reserved, with every id beginning
  `handle:`, `being:` or `standing:`.
- **A member name never clashes.** An ask named as a member of `Being`,
  such as `invite` or `held`, refuses the species.
- **A species is pure.** It imports `nervur/being`, other species and its
  own files, and nothing that reaches a machine. It reaches time and
  randomness through `this.house` alone.
- **A species runs contained.** Each house runs in a runner of its own.
  A loop without end, or a rejection she left unawaited, fails her ask
  at its wait. Every other house and being goes on.

## Composition

Beings compose by asking each other. Four patterns cover what one being
alone cannot do.

### A saga, since nothing is atomic across beings

Her ask lands whole, but two beings never land together. So a step that
spans beings is a saga: one effect at a time, each answered through its
reply, and a step that fails undoes the ones before it.

```ts
// patterns/trip.ts
import { Being, need, s, type Args } from 'nervur/being';

export const Hotel = need('hotel', {
  hold: { args: s.object({ trip: s.string() }) },
  release: { args: s.object({ trip: s.string() }) },
});

export const Flight = need('flight', {
  book: { args: s.object({ trip: s.string(), seats: s.integer() }) },
});

// A saga: each step is an effect, and a step that fails undoes the ones before it.
export class Trip extends Being.of({
  kind: 'org.example.trip',
  cells: { state: 'planning', seats: 0 },
  state: (me) => me.cells.state,
  asks: {
    book: { in: 'planning', for: 'root', to: 'holding', args: s.object({ seats: s.integer() }) },
    roomHeld: { in: 'holding', for: 'standing', args: s.reply(Hotel.hold), to: ['booking', 'planning'] },
    flown: { in: 'booking', for: 'standing', args: s.reply(Flight.book), to: ['booked', 'planning'] },
  },
}) {
  book({ seats }: Args<Trip, 'book'>) {
    this.cells.seats = seats;
    this.held('hotel', Hotel).hold({ trip: this.id }, { reply: 'roomHeld' });
    this.cells.state = 'holding';
  }

  roomHeld({ error }: Args<Trip, 'roomHeld'>) {
    if (error) {
      this.cells.state = 'planning';
      return;
    }
    this.held('flight', Flight).book({ trip: this.id, seats: this.cells.seats }, { reply: 'flown' });
    this.cells.state = 'booking';
  }

  flown({ error }: Args<Trip, 'flown'>) {
    if (error) {
      // The room is held and the flight is not: the saga lets the room go.
      this.held('hotel', Hotel).release({ trip: this.id });
      this.cells.state = 'planning';
      return;
    }
    this.cells.state = 'booked';
  }
}
```

### Awaited edges form no cycle

While she awaits, she holds her queue. A call back to her waits behind
the ask that waits for it, until the wait runs out. So a being answering
her caller calls back with an effect, which leaves once her ask lands.

```ts
// patterns/team.ts
import { Being, need, s, type Args } from 'nervur/being';

const Work = need('work', {
  work: { idempotent: true, args: s.object({ job: s.string() }), result: s.string() },
});

const Report = need('report', {
  done: { args: s.object({ job: s.string() }) },
});

export class Manager extends Being.of({
  kind: 'org.example.manager',
  cells: { done: [] as string[] },
  asks: {
    assign: { for: 'root', idempotent: true, args: s.object({ job: s.string() }), result: s.string() },
    done: { for: 'being', args: s.object({ job: s.string() }) },
    report: { for: 'root', readOnly: true, result: s.array(s.string()) },
  },
}) {
  async assign({ job }: Args<Manager, 'assign'>) {
    return this.must(await this.held('clerk', Work).work({ job }));
  }

  done({ job }: Args<Manager, 'done'>) {
    if (!this.cells.done.includes(job)) this.cells.done = [...this.cells.done, job];
  }

  report() {
    return this.cells.done;
  }
}

export class Clerk extends Being.of({
  kind: 'org.example.clerk',
  asks: {
    work: { for: 'being', idempotent: true, args: s.object({ job: s.string() }), result: s.string() },
  },
}) {
  work({ job }: Args<Clerk, 'work'>) {
    // The manager awaits this ask, so she answers back with an effect.
    this.held('manager', Report).done({ job });
    return `on it: ${job}`;
  }
}

export const beings = [Manager, Clerk];
```

### An index being answers questions across beings

A being knows only her own cells. A question across many, such as the
cheapest listings, needs an index being that each one tells. The index
keys what it hears by the true asker, so no listing writes another's
entry.

```ts
// patterns/search.ts
import { Being, need, s, type Args } from 'nervur/being';

const Index = need('index', {
  put: { idempotent: true, args: s.object({ price: s.number() }) },
});

export class Listing extends Being.of({
  kind: 'org.example.listing',
  cells: { price: 0 },
  asks: {
    price: { for: 'root', args: s.object({ price: s.number() }) },
  },
}) {
  async price({ price }: Args<Listing, 'price'>) {
    this.must(await this.held('search', Index).put({ price }));
    this.cells.price = price;
  }
}

// The index answers the question no listing can: which are cheapest.
export class Search extends Being.of({
  kind: 'org.example.search',
  cells: { prices: {} },
  asks: {
    put: { for: 'being', idempotent: true, args: s.object({ price: s.number() }) },
    cheapest: { for: 'root', readOnly: true, result: s.array(s.string()) },
  },
}) {
  // Keyed by the true asker, so no listing writes another's price.
  put({ price }: Args<Search, 'put'>) {
    this.cells.prices = { ...this.cells.prices, [this.asker.id]: price };
  }

  cheapest() {
    const sorted = Object.entries<number>(this.cells.prices).sort(([, a], [, b]) => a - b);
    return sorted.slice(0, 3).map(([id]) => id);
  }
}

export const beings = [Listing, Search];
```

### Verifying who accepted an invitation

An invitation admits whoever takes it first. Where that must be one
person, the being checks it herself. Here the club keeps a pin in her
notes on the new occupant, and the pin travels by another road. A role
reads her notes, so the asks a member reaches stay hidden until the pin
is shown.

```ts
// patterns/club.ts
import { Being, need, s, type Args } from 'nervur/being';

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

export class Club extends Being.of({
  kind: 'org.example.club',
  roles: {
    guest: (asker) => typeof asker.notes.pin === 'string',
    member: (asker) => asker.notes.member === true,
  },
  asks: {
    admit: {
      for: 'root',
      args: s.object({ name: s.string() }),
      result: s.object({ invitation: s.handle(), pin: s.string() }),
    },
    claim: { for: 'guest', idempotent: true, args: s.object({ pin: s.string() }) },
    enter: { for: 'member', readOnly: true, result: s.string() },
  },
}) {
  // The invitation travels by one road and the pin by another.
  admit({ name }: Args<Club, 'admit'>) {
    const pin = hex(this.house.random({ length: 4 }));
    const invitation = this.invite(`guest-${name}`, { notes: { pin, name }, expires: 86_400_000 });
    return { invitation, pin };
  }

  // Whoever took the invitation proves they are the one it was meant for.
  claim({ pin }: Args<Club, 'claim'>) {
    if (pin !== this.asker.notes.pin) this.fail('That is not the pin.');
    this.occupants.note(this.asker.id, { member: true, name: this.asker.notes.name ?? '' });
  }

  enter() {
    return `Welcome, ${String(this.asker.notes.name)}.`;
  }
}

const Claim = need('claim', {
  claim: { idempotent: true, args: s.object({ pin: s.string() }) },
});

const Entry = need('entry', {
  enter: { readOnly: true, result: s.string() },
});

export class Guest extends Being.of({
  kind: 'org.example.guest',
  cells: { club: '' },
  asks: {
    join: { for: 'root', idempotent: true, args: s.object({ invitation: s.handle() }) },
    claim: { for: 'root', idempotent: true, args: s.object({ pin: s.string() }) },
    enter: { for: 'root', idempotent: true, result: s.string() },
  },
}) {
  join({ invitation }: Args<Guest, 'join'>) {
    this.cells.club = invitation;
  }

  async claim({ pin }: Args<Guest, 'claim'>) {
    this.must(await this.held(this.cells.club, Claim).claim({ pin }));
  }

  async enter() {
    return this.must(await this.held(this.cells.club, Entry).enter());
  }
}
```

A code the steward writes in her own notes serves the same end, as the
shop's `owner` does.

## Proving a species

`nervur/bench` proves a species at three levels: alone, as a household,
and as a world. The bench runs contained, as every ground does, so it
takes her module by its URL and loads her classes in the house's runner.

A house's folder names what the house holds, and the household reads it.

```ts
// classes/index.ts
export { Shop as steward } from './shop.ts';
export { Lobby as public } from './lobby.ts';
import { Order } from './order.ts';

export const beings = [Order];
```

```ts
// order.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bench } from 'nervur/bench';
import { Lobby } from './classes/lobby.ts';
import { Courier, Order } from './classes/order.ts';
import { Shop } from './classes/shop.ts';
import { Payments, paymentsOffer } from './payments.ts';

// Her module, which the bench loads in the house's own runner.
const module = new URL('./classes/order.ts', import.meta.url);

test('Order keeps her table: every state and role shows what it owes', async () => {
  await Bench.check(Order, { module });
});

test('An order is paid once the provider calls the handle it was given', async () => {
  // The provider stands in memory.
  const payments = new Payments();
  const bench = await Bench.open({ module, offers: [paymentsOffer(payments)] });
  const order = await bench.place(Order, { id: 'first' });

  assert.deepEqual(await order.ask('checkout'), { error: { message: 'Add an item first.' } });
  assert.deepEqual(await order.ask('add', { sku: 'tea', price: 4 }), { result: { total: 4 } });
  assert.deepEqual(await order.ask('checkout'), { result: null });
  await bench.settle();
  assert.equal((await order.describe())?.state, 'paying', 'the charge left once checkout landed, and answered pending');

  assert.deepEqual(await payments.settle('first'), { result: null });
  await bench.settle();
  assert.equal((await order.describe())?.state, 'paid');
  assert.deepEqual(await order.ask('add', { sku: 'jam', price: 1 }), { error: { message: 'not in this state' } });
});

test('A paid order ships through the courier she hired, whose stand-in hears her', async (t) => {
  const payments = new Payments();
  const bench = await Bench.open({
    module,
    offers: [paymentsOffer(payments)],
    // The courier's side of her standing, answered by the handlers in courier.ts.
    standIns: { courier: { need: Courier, module: new URL('./courier.ts', import.meta.url) } },
  });
  t.after(() => bench.close());
  const order = await bench.place(Order, { id: 'second' });

  // Her steward carries the invitation, and she takes it as a standing of her own.
  await order.ask('hire', { courier: await bench.invitation('courier') });
  await order.ask('add', { sku: 'tea', price: 4 });
  await order.ask('checkout');
  await payments.settle('second');
  await bench.settle();
  assert.deepEqual(await order.ask('ship'), { result: null });
  await bench.settle();
  assert.deepEqual(await bench.heard('courier'), [{ method: 'pickup', args: { items: ['tea'] } }]);
});

// The house module: its steward, its public being and its beings.
const house = new URL('./classes/index.ts', import.meta.url);

test('The steward and the lobby keep their tables where the house places them', async () => {
  await Bench.check(Shop, { module: house, position: 'steward' });
  await Bench.check(Lobby, { module: house, position: 'public' });
});

test('Her house keeps its table as one household: each being walked beside the others', async () => {
  await Bench.household({ module: house });
});
```

### Alone

`Bench.check(Class, { module, position?, steward? })` proves her alone,
where the house would place her: `normal`, `steward` or `public`. It runs
every example and walks every state. An owner's dock steward is checked
at `dock`, as GROUNDS.md says. It throws an error naming every
finding that failed.

An example is a history, then one ask. `given` lists the asks that
bring her from her `born` to where it starts. `role` asks, `args` are
the ask's, `fakes` answer her needs, and `gives` is the answer owed.

The walk describes every state she reaches to every role the bench can
play. It then plays each ask by each role its `for` names. The bench
plays a role as an owner could: `root` through the hand, `steward` as her
steward, `being` as a being introduced to her, and `stranger` at the
public being. A role of yours is an occupant whose steward notes hold it
`true`. A role read from her own notes is hers to grant, and the bench
plays it only where her asks grant it.

The checker flags each of these.

- An example whose answer differs from its `gives`.
- A re-run of one history that answers differently, or leaves her cells
  differently.
- A state that shows a role other asks than her table owes it.
- An ask she refuses to a role her table gives it.
- A `readOnly` ask that writes.
- An ask that lands in a state its `to` does not name.
- An ask that throws past `fail`.
- A reply her table refused, played where her own asks reach its edge.
- An ask a stranger reaches that is neither `idempotent` nor
  `replayable`.

### Her bodies and standings

`Bench.open({ module, offers, standIns, steward, public })` opens a
bench to drive her by hand. `place(Class, { id, born })` places her.
`ask(method, args, { role })` and `describe({ role })` meet her as a role
would. `cells()` reads her cells as her owner reads them. `settle()` lets
every effect and reply run, and `advance(ms)` moves the clock.

A body stands beside her as an offer: `{ blueprint, object }`, an object
your test writes, which keeps its own calls. The order's payments are
one, and [Writing a faculty](FACULTIES.md) teaches how to write them.

A standing stands beside her as a stand-in. `standIns` names each by id,
with her need and a module of handlers, one function for each method. A
throw refuses the ask with its message. The bench introduces each to
every being it places, under that id. `bench.invitation(id)` answers an
invitation to one, which her ask takes as a standing of her own.
`bench.heard(id)` answers what it heard, in order.

A standing on another species of yours is an introduction.
`bench.introduce(from, to)` makes one as a steward does, each side a
placed being or an id. `{ notes }` writes her steward's notes on the
relation, where she finds a standing by them. So a manager and her
clerk are proven on one bench, before their household. The bench
introduces beside its own steward alone. A steward you bring holds the
powers, and the bench bears nothing in her house, neither a being nor
a stand-in.

```ts
// courier.ts
// The courier's side of her standing, one function for each method of
// her need. On the bench a stand-in runs them in the house's own runner.
export const pickup = ({ items }: { items: string[] }): void => {
  if (items.length === 0) throw new Error('Nothing to pick up.');
};
```

### A household

`Bench.household({ module, beings?, introduce? })` stands a house module
whole. The bench's steward bears every being it lists, places its public
being, and makes each introduction `introduce` names. Each being is
walked in place, beside the others. An awaited call that answered nothing
between two of them is a finding naming both, since it came back into
its own chain.

### A world

A world is proven on a `BenchGround`: a ground in memory, on a
`FakeNetwork` whose one clock the test moves. The test stands faculties
and houses through the ground's hand, as an owner does. Several grounds
join one network, so one test proves the same species at every distance.

```ts
// world.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { faculties } from './recipe.ts';

const shop = new URL('./classes/index.ts', import.meta.url);

test('The shop stands as a world: its owner opens an order through the hand', async (t) => {
  const ground = await BenchGround.open({ network: new FakeNetwork(), host: 'shop', modules: { shop }, registry: { faculties } });
  t.after(() => ground.down());
  await ground.hand({ method: 'facultiesAdd', args: { name: 'payments', make: 'payments' } });
  await ground.add('shop', 'shop', { faculties: ['payments'] });

  assert.ok('result' in (await ground.ask({ house: 'shop', method: 'open', args: { id: 'first' } })));
  assert.deepEqual(await ground.ask({ house: 'shop', method: 'orders' }), { result: ['first'] });
  const order = await ground.ask({ house: 'shop', id: 'first' });
  assert.equal('describe' in order && (order.describe as { state: string }).state, 'open');
});
```

`recipe.ts` is the registry of the shop's faculties, and
[Grounds](GROUNDS.md) says how a ground stands one.

### In your gate and in CI

The same checker runs in your gate and in CI. `@nervur-org/proof`, an
open package beside the library, proves a folder with `nervur test`. It
checks each species where its ground places her, with `Bench.check`, and
walks each house folder with `Bench.household`. Run your own suites with
`node --test`, and check your types with `npx tsc --noEmit`, since a need
you forgot to declare fails only inside her ask.
