import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMinutes, sortItems, groupByDay, findNext, isPast, untilLabel, costTotals } from '../../site/js/schedule.js';

const a = { id: 'a', day: 2, start: '09:00', end: null, title: '아침', cost: 15 };
const b = { id: 'b', day: 2, start: '14:00', end: '16:00', title: '신톈디', cost: null };
const c = { id: 'c', day: 2, start: null, end: null, title: '숙소 휴식', cost: null };
const d = { id: 'd', day: 5, start: '10:00', end: null, title: '톈쯔팡', cost: 40 };
const e = { id: 'e', day: null, start: null, end: null, title: '예원', cost: null };

test('toMinutes', () => { assert.equal(toMinutes('13:20'), 800); });

test('sortItems puts timed items first, timeless last', () => {
  assert.deepEqual(sortItems([c, b, a]).map(i => i.id), ['a', 'b', 'c']);
});

test('groupByDay sends days beyond the trip length to undecided', () => {
  const g = groupByDay([a, b, c, d, e], 4);
  assert.deepEqual(g.byDay.get(2).map(i => i.id), ['a', 'b', 'c']);
  assert.deepEqual(g.undecided.map(i => i.id).sort(), ['d', 'e']);
});

test('groupByDay keeps day numbers when trip length is unknown', () => {
  const g = groupByDay([d, e], null);
  assert.deepEqual(g.byDay.get(5).map(i => i.id), ['d']);
  assert.deepEqual(g.undecided.map(i => i.id), ['e']);
});

test('findNext', () => {
  assert.deepEqual(findNext([a, b, c], 800), { next: b, inProgress: [] });
  assert.deepEqual(findNext([a, b, c], 870), { next: null, inProgress: [b] });
  assert.deepEqual(findNext([], 800), { next: null, inProgress: [] });
});

test('isPast', () => {
  assert.equal(isPast(a, 800), true);
  assert.equal(isPast(b, 870), false);
  assert.equal(isPast(c, 800), false);
});

test('untilLabel', () => {
  assert.equal(untilLabel(40), '40분 후');
  assert.equal(untilLabel(60), '1시간 후');
  assert.equal(untilLabel(130), '2시간 10분 후');
});

test('costTotals ignores null costs', () => {
  const t = costTotals([a, b, d]);
  assert.equal(t.total, 55);
  assert.equal(t.byDay.get(2), 15);
});

import { nowIndex, defaultDay } from '../../site/js/schedule.js';

test('nowIndex counts items that already started', () => {
  const sorted = sortItems([a, b, c]);
  assert.equal(nowIndex(sorted, 500), 0);
  assert.equal(nowIndex(sorted, 800), 1);
  assert.equal(nowIndex(sorted, 870), 2);
});

test('defaultDay', () => {
  assert.equal(defaultDay({ kind: 'during', day: 2 }, 4, []), 2);
  assert.equal(defaultDay({ kind: 'before', dday: 3 }, 4, []), 1);
  assert.equal(defaultDay({ kind: 'undated' }, null, [d, e]), 5);
  assert.equal(defaultDay({ kind: 'undated' }, null, [e]), 'none');
});
