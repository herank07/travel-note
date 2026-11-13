import { test, before, after, beforeEach } from 'node:test';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { makeEnv, seed, register, as, tripData } from './setup.js';

let env;
before(async () => { env = await makeEnv(); });
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const MIN = 60 * 1000;

test('a device registers itself as a new person', async () => {
  const db = as(env, 'U');
  const batch = db.batch();
  batch.set(db.doc('people/U'), { name: '혜원', createdAt: new Date() });
  batch.set(db.doc('devices/U'), { personId: 'U', via: 'self' });
  await assertSucceeds(batch.commit());
});

test('a device cannot register as someone else', async () => {
  const db = as(env, 'U');
  await assertFails(db.doc('people/X').set({ name: 'x', createdAt: new Date() }));
  await assertFails(db.doc('devices/U').set({ personId: 'X', via: 'self' }));
});

test('a valid link code links a new device to that person', async () => {
  await register(env, 'P', '혜원');
  await seed(env, 'linkCodes/C1', { personId: 'P', expiresAt: new Date(Date.now() + 10 * MIN) });
  await assertSucceeds(as(env, 'N').doc('devices/N').set({ personId: 'P', via: 'link', code: 'C1' }));
});

test('an expired or mismatched link code is rejected', async () => {
  await register(env, 'P', '혜원');
  await seed(env, 'linkCodes/OLD', { personId: 'P', expiresAt: new Date(Date.now() - MIN) });
  await seed(env, 'linkCodes/C1', { personId: 'P', expiresAt: new Date(Date.now() + 10 * MIN) });
  await assertFails(as(env, 'N').doc('devices/N').set({ personId: 'P', via: 'link', code: 'OLD' }));
  await assertFails(as(env, 'N').doc('devices/N').set({ personId: 'Q', via: 'link', code: 'C1' }));
});

test('a recovery code links a device to its person', async () => {
  await register(env, 'P', '혜원');
  await seed(env, 'recoveryCodes/R1', { personId: 'P' });
  await assertSucceeds(as(env, 'N').doc('devices/N').set({ personId: 'P', via: 'recovery', code: 'R1' }));
  await assertFails(as(env, 'M').doc('devices/M').set({ personId: 'P', via: 'recovery', code: 'NOPE' }));
});

test('a registered device can switch to another person with a recovery code', async () => {
  await register(env, 'P', '혜원');
  await register(env, 'N', '새 기기');
  await seed(env, 'recoveryCodes/R1', { personId: 'P' });
  await assertSucceeds(as(env, 'N').doc('devices/N').set({ personId: 'P', via: 'recovery', code: 'R1' }));
});

test('link and recovery codes can only be made for yourself', async () => {
  await register(env, 'P', '혜원');
  const db = as(env, 'P');
  await assertSucceeds(db.doc('linkCodes/C2').set({ personId: 'P', expiresAt: new Date(Date.now() + 10 * MIN) }));
  await assertFails(db.doc('linkCodes/C3').set({ personId: 'Q', expiresAt: new Date(Date.now() + 10 * MIN) }));
  await assertSucceeds(db.doc('recoveryCodes/R2').set({ personId: 'P' }));
  await assertFails(db.doc('recoveryCodes/R3').set({ personId: 'Q' }));
  await assertFails(db.doc('recoveryCodes/R2').set({ personId: 'P' }));
});

test('codes cannot be read back by anyone', async () => {
  await register(env, 'P', '혜원');
  await register(env, 'S', '모르는 사람');
  await seed(env, 'recoveryCodes/R1', { personId: 'P' });
  await assertFails(as(env, 'S').doc('recoveryCodes/R1').get());
  await assertFails(as(env, 'S').collection('recoveryCodes').get());
  await assertFails(as(env, 'S').collection('linkCodes').get());
});

test('recovery code can be created in the registration batch', async () => {
  const db = as(env, 'U');
  const batch = db.batch();
  batch.set(db.doc('people/U'), { name: '혜원', createdAt: new Date() });
  batch.set(db.doc('devices/U'), { personId: 'U', via: 'self' });
  batch.set(db.doc('recoveryCodes/R9'), { personId: 'U' });
  await assertSucceeds(batch.commit());
});

test('names are readable only by registered devices', async () => {
  await register(env, 'P', '혜원');
  await register(env, 'Q', '민수');
  await assertSucceeds(as(env, 'Q').doc('people/P').get());
  await assertFails(as(env, 'STRANGER').doc('people/P').get());
});

test('a person creates a trip they own', async () => {
  await register(env, 'P', '혜원');
  const db = as(env, 'P');
  await assertSucceeds(db.doc('trips/T').set(tripData('P')));
  await assertFails(db.doc('trips/T2').set(tripData('Q')));
  await assertFails(db.doc('trips/T3').set(tripData('P', { memberIds: ['P', 'Q'] })));
});

test('strangers cannot read a trip; members can', async () => {
  await register(env, 'P', '혜원');
  await register(env, 'S', '모르는 사람');
  await seed(env, 'trips/T', tripData('P'));
  await assertSucceeds(as(env, 'P').doc('trips/T').get());
  await assertFails(as(env, 'S').doc('trips/T').get());
  await assertFails(env.unauthenticatedContext().firestore().doc('trips/T').get());
});

test('a member lists only their own trips', async () => {
  await register(env, 'P', '혜원');
  await register(env, 'S', '모르는 사람');
  await seed(env, 'trips/T', tripData('P'));
  await seed(env, 'trips/U', tripData('S'));
  const snap = await assertSucceeds(as(env, 'P').collection('trips').where('memberIds', 'array-contains', 'P').get());
  if (snap.size !== 1 || snap.docs[0].id !== 'T') throw new Error(`expected only T, got ${snap.docs.map((d) => d.id)}`);
  await assertFails(as(env, 'P').collection('trips').get());
});

test('members edit trip details but not owner or members', async () => {
  await register(env, 'P', '혜원');
  await register(env, 'Q', '민수');
  await seed(env, 'trips/T', tripData('P', { memberIds: ['P', 'Q'] }));
  const db = as(env, 'Q');
  await assertSucceeds(db.doc('trips/T').update({ name: '상하이 4일', startDate: '2027-04-15' }));
  await assertFails(db.doc('trips/T').update({ ownerId: 'Q' }));
  await assertFails(db.doc('trips/T').update({ memberIds: ['P', 'Q', 'R'] }));
  await assertFails(db.doc('trips/T').delete());
  await assertSucceeds(as(env, 'P').doc('trips/T').delete());
});
