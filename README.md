# nervur

Nervur's kit of [Quo](https://quo.systems). Quo is a protocol: an object
asks another object and gets an answer, without knowing where it is. This
package is one implementation of it, and the two names never stand for
the same thing. Where they disagree, Quo's spec wins.

You write classes, beings and faculties, and nothing else. A harbor
unpacks a whole world from them.

## Install

```sh
npm install nervur
```

Node 22.18 or later. The main entry imports no platform, so it runs in a
browser, Deno, Bun and workerd as well. `nervur/folder` keeps a harbor on
a disk and needs Node's file system.

## A harbor where you run

```js
import { readFile } from 'node:fs/promises';
import { Harbor } from 'nervur';

const harbor = await Harbor.open();
await harbor.ask({ method: 'stand' });
const source = await readFile('./greetings.js', 'utf8');
await harbor.ask({ method: 'ask', args: { being: 'catalogue', method: 'add', args: { source } } });
```

A harbor is asked and nothing else. `harbor.ask` takes one root request,
`{ ward?, method?, args? }`, asks the box ward, or the hosted ward named,
as its root, and answers one plain JSON value. `arrive`, `holds` and
`close` are the rest of what a program holds of a harbor.

With no terrain, the harbor picks its ground's bodies itself. In Node it
keeps itself in a folder, `where` if you name one, else `$NERVUR_DIR`,
else `~/.nervur`, speaks TCP and the web where you open them,
and serves its root line, so the `nervur` command below asks it while it
stands. A folder opens in one run at a time. Bundled for a browser, in a
page or a worker, it keeps itself in the IndexedDB database `where`
names, else `nervur`, its seed sealed under a key the browser never hands
out, speaks the web where you open it, and opens in one run at a time.
On Cloudflare Workers it is one Durable Object of many a worker carries,
running in a child worker the object loads for the commit `live` names,
answering Quo at `/<name>/quo` on whatever host reaches it, and asking
over TCP and the web. Anywhere else it lives as long as its process and
speaks the web where you open it. Hand in a terrain, as below, and that
one is used.

Nothing enters a harbor unasked. A new harbor holds its catalogue alone,
and a carrier stands only once the root opens it:

```js
await harbor.ask({ method: 'open', args: { key: 'web', class: 'org.nervur.web' } });
```

## A harbor on the edge

An edge harbor is born on your machine and carried there, so you pilot it
from your own harbor, as you pilot one on a server, and you move its code
the same way, with no deploy. One worker carries as many harbors as you
pack into it, each a Durable Object by its name, answering at
`/<name>/quo`. The worker is a shell: it keeps each harbor's storage and
its web door, and runs the harbor, the kit and the modules its `live`
commit holds, in a child worker Cloudflare's Worker Loader makes of them.
The worker is a folder of its own, an ES module project (`"type":
"module"` in its `package.json`), holding the worker and its
`wrangler.toml`:

```js
// worker.js
import { harborShell, harborWorker } from 'nervur/edge';
import kit from 'nervur/edge/kit';
import pack from './pack.edge.json';

export const Harbor = harborShell({ kit, pack });
export default harborWorker();
```

```toml
# wrangler.toml
name = "harbor"
main = "worker.js"
compatibility_date = "2026-09-01"

[[durable_objects.bindings]]
name = "HARBOR"
class_name = "Harbor"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["Harbor"]

[[worker_loaders]]
binding = "LOADER"
```

The Worker Loader is in beta, and on Cloudflare it needs the Workers Paid
plan. `wrangler dev` runs it on your machine at no cost.

Make the harbor and set it up with the command, from that folder, naming
where the edge will reach it:

```sh
nervur init --dir ./harbor
nervur module add ./greetings.js --dir ./harbor
nervur reach http://127.0.0.1:8787/main/quo --dir ./harbor
nervur own me --dir ./harbor
```

`own` prints the owner invitation, which never leaves your machine. Run
it on this machine first:

```sh
nervur edge dev ./pack.edge.json main --dir ./harbor
```

`edge dev` packs the harbor as `main` into `pack.edge.json`, beside any
harbor packed there before, and runs your `wrangler dev`, keeping the
objects' storage and a secret of its own in `.nervur-edge`, so the
harbor stands again each time you run it. The harbor's code travels in
its package, as its DNA. The first time its object starts, the harbor
lands in its storage; after that the storage is the harbor, and a new
deploy leaves it be. Then, from your own harbor:

```sh
nervur pilot edge '<the owner invitation>' --dir ./mine
nervur host shop --via edge --dir ./mine
nervur module add ./greetings.js --via edge --dir ./mine
```

A module added, or `live` moved back, runs on the edge at once: the
worker loads the next child for the commit `live` names, with no deploy.
A module that does not load there is refused with its reason, and `live`
stays where it was.

For Cloudflare, keep one secret for the worker, `wrangler secret put
NERVUR_SECRET`, and hold the same one as `NERVUR_SECRET` in your shell.
Name each harbor's address with `reach`, pack each with
`nervur edge pack ./pack.edge.json <name> --dir <its folder>`, and
`wrangler deploy`. A pack holds every seed sealed under that secret, so
it ships in the bundle and opens nowhere else, and a new harbor is a new
deploy, never a new secret. `pilot` opens the web carrier where the
invitation names a web address. A name the pack does not hold answers
404, so a stranger's request mints nothing.

## A world in one process

A module is one file of JavaScript that imports nothing but `nervur`:

```js
// greetings.js
import { Being, Faculty } from 'nervur';

// Its name, as a kind is named, and its version.
export const module = 'org.example.greetings';
export const version = '1.0.0';

// A contract, and a faculty that fulfils it. Every class names its kind.
class Clock extends Faculty {
  static kind = 'org.example.clock';
}
class SystemTime extends Clock {
  static kind = 'org.example.system-time';
  static asks = { now: {} };
  now() {
    return { now: Date.now() };
  }
}

// A being, who lends a clock by its contract.
class Greeter extends Being {
  static kind = 'org.example.greeter';
  static asks = { hello: {} };
  async hello(args, asker) {
    if (!this.stance.standings.get('clock')) await this.stance.lend(Clock, 'clock');
    const time = await this.stance.standings.get('clock')?.ask('now');
    return { hello: asker.id ?? 'stranger', time };
  }
}

export const classes = [SystemTime, Greeter];
```

A harbor's catalogue takes its source, commits it, and runs it:

```js
import { readFile } from 'node:fs/promises';
import { DEFAULTS, World } from 'nervur';

const world = new World(DEFAULTS);
const harbor = await world.harbor('home');
const source = await readFile('./greetings.js', 'utf8');
await harbor.ask({ method: 'ask', args: { being: 'catalogue', method: 'add', args: { source } } });
await harbor.ask({ method: 'open', args: { key: 'clock', class: 'org.example.system-time' } });
await harbor.ask({ method: 'host', args: { ward: 'alice' } });
await harbor.ask({ ward: 'alice', method: 'boot', args: { key: 'greeter', class: 'org.example.greeter' } });
```

A second harbor in the same world takes an invitation on the greeter and
asks it through the world, sealed as Quo's bytes. `world.restart('home')`
opens the harbor again from what its memory kept.

## Kinds

A row keeps the kind of the class a being is born of, and a being lends
by a contract's kind. A kind is declared on the class, because a bundler
renames classes. It is a domain you own, reversed, then a name, as Apple
and Matrix name things: `com.acme.shop`. Every segment is lowercase
letters, digits and `-`, and there are three at least. Each class
declares its own: a subclass that stands, and every contract between a
faculty and `Faculty`. `org.nervur.` is the kit's, and `org.example.` is
for examples like the one above. A module's classes stand under its own
domain: `com.acme.shop` stands `com.acme.*` kinds. A harbor refuses a
module in which one kind names two classes or two contracts, or names a
class and a contract.

## The DNA

Your classes come in modules, each one file exporting `module`, `version`
and `classes`, a module named as a kind is. A harbor's catalogue keeps
its code as a git repository, its DNA, from its first moment: a commit
holds `modules/<module>.js` for every module the harbor runs, and `live`
names the commit that stands. Her asks, the root's and an owner's:

- `add { source, name? }` commits a module's source on `live` and moves
  `live` to it; the same module again takes its new version.
- `remove { module }` commits its file away, refused while a being or a
  ward stands on its kinds.
- `live { commit? }` moves `live` to a commit or a fetched ref, or, with
  none, names the commit that stands. Moving `live` back is a rollback.
- `log` walks back from `live`. `modules` shows what `live` runs, and why
  a module does not.
- `origin { url }` names a git repository over HTTP, and `fetch` reads
  every ref it has and all they reach into the harbor, touching nothing
  there.

Moving `live` runs the commit's modules together, or refuses them with
the reason and leaves `live` where it was. Once they run, every being a
new class resolves is born again of it, on the cells she keeps. A
restart stands `live` from what the harbor keeps, with no network. The
objects live in the harbor's memory, sealed as everything else is, so a
harbor carried to another ground carries its DNA. Real `git` reads a
harbor's objects, and a harbor reads what `git` serves.

## The onion

A harbor is one package. Only the seed and the terrain's bodies, its
loader among them, stand outside it. It stands in three levels, and each
level stands the next and leaves it alone.

1. **The boot**, the harbor's own, from the library's core alone. The
   terrain gives the seed, which opens its memory; the terrain keeps that
   memory as sealed bytes and reads none of it. The box ward unpacks, the
   catalogue stands and runs every module `live` holds, every registry the
   catalogue resolves stands, and then the dock, of her class. The door is
   hers from here, and `Harbor.open()` returns. It is one call, and no ask
   makes it.
2. **The dock's**, on her `stand` ask. She stands every other faculty,
   registries first, then memory faculties, then the rest; hands her
   routes to the carrier; and stands every ward she hosts, under the seed
   she keeps for it.
3. **Each ward's beings**, stood by nothing. A being's cells, occupants
   and standings are her ward's rows, so she is born from her row when an
   ask reaches her, once for the asks in flight on her, and dropped after.
   A harbor holds in memory its faculties, its wards and the beings
   answering now.

After the boot a harbor takes asks alone. Whoever holds it asks `stand`:

```js
const harbor = await Harbor.open();
await harbor.ask({ method: 'stand' });
```

`stand` answers what stood, or silence where everything already stands.
The command asks it of every harbor it opens.

Cells decide what stands. The modules only resolve a kind a row keeps.
Opening a harbor on empty memory is its genesis: the harbor writes the
catalogue and the default dock, and the root's asks write the rest: `add`
on the catalogue, `open`, `host`, `route`, and `boot` on a ward.
`host { ward, seed? }` stands a ward under a seed you name, or a drawn
one.

A ward is a being too, and her row keeps her class's kind. `Ward` and
`Dock` are contracts, and `DefaultWard` and `DefaultDock` the library's
defaults of them. A class of yours extending either, in a module the
catalogue runs, is a ward of your own: `host { ward, class }` stands a
hosted ward of it, and `become { class }` on any ward, the box ward's
dock among them, has her born again of it on the same cells and
relations. A dock of yours stands on every open, since she stands once
the catalogue runs.

Every class comes from a registry. The catalogue is the library's, and a
class of yours extending `RegistryFaculty` is another: open it as any
faculty, and name it where a class is named. `open { key, class,
registry }` stands a faculty through it, `host { ward, registry }` stands
a ward and every class of it through it, and `become { class, registry }`
stands the dock through it, where the catalogue stands that registry. A
registry may stand through another.

A ward's place is kept by the root memory unless you name a memory
faculty. `open { key: 'vault', class: 'org.nervur.ground-memory' }` opens
the memory faculty every ground ships, and `host { ward, memory: 'vault' }`
keeps the ward there. A class of yours extending `MemoryFaculty` keeps a
ward in a bucket or a database the same way, and `move { ward, memory }`
carries a ward between keepers whole.

## What it holds

- **Being, Faculty, Ward, Dock.** What you extend, each a contract.
  A faculty's contract is its class and every class between it and
  `Faculty`. `DefaultWard` and `DefaultDock` are the kit's ward and dock.
- **Entropy, Clock, Custody, Memory, Carrier, Loader.** The contracts a
  terrain fulfils. Each has one suite, and every body that fulfils it
  passes it. `nervur/proof` hands you those suites and the unpacking
  law's as scenes, a title and a function each, so a body of your own,
  a memory in a cloud or a secret of your platform's, runs them under
  your own runner: `for (const [title, scene] of memoryScenes('Mine',
  make, expect)) test(title, scene)`.
- **Harbor, Terrain, Catalogue, Registry.** The onion.
- **World, PointerTerrain** and the pointer bodies. A whole world with
  this package alone.
- **SourceLoader, BundleLoader.** A module's source run by the engine's
  own import, its `nervur` linked to the kit running, and the modules a
  bundle carries, found by their git blob, for a service worker, which
  imports nothing once it runs.
- **addGround, grounds**: the grounds `Harbor.open()` tries, and a way to
  add your own.
- **NodeTerrain**, from `nervur/node`: the Node ground's terrain, for a
  folder you name in code.
- **BrowserTerrain, IdbMemory, IdbCustody**, from `nervur/browser`: the
  browser ground's terrain and bodies. `serveWorker(Harbor.open())` at
  the top of a shared or service worker holds one harbor for every tab,
  each tab asks it with `rootOf(worker)`, and a push the service worker
  hears is the dock's `heard`, told to every carrier.
- **harborShell, harborWorker, EdgeMemory, EdgeCustody, EdgeLoader**,
  from `nervur/edge`, and the kit as one module's text, from
  `nervur/edge/kit`: the edge's shell and the bodies its children stand
  on.
- **FolderMemory, FolderCustody**, from `nervur/folder`.
- **TcpCarrier, TcpListener, NodeSockets**, from `nervur/tcp`: Quo over
  TCP. Route a ward pk to its `tcp://host:port` addresses on the carrier,
  hand the listener your harbor, and harbors in two processes, or a
  harbor and another kit, speak. `TcpFaculty` is the same carrier as a
  faculty of a harbor, on the sockets its terrain hands it:
  `NodeSockets` on Node, a worker's own on the edge.
- **WebDialer, WebFaculty**: Quo over the web, a post to `https://` or a
  held line to `wss://`, in any engine with `fetch` and WebSocket.
  `webServe`, from `nervur/http`, is the listener a Node terrain hands
  the web carrier. `answerPost(harbor, listen, request)` answers one post
  and nothing more, for a function that opens a harbor per request and
  closes it.
- **DEFAULTS**: the one list of beings and faculties every ground runs
  where you write none, handed to a terrain as `defaults`.
- **CarrierFaculty**: a carrier of your own. It says which addresses it
  accepts, dials them, and says the carrier of Quo it `carries`, `tcp`
  or `web`, so the command finds it. One that answers `relay` for a ward
  pk no door holds is handed that pk's boxes, and every carrier hears
  the dock's `heard` when a device hears a push.

Quo crosses two carriers, TCP and the web, and no third. MCP, an HTTP API
and every other outside protocol are gateway faculties: classes that
serve their clients, a UI in a browser, an MCP client, a caller holding
a bearer token, on one side, and stand as an ordinary being on the
other, offering standings, holding occupants and speaking Quo inbound
and outbound. They and every screen
are classes written over this package, and none ships in it.

## The command

`nervur` stands a harbor on this machine: its seed and sealed memory in a
folder, Quo over TCP as its carrier. A module is a file that exports
`module`, `version` and `classes`.

```sh
nervur init  --dir ./harbor
nervur module add ./greetings.js --dir ./harbor
nervur serve --dir ./harbor --port 7000
nervur reach tcp://harbor.example:7000 --dir ./harbor
nervur open web org.nervur.web --dir ./harbor
nervur ask web listen '{"port":8080,"path":"/quo"}' --dir ./harbor
nervur host alice --dir ./harbor
nervur boot --ward alice greeter org.example.greeter --dir ./harbor
nervur ask --ward alice greeter hello --dir ./harbor
```

`reach` names where the harbor is reached, and every invitation it gives
carries those addresses in `at`. With no `reach`, an invitation carries
where the harbor listens, which serves a harbor callers reach directly;
behind a router or a proxy, name the public address with `reach`. A
harbor that takes such an invitation keeps them as that ward's route,
so nobody routes it by hand. Where an invitation carries no `at`,
`nervur route <ward pk> tcp://host:port` names the route, and a route
named this way is trusted first.

`init` makes the harbor, opens its TCP carrier unless you pass
`--no-tcp`, and prints its pk and an owner invitation. `serve` listens for
Quo on that carrier and for the root's asks on a local socket, open to
you alone, and adds nothing to the harbor: one with no TCP carrier is not
served. Every other command is one root ask, `pilot` at most two, sent
to the served harbor, or answered from the folder when none is served.
Each prints one JSON line. `--dir` defaults to `$NERVUR_DIR`, then `~/.nervur`.
`module add` reads the file and commits its text into the harbor's DNA,
so the harbor holds its own code on any ground. Routes live in the
harbor like everything else, so a restart finds both. `nervur modules`
shows what runs, `nervur module remove <module>` stops one, `nervur log`
walks the commits, `nervur live <commit>` moves `live`, and `nervur
origin <url>` with `nervur fetch` reads a git repository into the
harbor.

A harbor elsewhere is piloted with the owner invitation its `init`
printed, from a harbor of your own:

```sh
nervur pilot far '<owner invitation>' --dir ./mine
nervur host shop --via far --dir ./mine
```

`pilot` is your dock's `hold`: it keeps the invitation under the name
`far` as an ordinary Quo relation, kept in your harbor's memory, and
reaches the far harbor where its invitation's `at` says; where it says
nothing, name the address after the invitation, and the dock routes it
there. Where that address is on the web, `pilot` opens the web carrier
first. With `--via far`, any command is asked of the far harbor as its
owner, sealed over its carrier, except `own` and `disown`, which stay
the far root's. Every ward holds far beings this way, a ward or any
other being whose invitation
carries the notes `{ owner: true }`, each under a name, asked with
`pilot { name, method, args }` and let go with `drop { name }`.

`harbor.ask(request)` is the same request in code, for any other front:
`{ ward?, method?, args? }` in, one JSON answer out.

## Moving a harbor

A harbor moves to another machine by its bytes, with no harbor open:

```sh
nervur export --with-seed --dir ./harbor > harbor.json
nervur import harbor.json --dir ./elsewhere
```

`export` reads the folder's sealed places, and carries the seed only
where you ask for it. `import` writes them into a folder that holds none.
A package with no seed lands where custody already holds the one it was
sealed under. In code, `copyPackage(from, to)` carries every place of one
memory into another.

## License

Apache-2.0. Copyright 2026 Bookarest Digital SRL. See LICENSE and NOTICE.

[Quo](https://quo.systems) is a separate work, Razvan Gherghina's, also
under Apache-2.0, and its spec names no kit. `nervur` is Quo's first
implementation and says so gladly: the protocol owes this package
nothing, and where the two disagree the spec wins.
