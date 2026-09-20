# Security Policy

## Reporting a vulnerability

Please do not report security problems in a public issue.

Report them through GitHub's private vulnerability reporting, on the
Security tab of this repository, or by email to
`security@nervur.org`.

Please include the version, the engine, and enough detail to reproduce
the problem. You will get a first reply within five working days.

## What is in scope

`nervur` carries Quo, a protocol whose security rests on sealed boxes,
keys that move with every ask, and a seed that never leaves its custody.
Reports about any of the following are especially welcome:

- A box that opens where it should not, or a head that passes a door it
  should not pass.
- A key, a seed or a heir that reaches somewhere it was never handed.
- A ward's package read or written by something that holds no key to it.
- Any use of the cryptography that departs from what Quo's spec says.

## Supported versions

Until 1.0.0, only the latest published version is supported. Fixes land
in the next release, and there are no backports.

## Quo itself

Quo is a separate work with its own repository. A problem in the
protocol rather than in this implementation belongs at
<https://github.com/razvangherghina/quo>, and you are welcome to report it
here if you are unsure which it is.
