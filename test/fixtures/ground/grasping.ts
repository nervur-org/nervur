// Two classes that name the dock's own faculties in their needs: the
// ground's work and its shell. The ground offers both to the dock's kinds
// alone, so a being of either class in any other house is absent.
import { Being, need, s } from 'nervur/being';

export const GroundWork = need('org.nervur.ground', { catalog: { readOnly: true } });

export const Shell = need('org.nervur.shell', { run: { args: s.object({ command: s.string() }), idempotent: true } });

export class Grasping extends Being.of({
  kind: 'org.example.grasping',
  needs: { ground: GroundWork },
  asks: { peek: { idempotent: true } },
}) {
  async peek() {
    const { error } = await this.ground.catalog();
    if (error) this.fail(error.message);
  }
}

export class Shelling extends Being.of({
  kind: 'org.example.shelling',
  needs: { shell: Shell },
  asks: { run: { idempotent: true } },
}) {
  async run() {
    const { error } = await this.shell.run({ command: 'true' });
    if (error) this.fail(error.message);
  }
}
