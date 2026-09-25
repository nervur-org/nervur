# The command

`nervur` is the command the package installs. It holds no business of
its own. Two words start things on your machine, and every other word is
read from what the running ground says it holds. This guide assumes you
have read [the package's start](README.md), which runs a first ground.

## Starting a ground

`nervur up` runs a NodeGround on a folder until it is stopped. The
folder holds your code: a folder for each house, and each module or
program your entries name. `state/` holds the ground's key, its ledger
and its hand. The key is drawn on the first start, into a file your user
alone reads.

```bash
npx nervur up .
```

The ground stops cleanly on an interrupt and on `SIGTERM`. Its ledger
holds a lock on its state while it stands, so a second `nervur up` on
the same folder refuses to start. Keep `state/` as you keep an ssh key:
whoever holds its key and its ledger holds the ground, and without the
key the ledger opens nothing.

`nervur service` prints what keeps the ground running across reboots: a
systemd unit on Linux, a launchd job on macOS. Nothing is installed; you
place what it prints.

```bash
npx nervur service /srv/shop
```

## Settings

The environment names only what opens the ground's memory, its key and
its hand.

| Variable | What it names |
| --- | --- |
| `NERVUR_STATE` | the state folder, `state/` in the ground's folder where unset |
| `NERVUR_UNLOCK` | on macOS, `keychain:<account>` keeps the key in the keychain in place of `state/key` |
| `NERVUR_HAND` | where the hand's socket is, `state/hand` where unset; a relative path is read from where the command runs |

Every other setting is an entry the ground's dock keeps, set through the
hand and kept across a restart. The `tcp` entry listens on the loopback
at 9110 until you name another bind, and the `web` entry listens on no
port until one is named. The web serves the ground's one listener,
which its entry names in `faculties`.

| Arg | Of | What it sets |
| --- | --- | --- |
| `port` | `tcp`, `web` | the port it listens on; with none, it only dials |
| `bind` | `tcp`, `web` | the address it listens on, every interface where unset |
| `addresses` | `tcp`, `web` | the public addresses written into invitations |
| `origins` | `web` | the page origins the web listener answers |
| `allowPrivate` | `tcp`, `web` | `true` to let the ground dial a private or loopback address |

```bash
npx nervur faculties update name=web make=web faculties='["listener"]' args='{"port":8080,"addresses":["https://shop.example/quo"]}'
npx nervur wait set wait=30000
```

`faculties catalog` prints every faculty the ground can raise and what
each takes, so an entry it refuses says which arg failed. `wait set`
keeps the longest any ask may run, in milliseconds, and `wait show`
prints it.

A ground that people reach names its public addresses. Without them, it
writes only the addresses it listens on, which a stranger cannot reach.

A socket's path fits 103 bytes on macOS and 107 on Linux, and a longer
one refuses to start by name. A ground in a deep folder names a shorter
path in `NERVUR_HAND`, such as `state/hand` run from the folder, and every
command that reaches it names the same.

## Asking the ground

Every other word goes to the ground's hand, a socket in `state/` that
your user alone may open. Run the command in the ground's folder, or
name the socket with `--at <socket>` or `NERVUR_HAND`.

`help` prints what the ground holds: the asks of its dock, each faculty
with its methods or why it is down, and each house.

```bash
npx nervur help
```

The dock is the ground's own house, and its steward changes the ground.
Two words ask her, so `houses add` asks `housesAdd`. One word alone
prints the asks it begins. `secrets set` keeps a secret in a being of
the dock, whose cells no one reads. `faculties add` raises a faculty by
the `up` its entry names, and `houses add` opens a house on its entry.
Each answers why the body is down or the house closed, where it is.
Each `update` lands a new entry in one write, and `faculties restart`
takes a body down and up again. A faculty named with a method is called
through the dock, and named alone it prints its methods.

An entry names only faculties and secrets the ground holds already. A
module and a program stand on the folder's registry, so their entries
say `from=folder`.

```bash
npx nervur faculties add name=recipe from=folder make=module args='{"at":"recipe.ts"}'
npx nervur faculties add name=payments from=recipe make=payments secrets='["stripe-key"]'
npx nervur houses add name=main classes='{"faculty":"folder","at":"house"}' faculties='["payments"]'
```

`ask` asks a being of a house, as the house's owner. `--id <being>` names
her, and with none it asks the steward. With no method, it prints what
she shows.

```bash
npx nervur ask main
```

`--cells` reads a being's cells as they last landed, and asks nothing.
Nothing but the hand reads cells, which makes it the tool for a test, a
repair, or a look at what her asks do not show.

```bash
npx nervur ask main --cells
```

`ask dock` asks the dock's own beings, since no house takes that name.
`faculty.<name>`, `house.<name>` and the steward hold every entry, seed
and setting, and a secret's cells are shown to no one.

```bash
npx nervur ask dock --id faculty.web --cells
```

`shell run` runs a command on the ground's machine, in its code folder,
and prints its exit code and what it printed. The words after `--` are
the command line. Its environment holds nothing of the ground's.

```bash
npx nervur shell run -- git status
```

The command asks no watch. A watch is held by a being on her standing,
or by a page through a face, where something waits on its answer.

## Arguments and answers

Arguments are one JSON object, or words `key=value`. A value is read as
JSON where it reads as JSON, and as text where it does not, so
`count=3` is a number and `name=Ada` is text.

```bash
npx nervur ask main hello '{"name":"Ada"}'
```

A lone `-` reads the one JSON object from standard input instead. So a
secret never stands on a command line or in a shell's history.

```bash
npx nervur secrets set - < stripe-key.json
```

`--call <id>`, before the words, names the ask's call id. The same ask
sent again with the same id answers what the first answered, and runs
nothing twice. So a script that lost an answer sends its ask again.

```bash
npx nervur --call deploy-42 houses update name=main classes='{"faculty":"folder","at":"house"}'
```

Each word prints one JSON value, the answer, and its exit code says what
came back.

| Exit | What it means |
| --- | --- |
| 0 | a result, or what she shows |
| 1 | an error the ground or the being answered |
| 2 | nothing was asked: a word the command does not know, or a hand that does not answer |

So a script tells a refusal from a ground that is down.
