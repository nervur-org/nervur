// SPDX-License-Identifier: Apache-2.0
// The few assertions a scene needs, with no platform under them, so the
// same scene runs in Node's runner and inside any other engine.
export type Expect = {
  equal(actual: unknown, expected: unknown, message?: string): void;
  same(actual: unknown, expected: unknown, message?: string): void;
  ok(value: unknown, message?: string): void;
};

const fail = (message: string | undefined, detail: string): never => {
  throw new Error(`${message ? `${message}: ` : ''}${detail}`);
};

export const expect: Expect = {
  equal: (actual, expected, message) => {
    if (!Object.is(actual, expected)) fail(message, `${String(actual)} is not ${String(expected)}`);
  },
  same: (actual, expected, message) => {
    const [a, b] = [JSON.stringify(actual), JSON.stringify(expected)];
    if (a !== b) fail(message, `${a} is not ${b}`);
  },
  ok: (value, message) => {
    if (!value) fail(message, 'not true');
  },
};
