import { h, mount, field, notice } from './dom.js';
import { watchTrip, watchJournal, saveEntry, deleteEntry, getPeople } from '../db.js';
import { dayTitle } from './today.js';
import { tabbar, loading, gone } from './tripShell.js';

export function renderJournal(params) {
  mount(loading());
  let trip; let entries = null; let names = new Map(); let editing = null;
  const draw = () => {
    if (trip === undefined || entries === null) return;
    if (!trip) { mount(gone()); return; }
    mount(view(trip, entries, names, editing, (e) => { editing = e; draw(); }));
  };
  const off1 = watchTrip(params.tripId, (t) => { trip = t; draw(); }, () => { trip = null; draw(); });
  const off2 = watchJournal(params.tripId, async (list) => {
    entries = list;
    names = await getPeople(list.map((e) => e.authorId).filter(Boolean));
    draw();
  }, () => { entries = []; draw(); });
  return () => { off1(); off2(); };
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => (b.day ?? 0) - (a.day ?? 0)
    || ((b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)));
}

function entryForm(trip, entry, done) {
  const dayCount = Math.max(trip.days || 0, entry.day || 0, 1);
  const day = h('select', { id: 'entry-day' },
    h('option', { value: 'none', selected: entry.day == null ? true : null }, '날짜 없음'),
    Array.from({ length: dayCount }, (_, i) => h('option', { value: String(i + 1), selected: entry.day === i + 1 ? true : null }, `${i + 1}일차`)));
  const title = h('input', { id: 'entry-title', maxlength: 60, value: entry.title || '', placeholder: '예: 도착한 날' });
  const body = h('textarea', { id: 'entry-body', value: entry.body || '', placeholder: '오늘 있었던 일을 적어 보세요' });
  const error = h('p', { class: 'error', role: 'alert' });
  const submit = (e) => {
    e.preventDefault();
    if (!body.value.trim() && !title.value.trim()) { error.textContent = '제목이나 내용을 적어 주세요.'; return; }
    saveEntry(trip.id, {
      ...(entry.id ? { id: entry.id, authorId: entry.authorId } : {}),
      day: day.value === 'none' ? null : Number(day.value), title: title.value.trim(), body: body.value.trim(),
    }).catch(() => notice('저장하지 못했어요'));
    done(null);
  };
  return h('form', { class: 'card form', onsubmit: submit },
    h('h2', {}, entry.id ? '기록 고치기' : '새 기록'),
    field('날짜', day), field('제목', title), field('내용', body),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', type: 'submit' }, '저장'),
      h('button', { class: 'btn', type: 'button', onclick: () => done(null) }, '취소')),
    error);
}

function view(trip, entries, names, editing, setEditing) {
  const sorted = sortEntries(entries);
  return h('main', { class: 'screen' },
    h('div', { class: 'topline' }, h('a', { href: '#/', style: 'text-decoration:none' }, '‹ 여행 목록'), h('span', {}, trip.name)),
    h('div', { class: 'title-row' }, h('h1', {}, '기록'),
      editing ? null : h('button', { class: 'btn small', type: 'button', onclick: () => setEditing({}) }, '+ 기록 쓰기')),
    editing ? entryForm(trip, editing, setEditing) : null,
    sorted.length === 0 && !editing
      ? h('div', { class: 'empty' }, h('p', {}, '아직 기록이 없어요. 여행 중이나 다녀와서 그날 있었던 일을 남겨 보세요.'))
      : sorted.map((e) => h('article', { class: 'entry' },
        h('div', { class: 'meta' }, h('span', {}, e.day ? dayTitle(trip, e.day) : '날짜 없음'), h('span', {}, names.get(e.authorId) || '')),
        e.title ? h('h2', {}, e.title) : null,
        e.body ? h('p', { class: 'body' }, e.body) : null,
        h('div', { class: 'row' },
          h('button', { class: 'btn small', type: 'button', onclick: () => setEditing(e) }, '고치기'),
          h('button', { class: 'btn small danger', type: 'button', onclick: () => { deleteEntry(trip.id, e.id); notice('기록을 지웠어요'); } }, '지우기')))),
    tabbar(trip.id, 'journal'),
  );
}
