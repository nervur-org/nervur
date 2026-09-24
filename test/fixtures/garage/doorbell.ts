// A doorbell, as a faculty written in JavaScript and run over the bridge
// by `nervur/serve`. A being hands it the handle of an ask to call when
// the bell is pressed; a press calls that handle back through the house.
import { need, s } from 'nervur/being';
import { serve } from 'nervur/serve';

export const Doorbell = need('doorbell', {
  watch: { args: s.object({ inbox: s.handle() }), hints: { idempotent: true } },
  press: {},
});

let inbox: string | undefined;

serve(Doorbell, {
  watch: ({ inbox: token }) => {
    inbox = token as string;
    return null;
  },
  press: async (_args, context) => {
    if (inbox === undefined) throw new Error('no one watches the bell');
    const answered = await context.call(inbox, {});
    if ('error' in answered) throw new Error(answered.error.message);
    return null;
  },
});
