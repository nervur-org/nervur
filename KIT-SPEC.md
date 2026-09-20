# KIT-SPEC

Nervur's answer to every question of Quo's `KIT-SPEC.md`, in its order,
each with its reason. Another kit choosing otherwise still speaks Quo. The
shape these answers stand in, the onion and its words, is
`papers/nervur-explained.md` in the tree this package is written in.

## What stands behind a door

**Question 1. What stands behind a door, and how does the kit hand it an
arrival?** Beings. Every ward holds its steward, a being of the `Ward`
contract, first and any number of beings after it. The door judges an arrival,
finds the being the relation names, and calls her
`answer(asker, method, args)`. What she returns is the choice: a value is
an object with her `seen`, silence or nothing at all is silence. A
throw, a kit word out of her, a value JSON would not keep, or a write her
cells refuse is silence too, and the kit records no reason. A ward is
never empty, so a door always has someone behind it.

**Question 2. How is what constructed a ward reached, and can that edge be
taken away?** The box ward's seed lives in custody, which the terrain
holds, and a hosted ward's seed in the dock's cells. The ward never hands
its seed back. A being reaches what made her through a relation:
a being booted with an id invites her maker under the maker's key, and the
maker takes that relation under the id. A hosted ward
reaches the harbor through one invitation on the dock, taken at boot.
Removing the relation removes the way back. Nothing of this crosses a
door as anything but an ordinary relation.

**Question 3. What answers the zero head, and does anything?** The ward's
public being, when the root marks one, asked as nobody. With none, nothing
answers and the ask is case 4. The ward is never public, because
what she answers is the root's.

**Question 4. How many asks does a door judge at once?** Several, and the
door checks twice as the spec says. A being is not serialised: only the
sends on one relation wait for each other.

**Question 5. What does the kit call its parts, and its relations?** As
`papers/nervur-explained.md` names them: harbor, terrain, ward, house,
being, faculty, `Ward`, `Dock`, catalogue, registry, DNA, `live`, module,
cells, partition, stance, kind, level. A class is named by the kind it
declares on itself, never by the name the language gives it, and is
resolved by a registry: the catalogue, from a module the commit `live`
names in the harbor's DNA, which she keeps as a git repository, or a
registry faculty the owner opened. An occupant and a standing are each
filed under an id the being chooses. None of these names crosses a door.

## What a kit keeps

**Question 6. How are a ward's seed and its lock handed in and held, how
and when is the lock made, how many locks a ward holds, and does the ward
keep an heir's secret after it gives the invitation?** The harbor's seed
comes from the `Custody` contract, and it is the box ward's seed. A
harbor carried to an edge keeps the seed it was born with, packed under
its name and sealed under the worker's one `NERVUR_SECRET`. A
hosted ward's seed is drawn when the dock hosts it, or named in `host`,
and the dock keeps it in her cells. A ward holds one lock, drawn, never
derived from the seed, at its first invitation and kept in the partition,
so every invitation it gives carries the same encapsulation key. The heir
secret is not kept: the partition holds the heir pk and what the spec
keeps for a relation, and the secret lives only in the invitation.

**Question 7. Where do drawn bytes come from?** The `Entropy` contract.
The pointer terrain's body is `crypto.getRandomValues`, and a test hands a
fixed stream. Draws follow the spec's order.

**Question 8. What does a door keep for a relation, and in what?** What
the spec's relation keys name: the key held and the key vouched for, the
open and offered edge keys, and the count, in the ward's partition. The
partition is sealed under a key from the harbor's seed, and its bytes
live with the ward's keeper, the `Memory` body or a memory faculty making
the same promise, in the same keep as the cells of the being who
answered. So whether it survives a restart is the keeper's:
`VolatileMemory` keeps them for the life of its object, `FolderMemory`
on a disk. The count keeps the highest number honoured and
the numbers honoured in a bounded span below it.

One seed is not held to one run by the kit's contracts. That is the
terrain's: the Node ground, which the `nervur` command and
`Harbor.open()` in Node both stand on, refuses to open a folder another
run serves.

**Question 9. When does a door stop holding an heir, and what asks it to?**
When the being that invited it removes the occupant, when a faculty
retracts an offer nobody took, and when the root unboots the being that
invited it. Nothing else asks.

**Question 10. How long are keys kept at removal kept?** For the last 256
removed relations, oldest out, counted and never timed, so a partition is
bounded. An heir removed while fresh leaves nothing.

**Question 11. Which count numbers below the highest honoured does a door
still honour?** Those within a span of 64 below the highest that were not
seen, kept as a set beside the highest. Below the span, none.

## What a kit answers

**Question 12. Does the door answer, and when does it give nothing?** It
answers every ask with a box, silence included, and never gives nothing.
Nothing comes only from a carrier that did not deliver.

**Question 13. How is `seen` made, and when does it change?** The digest
of what the being can be asked by this asker: SHA-256 over the canonical
form of her describe, lowercase hex. It changes when her describe for that
asker changes. A being with no describe answers with `seen` null.

**Question 14. What does the empty ask answer?** The being's describe as
the object, with `seen` null. A being may answer silence instead.

**Question 15. How is a reply text other than silence written?** `object`
then `seen`, with no whitespace.

**Question 16. Does the kit pad what it seals with whitespace, and how
much?** It writes no padding, and reads any the spec allows.

**Question 17. Does every refusal take the same time?** No. Each case
refuses as early as the order allows, and the door evens bytes, never
time. A stranger with no invitation learns nothing from timing.

**Question 18. What does the kit keep for its own eyes?** The door hands
back the case it met and whether a key it holds spoke, beside the bytes
and never in them. The harbor keeps neither. A reply that breaks a rule
reads as silence, and no reason is kept.

## What a kit asks

**Question 19. How does an invitation reach its holder, and does the
minting kit keep a copy?** As a value a being returns or passes in args.
The minting ward keeps no copy.

**Question 20. How does a standing recover a knock that brought no object
back?** Its next ask goes under its own key and the knock's edge key, with
no ciphertext. The ask after that sends the knock again as the same
bytes, and the two alternate until an object comes back. A take asks up
to twice more after its knock before it gives up.

**Question 21. How long does an asker wait for a reply?** The allowance:
30,000 ms unless the being asks for another, never above 300,000 ms. A wait
that runs out is `late` to the being.

**Question 22. How does a standing number its asks, which keys does it
announce and when, and how does it keep two sends on one relation apart?**
One above the highest it sent. Every ask announces a freshly drawn key in
`next`. The sends on one relation run one after the other on the
relation's line.

**Question 23. What does the kit tell its own code on silence, on a word,
and on nothing?** Silence is the `silence` symbol. A word is the frozen
word object of that name. Nothing is `unreached`.

## What a kit carries

**Question 24. Which carriers does the kit stand, and in which forms,
does it carry them inside TLS and with which checks, and where it listens
on the web, at which path, for which origins, and with which status when
it does not carry an ask?** Quo over TCP, in plain TCP, as the carrier
faculty `org.nervur.tcp` from `nervur/tcp`, which dials and, where its
cells say, listens and answers ask frames for a harbor's doors; on an
edge the same faculty dials through the worker's sockets and never
listens, since a worker takes no inbound TCP. Quo over
the web, both forms, as the carrier faculty `org.nervur.web`: it dials a
post to `http` and `https` and a held line to `ws` and `wss`, inside TLS
where the scheme says, with the checks of the engine's own `fetch` and
WebSocket client. On Node it listens without TLS at the host, port and
path its cells name, `/` unless named, answers the CORS protocol for the
origins its cells name, every origin unless named, and answers a post it
does not carry with status 204, a post to another path with 404, another
method with 405, and a body that is no ask with 400. On an edge the
worker's shell answers the same way from the Durable Object's own
requests, at the path the carrier's cells name, behind the edge's TLS,
and hands each box to the child running the harbor. A harbor
carries to its own doors first, then walks a ward pk's route over its
carrier faculties, and hands a pk with no route to its terrain's
`Carrier`, which in a pointer world is `PointerCarrier`, reaching a
harbor through a `World`. The dialer opens one connection per address,
carries many asks on it, waits on an ask until its answer or the
connection's close, and closes a connection that sends bytes that are
not a frame. A held line is dialed once per address and carries many
asks. A carrier faculty may also answer for a ward pk no door of its
harbor holds, as a relay does, and the harbor hands it every box for such
a pk. Every other carrier is a class outside the kit, fulfilling
`CarrierFaculty`.

**Question 25. How does the kit learn where a ward is reached, does it
write `at` in its invitations and with which addresses, and how does it
try the addresses it reads?** A ward pk's route is a list of addresses in
the dock's cells, handed to the carrier as the harbor unpacks. The root
sets one with the dock's `route` ask, and it is trusted first. Where the
root set none, taking an invitation that carries `at` keeps that `at` as
the route, where the carrier dials one of its addresses. Every invitation
a harbor gives carries in `at` the addresses the root set with the dock's
`reach` ask. Where it set none, they carry every address its carriers
listen at, save one naming the unspecified host, and none where nothing
listens. A route is kept only where a
carrier faculty of the harbor accepts one of its addresses. The harbor
tries a route's addresses one after another, each with the carrier that
accepts it, going to the next only when the one before could not be
dialed, since a line that took a box may have heard it, and gives each as
long as the being's allowance. A `World` finds a ward's harbor by its pk. A ward
pk with no route is not delivered.

## What is not the kit's either

**Question 26. What do `method` and `args` mean?** Nervur's `Being` reads
`method` as the name of one of her declared asks and `args` as its input.
The empty ask is her describe.

## What a kit reads

**Question 27. How deep, how long and how strange a JSON text does the kit
read where Quo reads nothing, and what does it answer beyond that?** It
reads every value the spec allows, and keeps the bytes of `args` as they
arrived. A being is handed `args` parsed, and an arg nested deeper than 64,
holding a lone surrogate, repeating a key at any depth, or holding a
number a double does not hold as written is answered silence, because a
being would read something other than what was sent.
