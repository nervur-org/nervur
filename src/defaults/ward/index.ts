// SPDX-License-Identifier: Apache-2.0
// The default ward: the `Ward` contract as it stands, for a hosted ward
// whose owner names no class of her own.
import { ships } from '../../core/being/index.ts';
import { Ward } from '../../core/ward/index.ts';

export class DefaultWard extends Ward {
  static override readonly kind: string = 'org.nervur.default-ward';
  static {
    ships(this);
  }
}
