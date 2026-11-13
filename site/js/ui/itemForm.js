import { h, mount, field, confirmButton, notice } from './dom.js';
import { saveItem, deleteItem } from '../db.js';
import { navigate } from '../router.js';
import { CATEGORIES, CURRENCY_SYMBOLS } from '../config.js';
import { watchTripAndItems } from './today.js';
import { showDriver } from './nextItem.js';
import { loading, gone, backLink } from './tripShell.js';

const EMPTY = {
  day: null, start: null, end: null, title: '', place: '', localName: '', localAddress: '', transit: '',
  mapUrl: '', category: '관광', cost: null, memo: '', done: false,
};

function requestedDay() {
  try {
    const v = sessionStorage.getItem('newItemDay');
    if (v === null || v === 'none') return null;
    const n = Number(v);
    return Number.isInteger(n) ? n : null;
  } catch { return null; }
}

export function renderItemForm(params) {
  mount(loading());
  let drawn = false;
  return watchTripAndItems(params.tripId, (trip, items) => {
    if (!trip) { mount(gone()); return; }
    if (drawn) return;
    const isNew = params.itemId === 'new';
    const item = isNew ? { ...EMPTY, day: requestedDay() } : items.find((i) => i.id === params.itemId);
    if (!item) { mount(gone()); return; }
    drawn = true;
    draw(trip, item, isNew);
  });
}

function draw(trip, item, isNew) {
  const back = `#/trip/${trip.id}/today/${item.day ?? 'none'}`;
  const error = h('p', { class: 'error', role: 'alert' });
  const dayCount = Math.max(trip.days || 0, item.day || 0, 1);
  const dayOptions = [['none', '미정']];
  for (let d = 1; d <= dayCount; d += 1) dayOptions.push([String(d), `${d}일차`]);
  const els = {
    title: h('input', { id: 'item-title', required: true, maxlength: 60, value: item.title, placeholder: '예: 신톈디 산책' }),
    day: h('select', { id: 'item-day' }, dayOptions.map(([v, l]) => h('option', { value: v, selected: v === String(item.day ?? 'none') ? true : null }, l))),
    start: h('input', { id: 'item-start', type: 'time', value: item.start || '' }),
    end: h('input', { id: 'item-end', type: 'time', value: item.end || '' }),
    category: h('select', { id: 'item-category' }, CATEGORIES.map((c) => h('option', { value: c, selected: c === item.category ? true : null }, c))),
    place: h('input', { id: 'item-place', maxlength: 80, value: item.place, placeholder: '예: 황푸구' }),
    localName: h('input', { id: 'item-local-name', maxlength: 80, value: item.localName, placeholder: '예: 新天地', lang: 'zh' }),
    localAddress: h('input', { id: 'item-local-address', maxlength: 160, value: item.localAddress, placeholder: '기사님께 보여줄 현지어 주소', lang: 'zh' }),
    transit: h('input', { id: 'item-transit', maxlength: 80, value: item.transit, placeholder: '예: 지하철 10호선 신톈디역' }),
    mapUrl: h('input', { id: 'item-map', type: 'url', maxlength: 500, value: item.mapUrl, placeholder: '지도 앱에서 복사한 링크 (없어도 돼요)' }),
    cost: h('input', { id: 'item-cost', type: 'number', min: 0, step: 'any', inputmode: 'decimal', value: item.cost ?? '', placeholder: '0' }),
    memo: h('textarea', { id: 'item-memo', value: item.memo }),
  };

  const save = (e) => {
    e.preventDefault();
    const title = els.title.value.trim();
    if (!title) { error.textContent = '제목을 적어 주세요.'; return; }
    const start = els.start.value || null;
    const end = els.end.value || null;
    if (start && end && end <= start) { error.textContent = '끝나는 시간은 시작 시간보다 늦어야 해요.'; return; }
    if (end && !start) { error.textContent = '끝나는 시간을 적으려면 시작 시간도 적어 주세요.'; return; }
    const cost = els.cost.value === '' ? null : Number(els.cost.value);
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) { error.textContent = '예상 비용은 0 이상의 숫자로 적어 주세요.'; return; }
    const row = {
      ...(isNew ? {} : { id: item.id }),
      title, day: els.day.value === 'none' ? null : Number(els.day.value), start, end,
      category: els.category.value, place: els.place.value.trim(), localName: els.localName.value.trim(),
      localAddress: els.localAddress.value.trim(), transit: els.transit.value.trim(), mapUrl: els.mapUrl.value.trim(),
      cost, memo: els.memo.value.trim(),
      ...(isNew ? { done: false } : {}),
    };
    saveItem(trip.id, row).catch(() => notice('저장하지 못했어요. 연결되면 다시 시도해 주세요.'));
    if (!navigator.onLine) notice('오프라인이에요. 연결되면 저장돼요');
    navigate(`#/trip/${trip.id}/today/${row.day ?? 'none'}`);
  };

  const sym = CURRENCY_SYMBOLS[trip.currency] || trip.currency;
  mount(h('main', { class: 'screen' },
    backLink(back, '일정'),
    h('h1', {}, isNew ? '일정 추가' : '일정 고치기'),
    h('form', { class: 'card form', onsubmit: save },
      field('제목', els.title),
      h('div', { class: 'grid2' }, field('날짜', els.day), field('종류', els.category)),
      h('div', { class: 'grid2' }, field('시작 (선택)', els.start), field('끝 (선택)', els.end)),
      field('장소', els.place),
      field('현지어 이름', els.localName),
      field('현지어 주소', els.localAddress),
      field('가는 법', els.transit),
      field('지도 링크', els.mapUrl),
      field(`예상 비용 (${sym})`, els.cost),
      field('메모', els.memo),
      h('button', { class: 'btn primary block', type: 'submit' }, '저장'),
      error),
    !isNew && (item.localName || item.localAddress)
      ? h('button', { class: 'btn block', type: 'button', onclick: () => showDriver(item) }, '기사님께 보여주기') : null,
    !isNew ? confirmButton('일정 삭제', '이 일정을 지울까요?', () => {
      deleteItem(trip.id, item.id).catch(() => notice('지우지 못했어요'));
      navigate(back);
    }) : null,
  ));
  if (isNew) els.title.focus();
}
