import { h, mount, notice, copyText, confirmButton } from './dom.js';
import {
  watchTrip, watchMyTrips, getPeople, getInvite, regenerateInvite, removeMember, addMember, leaveTrip, myPersonId,
} from '../db.js';
import { navigate } from '../router.js';
import { tabbar, loading, gone } from './tripShell.js';

export function inviteLink(code) {
  return `${location.origin}${location.pathname}#/join/${code}`;
}

export function renderMembers(params) {
  mount(loading());
  let alive = true;
  let trip; let myTrips = []; let names = new Map(); let code = null; let askedCode = false;
  const draw = () => {
    if (!alive || trip === undefined) return;
    if (!trip) { mount(gone()); return; }
    mount(view(trip, myTrips, names, code, {
      regenerate: async () => {
        try { code = await regenerateInvite(trip.id); notice('초대 코드를 바꿨어요. 예전 링크는 이제 안 열려요'); draw(); }
        catch { notice('바꾸지 못했어요. 인터넷 연결을 확인해 주세요'); }
      },
      remove: async (id, label) => {
        try { code = await removeMember(trip.id, id); notice(`${label} 님을 내보냈어요. 초대 코드도 새로 바꿨어요`); draw(); }
        catch { notice('내보내지 못했어요'); }
      },
      leave: async () => {
        try { await leaveTrip(trip.id); notice('여행에서 나왔어요'); navigate('#/'); }
        catch { notice('나가지 못했어요. 인터넷 연결을 확인해 주세요'); }
      },
    }));
  };
  const refreshNames = async () => {
    const ids = new Set(trip?.memberIds || []);
    myTrips.forEach((t) => t.memberIds.forEach((id) => ids.add(id)));
    const result = await getPeople([...ids]);
    if (!alive) return;
    names = result;
    draw();
  };
  const off1 = watchTrip(params.tripId, async (t) => {
    trip = t;
    if (t && t.ownerId === myPersonId() && !askedCode) {
      askedCode = true;
      try { code = await getInvite(t.id); } catch { code = null; }
    }
    draw();
    refreshNames();
  }, () => { trip = null; draw(); });
  const off2 = watchMyTrips((list) => { myTrips = list; refreshNames(); }, () => {});
  return () => { alive = false; off1(); off2(); };
}

function view(trip, myTrips, names, code, actions) {
  const me = myPersonId();
  const isOwner = trip.ownerId === me;
  const name = (id) => names.get(id) || '…';
  const companions = new Set();
  myTrips.forEach((t) => { if (t.id !== trip.id) t.memberIds.forEach((id) => companions.add(id)); });
  trip.memberIds.forEach((id) => companions.delete(id));

  return h('main', { class: 'screen' },
    h('div', { class: 'topline' }, h('a', { href: '#/', style: 'text-decoration:none' }, '‹ 여행 목록'), h('span', {}, trip.name)),
    h('h1', {}, '멤버'),
    h('ul', { class: 'list' }, trip.memberIds.map((id) => h('li', { class: 'check-row' },
      h('span', { style: 'flex:1' }, name(id), id === me ? ' (나)' : '', id === trip.ownerId ? ' · 만든 사람' : ''),
      isOwner && id !== me
        ? h('button', { class: 'btn small danger', type: 'button', onclick: () => actions.remove(id, name(id)) }, '내보내기')
        : null))),
    isOwner
      ? h('section', { class: 'card' },
        h('h2', {}, '초대하기'),
        h('p', { class: 'muted' }, '이 링크를 열거나 코드를 입력한 사람은 이 여행만 보고 고칠 수 있어요.'),
        code ? h('div', { class: 'code-box', 'aria-label': '초대 코드' }, code) : h('p', { class: 'muted' }, '코드를 불러오는 중…'),
        code ? h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => copyText(inviteLink(code)) }, '초대 링크 복사'),
          h('button', { class: 'btn', type: 'button', onclick: () => copyText(code) }, '코드 복사')) : null,
        confirmButton('초대 코드 바꾸기', '지금 코드와 링크는 바로 막혀요. 이미 들어온 사람은 그대로예요.', actions.regenerate))
      : h('p', { class: 'muted' }, '초대는 이 여행을 만든 사람이 할 수 있어요.'),
    isOwner && companions.size
      ? h('section', { class: 'card' },
        h('h2', {}, '함께했던 사람 추가'),
        h('p', { class: 'muted' }, '다른 여행에서 함께한 사람은 코드 없이 바로 넣을 수 있어요.'),
        h('ul', { class: 'list' }, [...companions].map((id) => h('li', { class: 'check-row' },
          h('span', { style: 'flex:1' }, name(id)),
          h('button', { class: 'btn small', type: 'button', onclick: () => addMember(trip.id, id).then(() => notice(`${name(id)} 님을 넣었어요`)).catch(() => notice('넣지 못했어요')) }, '추가')))))
      : null,
    h('a', { class: 'btn ghost', href: '#/link' }, '내 다른 기기 연결하기'),
    isOwner ? null : confirmButton('이 여행에서 나가기', '나가면 이 여행이 더는 보이지 않아요. 다시 들어오려면 초대를 받아야 해요.', actions.leave),
    tabbar(trip.id, 'members'),
  );
}
