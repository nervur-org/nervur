// A tenant house a hosting house opens: its steward answers every occupant
// who she is to it, and the notes the hand wrote on her.
import { Being, s } from 'nervur/being';

export class Tenant extends Being.of({
  kind: 'org.example.tenant',
  asks: {
    whoami: { readOnly: true, result: s.string() },
  },
}) {
  whoami() {
    return `${this.asker.id} ${JSON.stringify(this.asker.notes)}`;
  }
}

export const steward = Tenant;
