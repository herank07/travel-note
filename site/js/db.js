// Every Firestore read and write the app makes. Security lives in firestore.rules.
import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, writeBatch,
  onSnapshot, query, where, serverTimestamp, Timestamp, arrayUnion, arrayRemove,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { auth, db } from './firebase.js';
import { generateCode } from './codes.js';

let personCache = null;

function uid() { return auth.currentUser.uid; }

export async function getMyPersonId() {
  if (personCache) return personCache;
  const snap = await getDoc(doc(db, 'devices', uid()));
  personCache = snap.exists() ? snap.data().personId : null;
  return personCache;
}

export function myPersonId() { return personCache; }

export async function registerPerson(name) {
  const me = uid();
  const recoveryCode = generateCode(10);
  const batch = writeBatch(db);
  batch.set(doc(db, 'people', me), { name, createdAt: serverTimestamp() });
  batch.set(doc(db, 'devices', me), { personId: me, via: 'self' });
  batch.set(doc(db, 'recoveryCodes', recoveryCode), { personId: me });
  await batch.commit();
  personCache = me;
  return { personId: me, recoveryCode };
}

export async function renamePerson(name) {
  await updateDoc(doc(db, 'people', await getMyPersonId()), { name });
}

export async function createLinkCode() {
  const code = generateCode(6);
  await setDoc(doc(db, 'linkCodes', code), {
    personId: await getMyPersonId(),
    expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
  });
  return code;
}

async function linkWith(collectionName, via, code) {
  const clean = code.trim().toUpperCase();
  const snap = await getDoc(doc(db, collectionName, clean));
  if (!snap.exists()) throw new Error('코드를 찾을 수 없어요. 다시 확인해 주세요.');
  const { personId, expiresAt } = snap.data();
  if (expiresAt && expiresAt.toMillis() < Date.now()) throw new Error('시간이 지난 코드예요. 새 코드를 만들어 주세요.');
  await setDoc(doc(db, 'devices', uid()), { personId, via, code: clean });
  personCache = personId;
  return personId;
}

export const useLinkCode = (code) => linkWith('linkCodes', 'link', code);
export const useRecoveryCode = (code) => linkWith('recoveryCodes', 'recovery', code);

// ---- trips ----

export function watchMyTrips(cb, onError) {
  const q = query(collection(db, 'trips'), where('memberIds', 'array-contains', personCache));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

export function watchTrip(tripId, cb, onError) {
  return onSnapshot(doc(db, 'trips', tripId), (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError);
}

export async function createTrip(fields) {
  const me = await getMyPersonId();
  const tripRef = doc(collection(db, 'trips'));
  const code = generateCode();
  const batch = writeBatch(db);
  batch.set(tripRef, { ...fields, ownerId: me, memberIds: [me], createdAt: serverTimestamp() });
  batch.set(doc(db, 'trips', tripRef.id, 'private', 'invite'), { code });
  batch.set(doc(db, 'inviteCodes', code), { tripId: tripRef.id });
  batch.commit().catch((e) => console.error('createTrip', e));
  return tripRef.id;
}

export function updateTrip(tripId, fields) {
  return updateDoc(doc(db, 'trips', tripId), fields);
}

export async function deleteTrip(tripId) {
  const batch = writeBatch(db);
  for (const sub of ['items', 'journal', 'checklist']) {
    const snap = await getDocs(collection(db, 'trips', tripId, sub));
    snap.forEach((d) => batch.delete(d.ref));
  }
  const invite = await getDoc(doc(db, 'trips', tripId, 'private', 'invite'));
  if (invite.exists()) {
    batch.delete(doc(db, 'inviteCodes', invite.data().code));
    batch.delete(invite.ref);
  }
  batch.delete(doc(db, 'trips', tripId));
  await batch.commit();
}

// ---- people and members ----

export async function getPeople(ids) {
  const map = new Map();
  await Promise.all([...new Set(ids)].map(async (id) => {
    try {
      const snap = await getDoc(doc(db, 'people', id));
      map.set(id, snap.exists() ? snap.data().name : '알 수 없음');
    } catch { map.set(id, '알 수 없음'); }
  }));
  return map;
}

export async function getInvite(tripId) {
  const snap = await getDoc(doc(db, 'trips', tripId, 'private', 'invite'));
  return snap.exists() ? snap.data().code : null;
}

export async function regenerateInvite(tripId) {
  const old = await getInvite(tripId);
  const code = generateCode();
  const batch = writeBatch(db);
  batch.set(doc(db, 'trips', tripId, 'private', 'invite'), { code });
  if (old) batch.delete(doc(db, 'inviteCodes', old));
  batch.set(doc(db, 'inviteCodes', code), { tripId });
  await batch.commit();
  return code;
}

export async function joinByCode(code) {
  const clean = code.trim().toUpperCase();
  const snap = await getDoc(doc(db, 'inviteCodes', clean));
  if (!snap.exists()) throw new Error('초대 코드를 찾을 수 없어요. 코드가 바뀌었을 수 있어요.');
  const { tripId } = snap.data();
  const me = await getMyPersonId();
  const batch = writeBatch(db);
  batch.set(doc(db, 'trips', tripId, 'joins', me), { code: clean });
  batch.update(doc(db, 'trips', tripId), { memberIds: arrayUnion(me) });
  await batch.commit();
  return tripId;
}

export const removeMember = (tripId, personId) => updateDoc(doc(db, 'trips', tripId), { memberIds: arrayRemove(personId) });
export const addMember = (tripId, personId) => updateDoc(doc(db, 'trips', tripId), { memberIds: arrayUnion(personId) });

// ---- trip contents ----

function watchSub(tripId, sub, cb, onError) {
  return onSnapshot(collection(db, 'trips', tripId, sub),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

// Writes are not awaited by the UI: offline they resolve only after reconnecting.
function saveSub(tripId, sub, row) {
  const { id, ...data } = row;
  const p = id ? setDoc(doc(db, 'trips', tripId, sub, id), data) : addDoc(collection(db, 'trips', tripId, sub), data);
  p.catch((e) => console.error(`save ${sub}`, e));
  return p;
}

function deleteSub(tripId, sub, id) {
  const p = deleteDoc(doc(db, 'trips', tripId, sub, id));
  p.catch((e) => console.error(`delete ${sub}`, e));
  return p;
}

export const watchItems = (tripId, cb, onError) => watchSub(tripId, 'items', cb, onError);
export const saveItem = (tripId, item) => saveSub(tripId, 'items', item);
export const deleteItem = (tripId, id) => deleteSub(tripId, 'items', id);
export const setItemDone = (tripId, id, done) => updateDoc(doc(db, 'trips', tripId, 'items', id), { done });

export const watchJournal = (tripId, cb, onError) => watchSub(tripId, 'journal', cb, onError);
export function saveEntry(tripId, entry) {
  return saveSub(tripId, 'journal', { ...entry, authorId: entry.authorId || personCache, updatedAt: serverTimestamp() });
}
export const deleteEntry = (tripId, id) => deleteSub(tripId, 'journal', id);

export const watchChecklist = (tripId, cb, onError) => watchSub(tripId, 'checklist', cb, onError);
export const saveCheck = (tripId, row) => saveSub(tripId, 'checklist', row);
export const deleteCheck = (tripId, id) => deleteSub(tripId, 'checklist', id);

export async function copyChecklist(fromTripId, toTripId) {
  const snap = await getDocs(collection(db, 'trips', fromTripId, 'checklist'));
  const batch = writeBatch(db);
  snap.forEach((d) => {
    const { name, order } = d.data();
    batch.set(doc(collection(db, 'trips', toTripId, 'checklist')), { name, order: order ?? 0, checked: false });
  });
  await batch.commit();
  return snap.size;
}
