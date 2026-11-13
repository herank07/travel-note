import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCode } from '../../site/js/codes.js';

test('generateCode uses the injected random source', () => {
  assert.equal(generateCode(8, arr => arr.fill(0)), 'AAAAAAAA');
});
test('generateCode uses the unambiguous alphabet', () => {
  assert.match(generateCode(), /^[A-HJ-NP-Z2-9]{8}$/);
});
