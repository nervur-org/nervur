// Faculties that each use one part of a contained faculty's lifecycle, and
// write every hook they run to one log, so a test reads the order. What a
// test moves while a dock keeps its entries, a version, a health or a
// failure, is read from `held`.
import { Faculty, Installer, OK, type FacultyClass, type Status } from 'nervur';
import { need, s, type Json } from 'nervur/being';

/** A lamp, as a being calls it: one shine, answered with the lamp that shone. */
export const Lamp = need('lamp', { shine: { result: s.string(), idempotent: true } });

/** What a faculty that offers beings nothing names for its blueprint. */
const Quiet = need('org.example.quiet', {});

/** What a test moves beneath the dock's entries. */
export interface Held {
  version: string;
  migrateFails: boolean;
  uninstallFails: boolean;
  health: { ok: boolean; why?: string };
  meetFails: boolean;
  /** What the scanner was handed as `made.met` when it last went up. */
  met?: Readonly<Record<string, Json>>;
}

export const contained = () => {
  const log: string[] = [];
  const held: Held = { version: '1', migrateFails: false, uninstallFails: false, health: { ok: true }, meetFails: false };

  /** An installer of packages, which meets the kinds it names alone, and answers where it put packages and nothing for any other kind. */
  const packages = (name: string, kinds: readonly string[]): FacultyClass =>
    class Packages extends Faculty {
      static override readonly blueprint = Installer;
      readonly meets = kinds;
      override up(): Status {
        log.push(`up ${name}`);
        return OK;
      }
      meet({ kind, spec, name: faculty }: { kind: string; spec: Json; name: string }): Json | void {
        if (held.meetFails) throw new Error('the mirror is down');
        log.push(`${name} meets ${kind} ${JSON.stringify(spec)} for ${faculty}`);
        if (kind === 'packages') return { tesseract: `/opt/${name}/bin/tesseract` };
      }
    };

  // Its memory is brought to its version before it goes up, forward or back.
  class Keeper extends Faculty {
    static override readonly blueprint = Quiet;
    static override get version(): string {
      return held.version;
    }
    override migrate(from: string): Status {
      if (held.migrateFails) throw new Error('the rows do not fit');
      log.push(`migrate ${from} to ${held.version}`);
      return OK;
    }
    override up(): Status {
      log.push(`up keeper ${held.version}`);
      return OK;
    }
  }

  // What it installs, it lets go of once its body is down and its entry removed.
  class Kit extends Faculty {
    static override readonly blueprint = Quiet;
    override install(): Status {
      log.push(`install ${this.made.name}`);
      return OK;
    }
    override up(): Status {
      log.push(`up ${this.made.name}`);
      return OK;
    }
    override down(): void {
      log.push(`down ${this.made.name}`);
    }
    override uninstall(): Status {
      if (held.uninstallFails) throw new Error('the folder is busy');
      log.push(`uninstall ${this.made.name}`);
      return OK;
    }
  }

  // Its body answers its health when asked, and counts each ask.
  class Probe extends Faculty {
    static override readonly blueprint = Quiet;
    override health(): Status {
      log.push('health');
      return held.health;
    }
  }

  // A body with no health of its own.
  class Plain extends Faculty {
    static override readonly blueprint = Quiet;
  }

  // It needs its terrain, and names what as data.
  class Scanner extends Faculty {
    static override readonly blueprint = Quiet;
    static override readonly needs = { packages: { apt: 'tesseract-ocr', brew: 'tesseract' }, containers: [{ image: 'redis:7' }] as Json };
    override install(): Status {
      log.push(`install ${this.made.name}`);
      return OK;
    }
    override up(): Status {
      held.met = this.made.met;
      log.push(`up ${this.made.name}`);
      return OK;
    }
  }

  // The lamp's stand-in, which needs no terrain.
  class FakeLamp extends Faculty {
    static override readonly blueprint = Lamp;
    override up(): Status {
      log.push('up the fake lamp');
      return OK;
    }
    async shine() {
      return { result: 'the fake lamp' };
    }
  }

  // It needs its terrain, and ships its stand-in.
  class RealLamp extends Faculty {
    static override readonly blueprint = Lamp;
    static override readonly needs = { packages: { apt: 'lamp-driver' } };
    static override readonly fake = FakeLamp;
    async shine() {
      return { result: 'the real lamp' };
    }
  }

  // Named before its installers on any list, so only the ladder puts it after them.
  class Fax extends Faculty {
    static override readonly blueprint = Quiet;
    override up(): Status {
      log.push(`up ${this.made.name}`);
      return OK;
    }
  }

  const faculties: Record<string, FacultyClass> = {
    keeper: Keeper,
    kit: Kit,
    probe: Probe,
    plain: Plain,
    pkg: packages('pkg', ['packages']),
    box: packages('box', ['containers']),
    scanner: Scanner,
    lamp: RealLamp,
    fax: Fax,
  };
  return { log, held, registry: { faculties } };
};
