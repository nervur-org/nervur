#!/usr/bin/env python3
# The relay on a garage's Pi, as a faculty over the bridge. One pulse
# toggles the door, so a pulse sent twice would open it and close it
# again. It keeps each call id before it pulses, and answers an id it has
# seen with the answer it gave, so a pulse sent again never toggles twice.
# The relay is simulated: each pulse is a line in the file RELAY_PULSES.
import json
import os
import sys

SEEN = 'seen.json'
PULSES = os.environ['RELAY_PULSES']
# A pulse after which the program dies once, before it answers, as a crash would.
CRASH_AFTER = os.environ.get('RELAY_CRASH_AFTER')

BLUEPRINT = {
    'name': 'relay',
    'methods': {
        'pulse': {
            'description': 'One pulse of the relay, which toggles the door.',
            'args': {'type': 'object', 'properties': {}, 'required': [], 'additionalProperties': False},
            'result': {'type': 'integer'},
        },
    },
}


def load():
    try:
        with open(SEEN) as held:
            return json.load(held)
    except FileNotFoundError:
        return {}


def keep(seen):
    with open(SEEN + '.tmp', 'w') as held:
        json.dump(seen, held)
        held.flush()
        os.fsync(held.fileno())
    os.replace(SEEN + '.tmp', SEEN)


def answer(id, **fields):
    sys.stdout.write(json.dumps({'id': id, **fields}) + '\n')
    sys.stdout.flush()


seen = load()
for line in sys.stdin:
    message = json.loads(line)
    if message.get('method') == 'describe':
        answer(message['id'], result={'blueprint': BLUEPRINT, 'window': 7 * 86_400_000})
        continue
    if message.get('method') != 'pulse':
        answer(message['id'], error={'message': 'no such method'})
        continue
    call = message['call']
    if call in seen:
        answer(message['id'], result=seen[call])
        continue
    count = len(seen) + 1
    # The call id is kept before the pulse, so a crash between them never pulses twice.
    seen[call] = count
    keep(seen)
    with open(PULSES, 'a') as relay:
        relay.write(call + '\n')
    if CRASH_AFTER is not None and count == int(CRASH_AFTER) and not os.path.exists('crashed'):
        open('crashed', 'w').close()
        os._exit(1)
    answer(message['id'], result=count)
