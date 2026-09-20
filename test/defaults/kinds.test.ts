// SPDX-License-Identifier: Apache-2.0
// A default is a class like any other: a module's class extends one, keeps
// its own kind, and fulfils every contract the default does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Faculty } from '../../src/core/being/index.ts';
import { Registry } from '../../src/core/harbor/index.ts';
import { DefaultDock, GroundMemory, WebFaculty } from '../../src/defaults/index.ts';
import { holds } from '../claims.ts';

test(holds('registry.kit-classes', 'defaults: a module class extends a default, as its own kind, fulfilling every contract the default does'), () => {
  class OwnWeb extends WebFaculty {
    static override kind = 'com.acme.web';
  }
  class OwnMemory extends GroundMemory {
    static override kind = 'com.acme.memory';
  }
  class OwnDock extends DefaultDock {
    static override kind = 'com.acme.dock';
  }
  const registry = new Registry([], [{ module: 'com.acme.test', version: '1', classes: [OwnWeb, OwnMemory, OwnDock] }]);
  assert.equal(registry.classOf('com.acme.web'), OwnWeb, 'a default carrier extended');
  assert.equal(registry.classOf('com.acme.dock'), OwnDock, 'the default dock extended');
  assert.deepEqual(Faculty.contracts(OwnWeb), ['com.acme.web', 'org.nervur.web', 'org.nervur.carrier']);
  assert.deepEqual(Faculty.contracts(OwnMemory), ['com.acme.memory', GroundMemory.kind, 'org.nervur.memory']);
});
