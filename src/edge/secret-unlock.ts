// SPDX-License-Identifier: Apache-2.0
// An edge's unlock: the Worker's one secret is the ground's key. It draws
// nothing, so an edge whose secret is missing opens no drawer. Storage
// alone opens nothing, and the secret alone holds nothing.
import type { Unlock } from '../ground/ground.ts';

const KEY = /^[0-9a-f]{64}$/;

export class SecretUnlock implements Unlock {
  readonly #secret: string;

  /** `secret` is the Worker's `NERVUR_SECRET`, sixty-four lowercase hex digits, set as a secret and never in its code. */
  constructor(secret: string | undefined) {
    if (typeof secret !== 'string' || !KEY.test(secret)) throw new TypeError('the edge’s secret is sixty-four lowercase hex digits');
    this.#secret = secret;
  }

  key(): Promise<string> {
    return Promise.resolve(this.#secret);
  }
}
