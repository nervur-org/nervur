#!/usr/bin/env python3
# The relay on a garage's Pi, as a faculty over the bridge. One pulse
# toggles the door, so a pulse sent twice would open it and close it
# again. It keeps each call id before it pulses, and answers an id it has
# seen with the answer it gave, so a pulse sent again never toggles twice.
# It runs in the folder the ground gives it, where it keeps what it saw.
import json
import os
import sys

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


def pulse(call):
    # The Pi drives its pin here. This relay writes a line, so a test counts pulses.
    with open('pulses', 'a') as relay:
        relay.write(call + '\n')


def keep(seen):
    with open('seen.json.tmp', 'w') as held:
        json.dump(seen, held)
        held.flush()
        os.fsync(held.fileno())
    os.replace('seen.json.tmp', 'seen.json')


def answer(id, **fields):
    sys.stdout.write(json.dumps({'id': id, **fields}) + '\n')
    sys.stdout.flush()


seen = json.load(open('seen.json')) if os.path.exists('seen.json') else {}
# Each life writes a line, so a test knows when the program started again.
with open('lives', 'a') as lives:
    lives.write(str(os.getpid()) + '\n')
for line in sys.stdin:
    message = json.loads(line)
    if message['method'] == 'describe':
        answer(message['id'], result={'blueprint': BLUEPRINT, 'window': 7 * 86_400_000})
    elif message['method'] != 'pulse':
        answer(message['id'], error={'message': 'no such method'})
    elif message['call'] in seen:
        answer(message['id'], result=seen[message['call']])
    else:
        count = len(seen) + 1
        # The call id is kept before the pulse, so a crash between them never pulses twice.
        seen[message['call']] = count
        keep(seen)
        pulse(message['call'])
        # A test writes `crash-after`: the program dies once after that pulse, before it answers.
        if os.path.exists('crash-after') and count == int(open('crash-after').read()):
            os.remove('crash-after')
            os._exit(1)
        answer(message['id'], result=count)
