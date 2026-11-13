import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localParts, formatHM, addDays, dayDate, tripStatus, statusLabel } from '../../site/js/time.js';

test('localParts uses the given zone, not the device zone', () => {
  const t = new Date('2027-04-16T05:20:00Z');
  assert.deepEqual(localParts(t, 'Asia/Shanghai'), { ymd: '2027-04-16', minutes: 800 });
  assert.deepEqual(localParts(t, 'Asia/Seoul'), { ymd: '2027-04-16', minutes: 860 });
  assert.deepEqual(localParts(new Date('2027-04-15T16:30:00Z'), 'Asia/Shanghai'), { ymd: '2027-04-16', minutes: 30 });
});

test('formatHM and addDays', () => {
  assert.equal(formatHM(800), '13:20');
  assert.equal(formatHM(30), '00:30');
  assert.equal(addDays('2027-02-27', 2), '2027-03-01');
});

test('dayDate maps day numbers to dates when a start date exists', () => {
  assert.equal(dayDate({ startDate: '2027-04-15', days: 4 }, 2), '2027-04-16');
  assert.equal(dayDate({ startDate: null, days: 4 }, 2), null);
});

test('tripStatus', () => {
  const trip = { startDate: '2027-04-15', days: 4 };
  assert.deepEqual(tripStatus(trip, '2027-04-16'), { kind: 'during', day: 2 });
  assert.deepEqual(tripStatus(trip, '2027-04-18'), { kind: 'during', day: 4 });
  assert.deepEqual(tripStatus(trip, '2027-03-16'), { kind: 'before', dday: 30 });
  assert.deepEqual(tripStatus(trip, '2027-04-14'), { kind: 'before', dday: 1 });
  assert.deepEqual(tripStatus(trip, '2027-04-19'), { kind: 'after' });
  assert.deepEqual(tripStatus({ startDate: null, days: 4 }, '2027-04-16'), { kind: 'undated' });
  assert.deepEqual(tripStatus({ startDate: '2027-04-15', days: null }, '2027-04-16'), { kind: 'undated' });
});

test('statusLabel', () => {
  assert.equal(statusLabel({ kind: 'before', dday: 30 }), 'D-30');
  assert.equal(statusLabel({ kind: 'during', day: 2 }), '2일차');
  assert.equal(statusLabel({ kind: 'after' }), '다녀옴');
  assert.equal(statusLabel({ kind: 'undated' }), '날짜 미정');
});

test('localParts falls back to Seoul for an unknown zone instead of throwing', () => {
  const t = new Date('2027-04-16T05:20:00Z');
  assert.deepEqual(localParts(t, 'Nope/Zone'), { ymd: '2027-04-16', minutes: 860 });
});
