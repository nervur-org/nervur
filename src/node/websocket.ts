// SPDX-License-Identifier: Apache-2.0
// The server's side of a WebSocket, as RFC 6455 writes it: the handshake's
// answer, and messages framed on the socket. A client masks every frame;
// the server masks none. A message past `longest` closes the connection.
import { createHash } from 'node:crypto';
import type { Socket } from 'node:net';
import type { Held, HeldSocket } from '../bodies/web-carry.ts';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const TEXT = 1;
const BINARY = 2;
const CLOSE = 8;
const PING = 9;
const PONG = 10;

/** The `Sec-WebSocket-Accept` for a client's key. */
export const acceptOf = (key: string): string => createHash('sha1').update(`${key}${GUID}`).digest('base64');

const header = (opcode: number, length: number): Buffer => {
  if (length < 126) return Buffer.from([0x80 | opcode, length]);
  if (length < 65_536) {
    const out = Buffer.alloc(4);
    out[0] = 0x80 | opcode;
    out[1] = 126;
    out.writeUInt16BE(length, 2);
    return out;
  }
  const out = Buffer.alloc(10);
  out[0] = 0x80 | opcode;
  out[1] = 127;
  out.writeBigUInt64BE(BigInt(length), 2);
  return out;
};

/**
 * A socket past its handshake, held as frames. Every `ping` milliseconds it
 * pings, so a router between keeps the line, and a line silent across two
 * pings is closed, so its dialer dials again rather than wait on the dead.
 */
export const hold = (socket: Socket, open: (held: HeldSocket) => Held, longest: number, { ping = 25_000 }: { ping?: number } = {}): void => {
  let closed = false;
  let quiet = 0;
  const write = (opcode: number, payload: Uint8Array) => {
    if (closed) return;
    socket.write(Buffer.concat([header(opcode, payload.length), payload]));
  };
  const beat = setInterval(() => {
    if (++quiet > 2) return end();
    write(PING, new Uint8Array());
  }, ping);
  beat.unref();
  const end = () => {
    clearInterval(beat);
    if (closed) return;
    write(CLOSE, new Uint8Array());
    closed = true;
    socket.end();
  };
  const held = open({ send: (data) => write(BINARY, data), close: end });

  let buffered = Buffer.alloc(0);
  let parts: Buffer[] = [];
  let partsKind = 0;
  let partsLength = 0;
  socket.on('data', (chunk: Buffer) => {
    // Anything heard, a pong among it, says the line stands.
    quiet = 0;
    buffered = Buffer.concat([buffered, chunk]);
    while (buffered.length >= 2) {
      const fin = (buffered[0] & 0x80) !== 0;
      const opcode = buffered[0] & 0x0f;
      const masked = (buffered[1] & 0x80) !== 0;
      let length = buffered[1] & 0x7f;
      let at = 2;
      if (length === 126) {
        if (buffered.length < 4) return;
        length = buffered.readUInt16BE(2);
        at = 4;
      } else if (length === 127) {
        if (buffered.length < 10) return;
        const long = buffered.readBigUInt64BE(2);
        if (long > BigInt(longest)) return end();
        length = Number(long);
        at = 10;
      }
      // Every frame from a client is masked, and a message past the longest is none of ours.
      if (!masked || length > longest) return end();
      if (buffered.length < at + 4 + length) return;
      const mask = buffered.subarray(at, at + 4);
      const payload = Buffer.from(buffered.subarray(at + 4, at + 4 + length));
      for (let index = 0; index < payload.length; index++) payload[index] ^= mask[index % 4];
      buffered = buffered.subarray(at + 4 + length);

      if (opcode === CLOSE) return end();
      if (opcode === PING) {
        write(PONG, payload);
        continue;
      }
      if (opcode === PONG) continue;
      if (opcode !== 0) {
        partsKind = opcode;
        parts = [];
        partsLength = 0;
      }
      parts.push(payload);
      partsLength += payload.length;
      if (partsLength > longest) return end();
      if (!fin) continue;
      const message = Buffer.concat(parts);
      parts = [];
      partsLength = 0;
      // An always-on ground holds no wake, so what a message asks is answered in its own time.
      if (partsKind === TEXT) void held.message(message.toString('utf8'));
      else if (partsKind === BINARY) void held.message(new Uint8Array(message));
      else return end();
    }
  });
  socket.on('close', () => {
    clearInterval(beat);
    closed = true;
    held.close();
  });
  socket.on('error', () => socket.destroy());
};
