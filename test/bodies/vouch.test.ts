// A domain's vouch, read as quo/DOMAIN.md writes it, through a fetch the
// test answers: which domains an invitation's addresses name, what the
// file must be, and every way it vouches for nothing.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { vouchesOf } from 'nervur';

const WARD = 'ab'.repeat(64);
const OTHER = 'cd'.repeat(64);

type Answer = { status?: number; body?: string | Uint8Array<ArrayBuffer>; throws?: boolean };

// A web whose files are given by URL, and every URL asked, in order.
const web = (files: Record<string, Answer>) => {
  const asked: string[] = [];
  const fetcher = (url: string, init: { redirect: string }) => {
    asked.push(url);
    assert.equal(init.redirect, 'error', 'a redirect is never followed');
    const answer = files[url];
    if (answer === undefined || answer.throws === true) return Promise.reject(new TypeError('fetch failed'));
    return Promise.resolve(new Response(answer.body ?? '', { status: answer.status ?? 200 }));
  };
  return { fetcher, asked };
};

const file = (domain: string) => `https://${domain}/.well-known/quo`;

test('A domain whose file lists the ward vouches for it, and one that lists another does not', async () => {
  const { fetcher, asked } = web({
    [file('acme.shop')]: { body: JSON.stringify({ wards: [OTHER, WARD] }) },
    [file('cdn.example')]: { body: JSON.stringify({ wards: [OTHER] }) },
  });
  const at = ['wss://acme.shop/quo', 'https://ACME.shop/quo', 'https://cdn.example/quo', 'tcp://acme.shop:9110', 'http://plain.example/quo'];
  assert.deepEqual(await vouchesOf({ fetcher, ward: WARD, at, schemes: ['https', 'wss'] }), ['acme.shop']);
  assert.deepEqual(asked, [file('acme.shop'), file('cdn.example')], 'each web host once, in order, read without regard to case, and no port nor path written');
});

test('A vouch is read from the one host it names, never its parent', async () => {
  const { fetcher } = web({ [file('example.com')]: { body: JSON.stringify({ wards: [WARD] }) } });
  assert.deepEqual(await vouchesOf({ fetcher, ward: WARD, at: ['https://shop.example.com/quo'], schemes: ['https'] }), []);
});

test('Anything but a 200 whose body is one object with its wards vouches for nothing', async () => {
  const cases: Record<string, Answer> = {
    moved: { status: 301, body: JSON.stringify({ wards: [WARD] }) },
    missing: { status: 404 },
    unreachable: { throws: true },
    'not json': { body: 'wards' },
    array: { body: JSON.stringify([WARD]) },
    'no wards': { body: JSON.stringify({ ward: WARD }) },
    'wards not an array': { body: JSON.stringify({ wards: WARD }) },
    'a repeated key': { body: `{"wards":[],"wards":["${WARD}"]}` },
    'the ward in capitals': { body: JSON.stringify({ wards: [WARD.toUpperCase()] }) },
    'a byte order mark': { body: `﻿${JSON.stringify({ wards: [WARD] })}` },
    'not UTF-8': { body: new Uint8Array([0x7b, 0xff, 0x7d]) },
    'above the size': { body: JSON.stringify({ wards: [WARD], pad: 'x'.repeat(1_048_576) }) },
  };
  for (const [why, answer] of Object.entries(cases)) {
    const { fetcher } = web({ [file('acme.shop')]: answer });
    assert.deepEqual(await vouchesOf({ fetcher, ward: WARD, at: ['https://acme.shop/quo'], schemes: ['https'] }), [], why);
  }
});

test('A field beside wards is ignored, and an item of another kind is skipped', async () => {
  const { fetcher } = web({ [file('acme.shop')]: { body: JSON.stringify({ wards: [7, null, 'x', WARD], name: 'Acme' }) } });
  assert.deepEqual(await vouchesOf({ fetcher, ward: WARD, at: ['https://acme.shop/quo'], schemes: ['https'] }), ['acme.shop']);
});

test('A private or loopback host is asked only where private addresses are allowed', async () => {
  const { fetcher, asked } = web({ [file('127.0.0.1')]: { body: JSON.stringify({ wards: [WARD] }) } });
  const at = ['https://127.0.0.1:8443/quo'];
  assert.deepEqual(await vouchesOf({ fetcher, ward: WARD, at, schemes: ['https'] }), []);
  assert.deepEqual(asked, [], 'nothing was asked');
  assert.deepEqual(await vouchesOf({ fetcher, ward: WARD, at, schemes: ['https'], allowPrivate: true }), ['127.0.0.1']);
});
