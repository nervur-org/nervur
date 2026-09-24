// The family's station as an edge: a Worker's module, as a deploy writes
// it. The ground's object holds the garage mirror's code; the Worker hands
// it every request.
import { connect } from 'cloudflare:sockets';
import { EdgeGround } from 'nervur/edge';
import { station } from '../../../test/fixtures/world/outpost.ts';

export const Ground = EdgeGround.object({ code: { station }, connect });

export default EdgeGround.worker();
