# Reading a world

nervur has four pieces: grounds, faculties, houses and beings. They can
model any situation, so they give no order by themselves. This guide
gives the order. It takes a real situation, with its people,
organisations, machines, apps and sensors, and reads it into those four
pieces. It adds nothing to the library. [Writing for
nervur](AUTHORING.md) teaches beings and grounds, and [Writing a
faculty](FACULTIES.md) teaches faculties.

## Three questions

Ask three questions of every real thing, and choose its terrain last.

1. **Whose will does it serve?** A will is one owner, a person or an
   organisation. Inside one will the owner possesses everything. The
   design work is at the borders, where a relation crosses from one will
   to another.
2. **Is it a mind, a thing or a matter?** A mind decides: a human, an AI
   agent, an organisation acting through its systems. A thing senses or
   acts and decides nothing: a camera, a sensor, a shell, a payment API.
   A matter is work several parties share: an order, a booking, a case.
3. **Can it be asked?** The end of a relation that others ask must stand
   on a ground they can reach. So reach decides where a being lives.

## Two kinds of being

**Every being is a twin or a matter.** A twin maps one thing outside the
house into it, through one entry. A matter lives inside the house alone,
and shares work between twins.

| Twin of | Enters by | Being |
| --- | --- | --- |
| the house's owner | the hand | the steward |
| any stranger | a face with no token, or Quo with no relation | the public being |
| one known will | a face with a token, or Quo | a representative |
| one thing | a faculty | the twin of that thing |

**The steward is the twin of the house's owner.** The owner is whoever
holds the house's seed.

**A representative is the twin of one known will.** That will may be a
human on a site, a human with an AI agent over MCP, an organisation's
script over an API, or another house over Quo. Her occupants are that
will's doors in. Her standings are its accounts out.

**A representative in a shop and an avatar at home are one shape.** At a
shop, Alice's representative holds what the shop's class lets her hold.
In Alice's own house, her avatar is the same shape, and Alice's class
decides.

**The twin of a thing is the one being granted its faculty.** The
faculty is the process or service that touches the thing. The ground
grants it to the twin's kind alone. The twin holds the thing's policy,
state and history.

**A matter is shared work.** An order between a customer and a shop, a
case between a lawyer and a court, and a family calendar are matters.
Each is reached only through the representatives and twins of those who
share it.

## The rules between them

- A mind reaches a matter only through its representative.
- A matter or a representative reaches a thing only through its twin.
- A faculty never crosses from one will to another. The other will
  holds a standing on the twin, and the twin applies its policy.
- Nothing outside the house touches a matter directly.
- The border of a house is its twins, one for each outside thing. Its
  inside is its matters.

## How a human enters

**A human enters in one of two ways.**

- **Possessing.** She sits at the machine and asks through the hand,
  with the `nervur` command or an app's own screens. She is `root` on
  every house of that ground.
- **Living.** She enters through a face, a site, an API or an MCP
  server, with a token. She is one occupant of one being, and reaches
  only what that being's table allows her.

**Quo is not a human's entry.** Quo carries asks between houses. When
Alice's home asks a shop, her avatar asks for her.

**The hand never leaves its machine.** A human away from the machine
lives through a face, even in her own house.

## A person, seen from two sides

**A shop sees a person as one being with many doors.** Each occupant of
her representative is one way she reaches it: a browser's token, one of
her devices, or her home. The shop never needs to know that the doors
are one person.

**One reachable house becomes a person's home.** It holds her standings
on every shop, and each of her devices holds a standing on it. A shop
then sees one door from her, and a lost device is revoked at home,
touching no shop.

## Stations and devices

**Every ground is a station or a device, by whether it can be asked.**

- **A station can be asked.** Representatives, the public being and
  shared matters live there.
- **A device cannot be asked.** The twins of physical things live there,
  beside their things. Each device holds a standing on one station.

| Ground | Family | What lives on it |
| --- | --- | --- |
| NodeGround | a station on a server; a device on a desktop or a Pi behind a router | anything its reach allows |
| EdgeGround | a station with no machine | the public being, representatives, shared matters |
| AppGround | a device, woken by launch and by push | the steward, twins of the phone's things |
| BrowserGround | a device bound to its origin | the steward, twins of the browser's things |
| BenchGround | every family, in memory | a whole world under test |

**Representatives live on stations alone.** Others must ask them, so
they need a ground that can be reached.

**The twin of a physical thing lives beside it.** A camera's twin stands
on the Pi or the phone that touches the camera.

**A device keeps matters only for its own autonomy.** A thermostat rule
between a temperature twin and a heater twin runs on the Pi while the
network is down. Every matter another will shares lives on a station.

**A device cannot be asked, so it asks.** Its twins send readings up as
effects to a mirror on its station, and it watches the mirror for what
waits for it. Every other will holds a standing on the mirror, and never
on the device.

## Four roles

**Crossing the owner with the family gives four roles.**

| | Station | Device |
| --- | --- | --- |
| A person's | home | device |
| An organisation's | shop | outpost |

## A garage, read whole

**The garage door is a thing, and its relay is a faculty on a Pi.** One
pulse toggles the door, so a pulse sent twice opens it and closes it
again. The relay's program keeps each call id before it pulses.

**The door's twin is the one being granted the relay.** She keeps who
opened the door and which pulse did it. The Pi is an outpost of the
family: it only dials, and opens no port.

**The door's mirror stands on the family's station, and the twin watches
it.** An opening lands on the mirror and reaches the Pi at once, over one
held line.

**Alice's phone asks the mirror.** Each tap pulses once, across a crash
of the program and a lost reply, since each hop carries one call id. Bob
and a babysitter hold standings on the mirror too, and never reach the
Pi.

## Minds that are not human

**An AI agent is a mind.** One working for a person gets a
representative and lives through an MCP face, or runs from a house of
its own and asks over Quo. It is never a faculty.

**A model called for a completion is a thing.** A being that asks a
model to help her decide calls a faculty through her twin of it. The
being decides, and the model answers.

**A script that speaks no Quo is a mind or a thing.** A script that acts
as a client lives through an API face with a token. A program the house
calls is a thing, wrapped as a faculty by the bridge.

## The order, step by step

1. Draw the wills.
2. In each will, list its minds, its things and its matters.
3. Give each mind a representative, each thing a twin, and each matter a
   being.
4. Place each twin of a physical thing at its thing, and every
   representative and matter on a station of the will that owns it.
5. Connect wills only through representatives and twins.
6. Check that every end others ask stands on a station, and make each
   device push up and pull down.
7. Choose the terrain of each ground last.

## What the reading refuses

- A fifth piece. A twin, a matter, a station and a device are readings
  of the four.
- A faculty granted across a will.
- A representative on a device, where no one can ask her.
- A matter shared with another will on a device.
- A human entering by any way but the hand or a face.
