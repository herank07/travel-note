import { h, mount, field, confirmButton, notice } from './dom.js';
import { createTrip, updateTrip, deleteTrip, watchTrip, myPersonId } from '../db.js';
import { navigate } from '../router.js';
import { ZONES, CURRENCY_SYMBOLS } from '../config.js';
import { backLink, loading, gone } from './tripShell.js';

const COUNTRIES = [
  ['CN', '중국', 'Asia/Shanghai', 'CNY'], ['JP', '일본', 'Asia/Tokyo', 'JPY'], ['KR', '한국', 'Asia/Seoul', 'KRW'],
  ['TW', '대만', 'Asia/Taipei', 'TWD'], ['HK', '홍콩', 'Asia/Hong_Kong', 'HKD'], ['TH', '태국', 'Asia/Bangkok', 'THB'],
  ['VN', '베트남', 'Asia/Ho_Chi_Minh', 'VND'], ['SG', '싱가포르', 'Asia/Singapore', 'SGD'], ['US', '미국', 'America/New_York', 'USD'],
  ['GB', '영국', 'Europe/London', 'GBP'], ['FR', '프랑스', 'Europe/Paris', 'EUR'], ['XX', '그 밖의 나라', 'Asia/Seoul', 'USD'],
];

const DEFAULTS = {
  name: '', destination: '', fromCode: 'ICN', toCode: '', startDate: null, days: null,
  timeZone: 'Asia/Shanghai', countryCode: 'CN', currency: 'CNY', notes: '',
};

const select = (id, options, value) => h('select', { id },
  options.map(([v, label]) => h('option', { value: v, selected: v === value ? true : null }, label)));

export function renderTripForm(params) {
  if (!params.tripId) { draw(null, DEFAULTS); return null; }
  mount(loading());
  let drawn = false;
  return watchTrip(params.tripId, (trip) => {
    if (!trip) { mount(gone()); return; }
    if (!drawn) { drawn = true; draw(params.tripId, trip); }
  }, () => mount(gone()));
}

function draw(tripId, t) {
  const error = h('p', { class: 'error', role: 'alert' });
  const els = {
    name: h('input', { id: 'trip-name', required: true, maxlength: 40, value: t.name, placeholder: '예: 2027 상하이' }),
    destination: h('input', { id: 'trip-destination', maxlength: 60, value: t.destination, placeholder: '예: 상하이, 중국' }),
    fromCode: h('input', { id: 'trip-from', maxlength: 4, value: t.fromCode, autocapitalize: 'characters' }),
    toCode: h('input', { id: 'trip-to', maxlength: 4, value: t.toCode, autocapitalize: 'characters', placeholder: 'PVG' }),
    startDate: h('input', { id: 'trip-start', type: 'date', value: t.startDate || '' }),
    days: h('input', { id: 'trip-days', type: 'number', min: 1, max: 60, inputmode: 'numeric', value: t.days ?? '', placeholder: '미정' }),
    countryCode: select('trip-country', COUNTRIES.map(([c, n]) => [c, n]), t.countryCode),
    timeZone: select('trip-zone', ZONES.map((z) => [z.id, `${z.label} (${z.id})`]), t.timeZone),
    currency: select('trip-currency', Object.keys(CURRENCY_SYMBOLS).map((c) => [c, `${c} ${CURRENCY_SYMBOLS[c]}`]), t.currency),
    notes: h('textarea', { id: 'trip-notes', value: t.notes, placeholder: '예: 비자 필요 여부 확인' }),
  };
  els.countryCode.addEventListener('change', () => {
    const c = COUNTRIES.find(([code]) => code === els.countryCode.value);
    if (c) { els.timeZone.value = c[2]; els.currency.value = c[3]; }
  });

  const save = async (e) => {
    e.preventDefault();
    const days = els.days.value ? Number(els.days.value) : null;
    if (!els.name.value.trim()) { error.textContent = '여행 이름을 적어 주세요.'; return; }
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > 60)) { error.textContent = '일수는 1에서 60 사이로 적어 주세요.'; return; }
    const fields = {
      name: els.name.value.trim(), destination: els.destination.value.trim(),
      fromCode: els.fromCode.value.trim().toUpperCase(), toCode: els.toCode.value.trim().toUpperCase(),
      startDate: els.startDate.value || null, days,
      countryCode: els.countryCode.value, timeZone: els.timeZone.value, currency: els.currency.value,
      notes: els.notes.value.trim(),
    };
    try {
      if (tripId) {
        updateTrip(tripId, fields).catch((err) => console.error(err));
        notice('저장했어요');
        navigate(`#/trip/${tripId}/today`);
      } else {
        const id = await createTrip(fields);
        navigate(`#/trip/${id}/today`);
      }
    } catch (err) {
      console.error(err);
      error.textContent = '저장하지 못했어요. 다시 시도해 주세요.';
    }
  };

  const isOwner = tripId && t.ownerId === myPersonId();
  mount(h('main', { class: 'screen' },
    backLink(tripId ? `#/trip/${tripId}/today` : '#/', tripId ? '일정' : '여행 목록'),
    h('h1', {}, tripId ? '여행 정보' : '새 여행'),
    h('form', { class: 'card form', onsubmit: save },
      field('여행 이름', els.name),
      field('목적지', els.destination),
      h('div', { class: 'grid2' }, field('출발 공항', els.fromCode), field('도착 공항', els.toCode)),
      h('div', { class: 'grid2' }, field('시작일 (몰라도 돼요)', els.startDate), field('며칠', els.days)),
      h('p', { class: 'muted', style: 'font-size:13px' }, '날짜를 몰라도 일수만 정하면 1일차, 2일차로 일정을 짤 수 있어요.'),
      field('나라', els.countryCode),
      h('div', { class: 'grid2' }, field('여행지 시간대', els.timeZone), field('통화', els.currency)),
      field('메모', els.notes),
      h('button', { class: 'btn primary block', type: 'submit' }, tripId ? '저장' : '여행 만들기'),
      error),
    isOwner ? confirmButton('여행 삭제', '이 여행과 일정, 기록, 준비물이 모두 지워져요. 되돌릴 수 없어요.', async () => {
      try { await deleteTrip(tripId); notice('여행을 지웠어요'); navigate('#/'); }
      catch (err) { console.error(err); notice('지우지 못했어요. 인터넷 연결을 확인해 주세요.'); }
    }) : null,
  ));
}
