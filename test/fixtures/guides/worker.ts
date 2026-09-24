// worker.ts
import { EdgeGround } from 'nervur/edge';
import * as shop from './classes/index.ts';
import * as recipe from './recipe.ts';

export const Ground = EdgeGround.object({ recipe, code: { shop } });

export default EdgeGround.worker();
