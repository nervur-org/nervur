// A doorbell that outlives its program: it keeps the handle it was handed
// in its folder, as a faculty that survives a restart does. Each life
// writes a line to `lives`. A press that finds `die` in the folder kills
// the program before it calls back, once. Each press that calls back
// writes a line to `presses` once the house has answered.
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { need, s } from 'nervur/being';
import { serve } from 'nervur/serve';

const Doorbell = need('doorbell', {
  watch: { args: s.object({ inbox: s.handle() }), hints: { idempotent: true } },
  press: {},
});

appendFileSync('lives', `${process.pid}\n`);

serve(Doorbell, {
  watch: ({ inbox }) => {
    writeFileSync('inbox', String(inbox));
    return null;
  },
  press: async (_args, context) => {
    if (existsSync('die')) {
      rmSync('die');
      process.exit(1);
    }
    const answered = await context.call(readFileSync('inbox', 'utf8'), {});
    if ('error' in answered) throw new Error(answered.error.message);
    appendFileSync('presses', `${context.id}\n`);
    return null;
  },
});
