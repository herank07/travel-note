import { ready } from './firebase.js';
import { getMyPersonId, joinByCode } from './db.js';
import { onRoute, navigate, parseRoute } from './router.js';
import { h, mount, notice } from './ui/dom.js';
import { renderWelcome } from './ui/welcome.js';

// name → [module, export]. Screens receive (params, ctx) and may return a cleanup function.
const screens = {
  trips: ['./ui/trips.js', 'renderTrips'],
  tripNew: ['./ui/tripForm.js', 'renderTripForm'],
  tripEdit: ['./ui/tripForm.js', 'renderTripForm'],
  today: ['./ui/today.js', 'renderToday'],
  next: ['./ui/nextItem.js', 'renderNextItem'],
  item: ['./ui/itemForm.js', 'renderItemForm'],
  journal: ['./ui/journal.js', 'renderJournal'],
  checklist: ['./ui/checklist.js', 'renderChecklist'],
  members: ['./ui/members.js', 'renderMembers'],
  link: ['./ui/link.js', 'renderLink'],
};

let cleanup = null;

async function show(route) {
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  if (route.name === 'join') {
    try {
      const tripId = await joinByCode(route.params.code);
      notice('여행에 들어왔어요');
      navigate(`#/trip/${tripId}/today`);
    } catch (e) {
      console.error(e);
      notice(e.message.startsWith('초대') ? e.message : '들어가지 못했어요. 코드를 확인해 주세요.');
      navigate('#/');
    }
    return;
  }
  const [path, name] = screens[route.name] || screens.trips;
  const mod = await import(path);
  cleanup = (await mod[name](route.params, { route })) || null;
}

function showError(text) {
  mount(h('main', { class: 'screen' }, h('div', { class: 'empty' }, h('p', {}, text),
    h('button', { class: 'btn', type: 'button', onclick: () => location.reload() }, '다시 시도'))));
}

async function boot() {
  mount(h('main', { class: 'screen' }, h('p', { class: 'muted' }, '불러오는 중…')));
  try {
    await ready;
  } catch (e) {
    console.error(e);
    showError('처음 한 번은 인터넷 연결이 필요해요. 연결한 뒤 다시 시도해 주세요.');
    return;
  }
  let personId = null;
  try { personId = await getMyPersonId(); } catch (e) { console.error(e); }
  if (!personId) {
    // The URL keeps any #/join/... route, so joining happens right after registration.
    renderWelcome(start);
    return;
  }
  start();
}

let started = false;
function start() {
  if (started) { show(parseRoute(location.hash)); return; }
  started = true;
  onRoute((route) => show(route).catch((e) => { console.error(e); showError('화면을 열지 못했어요.'); }));
}

boot();
