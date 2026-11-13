import { test, before, after, beforeEach } from 'node:test';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import { makeEnv, seed, register, as, tripData } from './setup.js';

let env;
before(async () => { env = await makeEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await register(env, 'P', '혜원');   // owner
  await register(env, 'Q', '민수');   // member
  await register(env, 'S', '모르는 사람');
  await seed(env, 'trips/T', tripData('P', { memberIds: ['P', 'Q'] }));
  await seed(env, 'trips/T/private/invite', { code: 'GOODCODE' });
  await seed(env, 'inviteCodes/GOODCODE', { tripId: 'T' });
  await seed(env, 'trips/T/items/i1', { day: 1, start: '10:00', end: null, title: '예원', done: false });
});

const arrayUnion = (...v) => firebase.firestore.FieldValue.arrayUnion(...v);

function join(uid, code) {
  const db = as(env, uid);
  const batch = db.batch();
  batch.set(db.doc(`trips/T/joins/${uid}`), { code });
  batch.update(db.doc('trips/T'), { memberIds: arrayUnion(uid) });
  return batch.commit();
}

test('invite codes can be looked up but not listed', async () => {
  await assertSucceeds(as(env, 'S').doc('inviteCodes/GOODCODE').get());
  await assertFails(as(env, 'S').collection('inviteCodes').get());
  await assertFails(env.unauthenticatedContext().firestore().doc('inviteCodes/GOODCODE').get());
});

test('only the owner creates or deletes invite codes', async () => {
  await assertSucceeds(as(env, 'P').doc('inviteCodes/NEWCODE1').set({ tripId: 'T' }));
  await assertFails(as(env, 'Q').doc('inviteCodes/NEWCODE2').set({ tripId: 'T' }));
  await assertFails(as(env, 'Q').doc('inviteCodes/GOODCODE').delete());
  await assertSucceeds(as(env, 'P').doc('inviteCodes/GOODCODE').delete());
});

test('the private invite is owner-only', async () => {
  await assertSucceeds(as(env, 'P').doc('trips/T/private/invite').get());
  await assertFails(as(env, 'Q').doc('trips/T/private/invite').get());
  await assertFails(as(env, 'S').doc('trips/T/private/invite').get());
  await assertFails(as(env, 'Q').doc('trips/T/private/invite').set({ code: 'MINE' }));
});

test('a trip is created together with its invite', async () => {
  const db = as(env, 'P');
  const batch = db.batch();
  batch.set(db.doc('trips/T2'), tripData('P'));
  batch.set(db.doc('trips/T2/private/invite'), { code: 'CODE2222' });
  batch.set(db.doc('inviteCodes/CODE2222'), { tripId: 'T2' });
  await assertSucceeds(batch.commit());
});

test('joining with the current code works', async () => {
  await assertSucceeds(join('S', 'GOODCODE'));
  await assertSucceeds(as(env, 'S').doc('trips/T').get());
});

test('joining with a wrong code fails', async () => {
  await assertFails(join('S', 'WRONGCOD'));
  await assertFails(as(env, 'S').doc('trips/T').get());
});

test('you cannot join someone else in', async () => {
  const db = as(env, 'S');
  const batch = db.batch();
  batch.set(db.doc('trips/T/joins/S'), { code: 'GOODCODE' });
  batch.update(db.doc('trips/T'), { memberIds: arrayUnion('S', 'X') });
  await assertFails(batch.commit());
});

test('after the code changes, the old code fails and members stay', async () => {
  const db = as(env, 'P');
  const batch = db.batch();
  batch.set(db.doc('trips/T/private/invite'), { code: 'NEWCODE9' });
  batch.delete(db.doc('inviteCodes/GOODCODE'));
  batch.set(db.doc('inviteCodes/NEWCODE9'), { tripId: 'T' });
  await assertSucceeds(batch.commit());
  await assertFails(join('S', 'GOODCODE'));
  await assertSucceeds(as(env, 'Q').doc('trips/T').get());
  await assertSucceeds(join('S', 'NEWCODE9'));
});

test('a removed member loses the trip and its contents', async () => {
  await assertSucceeds(as(env, 'P').doc('trips/T').update({ memberIds: ['P'] }));
  await assertFails(as(env, 'Q').doc('trips/T').get());
  await assertFails(as(env, 'Q').doc('trips/T/items/i1').get());
});

test('only the owner adds a past companion directly', async () => {
  await assertSucceeds(as(env, 'P').doc('trips/T').update({ memberIds: ['P', 'Q', 'S'] }));
  await env.clearFirestore();
  await register(env, 'P', '혜원');
  await register(env, 'Q', '민수');
  await seed(env, 'trips/T', tripData('P', { memberIds: ['P', 'Q'] }));
  await assertFails(as(env, 'Q').doc('trips/T').update({ memberIds: ['P', 'Q', 'S'] }));
});

test('the owner cannot remove themselves from members', async () => {
  await assertFails(as(env, 'P').doc('trips/T').update({ memberIds: ['Q'] }));
});

for (const sub of ['items', 'journal', 'checklist']) {
  test(`${sub}: members read and write, strangers cannot`, async () => {
    const row = sub === 'journal' ? { day: 1, title: 't', body: 'b', authorId: 'Q', updatedAt: new Date() }
      : sub === 'checklist' ? { name: '여권', checked: false, order: 1 }
      : { day: 1, start: null, end: null, title: '와이탄', done: false };
    const ref = `trips/T/${sub}/x1`;
    await assertSucceeds(as(env, 'Q').doc(ref).set(row));
    await assertSucceeds(as(env, 'P').doc(ref).get());
    await assertSucceeds(as(env, 'P').collection(`trips/T/${sub}`).get());
    await assertSucceeds(as(env, 'P').doc(ref).delete());
    await assertFails(as(env, 'S').doc(ref).set(row));
    await assertFails(as(env, 'S').collection(`trips/T/${sub}`).get());
  });
}

test('a removed member cannot rejoin with the old link or a plain update', async () => {
  await seed(env, 'trips/T/joins/Q', { code: 'GOODCODE' });
  const db = as(env, 'P');
  const batch = db.batch();
  batch.update(db.doc('trips/T'), { memberIds: ['P'] });
  batch.delete(db.doc('trips/T/joins/Q'));
  batch.set(db.doc('trips/T/private/invite'), { code: 'NEWCODE9' });
  batch.delete(db.doc('inviteCodes/GOODCODE'));
  batch.set(db.doc('inviteCodes/NEWCODE9'), { tripId: 'T' });
  await assertSucceeds(batch.commit());
  await assertFails(join('Q', 'GOODCODE'));
  await assertFails(as(env, 'Q').doc('trips/T').update({ memberIds: arrayUnion('Q') }));
});

test('a member can leave; nobody else is removed that way', async () => {
  await assertFails(as(env, 'Q').doc('trips/T').update({ memberIds: ['Q'] }));
  await assertSucceeds(as(env, 'Q').doc('trips/T').update({ memberIds: ['P'] }));
  await assertFails(as(env, 'Q').doc('trips/T').get());
});

test('people cannot be listed', async () => {
  await assertFails(as(env, 'S').collection('people').get());
  await assertSucceeds(as(env, 'S').doc('people/P').get());
});

test('trips reject unknown fields and bad values', async () => {
  const db = as(env, 'P');
  await assertFails(db.doc('trips/T2').set(tripData('P', { junk: 'x'.repeat(1000) })));
  await assertFails(db.doc('trips/T3').set(tripData('P', { timeZone: 5 })));
  await assertFails(db.doc('trips/T4').set(tripData('P', { days: 'four' })));
  await assertFails(db.doc('trips/T5').set(tripData('P', { startDate: '15/04/2027' })));
  await assertSucceeds(db.doc('trips/T6').set(tripData('P', { startDate: '2027-04-15', days: 4 })));
  await assertFails(as(env, 'Q').doc('trips/T').update({ timeZone: 'Nope/Zone' }));
  await assertFails(as(env, 'Q').doc('trips/T').update({ junk: 1 }));
});

test('items reject bad times, days and costs', async () => {
  const db = as(env, 'Q');
  const ok = { day: 1, start: '09:00', end: null, title: '예원', place: '', localName: '', localAddress: '', transit: '', mapUrl: '', category: '관광', cost: 40, memo: '', done: false };
  await assertSucceeds(db.doc('trips/T/items/ok').set(ok));
  await assertFails(db.doc('trips/T/items/b1').set({ ...ok, start: 5 }));
  await assertFails(db.doc('trips/T/items/b2').set({ ...ok, start: '9시' }));
  await assertFails(db.doc('trips/T/items/b3').set({ ...ok, day: '1' }));
  await assertFails(db.doc('trips/T/items/b4').set({ ...ok, cost: '40' }));
  await assertFails(db.doc('trips/T/items/b5').set({ ...ok, title: '' }));
  await assertFails(db.doc('trips/T/items/b6').set({ ...ok, junk: 1 }));
  await assertSucceeds(db.doc('trips/T/items/ok').update({ done: true }));
});

test('journal author must be yourself', async () => {
  await assertFails(as(env, 'Q').doc('trips/T/journal/j1').set({ day: 1, title: 't', body: 'b', authorId: 'P', updatedAt: new Date() }));
});
