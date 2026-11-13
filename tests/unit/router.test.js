import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from '../../site/js/router.js';

test('parseRoute', () => {
  assert.deepEqual(parseRoute(''), { name: 'trips', params: {} });
  assert.deepEqual(parseRoute('#/'), { name: 'trips', params: {} });
  assert.deepEqual(parseRoute('#/trip/T1/today'), { name: 'today', params: { tripId: 'T1', day: null } });
  assert.deepEqual(parseRoute('#/trip/T1/today/3'), { name: 'today', params: { tripId: 'T1', day: 3 } });
  assert.deepEqual(parseRoute('#/trip/T1/today/none'), { name: 'today', params: { tripId: 'T1', day: 'none' } });
  assert.deepEqual(parseRoute('#/trip/T1/item/new'), { name: 'item', params: { tripId: 'T1', itemId: 'new' } });
  assert.deepEqual(parseRoute('#/trip/T1/next'), { name: 'next', params: { tripId: 'T1' } });
  assert.deepEqual(parseRoute('#/trip/T1/journal'), { name: 'journal', params: { tripId: 'T1' } });
  assert.deepEqual(parseRoute('#/trip/T1/checklist'), { name: 'checklist', params: { tripId: 'T1' } });
  assert.deepEqual(parseRoute('#/trip/T1/members'), { name: 'members', params: { tripId: 'T1' } });
  assert.deepEqual(parseRoute('#/trip/T1/edit'), { name: 'tripEdit', params: { tripId: 'T1' } });
  assert.deepEqual(parseRoute('#/new'), { name: 'tripNew', params: {} });
  assert.deepEqual(parseRoute('#/join/ABCD2345'), { name: 'join', params: { code: 'ABCD2345' } });
  assert.deepEqual(parseRoute('#/link'), { name: 'link', params: {} });
  assert.deepEqual(parseRoute('#/nonsense/x'), { name: 'trips', params: {} });
});
