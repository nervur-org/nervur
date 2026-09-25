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

**It unpacks in layers, each a faculty.** Every faculty has one
lifecycle. A registry holds faculties by name, each an object `{ takes?,
up, install? }`. Standing one raises it by its `up` into a body, the
living instance houses and other bodies use. `install` does the slow
work once for each entry, and a body's `down` lets go of what its `up`
opened.

| Layer | Its faculties | What they are |
| --- | --- | --- |
| primordial | the memory, the unlock, crypto, tools, the clock | the host's, read from the environment alone |
| the ground's work | `ground` | the library's, offered to the dock alone |
| the dock | a house of the library's beings | the drawer, and the hand's one road |
| the ladder | the terrain's defaults and your entries | carries, code, and every custom faculty |
| the hand | a socket, a key, a channel | the owner's reach, up last and down first |

**It keeps its drawer as cells of the dock's beings.** The dock is a
house every ground stands, and its beings are the library's. A twin
stands for each faculty entry, a being for each house, and one for each
secret. Their cells hold every entry, what each faculty installed, each
house's seed and ward, every secret, and the ground's bound on every
ask. No row of the ground's stands beside them.

**Every name an entry gives is a standing.** A house's code, its memory
and the faculties it uses, and a faculty's registry, its callees and its
secrets, are relations between those beings. The dock's steward
introduces each, and her notes name the grant. An entry that names a
faculty or a secret the dock does not hold is refused, and nothing
lands.

**Its houses keep their places in the same memory.** The dock, each
house and each faculty sees a view of the ground's memory under a prefix
of its own. A house seals its own rows, and the ground seals each
faculty's. So what rests on the disk is ciphertext, and copying the key,
the memory and the code moves the whole ground. A memory the key opens
no dock in is refused.

**It stands its bodies on a ladder.** The ground's own registry is its
terrain's. A body may carry a registry of its own, and the faculties an
entry raises `from` it stand after it. A body stands after each body its
entry names in `faculties`, whose objects its `up` receives. A body that
fails to stand stays down and says why, and the ground boots beside it.

**Its terrain names default entries, and yours win.** Each ground stands
its carries and its bodies of code from entries of its own. Its one
clock is primordial, which the dock and every house receive.
An entry you land under the same name stands in its place.

```text
recipe    { from: 'folder', make: 'module', args: { at: 'recipe.ts' } }
payments  { from: 'recipe', make: 'payments', secrets: ['stripe-key'], kinds: ['com.acme.order'] }
```

**It opens each house on its entry.** An entry names the body that
serves the house's code, the custom faculties it may use, and the
longest any of its asks may run. It names a body serving memory only
where the house keeps its places apart from the ground's memory. Beside
each body's name, it holds the args that body hands this house.

```text
shop  { classes: { faculty: 'folder', at: 'shop' }, faculties: ['payments'], wait: 60000 }
```

**A change answers what stands, and an error means nothing landed.**
Adding or updating a faculty answers why its body is down, where it is.
Adding or updating a house answers its ward, or why it stays closed.
The entry lands either way, and the hand mends it later.

**It updates an entry in one write.** `update` lands the new entry over
the old. A house closes and opens again on it, as the same ward. A body
goes down, installs where its entry moved, and goes up, and each house
naming it opens again. `restart` takes a body down and up on its entry.

**It grants a faculty in two steps.** A house uses only the faculties its
entry names. Inside it, a being holds one only where the faculty's entry
names her class in `kinds`, or where it names none. So a raw program
reaches one house and one class inside it.

**It hands each faculty its secrets.** A secret is set through the hand
and kept in a being's cells. A faculty's entry names the secrets its
`up` receives, and no other code reads one. The hand lists their names
and the entries that name each, and never a value. A secret's cells are
shown to no one, and a changed secret reaches a body when it goes up
again.

**It holds each entry to what its faculty takes.** A faculty declares
`takes`: a schema its args meet, and the secrets its entry must name.
The hand refuses an entry that fails it, or that names a secret not
kept, and says what failed. `facultiesCatalog` shows every faculty the
ground can raise, and what each takes.

**It hooks every door and runs one listener.** Each house's door goes to
the ground's carry, which also delivers between the ground's own houses
without touching the network. Everything that speaks HTTP, Quo over the
web and every face, is a handler on one listener. A faculty stood while
the ground runs is served at once.

**The dock's steward reaches the ground through two faculties.** The
`ground` faculty raises and lowers bodies, opens and closes houses,
shows the catalogue and moves a house's places. It is offered to the
dock's beings alone. The `shell` runs a command on the ground's machine,
where the terrain has one. The dock is offered it as any house is
offered a body. Its steward stands on the shell's twin, and the twin's
entry grants it to the dock's shell being alone. No entry names, makes
or grants either.

**A boot writes only what moved.** Each twin raises its body by a read,
and her cells are written only where what came of it differs. So a wake
that finds nothing changed writes nothing.

**It serves its owner's hand, and the hand has one road.** The hand
answers `describe`, and otherwise asks a being of the dock or of a house
as `root`. A request that names a house asks a being there. One that
names none asks the dock's steward. `describe` shows her asks, every
faculty with its methods or why it is down, and every house.

| The dock's asks | What they do | Who asks them |
| --- | --- | --- |
| `housesAdd`, `housesUpdate`, `housesRemove`, `housesList` | the houses | `root`, and a pilot |
| `facultiesAdd`, `facultiesUpdate`, `facultiesRestart`, `facultiesRemove`, `facultiesList` | the faculties | `root`, and a pilot |
| `facultiesCatalog` | every faculty the ground can raise, and what it takes | `root`, and a pilot |
| `waitSet`, `waitShow` | the ground's bound on every ask | `root`, and a pilot |
| `secretsSet`, `secretsRemove`, `secretsList` | the secrets | `root` alone |
| `movesOut`, `movesIn` | a house moved between grounds | `root` alone |
| `callFaculty` | a faculty's method, called by name | `root` alone |
| `shellRun` | a command on the ground's machine | `root` alone |
| `pilotsInvite`, `pilotsDismiss`, `pilotsList` | who pilots the ground | `root` alone |
| `boot` | the ladder stood and every house opened, as each boot asks | `root` alone |

**An ask of the dock is safe to send twice.** A request may carry
`call`, its call id. The same id sent again answers what the first
answered, and runs nothing twice.

**It lets a pilot possess it from afar.** `pilotsInvite` mints an
invitation to the dock's steward, and the owner hands it to one being.
That being then holds a standing on the dock, and asks the houses and
faculties asks through it. Her class reaches them typed with
`this.held(id, DockPilot)`, the need `nervur` exports. Secrets, moves,
the shell and faculties' methods stay the hand's alone. A secret passes
through `secretsSet`, which answers nothing, so no answer holds one.

**It moves a house by its seed and its memory.** `movesOut` takes a
house out as its seed and every place of its memory, and another ground
takes them in with `movesIn`. The house keeps its identity, so every
relation still answers and no far house notices.

## The five grounds

| Ground | Where it runs | When it wakes | Its unlock | Its memory | Its hand |
| --- | --- | --- | --- | --- | --- |
| NodeGround | a server, a desktop, a Pi | always on | a key file, or the macOS keychain | a ledger in its folder | a socket in its folder |
| EdgeGround | a Cloudflare Worker and its Durable Object | per request, per message, per alarm | the Worker's secret | the object's storage | a key the Worker holds |
| BrowserGround | a page or its service worker | while a tab is open, and by push | a key sealed under one the browser never hands out | IndexedDB | a channel between the origin's tabs |
| AppGround | an iOS or Android app's web view | per launch, and by push | the Keychain or the Keystore | the app's native store | a channel, as in a page |
| BenchGround | memory, in a test | as the test moves its clock | a key drawn from the bench's seed | memory in the process | the test's own |

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

**Its registry holds its terrain's faculties.** `folder` serves each
house its classes from a folder inside the code folder its args name.
Its body carries a registry of two more, rooted there. `module` imports
a module as a registry, whose `faculties` export holds `{ up, install?
}` by name. `bridge` starts a program, in any language, and hands it the
secrets its entry names as its environment. An entry stands either with
`from: 'folder'`. `tcp` and `web` are its carries, `listener` its one
listener, and `shell` its shell. Its clock is the library's, and
primordial.

**Its code gives the default entries.** `folder`, `listener`, `tcp`,
`web` and `shell` stand from entries the library fixes. TCP
listens on the loopback at 9110, so nothing beyond the machine reaches
a new ground. A server names its bind through the hand. The web names
`listener` in its `faculties` and listens on no port. An entry of the
same name you land stands in their place, so a port changes through the
hand. Name
`listener` there too, since the web serves the listener it calls.

**A port another process holds keeps that carry down with why.** The
ground boots beside it until the hand moves the port. A `tcp` entry
whose args name no port only dials, and its invitations name no TCP
address. Its environment names only `NERVUR_STATE`, `NERVUR_UNLOCK` and
`NERVUR_HAND`.

**Its key rests in `state/key`, its owner's alone.** A key file others
may read is refused, as ssh refuses a key. On macOS,
`NERVUR_UNLOCK=keychain:<account>` keeps the key in the keychain
instead. Keep `state/` as you keep an ssh key: whoever holds the key and
the ledger holds the ground.

**It keeps its memory as a ledger, which holds the folder's lock.** Every
write is one line, chained to the line before it and synced before it
counts. A ledger edited anywhere but its end is refused. A witness file
kept on another disk refuses a restored copy that is behind. While the
ledger stands, a second ground on the same state is refused.

**Its shell runs a command for the hand alone.** `nervur shell run --
<command>` runs it in the code folder, and answers its exit code and
what it printed. Its environment holds `PATH`, `HOME` and a few more of
the process's, and never a secret or a `NERVUR_` variable. No pilot and
no being reaches it.

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
`registry` joins the terrain's own, so an entry raises `payments` with
no `from`. A house's entry names its code with `classes: { faculty:
'bundle', at: 'shop' }`.

**Its Worker holds two secrets and nothing else.**

| Variable | What it names |
| --- | --- |
| `NERVUR_SECRET` | the ground's key, sixty-four hex digits; set as a secret |
| `NERVUR_HAND` | the key its hand answers; set as a secret |

A Worker learns no name it is reached by, so it writes only the
addresses its `web` entry names, the held line first. Name them through
the hand with `facultiesUpdate`, as `addresses` in the args of `web`,
beside its `origins` and `allowPrivate`, and the dock keeps them.
Every ask runs a minute at most, and `waitSet` keeps a shorter bound.
Its faculties take their secrets from the dock, as on every ground. It
has no shell.

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
the ground, and its hand answers every other tab over a channel. It
only dials, so it answers no face. Whoever serves the origin's script
possesses the ground, so its origin serves nothing else.
[The package's start](README.md) opens one in a page.

**Its registry is the one the page hands.** `BrowserGround.open({
registry })` joins it to the terrain's own, whose faculty `origin`
serves each house its classes from the origin.

**An AppGround is a BrowserGround with the shell's bodies.** The app's
native shell hands in two small interfaces, one for secrets and one for
a store, and the library holds the rest. The ground's key rests in the
secret store.

## BenchGround

**A BenchGround runs a world in memory.** A `FakeNetwork` joins several,
gives them names as DNS does, and carries every box between them on one
clock the test moves. It cuts, slows, drops and repeats boxes, and turns
a ground off and on. So one test proves the same classes at every
distance. [Writing for nervur](AUTHORING.md) tests the shop on it.
