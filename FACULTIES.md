# Writing a faculty

A faculty is anything a being calls that is not a being: a payment
provider, a mail sender, a model, a sensor, a relay on a Pi. This guide
teaches the craft whole. [Writing a species](AUTHORING.md) teaches beings,
and [Grounds](GROUNDS.md) how they run.

The example is a garage door. A relay on a Raspberry Pi pulses once to
toggle the door, so a pulse sent twice opens the door and closes it
again. The relay is a page of Python. The ground brings the rest: one
call id across a crash and a lost reply, one twin granted the relay, and
a phone that reaches the twin from anywhere. Every file here is a file
the package's own tests run.

## What a faculty owes

A faculty is a class extending `Faculty` from `nervur`. Its blueprint is
a name, and methods with their schemas. A registry holds the class by
name. The ground makes one instance of it, the body, and runs its hooks.
It hands the body to its houses as an offer, with the kinds its entry
grants.

```text
statics = { blueprint, takes?, needs?, version?, window?, fake?, examples?, contract? }
hooks   = install?, migrate?(from), up?, health?, down?, uninstall?   each answers { ok, why? }
parts   = handler?, registry?, schemes?, port?, house?(options), opened?(context)
takes   = { args?: schema, secrets?: { [name]: what it holds } }
needs   = { [kind]: what an installer reads }
made    = this.made: { name, args, secrets, faculties, memory, derive, met, call, listener }
offer   = { blueprint, object, kinds?, window? }
```

Every hook is optional, and the base class answers each one `{ ok: true
}`. A hook that answers `{ ok: false, why }` keeps the body down with
that why. A throw is read the same way, so nothing a faculty does falls
further than its own body.

- **It declares what it takes.** `takes.args` is a schema built with
  `s` from `nervur/being`, which its entry's args meet. `takes.secrets`
  names each secret it takes, with a line saying what it holds. The hand
  refuses an entry whose args fail, before it lands, and
  `facultiesCatalog` shows both to whoever writes the entry.
- **It waits for a secret, and never breaks without one.** A secret is
  declared, never required. Reading one it takes while it is not kept
  throws, and the ground keeps the body down with why, naming the secret
  and what it holds. Setting the secret raises the body with no restart,
  and removing it brings the body down. A faculty that goes on without a
  secret asks `name in secrets` first.
- **The body has the blueprint's methods.** Each is an instance method
  that takes one args object and a context, and answers `{ result }` or
  `{ error: { message } }`.
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
that changes the world keeps each call id with the answer it gave, in
its own memory, `this.made.memory`, where a restart and a move keep it. It
answers a call id it has seen with that answer, and acts once.

It keeps them for its `window`, seven days where the offer names none.
The house gives up on an effect at the window and tells the being, so a
retry never outlives the faculty's memory.

### It may be watched

A being watches a `readOnly` method of a faculty as she watches a
standing's ask, passing the result she holds as `after`. The method then
receives `context.watch`. It holds its answer while `context.watch.same`
says it equals hers, and answers once it differs. The house ends the
watch at `context.watch.until` whatever the faculty does. So a faculty
that ignores the watch answers at once, and she polls.

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
both the ground's. A house receives the faculties its entry names.
Within it, the faculty's own entry lists in `kinds` the classes that may
hold the offer, and without it, every class whose need it covers holds
it.

So a raw faculty reaches one class. Limits, approvals and quotas are not
the faculty's. One being holds the raw faculty, and every other being
reaches her through a standing, so policy is written as a being.

### It lives in the ground

The body arrives living. The ground makes each faculty its entries name
and awaits its `up`, and the house never starts, stops or restarts it.
Every being whose need it covers reaches the same body. Every hook reads
`this.made`, which holds six things beside the entry's name.

- **`args`** are its entry's, as the owner wrote them.
- **`secrets`** are the secrets its entry names that are kept, set
  through the hand and kept sealed in a being of the ground's dock. No
  other code reads them. One read while it is absent keeps the body
  waiting for it.
- **`memory`** is the faculty's own, a view of the ground's memory
  sealed under a key the ground derives for it. Its call ids live there,
  so they move with the ground.
- **`derive(label, length)`** answers bytes the ground derives from its
  key for this entry and the label, thirty-two at least. The same entry
  derives the same bytes in every life, so a key it signs with is never
  stored.
- **`call({ faculty, method, args, id })`** calls a method of a body its
  entry names in `faculties`, and of no other. It answers `{ result }`
  or `{ error }`, and never throws. A body down answers an error naming
  why, so no faculty holds another's object.
- **`listener`** is the ground's one listener, which a carry that serves
  HTTP serves.

`install` does the slow work once for each entry. A program's packages
and a repository's checkout are installed there, so going up again
installs nothing.

A body carries four parts beside its methods, each where it has one.

- **`handler`** answers HTTP on the ground's one listener. It takes a
  `Request` and answers a `Response`, or `null` where the request is not
  its own. A site, an API or an MCP server is a body with a handler.
- **`down()`** lets go of what its `up` opened. The ground calls it when
  the body is updated, restarted or removed, and when the ground stops,
  bodies in the reverse of the order they stood.
- **`registry`** holds more faculties, for every entry that names this
  body in `from`. A module of code, a git repository and a program's
  catalogue are each a registry.
- **`window`** is how long it remembers a call id.

The hand changes a body. `faculties update` lands a new entry, and the
body goes down and up on it. `faculties restart` takes it down and up on
the same entry. Each house that names it opens again.

## Three ways to wrap a program

| Way | What the object is | What a crash takes |
| --- | --- | --- |
| in the ground | a JavaScript object, an addon or a WASM module | the ground and every house |
| beside it | a program over the bridge | the calls in flight to it |
| far away | a client of a socket or an HTTP service | the calls in flight to it |

## The bridge

`bridge({ command, args, env, cwd, memory })` from `nervur/node` starts
a program and answers a body. A NodeGround raises one by its faculty
`bridge`, from its entry alone. The program may be written in any
language. It speaks one JSON value a line on its standard streams.

```text
in   { id, method, args, call }          a call to the program
out  { id, result } | { id, error }      its answer
out  { id, token, args, call }           the program calls a handle
in   { id, result } | { id, error }      the house's answer to that
out  { id, memory, args }                the program reads or writes its memory
in   { id, result } | { id, error }      the ground's answer to that
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
  names, so it never reads the ground's key. The faculty `bridge` names
  there the secrets of its entry, each under its name.
- **It keeps its state in the faculty's memory.** A memory line names
  `read`, `list` or `write` and the memory's args, every entry's bytes
  in lowercase hex. A write names the versions it read in `expect`, and
  answers `null` where another write moved them. Nothing it keeps rests
  in its folder.
- **It is started again.** A program that exits fails every awaited call
  in flight to it, and the house sends each effect again with its call
  id. A program that keeps failing is started more slowly, up to a
  minute apart.
- **Its blueprint is fixed while its faculty stands.** A program started
  again that describes another blueprint is stopped, and the ground says
  so. Every call to it then answers why, until its faculty stands again.
- **Its standard error goes to the ground's log**, and a line is at most
  a mebibyte.

The bridge is not a sandbox. A program runs as the ground's user, and
`kinds` decides which classes reach it. A program you do not trust runs
as a user of its own. On Linux the entry's command becomes `sudo`, with
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
# again. It keeps each call id in the faculty's memory before it pulses,
# and answers an id it has seen with the answer it gave, so a pulse sent
# again never toggles twice. Its memory is sealed by the ground and
# travels with it; its folder holds only what the Pi's pin would show.
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

waiting = []
asked = 0


def send(message):
    sys.stdout.write(json.dumps(message) + '\n')
    sys.stdout.flush()


def remember(op, args):
    # One memory line, and the ground's answer to it; calls that arrive meanwhile wait their turn.
    global asked
    asked += 1
    mine = 'memory-' + str(asked)
    send({'id': mine, 'memory': op, 'args': args})
    while True:
        line = sys.stdin.readline()
        if line == '':
            sys.exit(0)
        message = json.loads(line)
        if message.get('id') != mine or 'method' in message:
            waiting.append(message)
            continue
        if 'error' in message:
            raise RuntimeError(message['error']['message'])
        return message['result']


def seen():
    read = remember('read', {'place': 'seen'})
    return {call: int(bytes.fromhex(count).decode()) for call, count in read['entries'].items()}, read['version']


def keep(call, count, version):
    landed = remember('write', {'writes': {'seen': {call: str(count).encode().hex()}}, 'expect': {'seen': version}})
    if landed is None:
        # Another life wrote first: this one ends, and the ground starts it again.
        sys.exit(1)


def pulse(call):
    # The Pi drives its pin here. This relay writes a line, so a test counts pulses.
    with open('pulses', 'a') as relay:
        relay.write(call + '\n')


def messages():
    while True:
        if waiting:
            yield waiting.pop(0)
            continue
        line = sys.stdin.readline()
        if line == '':
            return
        yield json.loads(line)


# Each life writes a line, so a test knows when the program started again.
with open('lives', 'a') as lives:
    lives.write(str(os.getpid()) + '\n')
for message in messages():
    if message['method'] == 'describe':
        send({'id': message['id'], 'result': {'blueprint': BLUEPRINT, 'window': 7 * 86_400_000}})
        continue
    if message['method'] != 'pulse':
        send({'id': message['id'], 'error': {'message': 'no such method'}})
        continue
    counts, version = seen()
    if message['call'] in counts:
        send({'id': message['id'], 'result': counts[message['call']]})
        continue
    count = len(counts) + 1
    # The call id is kept before the pulse, so a crash between them never pulses twice.
    keep(message['call'], count, version)
    pulse(message['call'])
    # A test writes `crash-after`: the program dies once after that pulse, before it answers.
    if os.path.exists('crash-after') and count == int(open('crash-after').read()):
        os.remove('crash-after')
        os._exit(1)
    send({'id': message['id'], 'result': count})
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
    pulsed: { for: 'relay', args: s.reply(Relay.pulse) },
    log: { readOnly: true, result: s.object({ openers: s.array(s.string()), pulses: s.array(s.integer()), failed: s.array(s.string()) }) },
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
    accept: { args: s.object({ invitation: s.handle() }), idempotent: true },
    tap: {},
    opened: { for: 'standing', args: s.reply(Door.open) },
    heard: { readOnly: true, result: s.integer() },
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

## The entry

The Pi's folder holds the program and a folder of classes for its
house, and no code of the ground's. The relay stands from its entry,
raised by the faculty `bridge` of the NodeGround's folder, and granted
to the twin's class alone.

```bash
npx nervur faculties add name=relay from=folder make=bridge args='{"command":"python3","args":["relay.py"]}' kinds='["org.example.garage"]'
```

The house is added once, and names the relay among the faculties it
receives.

```bash
npx nervur houses add name=garage classes='{"faculty":"folder","at":"classes"}' faculties='["relay"]'
```

Both entries rest sealed as cells of the ground's dock, so the ground
stands the relay again at every start.

## In JavaScript

`serve(need, methods)` from `nervur/serve` is the program's side of the
bridge in JavaScript. It answers `describe` from the need, and every
call with the method it names. A method receives its args and a context:
the call id, `call(token, args, id?)` for a handle it was handed, and
`memory`, the faculty's own, whose `read`, `list` and `write` speak the
memory lines. Where no `id` is given, the handle's call id is the call's
own id and its count within the call. A retry of the call calls back with the same
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
  watch: { args: s.object({ inbox: s.handle() }), idempotent: true },
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

Its entry raises it with the faculty `bridge`, its command `node` and
its args `["doorbell.js"]`. A faculty that needs no process of its own
is a class extending `Faculty` whose methods answer instead.

## Testing a faculty

A faculty is tested on BenchGround, the ground in memory from
`nervur/bench`, with the program itself behind the bridge. The test
hands the bench a registry whose `bridge` faculty bridges the program, as a
NodeGround's own does, and stands the relay through the ground's hand,
as an owner does. A `FakeNetwork` joins
grounds and loses what the test tells it to lose, and its one clock
moves them all. A test waits on what it can hear: a watch on a being's
answer, or a line the program writes. The clock moves only as far as a
retry is due.

The Pi's house and the phone's each have a steward the owner pilots
through the hand. It answers `bear`, and `offerFor`, which mints a paper
on one of its beings for an occupant, as the shop's steward does in
[Writing a species](AUTHORING.md). The phone's remote takes that paper
as its standing on the twin.

```ts
// garage.test.ts
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, watch, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Faculty, OK, type Status } from 'nervur';
import { BenchGround, FakeNetwork } from 'nervur/bench';
import { bridge } from 'nervur/node';

const phone = new URL('./phone.ts', import.meta.url);
const pi = new URL('./pi.ts', import.meta.url);

test('Each tap on the phone pulses the relay once, whatever fails between', { timeout: 30_000 }, async (t) => {
  const state = mkdtempSync(join(tmpdir(), 'garage-'));
  t.after(() => rmSync(state, { recursive: true, force: true }));
  // Where the program runs, and where the Pi's pin shows each pulse.
  const pin = join(state, 'relay');
  mkdirSync(pin);
  // The program dies once, after its second pulse and before it answers.
  writeFileSync(join(pin, 'crash-after'), '2');
  const network = new FakeNetwork();

  // The Pi's ground, whose registry bridges the program as a NodeGround's does, and the door's twin.
  const relay = fileURLToPath(new URL('./relay.py', import.meta.url));
  class Bridged extends Faculty {
    #stop: (() => unknown) | undefined;
    // Its blueprint and its methods are what the program describes, so only its `up` learns them.
    override async up(): Promise<Status> {
      const { blueprint, window, object, down } = await bridge({ command: 'python3', args: [relay], cwd: pin, memory: this.made.memory });
      Object.assign(this, object);
      this.blueprint = blueprint;
      this.window = window;
      this.#stop = down;
      return OK;
    }
    override async down(): Promise<void> {
      await this.#stop?.();
    }
  }
  const garage = await BenchGround.open({ network, host: 'pi', names: ['garage.local'], modules: { pi }, registry: { faculties: { bridge: Bridged } } });
  t.after(() => garage.down());
  // The relay, granted to the twin's class alone.
  await garage.hand({ method: 'facultiesAdd', args: { name: 'relay', make: 'bridge', kinds: ['org.example.garage'] } });
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
      const started = () => existsSync(join(pin, 'lives')) && readFileSync(join(pin, 'lives'), 'utf8').trim().split('\n').length >= count;
      const watcher = watch(pin, () => {
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
  assert.ok(!existsSync(join(pin, 'crash-after')), 'the program died between its second pulse and its answer');

  // The reply to the phone is lost, so a second later it asks again, and
  // the twin answers from its call id.
  network.loseNext();
  await tap();
  await pulsed(3);
  await network.elapse(1_000);
  await heard(3);

  assert.ok(network.crossings.some(({ outcome }) => outcome === 'lost'), 'a reply to the phone was lost');
  assert.equal(readFileSync(join(pin, 'pulses'), 'utf8').trim().split('\n').length, 3, 'three pulses, never four');
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

## One contained faculty

A faculty is one entity over its ground. Its blueprint and its hooks are
all anyone sees of it. What it keeps lives in its own memory and in the
cells of its twin, the being of the ground's dock that stands for its
entry. So it moves with its ground, and runs wherever its needs are met.
These are the opinions the library holds a faculty to.

- **Declare what you take and what you need, as data.** `takes` is what
  its entry hands it. `needs` is what it needs of its terrain, by kind,
  as `{ packages: { apt: 'tesseract-ocr', brew: 'tesseract' } }` or
  `{ containers: [{ image: 'redis:7' }] }`. A faculty never installs its
  own terrain.
- **Name its installers in its entry.** An installer is a faculty whose
  blueprint is `Installer`. Its body lists the need kinds it meets, and
  `meet({ kind, spec, name })` meets one. An entry names its installers
  in order, as `installers: ['apt']`. The ground raises a faculty after
  its installers.
- **Needs are met before `install`, and only where install runs.** Each
  need goes to the first installer named that meets its kind. A need no
  installer named meets keeps the body down, naming the kind. A restart
  meets nothing again. The library ships no installer, so one is written
  once for each package manager, as any faculty is.
- **Read what was met from `made.met`, never from the environment.** A
  meet answers what it met, and the body reads it under the need's kind,
  as `this.made.met.binaries.verdaccio`, an absolute path to spawn.
  Nothing an installer does enters the process environment.
- **Write only the hooks you need.** The base class answers every
  unwritten one, so a clock writes its methods alone. `up` opens what
  the body holds. `install` does the slow work
  once for each entry. `migrate(from)` brings its memory to its
  `version` before `up`, where the version its twin kept differs, forward
  or back. `uninstall` lets go of what `install` made, once the body is
  down and its entry removed.
- **A body answers its health when asked.** `health()` answers `{ ok,
  why? }`, and the hand's `faculties health` asks it. Nothing asks it on
  a clock.
- **Ship a `fake` and `examples` with every faculty that needs its
  terrain.** A bench stands the fake in its place, with the same
  blueprint and no terrain. A faculty that needs its terrain and has no
  fake stays down on a bench. Each example names a method, its args, a
  call id and the answer it `gives`. A static `contract(body)` throws
  where a body breaks a promise no example can say.
- **Test one faculty alone with `Bench.check`.** It walks the fake, and
  the real body where the test hands its terrain in `made`. Each walk
  installs, goes up, asks every example twice, goes down and up again on
  the same memory, asks each once more, and uninstalls. So the stand-in
  every other test stands is proven equal to the real one.
- **Use a faculty in a test with `Bench.raise`.** It installs and raises
  the faculty as a ground does, never its fake, and answers its body. A
  test calls the body's methods and lets it go with `body.down()`.
- **Prefer a WASM component where the faculty only computes and speaks
  over the network.** It holds only what its host grants it, so it runs
  on any ground. A faculty that drives a device, a native library or
  another program stays native, over the bridge.

The relay, contained, declares what its entry hands it, what it needs of
the Pi, its version, its stand-in and its examples. Its entry names the
installer that meets its need, as `installers: ['apt']`.

```ts
// The relay as one contained faculty: what its entry hands it, what it
// needs of the Pi, its version, the stand-in a bench raises in its place,
// and the examples the relay and its stand-in both answer. The ground
// meets its need through an installer its entry names, then raises it.
import { fileURLToPath } from 'node:url';
import { Faculty, OK, type FacultyContext, type Status } from 'nervur';
import { s, type Json } from 'nervur/being';
import { bridge } from 'nervur/node';
import { Relay } from './garage.ts';

const program = fileURLToPath(new URL('./relay.py', import.meta.url));

/** The bench's relay: the same blueprint, a count kept in the process, no pin and no Python. */
export class FakeRelay extends Faculty {
  static override readonly blueprint = Relay;
  readonly #seen = new Map<string, number>();

  async pulse(_args: Json, { id }: FacultyContext) {
    if (!this.#seen.has(id)) this.#seen.set(id, this.#seen.size + 1);
    return { result: this.#seen.get(id)! };
  }
}

/** The relay: the Python program behind the bridge, started at its `up` and stopped at its `down`. */
export class RelayFaculty extends Faculty {
  static override readonly blueprint = Relay;
  static override readonly takes = { args: s.object({ folder: s.string() }) };
  static override readonly needs = { packages: { apt: 'python3', brew: 'python' } };
  static override readonly version = '1';
  static override readonly fake = FakeRelay;
  // A pulse answers its count, and a call id sent again answers the count it gave.
  static override readonly examples = [
    { method: 'pulse', id: 'one', gives: { result: 1 } },
    { method: 'pulse', id: 'two', gives: { result: 2 } },
  ];
  #program: { pulse(args: Json, context: FacultyContext): Promise<unknown>; stop(): unknown } | undefined;

  override async up(): Promise<Status> {
    const { object, down } = await bridge({ command: 'python3', args: [program], cwd: this.made.args.folder as string, memory: this.made.memory });
    this.#program = { pulse: (object as { pulse: (args: Json, context: FacultyContext) => Promise<unknown> }).pulse, stop: () => down?.() };
    return OK;
  }

  pulse(args: Json, context: FacultyContext): Promise<unknown> {
    return this.#program!.pulse(args, context);
  }

  override async down(): Promise<void> {
    await this.#program?.stop();
  }
}
```

One test walks the relay and its stand-in with `Bench.check`.

```ts
// relay.test.ts
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Bench } from 'nervur/bench';
import { RelayFaculty } from './relay.ts';

test('The relay and its stand-in answer its examples alike', { timeout: 30_000 }, async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'relay-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const findings = await Bench.check(RelayFaculty, { made: { args: { folder } } });
  assert.ok(findings.some(({ what }) => what.startsWith('its fake: ')) && findings.some(({ what }) => what.startsWith('the faculty: ')), 'both were walked');
  assert.equal(readFileSync(join(folder, 'pulses'), 'utf8').trim().split('\n').length, 2, 'the real relay pulsed twice, since each call id came three times');
});
```

Each example is asked, asked again with its call id, and asked once more
after a restart on the same memory. The real relay pulses twice for six
asks, and the fake answers each the same way. So every other test of the
garage may stand the fake, and a bench never needs the Pi.
