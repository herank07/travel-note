import { h, mount, notice } from './dom.js';
import { watchTrip, watchChecklist, saveCheck, deleteCheck, watchMyTrips, copyChecklist } from '../db.js';
import { tabbar, loading, gone } from './tripShell.js';

export function renderChecklist(params) {
  mount(loading());
  let trip; let rows = null; let others = [];
  const draw = () => {
    if (trip === undefined || rows === null) return;
    if (!trip) { mount(gone()); return; }
    mount(view(trip, rows, others));
  };
  const off1 = watchTrip(params.tripId, (t) => { trip = t; draw(); }, () => { trip = null; draw(); });
  const off2 = watchChecklist(params.tripId, (list) => { rows = list; draw(); }, () => { rows = []; draw(); });
  const off3 = watchMyTrips((trips) => { others = trips.filter((t) => t.id !== params.tripId); draw(); }, () => {});
  return () => { off1(); off2(); off3(); };
}

function view(trip, rows, others) {
  const sorted = [...rows].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const input = h('input', { id: 'check-new', maxlength: 60, placeholder: '예: 여권', 'aria-label': '새 준비물' });
  const add = (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    const order = sorted.length ? (sorted[sorted.length - 1].order ?? 0) + 1 : 1;
    saveCheck(trip.id, { name, checked: false, order });
    input.value = '';
    input.focus();
  };
  const move = (i, dir) => {
    const a = sorted[i]; const b = sorted[i + dir];
    if (!a || !b) return;
    saveCheck(trip.id, { ...a, order: b.order ?? i + dir });
    saveCheck(trip.id, { ...b, order: a.order ?? i });
  };
  const done = sorted.filter((r) => r.checked).length;

  return h('main', { class: 'screen' },
    h('div', { class: 'topline' }, h('a', { href: '#/', style: 'text-decoration:none' }, '‹ 여행 목록'), h('span', {}, trip.name)),
    h('div', { class: 'title-row' }, h('h1', {}, '준비물'), sorted.length ? h('span', { class: 'pill' }, `${done}/${sorted.length}`) : null),
    h('form', { class: 'row', onsubmit: add },
      h('label', { class: 'field', style: 'flex:3' }, input),
      h('button', { class: 'btn primary', type: 'submit', style: 'flex:1' }, '추가')),
    sorted.length
      ? h('ul', { class: 'list' }, sorted.map((r, i) => h('li', { class: `check-row${r.checked ? ' checked' : ''}` },
        h('label', {}, h('input', {
          type: 'checkbox', checked: r.checked,
          onchange: (e) => saveCheck(trip.id, { ...r, checked: e.target.checked }),
        }), h('span', {}, r.name)),
        h('button', { class: 'btn small ghost', type: 'button', 'aria-label': `${r.name} 위로`, onclick: () => move(i, -1), disabled: i === 0 ? true : null }, '↑'),
        h('button', { class: 'btn small ghost', type: 'button', 'aria-label': `${r.name} 지우기`, onclick: () => deleteCheck(trip.id, r.id) }, '×'))))
      : h('div', { class: 'empty' },
        h('p', {}, '아직 준비물이 없어요.'),
        others.length ? h('p', {}, '지난 여행의 목록을 가져올 수 있어요.') : null,
        others.map((t) => h('button', {
          class: 'btn', type: 'button',
          onclick: async () => {
            try {
              const n = await copyChecklist(t.id, trip.id);
              notice(n ? `${n}개를 가져왔어요` : '그 여행에는 준비물이 없어요');
            } catch { notice('가져오지 못했어요'); }
          },
        }, `${t.name}에서 가져오기`))),
    tabbar(trip.id, 'checklist'),
  );
}
