// SPDX-License-Identifier: Apache-2.0
// The three boxes and the keys between them.
//
//   ask box    lid (32) || AES( head ) || AES( body )
//   knock box  lid (32) || AES( head ) || ML-KEM ciphertext (1088) || AES( body )
//   reply box  ephemeral pk (32) || AES( body )
//   body       JSON text || signature (64)
//
// The head of an ask and the body of a reply are sealed under `quo-seal`
// over the agreement. The body of an ask is sealed under `quo-edge-seal`
// over the agreement and then the edge key. Every ciphertext's additional
// data is its own box's ephemeral pk.
import { CIPHERTEXT, concat, decrypt, encrypt, hkdf, sign, TAG, verify } from '../crypto/index.ts';
import { Ephemeral, LABEL, type Draw, type SigningKey } from './keys.ts';

export const SIZE = 1_048_576;
export const HEAD = 32;
export const SIGNATURE = 64;
export const SEALED_HEAD = HEAD + TAG;
export const ZERO_EDGE = new Uint8Array(32);
export const ZERO_HEAD = new Uint8Array(HEAD);

const cipher = async (label: Uint8Array, ...material: Uint8Array[]) => {
  const out = await hkdf(concat(...material), label, 44);
  return { key: out.subarray(0, 32), nonce: out.subarray(32) };
};
const seal = async (label: Uint8Array, material: Uint8Array[], lid: Uint8Array, plaintext: Uint8Array) => {
  const { key, nonce } = await cipher(label, ...material);
  return encrypt(key, nonce, lid, plaintext);
};
const open = async (label: Uint8Array, material: Uint8Array[], lid: Uint8Array, ciphertext: Uint8Array) => {
  const { key, nonce } = await cipher(label, ...material);
  return decrypt(key, nonce, lid, ciphertext);
};

// A knock's edge key, from the shared secret the lock decapsulates.
export const knockEdge = (shared: Uint8Array): Promise<Uint8Array> => hkdf(shared, LABEL.lock, 32);

// The edge key that follows `edge` after a reply of this agreement.
export const follow = (edge: Uint8Array, agreement: Uint8Array): Promise<Uint8Array> => hkdf(concat(edge, agreement), LABEL.edge, 32);

export const signBody = async (text: Uint8Array, key: SigningKey): Promise<Uint8Array> => concat(text, await sign(key.secret, text));

// The text and signature of a body, or null for a body of sixty-four bytes
// or fewer.
export const splitBody = (body: Uint8Array): { text: Uint8Array; signature: Uint8Array } | null =>
  body.length <= SIGNATURE ? null : { text: body.subarray(0, -SIGNATURE), signature: body.subarray(-SIGNATURE) };

export const checkBody = (pk: Uint8Array, body: { text: Uint8Array; signature: Uint8Array }): Promise<boolean> => verify(pk, body.text, body.signature);

// An ask box sealed under `lid` to a padlock, or null for a padlock that
// takes no seal. `ciphertext` makes it a knock box.
export const sealAsk = async (lid: Ephemeral, padlock: Uint8Array, head: Uint8Array, edge: Uint8Array, body: Uint8Array, ciphertext?: Uint8Array): Promise<Uint8Array | null> => {
  const agreement = await lid.agree(padlock);
  if (agreement === null) return null;
  const sealedHead = await seal(LABEL.seal, [agreement], lid.pk, head);
  const sealedBody = await seal(LABEL.edgeSeal, [agreement, edge], lid.pk, body);
  return concat(lid.pk, sealedHead, ciphertext ?? new Uint8Array(0), sealedBody);
};

// What a door reads before it knows which edge key to try.
export type OpenedHead = { lid: Uint8Array; agreement: Uint8Array; head: Uint8Array; rest: Uint8Array };

export const openHead = async (bytes: Uint8Array, agreement: Uint8Array): Promise<OpenedHead | null> => {
  if (bytes.length < HEAD + SEALED_HEAD) return null;
  const lid = bytes.subarray(0, HEAD);
  const head = await open(LABEL.seal, [agreement], lid, bytes.subarray(HEAD, HEAD + SEALED_HEAD));
  return head === null ? null : { lid, agreement, head, rest: bytes.subarray(HEAD + SEALED_HEAD) };
};

// A knock's rest split into its ciphertext and sealed body.
export const splitKnock = (rest: Uint8Array): { ciphertext: Uint8Array; sealedBody: Uint8Array } | null =>
  rest.length < CIPHERTEXT ? null : { ciphertext: rest.subarray(0, CIPHERTEXT), sealedBody: rest.subarray(CIPHERTEXT) };

export const openBody = (opened: OpenedHead, edge: Uint8Array, sealedBody: Uint8Array): Promise<Uint8Array | null> =>
  open(LABEL.edgeSeal, [opened.agreement, edge], opened.lid, sealedBody);

export type SealedReply = { bytes: Uint8Array; agreement: Uint8Array };

// The reply's ephemeral key and its agreement with the lid, drawn before the
// reply is written, since the edge keys move by that agreement.
export type ReplyKey = { ephemeral: Ephemeral; agreement: Uint8Array };

export const replyKey = async (draw: Draw, lid: Uint8Array): Promise<ReplyKey | null> => {
  const ephemeral = await Ephemeral.draw(draw);
  const agreement = await ephemeral.agree(lid);
  return agreement === null ? null : { ephemeral, agreement };
};

export const sealReply = async (key: ReplyKey, body: Uint8Array): Promise<Uint8Array> =>
  concat(key.ephemeral.pk, await seal(LABEL.seal, [key.agreement], key.ephemeral.pk, body));

// A reply's body and agreement, opened with the lid's secret, or null.
export const openReply = async (bytes: Uint8Array, lid: Ephemeral): Promise<SealedReply | null> => {
  if (bytes.length > SIZE || bytes.length < HEAD + TAG) return null;
  const pk = bytes.subarray(0, HEAD);
  const agreement = await lid.agree(pk);
  if (agreement === null) return null;
  const body = await open(LABEL.seal, [agreement], pk, bytes.subarray(HEAD));
  return body === null ? null : { bytes: body, agreement };
};
