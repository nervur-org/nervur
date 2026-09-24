// A member borne at signup, piloted by the owner her steward invited.
import { Being, s } from 'nervur/being';

export class Member extends Being.of({
  kind: 'org.example.member',
  roles: { owner: (asker) => asker.steward.owner === true },
  asks: {
    whoami: { for: 'owner', hints: { readOnly: true }, result: s.string() },
    ping: { for: 'owner' },
  },
}) {
  whoami() {
    return this.asker.id;
  }

  ping() {}
}
