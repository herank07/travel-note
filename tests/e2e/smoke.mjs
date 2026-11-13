// End-to-end walk through the app against the local emulators.
// Needs: `npm run emulators` and `npm run serve` running. Run: node tests/e2e/smoke.mjs
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:8080/';
const NOW = '?now=2027-04-16T05:20:00Z'; // Shanghai 13:20, day 2 of a trip starting 2027-04-15
const SHOTS = '.superpowers/shots';
mkdirSync(SHOTS, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const results = [];
let lastPage = null;
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };

async function newPage() {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  lastPage = page;
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [console]', m.text()); });
  return page;
}
const text = (page) => page.evaluate(() => document.body.innerText);
const waitText = (page, t, timeout = 10000) => page.waitForFunction((s) => document.body.innerText.includes(s), { timeout }, t);
async function clickText(page, t, sel = 'button, a') {
  await page.waitForFunction((s, q) => [...document.querySelectorAll(q)].some((e) => e.textContent.trim() === s), { timeout: 10000 }, t, sel);
  await page.evaluate((s, q) => [...document.querySelectorAll(q)].find((e) => e.textContent.trim() === s).click(), t, sel);
}
async function fill(page, id, value) {
  await page.waitForSelector(`#${id}`);
  await page.$eval(`#${id}`, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, value);
}
async function register(page, url, name) {
  await page.goto(url);
  await fill(page, 'name', name);
  await clickText(page, '시작하기');
  await waitText(page, '복구 코드를 저장해 두세요');
  const code = await page.$eval('.code-box', (e) => e.textContent.trim());
  await clickText(page, '저장했어요');
  return code;
}

try {
  // Owner registers and creates the trip.
  const owner = await newPage();
  const recovery = await register(owner, `${BASE}${NOW}`, '혜원');
  check('recovery code shown once', /^[A-Z2-9]{10}$/.test(recovery), recovery);
  await waitText(owner, '아직 여행이 없어요');
  check('empty trip list', true);
  await clickText(owner, '+ 새 여행');
  await fill(owner, 'trip-name', '2027 상하이');
  await fill(owner, 'trip-destination', '상하이, 중국');
  await fill(owner, 'trip-to', 'PVG');
  await fill(owner, 'trip-start', '2027-04-15');
  await fill(owner, 'trip-days', '4');
  await clickText(owner, '여행 만들기');
  await waitText(owner, '오늘 남은 일정이 없어요');
  const tripId = owner.url().match(/trip\/([^/]+)\//)[1];
  check('trip created, opens on today (day 2)', (await text(owner)).includes('2일차 · 4월 16일 (금)'));

  // Add three items on day 2 through the form.
  const add = async (title, start, extra = {}) => {
    await owner.goto(`${BASE}${NOW}#/trip/${tripId}/today/2`);
    await owner.waitForSelector('.fab');
    await owner.click('.fab');
    await fill(owner, 'item-title', title);
    await fill(owner, 'item-start', start);
    for (const [id, v] of Object.entries(extra)) await fill(owner, id, v);
    await clickText(owner, '저장');
    await waitText(owner, title);
  };
  await add('아침 · 성젠바오', '09:00', { 'item-cost': '15' });
  await add('신톈디 산책', '14:00', { 'item-end': '16:00', 'item-local-name': '新天地', 'item-transit': '지하철 10호선 신톈디역', 'item-local-address': '上海市黄浦区太仓路181弄' });
  await add('숙소 복귀', '21:00');
  const today = await text(owner);
  check('clock shows Shanghai and Korea time', today.includes('상하이 13:20 · 한국 14:20'));
  check('next item countdown', today.includes('40분 후'));
  check('now line', today.includes('지금'));
  check('day totals', today.includes('이날 예상 ¥15'));
  await owner.screenshot({ path: `${SHOTS}/today.png`, fullPage: true });

  // Big next card and driver overlay.
  await owner.goto(`${BASE}${NOW}#/trip/${tripId}/next`);
  await waitText(owner, '기사님께 보여주기');
  check('next card shows the next item', (await text(owner)).includes('신톈디 산책'));
  await owner.screenshot({ path: `${SHOTS}/next.png`, fullPage: true });
  await clickText(owner, '기사님께 보여주기');
  await waitText(owner, '上海市黄浦区太仓路181弄');
  check('driver overlay shows local address', true);
  await owner.screenshot({ path: `${SHOTS}/driver.png` });

  // Undecided bucket when the trip gets shorter.
  await add('톈쯔팡', '10:00');
  await owner.goto(`${BASE}${NOW}#/trip/${tripId}/edit`);
  await fill(owner, 'trip-days', '1');
  await clickText(owner, '저장');
  await owner.goto(`${BASE}${NOW}#/trip/${tripId}/today/none`);
  await waitText(owner, '톈쯔팡');
  check('items beyond trip length move to 미정', true);
  await owner.goto(`${BASE}${NOW}#/trip/${tripId}/edit`);
  await fill(owner, 'trip-days', '4');
  await clickText(owner, '저장');

  // Invite: a companion joins with the link.
  await owner.goto(`${BASE}${NOW}#/trip/${tripId}/members`);
  await owner.waitForSelector('.code-box');
  const invite = await owner.$eval('.code-box', (e) => e.textContent.trim());
  const friend = await newPage();
  await register(friend, `${BASE}${NOW}#/join/${invite}`, '민수');
  await waitText(friend, '신톈디 산책');
  check('companion joins through the invite link', true);

  // A stranger sees nothing.
  const stranger = await newPage();
  await register(stranger, `${BASE}${NOW}`, '모르는 사람');
  await stranger.goto(`${BASE}${NOW}#/trip/${tripId}/today`);
  await waitText(stranger, '이 여행을 볼 수 없어요');
  check('stranger cannot open the trip', !(await text(stranger)).includes('신톈디'));

  // Owner changes the code; the old link stops working.
  await owner.goto(`${BASE}${NOW}#/trip/${tripId}/members`);
  await waitText(owner, '민수');
  check('member list shows companion', true);
  await clickText(owner, '초대 코드 바꾸기');
  await clickText(owner, '네, 초대 코드 바꾸기');
  await waitText(owner, '예전 링크는 이제 안 열려요');
  await stranger.goto(`${BASE}${NOW}#/join/${invite}`);
  await waitText(stranger, '초대 코드를 찾을 수 없어요');
  check('old invite code rejected', true);

  // A "done" tick made by someone else survives my edit of the same item.
  await owner.goto(`${BASE}${NOW}#/trip/${tripId}/today/2`);
  await clickText(owner, '숙소 복귀', '.tl-title');
  await owner.waitForSelector('#item-memo');
  await friend.goto(`${BASE}${NOW}#/trip/${tripId}/today/2`);
  await friend.waitForSelector('[aria-label="숙소 복귀 완료"]');
  await friend.click('[aria-label="숙소 복귀 완료"]');
  await friend.waitForSelector('[aria-label="숙소 복귀 완료 취소"]');
  await fill(owner, 'item-memo', '체크아웃 시간 확인');
  await clickText(owner, '저장');
  await owner.waitForSelector('.tl-row');
  await new Promise((r) => setTimeout(r, 1500));
  check('done tick kept when another member edits', Boolean(await owner.$('[aria-label="숙소 복귀 완료 취소"]')));

  // Journal and checklist.
  await friend.goto(`${BASE}${NOW}#/trip/${tripId}/journal`);
  await clickText(friend, '+ 기록 쓰기');
  await fill(friend, 'entry-title', '도착한 날');
  await fill(friend, 'entry-body', '예원에 갔다.');
  await clickText(friend, '저장');
  await waitText(friend, '예원에 갔다.');
  check('journal entry saved with author', (await text(friend)).includes('민수'));
  await friend.goto(`${BASE}${NOW}#/trip/${tripId}/checklist`);
  await fill(friend, 'check-new', '여권');
  await clickText(friend, '추가');
  await waitText(friend, '여권');
  check('checklist item added', true);
  await friend.screenshot({ path: `${SHOTS}/checklist.png`, fullPage: true });

  // Typing in the journal survives another member's save.
  await friend.goto(`${BASE}${NOW}#/trip/${tripId}/journal`);
  await clickText(friend, '+ 기록 쓰기');
  await friend.waitForSelector('#entry-body');
  await friend.type('#entry-body', '쓰는 중인 글');
  await owner.goto(`${BASE}${NOW}#/trip/${tripId}/journal`);
  await clickText(owner, '+ 기록 쓰기');
  await fill(owner, 'entry-title', '둘째 날');
  await clickText(owner, '저장');
  await waitText(friend, '둘째 날');
  check('journal draft kept while another member saves', (await friend.$eval('#entry-body', (e) => e.value)) === '쓰는 중인 글');

  // Removing a member closes the door: their saved link no longer works.
  await owner.goto(`${BASE}${NOW}#/trip/${tripId}/members`);
  await owner.waitForSelector('.code-box');
  const current = await owner.$eval('.code-box', (e) => e.textContent.trim());
  await clickText(owner, '내보내기');
  await waitText(owner, '내보냈어요');
  await friend.goto(`${BASE}${NOW}#/join/${current}`);
  await waitText(friend, '초대 코드를 찾을 수 없어요');
  check('removed member cannot rejoin with the saved link', true);

  // Device linking: the owner's identity moves to a new device.
  const laptop = await newPage();
  await laptop.goto(`${BASE}${NOW}`);
  await fill(laptop, 'device-code', recovery);
  await clickText(laptop, '이 기기 연결하기');
  await waitText(laptop, '2027 상하이');
  check('recovery code restores trips on a new device', true);

  // Offline: with the service worker installed, the schedule still opens without a network.
  const SW = `${BASE}?sw=1&now=2027-04-16T05:20:00Z`;
  await laptop.goto(`${SW}#/trip/${tripId}/today/2`);
  await waitText(laptop, '신톈디 산책');
  await laptop.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, { timeout: 15000 })
    .catch(async () => { await laptop.reload(); await laptop.waitForFunction(() => navigator.serviceWorker.controller, { timeout: 15000 }); });
  await laptop.reload();
  await waitText(laptop, '신톈디 산책');
  await laptop.setOfflineMode(true);
  await laptop.reload();
  await waitText(laptop, '신톈디 산책', 15000);
  check('schedule opens offline', (await text(laptop)).includes('오프라인'));
  await laptop.setOfflineMode(false);
} catch (e) {
  check('scenario finished', false, e.message);
  if (lastPage) { console.log('URL', lastPage.url()); console.log((await text(lastPage)).slice(0, 600)); await lastPage.screenshot({ path: `${SHOTS}/fail.png`, fullPage: true }); }
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}
