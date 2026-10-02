// The handlers of the stand-in answering Quote's `rates`, each by the
// method it answers. They run in the house's runner, where a throw refuses
// the ask with its message.
export const rate = ({ from }: { from: string }): number => {
  if (from === 'nowhere') throw new Error('no rate from nowhere');
  return from === 'eur' ? 2 : 1;
};

export const note = (): void => undefined;
