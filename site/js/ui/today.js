import { h, mount, notice } from './dom.js';
import { watchTrip, watchItems, setItemDone } from '../db.js';
import { localParts, tripStatus, dayDate, formatHM } from '../time.js';
import {
  groupByDay, findNext, isPast, untilLabel, costTotals, toMinutes, nowIndex, defaultDay,
} from '../schedule.js';
import { HOME_TZ, HOME_LABEL, CURRENCY_SYMBOLS, USE_EMULATOR, zoneLabel } from '../config.js';
import { tabbar, loading, gone } from './tripShell.js';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

// Current time; on localhost `?now=<ISO>` pins it for checking the screen.
export function now() {
  if (USE_EMULATOR) {
    const pinned = new URLSearchParams(location.search).get('now');
    if (pinned) return new Date(pinned);
  }
  return new Date();
}

export function dayTitle(trip, day) {
  if (day === 'none') return '미정';
  const ymd = dayDate(trip, day);
  if (!ymd) return `${day}일차`;
  const [, m, d] = ymd.split('-').map(Number);
  return `${day}일차 · ${m}월 ${d}일 (${WEEK[new Date(`${ymd}T00:00:00Z`).getUTCDay()]})`;
}

export function clockLine(trip, at) {
  const here = formatHM(localParts(at, trip.timeZone).minutes);
  if (trip.timeZone === HOME_TZ) return `${HOME_LABEL} ${here}`;
  return `${zoneLabel(trip.timeZone)} ${here} · ${HOME_LABEL} ${formatHM(localParts(at, HOME_TZ).minutes)}`;
}

export function money(trip, n) {
  const sym = CURRENCY_SYMBOLS[trip.currency] || '';
  return `${sym}${n.toLocaleString('ko-KR')}${sym ? '' : ` ${trip.currency}`}`;
}

export function subline(item) {
  return [item.localName, item.transit || item.place].filter(Boolean).join(' · ');
}

export function watchTripAndItems(tripId, cb) {
  let trip; let items = []; let gotItems = false;
  const fire = () => { if (trip !== undefined && gotItems) cb(trip, items); };
  const off1 = watchTrip(tripId, (t) => { trip = t; fire(); }, () => { trip = null; cb(null, []); });
  const off2 = watchItems(tripId, (list) => { items = list; gotItems = true; fire(); }, () => { gotItems = true; fire(); });
  return () => { off1(); off2(); };
}

const checkIcon = () => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '16'); s.setAttribute('height', '16');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
  return s;
};

export function renderToday(params) {
  mount(loading());
  let latest = null;
  const draw = () => {
    if (!latest) return;
    const [trip, items] = latest;
    if (!trip) { mount(gone()); return; }
    mount(view(trip, items, params.day));
  };
  const off = watchTripAndItems(params.tripId, (trip, items) => { latest = [trip, items]; draw(); });
  const timer = setInterval(draw, 60 * 1000);
  const onShow = () => { if (document.visibilityState === 'visible') draw(); };
  document.addEventListener('visibilitychange', onShow);
  return () => { off(); clearInterval(timer); document.removeEventListener('visibilitychange', onShow); };
}

function view(trip, items, requestedDay) {
  const at = now();
  const local = localParts(at, trip.timeZone);
  const status = tripStatus(trip, local.ymd);
  const day = requestedDay ?? defaultDay(status, trip.days, items);
  const { byDay, undecided } = groupByDay(items, trip.days);
  const list = day === 'none' ? undecided : (byDay.get(day) || []);
  const isToday = status.kind === 'during' && day === status.day;
  const nowMin = local.minutes;
  const { next, inProgress } = isToday ? findNext(list, nowMin) : { next: null, inProgress: [] };
  const totals = costTotals(items);

  const maxItemDay = Math.max(0, ...[...byDay.keys()]);
  const dayCount = trip.days || maxItemDay;
  const chips = [];
  for (let d = 1; d <= dayCount; d += 1) chips.push(d);
  chips.push('none');

  const rows = [];
  const cut = isToday ? nowIndex(list, nowMin) : -1;
  list.forEach((item, i) => {
    if (i === cut) rows.push(nowRow(nowMin));
    rows.push(itemRow(trip, item, {
      past: isToday && isPast(item, nowMin),
      next: next && item.id === next.id ? untilLabel(toMinutes(next.start) - nowMin) : null,
      running: inProgress.some((x) => x.id === item.id),
      first: i === 0 && cut !== 0,
      last: i === list.length - 1 && cut !== list.length,
    }));
  });
  if (isToday && cut === list.length && list.length) rows.push(nowRow(nowMin));

  const doneCount = list.filter((i) => i.done).length;
  const dayCost = day === 'none' ? (totals.byDay.get(null) || 0) : (totals.byDay.get(day) || 0);

  return h('main', { class: 'screen' },
    h('div', { class: 'topline' },
      h('a', { href: '#/', style: 'text-decoration:none' }, '‹ 여행 목록'),
      h('span', { class: 'clock' }, clockLine(trip, at))),
    h('div', { class: 'title-row' },
      h('div', {}, h('p', { class: 'muted', style: 'font-size:13px' }, trip.name), h('h1', {}, dayTitle(trip, day))),
      h('a', { class: 'btn small', href: `#/trip/${trip.id}/edit` }, '여행 정보')),
    status.kind === 'before' ? h('p', { class: 'banner' }, `출발까지 D-${status.dday}`) : null,
    h('nav', { class: 'chips', 'aria-label': '날짜 고르기' }, chips.map((d) => h('a', {
      class: 'chip', href: `#/trip/${trip.id}/today/${d}`, 'aria-current': d === day ? 'true' : null,
    }, d === 'none' ? '미정' : `${d}일차`))),
    list.length
      ? h('p', { class: 'muted', style: 'font-size:13px;margin:0 4px' },
        `${list.length}개 중 ${doneCount}개 끝남 · 이날 예상 ${money(trip, dayCost)} · 여행 전체 ${money(trip, totals.total)}`)
      : null,
    list.length
      ? h('ol', { class: 'timeline', 'aria-label': `${dayTitle(trip, day)} 일정` }, rows)
      : h('div', { class: 'empty' }, h('p', {}, day === 'none' ? '날짜를 정하지 않은 일정이 없어요.' : '이날 일정이 아직 없어요.'),
        h('a', { class: 'btn primary', href: newItemHref(trip.id, day) }, '일정 추가')),
    isToday && list.length && !next && inProgress.length === 0
      ? h('p', { class: 'muted', style: 'text-align:center' }, '오늘 남은 일정이 없어요.') : null,
    h('a', { class: 'fab', href: newItemHref(trip.id, day), 'aria-label': '일정 추가', style: 'display:flex;align-items:center;justify-content:center;text-decoration:none' }, '+'),
    tabbar(trip.id, 'today'),
  );
}

function newItemHref(tripId, day) {
  try { sessionStorage.setItem('newItemDay', String(day)); } catch { /* ignore */ }
  return `#/trip/${tripId}/item/new`;
}

function nowRow(nowMin) {
  return h('li', { class: 'tl-now', 'aria-label': `지금 ${formatHM(nowMin)}` },
    h('span', { class: 'mono' }, formatHM(nowMin)),
    h('span', { class: 'tl-rail', 'aria-hidden': 'true' }, h('span', { class: 'seg bottom' }), h('span', { class: 'tl-dot' }), h('span', { class: 'seg bottom' })),
    h('span', { class: 'line' }, h('span', {}), h('span', {}, '지금')));
}

function itemRow(trip, item, { past, next, running, first, last }) {
  const cls = ['tl-row', past ? 'past' : '', item.done ? 'done' : '', next ? 'next' : '', running ? 'now' : ''].filter(Boolean).join(' ');
  const href = next ? `#/trip/${trip.id}/next` : `#/trip/${trip.id}/item/${item.id}`;
  const toggle = h('button', {
    type: 'button', class: 'tl-check', 'aria-pressed': item.done ? 'true' : 'false',
    'aria-label': item.done ? `${item.title} 완료 취소` : `${item.title} 완료`,
    onclick: () => { setItemDone(trip.id, item.id, !item.done).catch(() => notice('저장하지 못했어요')); },
  }, item.done ? checkIcon() : null);
  return h('li', { class: cls },
    h('span', { class: 'tl-time' }, item.start || '—'),
    h('span', { class: 'tl-rail', 'aria-hidden': 'true' },
      h('span', { class: `seg top${first ? ' none' : ''}` }), h('span', { class: 'tl-dot' }), h('span', { class: `seg bottom${last ? ' none' : ''}` })),
    h('a', { class: 'tl-body', href, style: 'text-decoration:none;color:inherit' },
      h('span', { class: 'tl-title' }, item.title),
      subline(item) ? h('span', { class: 'tl-sub' }, subline(item)) : null,
      running ? h('span', { class: 'tl-sub', style: 'color:var(--accent);font-weight:600' }, '진행 중') : null),
    h('span', { class: 'tl-side' },
      next ? h('span', { class: 'pill accent' }, next) : null,
      typeof item.cost === 'number' ? h('span', { class: 'tl-cost' }, money(trip, item.cost)) : null,
      toggle),
  );
}
