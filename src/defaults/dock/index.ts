// SPDX-License-Identifier: Apache-2.0
// The default dock: the `Dock` contract as it stands, for an owner who
// writes no dock of her own.
import { ships } from '../../core/being/index.ts';
import { Dock } from '../../core/harbor/index.ts';

export class DefaultDock extends Dock {
  static override readonly kind: string = 'org.nervur.default-dock';
  static {
    ships(this);
  }
}
