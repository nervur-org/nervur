# nervur's answers to KIT-SPEC

This document answers, for `nervur`, every question that Quo's `KIT-SPEC.md`
asks of a kit. Quo's spec, `SPEC.md`, and `KIT-SPEC.md` stand in
[razvangherghina/quo](https://github.com/razvangherghina/quo), and every
term below is the term they define. Quo's verifier judges nervur's Quo
layer as a door, an asker, a TCP listener and a TCP dialer. It passes all
four. Each answer states what the code of this version does.

## What stands behind a door

**Question 1.** A house stands behind each door, and holds one ward. A
house holds beings. A being is an instance of a class a developer writes,
with JSON cells and named asks. A ground is the script that opens a house.
It hands each arrival to the house's `door(box)` function. The door finds
the relation by its heir, and the heir names one being and one of her
occupants. An occupant is a being's name for the door's end of a relation.
Asks to one being run one at a time, in the order they arrive. An ask
marked `readOnly`, and the empty ask, run beside them. Asks to two beings
run side by side.

**Question 2.** The ground that runs the house holds its seed, in a
custody of one seed for each house. A keys body gives signatures and
agreements from it, and never the seed itself. `House.open`
hands the ground a hand, `ask({ id, method, args })`, which asks the being
`id`, or the steward where none is named, as the occupant `root`. The
steward places and removes every other being. Every other being holds the
standing `steward`, which she cannot drop. The steward cannot dismiss
`root`. So no path inside a house removes the edge back to what made it.
`root` never arrives through a door. The ground serves the hands of all
its houses in one place. On Node, that is a local socket only the
ground's user may open.

**Question 3.** The public being answers the zero head, where the ground's
classes name one. A house with no public being answers every ask on the
zero head with silence, as case 4. The public being reads each such asker
as the occupant `stranger`, with the key its ask was signed by. A stranger
reaches only her asks that are safe to repeat. The house keeps each
zero-head choice by the box's signature for ten minutes. The same sealed
bytes arriving again within that window hear the same choice, and nothing
runs twice. That cache lives in the process, so a restart empties it.

**Question 4.** The door opens any number of boxes at once, and judges
one at a time on each relation. A box whose relation has another box in
flight waits for it, and is judged again on the record it left. A box
opened on a record that moved meanwhile is judged again too. So each box
is admitted by what holds when the door chooses, and the highest number
honoured never goes down. An admitted ask waits its turn among its
being's asks, and its move lands in the ask's own write.

**Question 5.** nervur calls what stands behind a door a house, and what
it holds beings. The door's end of a relation is an occupant, named by an
id its being chooses. The asking end keeps Quo's name, a standing. A
standing that arrives by invitation is named `standing:` and sixteen hex
digits drawn from its heir, so the same invitation taken again gives the
same standing. The ids `root`, `stranger` and `steward` are reserved, with every
id beginning `handle:` or `being:`. The process that opens a house is its
ground. None of these names crosses a door.

## What a kit keeps

**Question 6.** A ward's seed is sixty-four lowercase hex digits, and
anything else opens no house. `SeedKeys` takes it as a string. `FileKeys`
reads it from a file only its owner may read, and `KeychainKeys` from the
macOS keychain. Both make a fresh seed where none is kept. The house never
holds the seed, and asks its keys body for operations alone. The lock is
derived, not drawn. It is the ML-KEM-768 key pair from 64 bytes of
HKDF-SHA-256 over the seed, under the label `nervur-lock`. It is made on
first use and is the same every time. So a ward holds one lock, and its
seed alone restores it whole. The ward keeps no heir's secret after it
gives the invitation.

**Question 7.** Every drawn byte comes from `crypto.getRandomValues`, the
platform's Web Crypto source. The default crypto body, `NobleCrypto`, draws
there for heir secrets, ephemeral secrets, announced keys and ids. Its
ML-KEM encapsulation, from the noble library, draws from the same source.
The lock draws nothing, since it derives from the seed. A ground may hand
its own crypto body, and then the source is that body's.

**Question 8.** For each heir, the door keeps whether it is spent, the key
it holds, the key it vouches for, and the open and offered edge keys. It
keeps the highest number it honoured as well. That record sits in the
place of the being the heir reaches, beside her other relations. The house
keeps it in the memory its ground hands it, sealed under a key derived
from the seed. `FileMemory` and `LedgerMemory` write to disk, and the
record survives a restart with them. A standing's record is kept the same
way. Its number and its knock are written before a box leaves.

**Question 9.** A door stops holding an heir when its being dismisses the
occupant the heir reaches. It stops when a handle made for one use has its
first ask land. It stops when the steward removes the being. An invitation
taken by a standing of the same house binds inside the house, and its heir
leaves the door then. An heir minted with a time to be spent in, and
still unspent past it, is one the door never held. The door lets it go
at the next mint or binding knock. A spent heir never expires, nor one
minted without a time.

**Question 10.** The door keeps no keys at removal, for any time.
Dismissal deletes the heir from the door's index. So an ask signed by any
of the relation's keys hears silence at once, and the door never answers
`removed` in this version.

**Question 11.** None. A door honours no number below the highest it
honoured on a relation, and a number at or below it hears `repeated`. A
nervur standing numbers each ask above every number it sent. So a retry
never meets `repeated` for a box that arrived.

## What a kit answers

**Question 12.** The door answers every box it refuses with silence or
with one of Quo's words. It answers every admitted ask with a choice. The
choice is the being's object, or silence where the being is absent or does
not hold that asker. The door gives nothing where the memory refuses the
write that holds the ask's move. Over TCP, the listener also answers
nothing for a ward it does not hold, and for a door that fails with an
error.

**Question 13.** `seen` is sixteen lowercase hex digits. They are the first
eight bytes of the SHA-256 of the canonical JSON of the describe that asker
would hear. So `seen` changes exactly when that describe changes: the
being's state, the asks shown to that asker, or their entries. Every
object carries it, an answer and a describe alike, a refusal of `args`
that repeat a key among them.

**Question 14.** The empty ask answers a describe to any asker the door
admits, a stranger on the zero head among them. A being that is absent
answers silence instead. A describe holds the being's current state and
every entry shown to the roles its asker holds, in every state. So two
askers with different roles hear two describes. Its `lang` is
`org.nervur.asks/1`, nervur's language above Quo, whose shapes are below.
An entry's `description` is the class author's text. Its `args` and
`result` are JSON Schema 2020-12, in a closed subset. A named ask that no
entry shown to that asker names hears `{"error":{"message":"no such ask"}}`.

```text
describe = { lang: "org.nervur.asks/1", kind, description?, state, asks }
entry    = { method, in, to, description?, args, result?, hints, wait }
answer   = { result } | { error: { message } }
```

**Question 15.** A reply text holds no whitespace between tokens. An
object reply writes `object` first and `seen` second. Its object is
canonical JSON, with every object's keys sorted by UTF-16 code units. A
word is written `{"quo":"removed"}`, and silence `{"silence":true}`.

**Question 16.** No. nervur seals every payload and every reply text with
no padding. It reads padding wherever padding arrives.

**Question 17.** No. Each refusal returns as soon as its case is found.
So a box refused at its head returns sooner than one refused at its
signature.

**Question 18.** The Quo layer names the case that refused each arrival,
and the house discards it. Nothing in this version logs a refusal, or a
reply that breaks a rule. A standing reads a reply that breaks a rule as
silence, and keeps no record of why.

## What a kit asks

**Question 19.** An invitation leaves a house as a handle. A being puts a
handle in her answer, or in the `args` of a call outward. The house writes
it as the hex of the invitation's canonical JSON. From there it travels
however its receiver carries it. The minting house keeps no copy. It keeps
the heir's public key and the record of the relation, never the heir's
secret.

**Question 20.** A standing whose knock surely reached no door sends the
knock again, as the same bytes, until it may have. Its carry says so: no
address took the box. A standing whose knock may have been heard, and
brought no object back, recovers it in turns. Its next send is an ask
with a new number, under the key its knock announced and the knock's edge
key. The send after that is the knock again, as the same bytes. The two
take turns until an object comes back, or a word to an ask. An awaited
call makes one send within its wait, and the next call on the relation
takes the next turn. An effect is sent again after a wait that starts at
one second and doubles, never past five minutes. It stops at its
deadline, which is seven days for a standing.

**Question 21.** Over TCP and the web, a dialer waits thirty seconds for
each address, unless the ground sets `wait` on its carry. An awaited call
waits as long as the method it calls names. That is thirty seconds by
default, never past five minutes, and never past the ground's `wait` on
the house. It never waits past what is left of the ask that makes it. An
awaited call to a far ward carries that time in the payload field
`within`, in milliseconds. The ask it starts waits that long at most, and
an ask whose time is spent runs nothing and hears silence. A being waits
on no effect, and an effect's answer returns to her as an ask.

**Question 22.** A standing numbers its asks from 1, each one above the
last it sent. Every ask announces a fresh random key in `next`. The house
sends one ask at a time on each relation, and the next waits for the reply
to the last. The number and any knock are written before a box leaves.
The standing moves only on an object answering an ask above every ask it
has moved on. It then signs with the key that ask announced, and keeps no
key it moved from. After a move, an ask that meets silence moves nothing.
The next ask signs with the same key under the same edge key, with a new
number and a new announced key.

**Question 23.** The Quo layer reads a reply as one of four: an object
with its `seen`, silence, one of Quo's three words, or nothing. The house
treats silence, a word and nothing alike, as transient, and names no
cause for any of them. An address that never answered, a spent heir and
a reply that came late read the same. An awaited call fails with the
method's name followed by `answered nothing`. An effect is sent again.
Past its deadline, its reply ask reads `the call gave up at its
deadline`. A being never reads silence, a word or nothing as such.

## What a kit carries

**Question 24.** nervur stands Quo over TCP, as a listener and as a
dialer, in `TcpCarry` from `nervur/node`. It carries plain TCP, with no TLS
and no check beyond Quo's own. The listener binds `0.0.0.0` by default, on
the port the ground names or one the system picks. One listener answers
for every ward whose house listens on it, routed by the ward each ask
names.

nervur stands Quo over the web in `WebCarry`, both its post and its held
line, as a listener and as a dialer. The listener is a handler on the
ground's own HTTP listener, at the path `/quo` unless the ground names
another. It answers a reply with status 200 and nothing with 204. It
answers a request that is not a `POST` with 405, a body of the wrong size
with 400, and a ward pk it holds no door for with 404. It answers the
CORS protocol only for the origins its ground names, and no origin
otherwise. A held line that does not offer the subprotocol `quo` is
refused at its handshake with 400. TLS is the ground's listener's, and
this carry adds none.

**Question 25.** A standing learns where a ward is reached from the `at` of
its invitation, and from which address answered. A house writes `at` in
every invitation it mints. It writes the addresses the ground hands its
carry, the same toward every holder. A carry that joins several lists
every one's addresses. Where the ground hands none, `TcpCarry` writes the
listener's own address, with `0.0.0.0` written as `127.0.0.1`.

A carry keeps the door of every ward it listens for. A box to one of those
wards goes to its door in the same process, before any address, and no
connection is made. So the houses of one ground reach each other by the
carry they share, whatever their invitations' `at` holds.

A standing keeps its route: the address that last answered with an
object or a word, which only a reply that opened as the ward's carries.
Silence pins nothing. Each ask tries the route first, then the addresses
of `at` in their order, one after another. The route is kept with the
standing's record and survives a restart.

A door writes `at` in an object reply when the ground's addresses differ
from the ones that holder last heard, in its invitation or in a reply.
It writes them once, and a later reply carries none until they change
again. A reply lost after it carried them leaves that holder with the
old addresses until the next change. A standing takes `at` from an
object reply alone. It replaces the addresses it held, and a later reply
with none leaves them as they stand. The dialer skips an
address its carry does not speak. It looks a name up and takes its first
address. One connection to each address carries many asks at once.

The dialer refuses a loopback, private, link-local, shared or unspecified
address, unless the ground sets `allowPrivate`. Over the web it reads
the host as the URL writes it, and refuses `localhost` too. It moves to
the next address after a refused address, a failed connection, a
nothing frame, or a post answered with any status but 200 and a body. It
carries the box no further after a wait that runs out, a connection that
closes with the ask in flight, or a post that failed after it was sent.
That ask may have been heard, and the send answers nothing.

## What is not the kit's either

**Question 26.** `method` names an entry of the being's describe, and
`args` are that entry's arguments. The house holds `args` to the entry's
schema before the method runs, and answers a mismatch as an error. The
`lang` `org.nervur.asks/1` names nervur's language, whose shapes Question
14 gives. A field `call` beside `method` carries a call id, and a field
`within` the milliseconds its chain has left, as Question 21 gives. An ask whose
call id that occupant already used hears the stored answer, and runs
nothing. A call id is kept seven days.

## What a kit reads

**Question 27.** nervur's JSON reader is iterative. It reads any nesting
depth that a box of at most 1 MiB holds, and sets no length below that
size. It takes lone surrogates written as escapes, and noncharacters, as
they stand. Repeated keys anywhere inside `args` are answered
`{"error":{"message":"the args repeat a key"}}`, and the method never runs.
Numbers are read as IEEE 754 doubles. So an integer beyond 2^53 loses
precision before the schema holds it. Fields of the payload that the spec
does not name, `call` and `within` apart, are ignored. Inside a reply's
`object`, a standing takes a repeated key and keeps its last value.
