import { h, mount } from './dom.js';
import { watchMyTrips } from '../db.js';
import { localParts, tripStatus, statusLabel, dayDate } from '../time.js';
import { navigate } from '../router.js';
import { APP_NAME } from '../config.js';
import { loading } from './tripShell.js';

let autoOpened = false;

const ORDER = { during: 0, before: 1, undated: 2, after: 3 };

export function sortTrips(trips, now = new Date()) {
  return trips
    .map((t) => ({ trip: t, status: tripStatus(t, localParts(now, t.timeZone || 'Asia/Seoul').ymd) }))
    .sort((a, b) => ORDER[a.status.kind] - ORDER[b.status.kind]
      || (a.status.dday ?? 0) - (b.status.dday ?? 0)
      || (b.trip.startDate || '').localeCompare(a.trip.startDate || ''));
}

function dateLine(trip) {
  if (!trip.startDate) return trip.days ? `${trip.days}일 · 날짜 미정` : '날짜 미정';
  const end = trip.days ? dayDate(trip, trip.days) : null;
  return end ? `${trip.startDate.replace(/-/g, '.')} – ${end.slice(5).replace('-', '.')}` : trip.startDate.replace(/-/g, '.');
}

export function renderTrips() {
  mount(loading());
  const off = watchMyTrips((trips) => {
    const sorted = sortTrips(trips);
    const during = sorted.find((x) => x.status.kind === 'during');
    if (!autoOpened && during && !location.hash) {
      autoOpened = true;
      navigate(`#/trip/${during.trip.id}/today`);
      return;
    }
    autoOpened = true;
    mount(h('main', { class: 'screen' },
      h('div', { class: 'title-row' }, h('h1', {}, APP_NAME), h('a', { class: 'btn small', href: '#/new' }, '+ 새 여행')),
      sorted.length === 0
        ? h('div', { class: 'empty' },
          h('p', {}, '아직 여행이 없어요.'),
          h('p', {}, '새 여행을 만들거나, 받은 초대 링크를 열어 주세요.'),
          h('a', { class: 'btn primary', href: '#/new' }, '첫 여행 만들기'))
        : h('ul', { class: 'list' }, sorted.map(({ trip, status }) => h('li', {},
          h('a', { class: 'list-btn', href: `#/trip/${trip.id}/today` },
            h('span', { class: 'grow' },
              h('span', { class: 'name' }, trip.name),
              h('span', { class: 'sub' }, [trip.destination, dateLine(trip)].filter(Boolean).join(' · '))),
            h('span', { class: `pill${status.kind === 'during' ? ' accent' : status.kind === 'before' ? ' ink' : ''}` }, statusLabel(status)))))),
      h('a', { class: 'btn ghost', href: '#/link' }, '다른 기기 연결하기'),
    ));
  }, (e) => { console.error(e); });
  return off;
}
