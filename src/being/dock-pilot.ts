// SPDX-License-Identifier: Apache-2.0
// The need a pilot holds a ground's dock by, and the schemas it is built
// from. It is pure, so a pilot's species imports it from `nervur/being`,
// and the dock's steward answers the same schemas.
import { need, WAIT_BOUND } from './need.ts';
import { s } from './schema.ts';

/** Any JSON value: a schema with no keyword. */
export const ANY = Object.freeze({});
export const OBJECT = { type: 'object', properties: {}, additionalProperties: true } as const;
export const NAME = s.object({ name: s.string() });
export const WHY = s.object({ why: s.optional(s.string()) });
export const STOOD = s.object({ ward: s.optional(s.string()), why: s.optional(s.string()) });
export const HEALTH = s.object({ ok: s.boolean(), why: s.optional(s.string()) });

const houseArgs = { name: s.string(), classes: OBJECT, memory: s.optional(OBJECT), faculties: s.optional(s.array(s.string())), wait: s.optional(s.integer({ minimum: 1 })) };
const facultyArgs = {
  name: s.string(),
  make: s.optional(s.string()),
  from: s.optional(s.string()),
  args: s.optional(OBJECT),
  secrets: s.optional(s.array(s.string())),
  faculties: s.optional(s.array(s.string())),
  installers: s.optional(s.array(s.string())),
  kinds: s.optional(s.array(s.string())),
};
/** A house's entry, as a pilot adds or updates it. */
export const HOUSE = s.object(houseArgs);
/** A house's entry with its seed and every place of its memory, as `movesIn` takes it. */
export const HOUSE_MOVED = s.object({ ...houseArgs, seed: s.string(), places: OBJECT });
/** A faculty's entry, as a pilot adds or updates it. */
export const FACULTY = s.object(facultyArgs);

// A change is safe to repeat, and one that may install a faculty or open a house takes the longest any ask may.
export const CHANGE = { idempotent: true } as const;
export const LIST = { readOnly: true } as const;

export const HOUSES_SHOWN = s.array(s.object({ name: s.string(), entry: OBJECT, ward: s.optional(s.string()), why: s.optional(s.string()) }));
export const FACULTIES_SHOWN = s.array(s.object({ name: s.string(), entry: OBJECT, terrain: s.optional(s.boolean()), serves: s.optional(s.string()), why: s.optional(s.string()) }));
export const CATALOG = s.array(s.object({ from: s.optional(s.string()), faculties: s.array(s.object({ make: s.string(), takes: s.optional(OBJECT), needs: s.optional(OBJECT), version: s.optional(s.string()) })) }));

/** A house and the id of a new occupant of its steward, as `housesInvite` takes them. */
export const INVITE = s.object({ name: s.string(), id: s.string() });
/** The invitation `housesInvite` answers, carried unopened for the being who takes it. */
export const INVITED = s.object({ invitation: s.invitation() });

// The houses asks, the same in a pilot's need and in a granted house's.
const houses = {
  housesAdd: { args: HOUSE, result: STOOD, ...CHANGE, wait: WAIT_BOUND },
  housesUpdate: { args: HOUSE, result: STOOD, ...CHANGE, wait: WAIT_BOUND },
  housesRemove: { args: NAME, ...CHANGE, wait: WAIT_BOUND },
  housesList: { result: HOUSES_SHOWN, ...LIST, wait: WAIT_BOUND },
  housesInvite: { args: INVITE, result: INVITED, ...CHANGE, wait: WAIT_BOUND },
} as const;

/**
 * The houses of the ground a house stands on, as the `ground` faculty
 * offers them to the beings of a house whose entry grants it: add,
 * update, remove and list every other house, and invite onto its steward.
 */
export const GroundHouses = need('org.nervur.ground.houses', houses);

/**
 * A ground's dock as a pilot holds it: the asks its steward answers for a
 * standing the owner minted with `pilotsInvite`. A being far or near
 * pilots a ground by `this.held(id, DockPilot)`.
 */
export const DockPilot = need('org.nervur.dock', {
  ...houses,
  facultiesAdd: { args: FACULTY, result: WHY, ...CHANGE, wait: WAIT_BOUND },
  facultiesUpdate: { args: FACULTY, result: WHY, ...CHANGE, wait: WAIT_BOUND },
  facultiesRestart: { args: NAME, result: WHY, ...CHANGE, wait: WAIT_BOUND },
  facultiesRemove: { args: NAME, result: WHY, ...CHANGE, wait: WAIT_BOUND },
  facultiesList: { result: FACULTIES_SHOWN, ...LIST, wait: WAIT_BOUND },
  facultiesHealth: { args: NAME, result: HEALTH, ...LIST, wait: WAIT_BOUND },
  facultiesCatalog: { result: CATALOG, ...LIST },
});
