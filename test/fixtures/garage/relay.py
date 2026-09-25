#!/usr/bin/env python3
# The relay on a garage's Pi, as a faculty over the bridge. One pulse
# toggles the door, so a pulse sent twice would open it and close it
# again. It keeps each call id in the faculty's memory before it pulses,
# and answers an id it has seen with the answer it gave, so a pulse sent
# again never toggles twice. Its memory is sealed by the ground and
# travels with it; its folder holds only what the Pi's pin would show.
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

waiting = []
asked = 0


def send(message):
    sys.stdout.write(json.dumps(message) + '\n')
    sys.stdout.flush()


def remember(op, args):
    # One memory line, and the ground's answer to it; calls that arrive meanwhile wait their turn.
    global asked
    asked += 1
    mine = 'memory-' + str(asked)
    send({'id': mine, 'memory': op, 'args': args})
    while True:
        line = sys.stdin.readline()
        if line == '':
            sys.exit(0)
        message = json.loads(line)
        if message.get('id') != mine or 'method' in message:
            waiting.append(message)
            continue
        if 'error' in message:
            raise RuntimeError(message['error']['message'])
        return message['result']


def seen():
    read = remember('read', {'place': 'seen'})
    return {call: int(bytes.fromhex(count).decode()) for call, count in read['entries'].items()}, read['version']


def keep(call, count, version):
    landed = remember('write', {'writes': {'seen': {call: str(count).encode().hex()}}, 'expect': {'seen': version}})
    if landed is None:
        # Another life wrote first: this one ends, and the ground starts it again.
        sys.exit(1)


def pulse(call):
    # The Pi drives its pin here. This relay writes a line, so a test counts pulses.
    with open('pulses', 'a') as relay:
        relay.write(call + '\n')


def messages():
    while True:
        if waiting:
            yield waiting.pop(0)
            continue
        line = sys.stdin.readline()
        if line == '':
            return
        yield json.loads(line)


# Each life writes a line, so a test knows when the program started again.
with open('lives', 'a') as lives:
    lives.write(str(os.getpid()) + '\n')
for message in messages():
    if message['method'] == 'describe':
        send({'id': message['id'], 'result': {'blueprint': BLUEPRINT, 'window': 7 * 86_400_000}})
        continue
    if message['method'] != 'pulse':
        send({'id': message['id'], 'error': {'message': 'no such method'}})
        continue
    counts, version = seen()
    if message['call'] in counts:
        send({'id': message['id'], 'result': counts[message['call']]})
        continue
    count = len(counts) + 1
    # The call id is kept before the pulse, so a crash between them never pulses twice.
    keep(message['call'], count, version)
    pulse(message['call'])
    # A test writes `crash-after`: the program dies once after that pulse, before it answers.
    if os.path.exists('crash-after') and count == int(open('crash-after').read()):
        os.remove('crash-after')
        os._exit(1)
    send({'id': message['id'], 'result': count})
