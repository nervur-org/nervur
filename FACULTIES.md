# Writing a faculty

A faculty is anything a being calls that is not a being: a payment
provider, a mail sender, a model, a sensor, a relay on a Pi. This guide
teaches the craft whole. [Writing for nervur](AUTHORING.md) teaches beings and
grounds, and the words both guides use.

The example is a garage door. A relay on a Raspberry Pi pulses once to
toggle the door, so a pulse sent twice opens the door and closes it
again. The relay is a page of Python. The ground brings the rest: one
call id across a crash and a lost reply, one twin granted the relay, and
a phone that reaches the twin from anywhere. Every file here is a file
the package's own tests run.

## What a faculty owes

A faculty answers a blueprint: a name, and methods with their schemas.
The ground hands it to its houses as an offer.

```text
offer = { blueprint, object, kinds?, window?, handler?, stop? }
```

- **The object has the blueprint's methods.** Each takes one args object
  and a context, and answers `{ result }` or `{ error: { message } }`.
- **An error is final, and a throw is not.** An error reaches the being
  as the answer. A throw, a crash or silence is a failure to answer, and
  the house asks again.
- **The context holds the call id**, and `call({ token, args, id })`,
  which calls a handle the faculty was handed.

The house checks the args against the offer's schema at each call, and
the answer against the being's need when it arrives. A being sees only
the methods her need names, and nothing else of the object.

### It acts once for each call id

A method marked `idempotent` is safe to repeat, so a being awaits it
during her ask. Every other method is an effect. The house writes an
effect in the same write as her cells, then sends it until it is
answered, with the same call id every time.

So one call arrives more than once. A reply lost on its way back brings
it again, and so does a program that died before it answered. A faculty
that changes the world keeps each call id with the answer it gave, where
a restart keeps it. It answers a call id it has seen with that answer,
and acts once.

It keeps them for its `window`, seven days where the offer names none.
The house gives up on an effect at the window and tells the being, so a
retry never outlives the faculty's memory.

### It calls back by token

A being may hand a faculty a handle to one of her asks, under
`s.handle` in the args. It arrives as a token, a string of at least 128
random bits that answers this faculty alone. The faculty calls it with
`context.call({ token, args, id })` whenever the world moves. Its own
`id` makes that call run once, however often it is sent.

A handle may reach a whole occupant rather than one ask, as a door a
steward's `invite` minted does. A face holds such tokens, one for each
person it serves. `context.call({ token, method, args, id, after, home
})` asks as that occupant, and `after` makes a `readOnly` ask a watch.
`home` carries the answer's handles home as invitation bytes, which the
person's own house takes.
`context.describe({ token })` reads what that occupant may ask now. The
being behind the token declares a need the face covers, so the ground's
grant decides which classes a face reaches.

### The ground grants it

A faculty is the ground's, never a house's. Its grant has two steps,
both the ground's. A house receives the faculties its entry names. Within
it, `kinds` lists the classes that may hold the offer, and without it,
every class whose need it covers holds it.

So a raw faculty reaches one class. Limits, approvals and quotas are not
the faculty's. One being holds the raw faculty, and every other being
reaches her through a standing, so policy is written as a being.

### It lives in the ground

The object arrives living. The ground's recipe makes each faculty by
name and awaits it up, and the house never starts, stops or restarts it.
Every being whose need it covers holds the same object.

- **`env`** is the ground's environment, so a secret stays on its
  machine and out of the code.
- **`dir(name)`** answers a folder of the faculty's own, where it keeps
  its call ids.
- **`handler`** answers HTTP on the ground's one listener. It takes a
  `Request` and answers a `Response`, or `null` where the request is not
  its own. A site, an API or an MCP server is a faculty with a handler.
- **`stop`** is called when the ground stops, faculties in the reverse
  of the order they were made.

## Three ways to wrap a program

| Way | What the object is | What a crash takes |
| --- | --- | --- |
| in the ground | a JavaScript object, an addon or a WASM module | the ground and every house |
| beside it | a program over the bridge | the calls in flight to it |
| far away | a client of a socket or an HTTP service | the calls in flight to it |

## The bridge

`bridge({ command, args, env, cwd })` from `nervur/node` starts a
program and answers an offer. The program may be written in any
language. It speaks one JSON value a line on its standard streams.

```text
in   { id, method, args, call }          a call to the program
out  { id, result } | { id, error }      its answer
out  { id, token, args, call }           the program calls a handle
in   { id, result } | { id, error }      the house's answer to that
```

- **It describes itself first.** Its first call is the method
  `describe`, and it answers `{ blueprint, window }`. It cannot offer
  what it does not declare.
- **Calls overlap.** Answers come in any order and are matched by `id`,
  and each direction keeps ids of its own.
- **`call` is the call id.** On a call in, it is the house's. On a
  handle the program calls, it is the program's own, and it must stay
  the same every time that call is sent, in every life of the program.
  A handle called with no `call` is refused.
- **It starts with an empty environment.** It holds only what `env`
  names, so it never reads the ground's seeds.
- **It is started again.** A program that exits fails every awaited call
  in flight to it, and the house sends each effect again with its call
  id. A program that keeps failing is started more slowly, up to a
  minute apart.
- **Its blueprint is fixed at the boot.** A program started again that
  describes another blueprint is stopped, and the ground says so. Every
  call to it then answers why, until its ground restarts.
- **Its standard error goes to the ground's log**, and a line is at most
  a mebibyte.

The bridge is not a sandbox. A program runs as the ground's user, and
`kinds` decides which classes reach it. A program you do not trust runs
as a user of its own. On Linux the recipe's command becomes `sudo`, with
`-n -u relay` before the program, and one rule allows it and nothing
else:

```text
nervur ALL=(relay) NOPASSWD: /usr/bin/python3 /srv/garage/relay.py
```

## The relay, in Python

```python
#!/usr/bin/env python3
# The relay on a garage's Pi, as a faculty over the bridge. One pulse
# toggles the door, so a pulse sent twice would open it and close it
# again. It keeps each call id before it pulses, and answers an id it has
# seen with the answer it gave, so a pulse sent again never toggles twice.
# It runs in the folder the ground gives it, where it keeps what it saw.
import json
import os
import sys

BLUEPRINT = {
    'name': 'relay',
    'methods': {
        'pulse': {
            'description': 'One pulse of the relay, which toggles the door.',
            'args': {'type': 'object', 'properties': {}, 'required': [], 'additionalProperties': False},
            'result': {'type': 'integer'},
        },
    },
}


def pulse(call):
    # The Pi drives its pin here. This relay writes a line, so a test counts pulses.
    with open('pulses', 'a') as relay:
        relay.write(call + '\n')


def keep(seen):
    with open('seen.json.tmp', 'w') as held:
        json.dump(seen, held)
        held.flush()
        os.fsync(held.fileno())
    os.replace('seen.json.tmp', 'seen.json')


def answer(id, **fields):
    sys.stdout.write(json.dumps({'id': id, **fields}) + '\n')
    sys.stdout.flush()


seen = json.load(open('seen.json')) if os.path.exists('seen.json') else {}
# Each life writes a line, so a test knows when the program started again.
with open('lives', 'a') as lives:
    lives.write(str(os.getpid()) + '\n')
for line in sys.stdin:
    message = json.loads(line)
    if message['method'] == 'describe':
        answer(message['id'], result={'blueprint': BLUEPRINT, 'window': 7 * 86_400_000})
    elif message['method'] != 'pulse':
        answer(message['id'], error={'message': 'no such method'})
    elif message['call'] in seen:
        answer(message['id'], result=seen[message['call']])
    else:
        count = len(seen) + 1
        # The call id is kept before the pulse, so a crash between them never pulses twice.
        seen[message['call']] = count
        keep(seen)
        pulse(message['call'])
        # A test writes `crash-after`: the program dies once after that pulse, before it answers.
        if os.path.exists('crash-after') and count == int(open('crash-after').read()):
            os.remove('crash-after')
            os._exit(1)
        answer(message['id'], result=count)
```

The call id is written to disk before the pin moves. A crash between the
write and the pulse loses one opening, and the call answers as if it
pulsed. The other order would pulse twice, and the door would close
again. For a door, a missed opening is the safe failure.
The blueprint is JSON Schema, in the subset `s` writes, so a need in
TypeScript and a program in any language describe one shape.

## The twin, and the remote

```ts
// The garage door's twin, on the Pi's ground, and the remote on a phone.
// The twin alone holds the relay, and keeps who opened the door and which
// pulse did it. The remote holds a standing on the twin and taps it by an
// effect, so a tap is sent until it is answered, and pulses once.
import { Being, need, s, type Args } from 'nervur/being';

/** The relay, as the Python program offers it: one pulse, answered with its count. */
export const Relay = need('relay', { pulse: { result: s.integer() } });

/** The twin, as the remote asks it. */
export const Door = need('garage', { open: {} });

export class Garage extends Being.of({
  kind: 'org.example.garage',
  description: 'The twin of a garage door: who opened it, and which pulse did.',
  needs: { relay: Relay },
  cells: { openers: [] as string[], pulses: [] as number[], failed: [] as string[] },
  asks: {
    open: {},
    pulsed: { args: s.reply(Relay.pulse) },
    log: { hints: { readOnly: true }, result: s.object({ openers: s.array(s.string()), pulses: s.array(s.integer()), failed: s.array(s.string()) }) },
  },
}) {
  open() {
    this.cells.openers = [...this.cells.openers, this.asker.id];
    this.relay.pulse({}, { reply: 'pulsed' });
  }

  pulsed({ result, error }: Args<Garage, 'pulsed'>) {
    if (error === undefined) this.cells.pulses = [...this.cells.pulses, result];
    else this.cells.failed = [...this.cells.failed, error.message];
  }

  log() {
    return this.cells;
  }
}

export class Remote extends Being.of({
  kind: 'org.example.remote',
  description: 'A garage remote on a phone: one tap, one opening.',
  cells: { garage: '', heard: 0, failed: [] as string[] },
  asks: {
    accept: { args: s.object({ invitation: s.handle() }), hints: { idempotent: true } },
    tap: {},
    opened: { args: s.reply(Door.open) },
    heard: { hints: { readOnly: true }, result: s.integer() },
  },
}) {
  accept({ invitation }: Args<Remote, 'accept'>) {
    this.cells.garage = invitation;
  }

  tap() {
    this.held(this.cells.garage, Door).open({}, { reply: 'opened' });
  }

  opened({ error }: Args<Remote, 'opened'>) {
    if (error === undefined) this.cells.heard += 1;
    else this.cells.failed = [...this.cells.failed, error.message];
  }

  heard() {
    return this.cells.heard;
  }
}
```

`pulse` is not `idempotent`, so it is an effect. It leaves once `open`
has landed, and its answer comes back to `pulsed`. The twin never waits
on the relay, and the relay never waits on the twin. The remote asks the
twin by an effect too, so a tap made while the Pi is unreachable reaches
it later, once.

## The recipe

```ts
// recipe.ts
import { fileURLToPath } from 'node:url';
import { bridge, type Recipe } from 'nervur/node';

const relay = fileURLToPath(new URL('./relay.py', import.meta.url));

// The relay runs in a folder of its own, granted to the twin's class alone.
export const faculties: NonNullable<Recipe['faculties']> = ({ dir }) => ({
  relay: dir('relay').then(async (cwd) => ({ ...(await bridge({ command: 'python3', args: [relay], cwd })), kinds: ['org.example.garage'] })),
});
```

The Pi's folder holds the recipe, the program and a folder of classes
for its house. The house is added once, and names the relay among the
faculties it receives.

```bash
npx nervur houses add name=garage memory='{"body":"ledger"}' classes='{"body":"folder","at":"classes"}' faculties='["relay"]'
```

## In JavaScript

`serve(need, methods)` from `nervur/serve` is the program's side of the
bridge in JavaScript. It answers `describe` from the need, and every
call with the method it names. A method receives its args and a context:
the call id, and `call(token, args, id?)` for a handle it was handed.
Where no `id` is given, the handle's call id is the call's own id and
its count within the call. A retry of the call calls back with the same
ids, so the handle acts once. A method that throws answers an error,
which is final. A program that must be asked again exits instead, and
the ground starts it again.

```ts
// A doorbell, as a faculty written in JavaScript and run over the bridge
// by `nervur/serve`. A being hands it the handle of an ask to call when
// the bell is pressed; a press calls that handle back through the house.
import { need, s } from 'nervur/being';
import { serve } from 'nervur/serve';

export const Doorbell = need('doorbell', {
  watch: { args: s.object({ inbox: s.handle() }), hints: { idempotent: true } },
  press: {},
});

let inbox: string | undefined;

serve(Doorbell, {
  watch: ({ inbox: token }) => {
    inbox = token as string;
    return null;
  },
  press: async (_args, context) => {
    if (inbox === undefined) throw new Error('no one watches the bell');
    const answered = await context.call(inbox, {});
    if ('error' in answered) throw new Error(answered.error.message);
    return null;
  },
});
```

The recipe starts it with `bridge({ command: 'node', args:
['doorbell.js'] })`. A faculty that needs no process of its own is a
plain object in the recipe instead, as the shop's payments are in
[Writing for nervur](AUTHORING.md).

## Testing a faculty

A faculty is tested on BenchGround, the ground in memory from
`nervur/bench`, with the program itself behind the bridge. The ground
makes it from the recipe, as every ground does. A `FakeNetwork` joins
grounds and loses what the test tells it to lose, and its one clock
moves them all. A test waits on what it can hear: a watch on a being's
answer, or a line the program writes. The clock moves only as far as a
retry is due.

The Pi's house and the phone's each have a steward the owner pilots
through the hand. It answers `bear`, and `offerFor`, which mints a paper
on one of its beings for an occupant, as the shop's steward does in
[Writing for nervur](AUTHORING.md). The phone's remote takes that paper
as its standing on the twin.

```ts
// garage.test.ts
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, watch, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import * as phone from './phone.ts';
import * as pi from './pi.ts';
import { faculties } from './recipe.ts';

test('Each tap on the phone pulses the relay once, whatever fails between', { timeout: 30_000 }, async (t) => {
  const state = mkdtempSync(join(tmpdir(), 'garage-'));
  t.after(() => rmSync(state, { recursive: true, force: true }));
  const dir = async (name: string) => {
    mkdirSync(join(state, name), { recursive: true });
    return join(state, name);
  };
  // The program dies once, after its second pulse and before it answers.
  writeFileSync(join(await dir('relay'), 'crash-after'), '2');
  const network = new FakeNetwork();

  // The Pi's ground, which makes the recipe's relay, and the door's twin.
  const garage = await BenchGround.open({ network, host: 'pi', names: ['garage.local'], modules: { pi }, recipe: () => faculties({ env: {}, dir }) });
  t.after(() => garage.down());
  await garage.add('garage', 'pi', { faculties: ['relay'] });
  await garage.ask({ house: 'garage', method: 'bear', args: { kind: 'org.example.garage', id: 'door' } });

  // Alice's phone: a device, holding a standing on the twin.
  const alice = await BenchGround.open({ network, host: 'phone', modules: { phone } });
  t.after(() => alice.down());
  await alice.add('phone', 'phone');
  await alice.ask({ house: 'phone', method: 'bear', args: { kind: 'org.example.remote', id: 'remote' } });
  const paper = await garage.ask({ house: 'garage', method: 'offerFor', args: { being: 'door', occupant: 'alice' } });
  await alice.ask({ house: 'phone', id: 'remote', method: 'accept', args: { invitation: (paper as { result: { handle: string } }).result.handle } });

  // A being's answer, watched until it is what the test waits for: each ask answers once it moves.
  const watched = async <T>(ground: BenchGround, house: string, id: string, method: string, done: (seen: T) => boolean): Promise<T> => {
    let seen = ((await ground.ask({ house, id, method })) as { result: T }).result;
    while (!done(seen)) seen = ((await ground.ask({ house, id, method, after: { result: seen as never } })) as { result: T }).result;
    return seen;
  };
  const pulsed = (count: number) => watched<{ pulses: number[] }>(garage, 'garage', 'door', 'log', (log) => log.pulses.length >= count);
  const heard = (count: number) => watched<number>(alice, 'phone', 'remote', 'heard', (seen) => seen >= count);
  // Resolves once the relay's program has started `count` times.
  const lives = (count: number) =>
    new Promise<void>((resolve) => {
      const started = () => existsSync(join(state, 'relay', 'lives')) && readFileSync(join(state, 'relay', 'lives'), 'utf8').trim().split('\n').length >= count;
      const watcher = watch(join(state, 'relay'), () => {
        if (!started()) return;
        watcher.close();
        resolve();
      });
      t.after(() => watcher.close());
      if (!started()) return;
      watcher.close();
      resolve();
    });
  const tap = async () => assert.ok('result' in (await alice.ask({ house: 'phone', id: 'remote', method: 'tap' })));

  await tap();
  await pulsed(1);
  await heard(1);

  // The second pulse kills the program before it answers. Once it runs
  // again, a second on the bench's clock sends the pulse again, with its
  // call id, and the program answers the pulse it gave.
  await tap();
  await lives(2);
  await network.elapse(1_000);
  await pulsed(2);
  await heard(2);
  assert.ok(!existsSync(join(state, 'relay', 'crash-after')), 'the program died between its second pulse and its answer');

  // The reply to the phone is lost, so a second later it asks again, and
  // the twin answers from its call id.
  network.loseNext();
  await tap();
  await pulsed(3);
  await network.elapse(1_000);
  await heard(3);

  assert.ok(network.crossings.some(({ outcome }) => outcome === 'lost'), 'a reply to the phone was lost');
  assert.equal(readFileSync(join(state, 'relay', 'pulses'), 'utf8').trim().split('\n').length, 3, 'three pulses, never four');
  assert.deepEqual(await garage.ask({ house: 'garage', id: 'door', method: 'log' }), { result: { openers: ['alice', 'alice', 'alice'], pulses: [1, 2, 3], failed: [] } });
});
```

Three taps open the door three times. The second pulse's program dies
before it answers, and the house sends that call again to the program
started anew, which answers from what it kept. The third tap's reply to
the phone is lost, and the phone's house sends it again to the twin,
which answers from its own call ids. The relay pulses three times, never
four.

`pi.ts` and `phone.ts` are the two houses' folders, each a steward and
the class it holds. A faculty a test does not run is an object the test
writes, whose methods answer, throw, refuse or never answer as the test
needs. Where no offer covers a need of a class, bearing a being of it
fails with `no offer covers her need <member>`.
