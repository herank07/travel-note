import { h } from './dom.js';

// Bottom tab bar shared by the screens inside one trip.
export function tabbar(tripId, current) {
  const tab = (key, label, href) => h('a', { href, 'aria-current': key === current ? 'page' : null }, label);
  return h('div', { class: 'tabbar' }, h('nav', { 'aria-label': '여행 메뉴' },
    tab('today', '일정', `#/trip/${tripId}/today`),
    tab('journal', '기록', `#/trip/${tripId}/journal`),
    tab('checklist', '준비물', `#/trip/${tripId}/checklist`),
    tab('members', '멤버', `#/trip/${tripId}/members`),
  ));
}

export function backLink(href, label = '여행 목록') {
  return h('a', { class: 'btn small ghost', href, style: 'align-self:flex-start;padding-left:0' }, '‹ ' + label);
}

export function loading() {
  return h('main', { class: 'screen' }, h('p', { class: 'muted' }, '불러오는 중…'));
}

export function gone() {
  return h('main', { class: 'screen' }, h('div', { class: 'empty' },
    h('p', {}, '이 여행을 볼 수 없어요. 삭제되었거나 멤버에서 빠졌을 수 있어요.'),
    h('a', { class: 'btn', href: '#/' }, '여행 목록으로')));
}
