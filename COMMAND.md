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

The ground stops cleanly on an interrupt and on `SIGTERM`. It takes a
lock on its state, so a second `nervur up` on the same folder refuses to
start. Keep `state/` as you keep an ssh key: whoever holds its key and
its ledger holds the ground, and without the key the ledger opens
nothing.

`nervur service` prints what keeps the ground running across reboots: a
systemd unit on Linux, a launchd job on macOS. Nothing is installed; you
place what it prints.

```bash
npx nervur service /srv/shop
```

## Settings

A ground reads its settings from the environment.

| Setting | What it sets |
| --- | --- |
| `NERVUR_STATE` | the state folder, `state/` in the ground's folder where unset |
| `NERVUR_TCP_PORT` | the TCP port Quo listens on, 9110 where unset |
| `NERVUR_HTTP_PORT` | the port of the web listener, which faces and Quo over the web share; none where unset |
| `NERVUR_BIND` | the address both listen on, every interface where unset |
| `NERVUR_ADDRESSES` | the public addresses written into invitations, by commas |
| `NERVUR_ORIGINS` | the page origins the web listener answers, by commas |
| `NERVUR_ALLOW_PRIVATE` | `1` to let the ground dial a private or loopback address |
| `NERVUR_UNLOCK` | on macOS, `keychain:<account>` keeps the key in the keychain in place of `state/key` |
| `NERVUR_HAND` | where the hand's socket is, `state/hand` where unset; a relative path is read from where the command runs |
| `NERVUR_WAIT` | the longest any ask may run, in milliseconds |

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

`help` prints what the ground holds: each faculty with its methods, or
why it is down, and each house.

```bash
npx nervur help
```

A faculty is called by its name and a method. Named alone, it prints its
methods. Four faculties are the ground's own. `secrets` keeps a secret
in the ground's sealed drawer. `faculties` stands a faculty on the maker
its entry names, and `houses` opens a house on its entry.

```bash
npx nervur faculties add name=recipe make=module args='{"at":"recipe.ts"}'
npx nervur faculties add name=payments from=recipe make=payments secrets='["stripe-key"]'
npx nervur houses add name=main classes='{"body":"folder","at":"house"}' faculties='["payments"]'
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

Each word prints one JSON value, the answer, and its exit code says what
came back.

| Exit | What it means |
| --- | --- |
| 0 | a result, or what she shows |
| 1 | an error the ground or the being answered |
| 2 | nothing was asked: a word the command does not know, or a hand that does not answer |

So a script tells a refusal from a ground that is down.
