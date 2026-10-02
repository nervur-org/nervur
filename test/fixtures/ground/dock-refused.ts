// A dock steward the ground refuses: she overrides an ask of the library's.
import { dockSteward } from 'nervur';

export class Overriding extends dockSteward({}) {
  override async housesList() {
    return [] as never;
  }
}
