# Grounds

A ground is the process houses run in. The library ships one for each
terrain, and you write none. You give it one key, and through its hand
you tell it which faculties to stand and which houses to open. This
guide says what every ground does, then what each one adds. [Writing
for nervur](AUTHORING.md) builds the shop this guide runs, and [the
command](COMMAND.md) drives a ground on your machine.

## What every ground does

**It holds one key outside itself.** The key is sixty-four hex digits,
kept by what the ground stands on: a file, a keychain, a Worker's
secret. The part of a ground that answers it is its unlock. Everything
else the ground keeps is sealed under that key.

**It keeps its drawer in its one memory.** The drawer is the ground's
own sealed places. It holds each house's entry and seed, each faculty's
entry, every secret you set, and each house's ward. A memory that holds
places the key does not open is refused, so a ground never opens on
another's memory.

**Its houses keep their places in the same memory.** Each house and each
faculty sees a view of the ground's memory under a prefix of its own. A
house seals its own rows, and the ground seals each faculty's. So what
rests on the disk is ciphertext, and copying the key, the memory and the
code moves the whole ground.

**It stands its faculties on a ladder.** A registry is code that makes
faculties and bodies by name. The ground's own registry is its
terrain's. A faculty may carry a registry of its own, and the faculties
an entry makes `from` it stand after it. A faculty that fails to stand
stays down and says why, and the ground boots beside it.

```text
recipe    { make: 'module', args: { at: 'recipe.ts' } }
payments  { from: 'recipe', make: 'payments', secrets: ['stripe-key'], kinds: ['com.acme.order'] }
```

**It opens each house on its entry.** An entry names the body of the
house's code, the custom faculties it may use, and the longest any of
its asks may run. It names a body of memory only where the house keeps
its places apart from the ground's memory.

```text
shop  { classes: { body: 'folder', at: 'shop' }, faculties: ['payments'], wait: 60000 }
```

**It grants a faculty in two steps.** A house uses only the faculties its
entry names. Inside it, a being holds one only where the faculty's entry
names her class in `kinds`, or where it names none. So a raw shell
reaches one house and one class inside it.

**It hands each maker its secrets.** A secret is set through the hand
and kept in the drawer. A faculty's entry names the secrets its maker
receives, and no other code reads one. The hand lists their names, and
never a value.

**It hooks every door and runs one listener.** Each house's door goes to
the ground's carry, which also delivers between the ground's own houses
without touching the network. Everything that speaks HTTP, Quo over the
web and every face, is a handler on one listener. A faculty stood while
the ground runs is served at once.

**It serves its owner's hand.** The hand answers three things: what the
ground holds, a faculty's method, and an ask of any being of any house,
as the house's owner. Four faculties are the ground's own.

| Faculty | Its methods | Who reaches it |
| --- | --- | --- |
| `houses` | `add`, `remove`, `list` | the hand, and the kinds its entry grants |
| `faculties` | `add`, `remove`, `list` | the hand, and the kinds its entry grants |
| `secrets` | `set`, `remove`, `list` | the hand alone |
| `moves` | `out`, `in` | the hand alone |

**It lets a pilot possess it from afar.** An entry for `houses` or
`faculties` holds `kinds` alone, and grants it to one pilot being. A
standing on that being then pilots the ground. `secrets` and `moves`
take no entry, so no being ever holds a seed or a secret.

**It moves a house by its seed and its memory.** `moves` takes a house
out as its seed and every place of its memory, and another ground takes
them in. The house keeps its identity, so every relation still answers
and no far house notices.

## The five grounds

| Ground | Where it runs | When it wakes | Its unlock | Its memory |
| --- | --- | --- | --- | --- |
| NodeGround | a server, a desktop, a Pi | always on | a key file, or the macOS keychain | a ledger in its folder |
| EdgeGround | a Cloudflare Worker and its Durable Object | per request, per message, per alarm | the Worker's secret | the object's storage |
| BrowserGround | a page or its service worker | while a tab is open, and by push | a key sealed under one the browser never hands out | IndexedDB |
| AppGround | an iOS or Android app's web view | per launch, and by push | the Keychain or the Keystore | the app's native store |
| BenchGround | memory, in a test | as the test moves its clock | a key drawn from the bench's seed | memory in the process |

The same class runs unchanged on every row. What differs is the bodies
each ground hands its houses.

## NodeGround

**`nervur up <folder>` runs one.** The folder holds your code: a folder
for each house, and each module or program your entries name. Its
`state/` holds the key, the ground's ledger and the hand's socket. A
house's folder has an `index` that exports its `steward`, and `public`
and `beings` where it has them, as [Writing for nervur](AUTHORING.md)
shows. The ground's folder is an ES module package, so its
`package.json` says `"type": "module"`. It listens on TCP and, where a
port is set, on the web. [The command](COMMAND.md) lists its settings
and runs its hand.

**Its registry makes three things.** The body `folder` loads a house's
classes from a folder inside it. The maker `module` imports a module
inside it as a registry, whose `faculties`, `memory` and `classes` are
maps of makers. The maker `bridge` starts a program, in any language,
and hands it the secrets its entry names as its environment.

**Its key rests in `state/key`, its owner's alone.** A key file others
may read is refused, as ssh refuses a key. On macOS,
`NERVUR_UNLOCK=keychain:<account>` keeps the key in the keychain
instead. Keep `state/` as you keep an ssh key: whoever holds the key and
the ledger holds the ground.

**It keeps its memory as a ledger.** Every write is one line, chained to
the line before it and synced before it counts. A ledger edited anywhere
but its end is refused. A witness file kept on another disk refuses a
restored copy that is behind.

**It runs a program as a faculty, in any language.** The bridge starts a
program and speaks one JSON value a line on its standard streams. The
program keeps what it must in the faculty's sealed memory, through lines
of its own. [Writing a faculty](FACULTIES.md) teaches it.

## EdgeGround

**An edge is one Durable Object, woken per event.** The Worker hands
every request to the one object its ground's name gives. At each wake
the ground boots again, and a house opens only when a box for it arrives
or the hand names it.

**Its Worker's module is two lines over your code.**

```ts
// worker.ts
import { EdgeGround } from 'nervur/edge';
import * as shop from './classes/index.ts';
import * as recipe from './recipe.ts';

export const Ground = EdgeGround.object({ registry: recipe, code: { shop } });

export default EdgeGround.worker();
```

The Worker binds the object's class as `GROUND`, with SQLite storage.
`registry` joins the terrain's own, so an entry makes `payments` with no
`from`. A house's entry names its code with `classes: { body: 'bundle',
at: 'shop' }`.

**Its settings are the Worker's.**

| Setting | What it sets |
| --- | --- |
| `NERVUR_SECRET` | the ground's key, sixty-four hex digits; set as a secret |
| `NERVUR_HAND` | the key its hand answers; set as a secret |
| `NERVUR_ADDRESSES` | the addresses it is reached at, by commas, the held line first |
| `NERVUR_ORIGINS` | the page origins it answers |
| `NERVUR_ALLOW_PRIVATE` | `1` to let it dial a private address |
| `NERVUR_WAIT` | the longest any ask may run, a minute where unset |

A Worker learns no name it is reached by, so it writes only the
addresses `NERVUR_ADDRESSES` names. Its faculties take their secrets
from its drawer, as on every ground.

**Its hand answers its key alone.** The hand is `POST /nervur/hand`, with
the key as a bearer token and one request as the body. Every other
request there, and every request to an edge that sets no key, finds
nothing.

**It is deployed by a faculty, never by hand.** A faculty on your
NodeGround holds the account. It builds the module, uploads it with the
two secrets, keeps them, and reaches the hand. The library ships none,
since a deploy is a choice of yours. The first deploy is that faculty
called through your NodeGround's hand, and every later one is your pilot
being's.

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

**Its registry is the one the page hands.** `BrowserGround.open({
registry })` joins it to the terrain's own, whose body `origin` loads a
house's classes from the origin.

**An AppGround is a BrowserGround with the shell's bodies.** The shell
hands in two small interfaces, one for secrets and one for a store, and
the library holds the rest. The ground's key rests in the secret store.

## BenchGround

**A BenchGround runs a world in memory.** A `FakeNetwork` joins several,
gives them names as DNS does, and carries every box between them on one
clock the test moves. It cuts, slows, drops and repeats boxes, and turns
a ground off and on. So one test proves the same classes at every
distance. [Writing for nervur](AUTHORING.md) tests the shop on it.
