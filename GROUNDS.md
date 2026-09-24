# Grounds

A ground is the process houses run in. The library ships one for each
terrain, and you write none: you give it a recipe and the code of each
house, and it runs them. This guide says what every ground does, then
what each one adds. [Writing for nervur](AUTHORING.md) builds the shop
this guide runs, and [the command](COMMAND.md) drives a ground on your
machine.

## What every ground does

**It opens its own custody and memory first.** Custody keeps one seed
for each house, and a house's seed is its identity. The ground's memory
keeps its record. Both are the terrain's own and nothing replaces them.

**It keeps a record of its houses.** Each entry names one house and what
it is handed. That is the body of its memory, the body of its code, the
custom faculties it may use, and the longest any of its asks may run.

```text
shop  { memory: { body: 'ledger' }, classes: { body: 'folder', at: 'shop' }, faculties: ['payments'], wait: 60000 }
```

**It makes its faculties from a recipe.** The recipe is a file of the
ground's code. It exports the faculties the ground makes, each by name,
and any body of memory or of code the terrain does not ship. A ground
that makes no faculty needs no recipe. A secret is
read where the ground runs: the environment on a machine, the Worker's
secrets on an edge.

**It grants a faculty in two steps.** A house uses only the faculties its
entry names. Inside it, a being holds one only where the offer's `kinds`
names her class, or where it names none. So a raw shell reaches one house
and one class inside it.

**It hooks every door and runs one listener.** Each house's door goes to
the ground's carry, which also delivers between the ground's own houses
without touching the network. Everything that speaks HTTP, Quo over the
web and every face, is a handler on one listener.

**It serves its owner's hand.** The hand answers three things: what the
ground holds, a faculty's method, and an ask of any being of any house,
as the house's owner. The ground's own `houses` faculty adds, removes and
lists houses. A recipe may grant it to one pilot being with `houses: {
kinds }`, and a standing on that being then pilots the ground from afar.

**It moves a house by its seed and its memory.** The hand's `moves`
faculty takes a house out as its seed and every place of its memory, and
another ground takes them in. The house keeps its identity, so every
relation still answers and no far house notices. No grant reaches
`moves`, so no being ever holds a seed.

## The five grounds

| Ground | Where it runs | When it wakes | Its custody | Its memory |
| --- | --- | --- | --- | --- |
| NodeGround | a server, a desktop, a Pi | always on | seed files, or the macOS keychain | a ledger in its folder |
| EdgeGround | a Cloudflare Worker and its Durable Object | per request, per message, per alarm | seeds sealed under the Worker's secret | the object's storage |
| BrowserGround | a page or its service worker | while a tab is open, and by push | seeds sealed under a key the browser never hands out | IndexedDB |
| AppGround | an iOS or Android app's web view | per launch, and by push | the Keychain or the Keystore | the app's native store |
| BenchGround | memory, in a test | as the test moves its clock | seeds drawn from the bench's seed | memory in the process |

The same class runs unchanged on every row. What differs is the bodies
each ground hands its houses.

## NodeGround

**`nervur up <folder>` runs one.** The folder holds the recipe, a folder
of code for each house, and `state/` for the seeds, the record's ledger
and the hand's socket. A house's folder has an `index` that exports its
`steward`, and `public` and `beings` where it has them, as [Writing for
nervur](AUTHORING.md) shows. The ground's folder is an ES module package,
so its `package.json` says `"type": "module"`. It listens on TCP and,
where a port is set, on the web. [The command](COMMAND.md) lists its
settings and runs its hand.

**It keeps each house's memory as a ledger.** Every write is one line,
chained to the line before it and synced before it counts. A ledger
edited anywhere but its end is refused. A witness file kept on another
disk refuses a restored copy that is behind.

**It runs a program as a faculty, in any language.** The bridge starts a
program and speaks one JSON value a line on its standard streams.
[Writing a faculty](FACULTIES.md) teaches it.

## EdgeGround

**An edge is one Durable Object, woken per event.** The Worker hands
every request to the one object its ground's name gives. At each wake the
ground boots again, and a house opens only when a box for it arrives or
the hand names it.

**Its Worker's module is two lines over your code.**

```ts
// worker.ts
import { EdgeGround } from 'nervur/edge';
import * as shop from './classes/index.ts';
import * as recipe from './recipe.ts';

export const Ground = EdgeGround.object({ recipe, code: { shop } });

export default EdgeGround.worker();
```

The Worker binds the object's class as `GROUND`, with SQLite storage. A
house's entry names its code with `classes: { body: 'bundle', at: 'shop'
}` and its memory with `memory: { body: 'durable' }`.

**Its settings are the Worker's.**

| Setting | What it sets |
| --- | --- |
| `NERVUR_SECRET` | sixty-four hex digits that seal every seed; set as a secret, and never turned |
| `NERVUR_HAND` | the key its hand answers; set as a secret |
| `NERVUR_ADDRESSES` | the addresses it is reached at, by commas, the held line first |
| `NERVUR_ORIGINS` | the page origins it answers |
| `NERVUR_ALLOW_PRIVATE` | `1` to let it dial a private address |
| `NERVUR_WAIT` | the longest any ask may run, a minute where unset |

A Worker learns no name it is reached by, so it writes only the
addresses `NERVUR_ADDRESSES` names.

**Its hand answers its key alone.** The hand is `POST /nervur/hand`, with
the key as a bearer token and one request as the body. Every other
request there, and every request to an edge that sets no key, finds
nothing.

**It is deployed by a faculty, never by hand.** A faculty your NodeGround
offers holds the account. It builds the module, uploads it with the
secrets, keeps the hand's key, and reaches the hand. The library ships
none, since a deploy is a choice of yours. The first deploy is that
faculty called through your NodeGround's hand, and every later one is
your pilot being's.

**Its held lines hibernate.** A page or a device holds a WebSocket on the
edge, the platform keeps it while the object sleeps, and a message wakes
the object. A watch held on that line answers the moment the change lands.

## BrowserGround and AppGround

**A BrowserGround is one ground for its origin.** Every tab and the
service worker of an origin share it. The tab holding a Web Lock runs
the ground, and every other tab reaches its hand. It only dials, so it
answers no face. Whoever serves the origin's script possesses the
ground, so its origin serves nothing else.
[The package's start](README.md) opens one in a page.

**An AppGround is a BrowserGround with the shell's bodies.** The shell
hands in two small interfaces, one for secrets and one for a store, and
the library holds the rest.

## BenchGround

**A BenchGround runs a world in memory.** A `FakeNetwork` joins several,
gives them names as DNS does, and carries every box between them on one
clock the test moves. It cuts, slows, drops and repeats boxes, and turns
a ground off and on. So one test proves the same classes at every
distance. [Writing for nervur](AUTHORING.md) tests the shop on it.
