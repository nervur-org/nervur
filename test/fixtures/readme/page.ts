// page.ts
import { BrowserGround } from 'nervur/browser';

// Every tab of this origin joins one ground, and the tab holding its lock runs it.
const ground = await BrowserGround.open();

// The house's code is a module on this origin, and its rows rest sealed in IndexedDB.
await ground.hand({
  method: 'housesAdd',
  args: { name: 'main', classes: { faculty: 'origin', at: '/house/index.js' } },
});

console.log(await ground.hand({ house: 'main', method: 'hello', args: { name: 'Ada' } }));
