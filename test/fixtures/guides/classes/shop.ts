// classes/shop.ts
import { Being, s, type Args } from 'nervur/being';

export class Shop extends Being.of({
  kind: 'com.acme.shop',
  description: 'The shop’s steward: opens orders, and enrols whoever signs up.',
  cells: { opened: 0 },
  roles: { pilot: (asker) => asker.id === 'root' },
  asks: {
    open: {
      for: 'pilot',
      description: 'Opens an order, and hands back an invitation for its owner.',
      args: s.object({ id: s.string() }),
      result: s.object({ owner: s.invitation() }),
    },
    orders: { for: 'pilot', hints: { readOnly: true }, result: s.array(s.string()) },
    hire: {
      for: 'pilot',
      description: 'Hands a courier’s invitation to an order, which takes it.',
      hints: { idempotent: true },
      args: s.object({ order: s.string(), courier: s.invitation() }),
      result: s.string(),
    },
    enroll: {
      for: 'being',
      hints: { idempotent: true },
      args: s.object({ signer: s.bytes() }),
      result: s.object({ invitation: s.invitation() }),
    },
  },
}) {
  open({ id }: Args<Shop, 'open'>) {
    this.powers!.bear({ kind: 'com.acme.order', id });
    this.cells.opened += 1;
    return { owner: this.powers!.invite({ id, occupant: 'owner', notes: { owner: true } }) };
  }

  async orders() {
    return (await this.powers!.list()).filter((being) => being.kind === 'com.acme.order').map((being) => being.id);
  }

  // She carries the invitation unopened, and the order she names takes it.
  async hire({ order, courier }: Args<Shop, 'hire'>) {
    return (await this.powers!.ask({ id: order, method: 'hire', args: { courier } })) as string;
  }

  // One order a signer: asked twice, the same id is borne once.
  enroll({ signer }: Args<Shop, 'enroll'>) {
    const id = `order-${Array.from(signer.subarray(0, 8), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    this.powers!.bear({ kind: 'com.acme.order', id });
    const occupant = `owner-${Array.from(this.house.random({ length: 4 }), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    return { invitation: this.powers!.invite({ id, occupant, notes: { owner: true } }) };
  }
}
