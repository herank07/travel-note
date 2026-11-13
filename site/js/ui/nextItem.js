import { h, mount } from './dom.js';
import { localParts, tripStatus, formatHM } from '../time.js';
import { groupByDay, findNext, toMinutes, untilLabel, sortItems } from '../schedule.js';
import { mapUrl } from '../maps.js';
import { watchTripAndItems, now, clockLine, subline, dayTitle } from './today.js';
import { loading, gone, tabbar } from './tripShell.js';

export function renderNextItem(params) {
  mount(loading());
  return watchTripAndItems(params.tripId, (trip, items) => {
    if (!trip) { mount(gone()); return; }
    mount(view(trip, items));
  });
}

function view(trip, items) {
  const at = now();
  const local = localParts(at, trip.timeZone);
  const status = tripStatus(trip, local.ymd);
  const back = h('a', { class: 'btn small', href: `#/trip/${trip.id}/today` }, '오늘 일정 전체');
  if (status.kind !== 'during') {
    return h('main', { class: 'screen' }, back, h('div', { class: 'empty' }, h('p', {}, '여행 중에만 다음 일정을 보여 드려요.')), tabbar(trip.id, 'today'));
  }
  const list = groupByDay(items, trip.days).byDay.get(status.day) || [];
  const { next } = findNext(list, local.minutes);
  const header = h('div', { class: 'topline' }, h('span', {}, `${trip.name} · ${dayTitle(trip, status.day)}`), h('span', { class: 'mono' }, clockLine(trip, at)));
  if (!next) {
    return h('main', { class: 'screen' }, header, back, h('div', { class: 'empty' }, h('p', {}, '오늘 남은 일정이 없어요.')), tabbar(trip.id, 'today'));
  }
  const later = sortItems(list).filter((i) => i.start && toMinutes(i.start) > toMinutes(next.start)).slice(0, 3);

  return h('main', { class: 'screen' },
    header,
    h('div', { class: 'title-row' }, h('h1', {}, '다음 일정'), back),
    h('section', { class: 'card next-card', 'aria-label': '다음 일정' },
      h('div', { class: 'label' }, h('span', {}, '다음 일정'), h('span', { class: 'pill accent' }, untilLabel(toMinutes(next.start) - local.minutes))),
      h('div', { style: 'display:flex;align-items:baseline;gap:10px' },
        h('span', { class: 'big-time' }, next.start),
        next.end ? h('span', { class: 'mono muted' }, `– ${next.end}`) : null),
      h('div', {}, h('h2', { class: 'big-title' }, next.title), subline(next) ? h('p', { class: 'muted' }, subline(next)) : null),
      next.memo ? h('p', { class: 'memo' }, next.memo) : null,
      h('div', { class: 'row' },
        h('a', { class: 'btn', href: mapUrl(next, trip.countryCode), target: '_blank', rel: 'noopener' }, '지도 열기'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => showDriver(next) }, '기사님께 보여주기')),
      h('a', { class: 'btn ghost small', href: `#/trip/${trip.id}/item/${next.id}` }, '이 일정 고치기')),
    later.length ? h('section', { 'aria-label': '그다음 일정', style: 'display:flex;flex-direction:column;gap:8px' },
      h('h3', {}, '그다음'),
      h('ul', { class: 'list' }, later.map((i) => h('li', {},
        h('a', { class: 'list-btn', href: `#/trip/${trip.id}/item/${i.id}` },
          h('span', { class: 'mono', style: 'font-weight:600;width:48px' }, i.start),
          h('span', { class: 'grow' }, h('span', { class: 'name' }, i.title), subline(i) ? h('span', { class: 'sub' }, subline(i)) : null)))))) : null,
    tabbar(trip.id, 'today'),
  );
}

// Full-screen card with the local name and address for a taxi driver. Tap anywhere to close.
export function showDriver(item) {
  const overlay = h('div', { class: 'driver', role: 'dialog', 'aria-label': '기사님께 보여주기', tabindex: '-1' },
    h('div', { class: 'local', lang: 'zh' }, item.localName || item.title),
    item.localAddress ? h('div', { class: 'addr', lang: 'zh' }, item.localAddress) : null,
    h('button', { class: 'btn', type: 'button' }, '닫기'));
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  overlay.focus();
}

export { formatHM };
