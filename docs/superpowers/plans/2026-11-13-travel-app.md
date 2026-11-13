# 여행 노트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone-first static web app where invited trip members plan days, see "what's next" at a glance during the trip, keep a journal and a packing checklist, with no login and nothing visible to strangers.

**Architecture:** Static HTML/CSS/ES-module JS in `site/`, deployed to GitHub Pages by a GitHub Actions workflow (no build step). Data lives in Cloud Firestore; each device signs in with Firebase Anonymous Auth and is mapped to a "person". All access control is enforced by `firestore.rules`, which is tested against the Firestore emulator. Pure logic (time, schedule, map links, codes) lives in DOM-free modules tested with `node --test`.

**Tech Stack:** Firebase JS SDK 10.14.1 loaded as ES modules from `https://www.gstatic.com/firebasejs/10.14.1/`, Cloud Firestore (Spark plan, `asia-northeast3`), Firebase Anonymous Auth, Node.js LTS (dev only: tests, emulator, static server), Java 21 (dev only: emulator), `firebase-tools`, `@firebase/rules-unit-testing`, GitHub Pages via Actions.

**Spec:** Claude Docs doc "여행 일정 앱 기획서" — https://claude.ai/artifact/HLuB9amrNBvYRc2k3qm16W (doc id `84598110-4456-4b58-8df0-d4b0bd988c9f`; read it with the Claude Docs `read` tool). Screen mockups: https://claude.ai/artifact/WMfEjZiYisim4jM1BKvYcd (boards A, B; C is not used).

## Global Constraints

- UI language: Korean only. App name: `여행 노트` (temporary, must be easy to change: one constant).
- No build step. Browser code is plain ES modules; no npm packages are shipped to the browser.
- Firebase JS SDK pinned to `10.14.1`, imported only from `https://www.gstatic.com/firebasejs/10.14.1/…`.
- Firestore location `asia-northeast3` (Seoul), free Spark plan. No paid Firebase products.
- Not in scope: photos, notifications, actual-spend tracking or settlement, KRW conversion, Claude or Google login.
- Strangers (no membership) must not read any trip, item, journal entry, checklist item or invite. Enforced in `firestore.rules`, never only in the UI.
- Only the trip creator (`ownerId`) may delete the trip, remove members, or change the invite code. All members may read and edit everything else in the trip.
- Items and journal entries are stored by day number (`day`, 1-based) or `null` (= "미정"), never by calendar date.
- All item times are trip-local (`trip.timeZone`). Home time zone is `Asia/Seoul`.
- Item categories, exactly: `이동`, `숙소`, `관광`, `식사`, `쇼핑`, `기타`.
- Map link: item's own `mapUrl` if set; otherwise country `CN` → `https://uri.amap.com/search?keyword=<q>`, else `https://www.google.com/maps/search/?api=1&query=<q>`, where `<q>` is `localName || place || title`, URI-encoded.
- Touch targets ≥ 44px. Works at 390px width. Visual style follows the mockups (IBM Plex Sans KR + IBM Plex Mono, cool grey ground, accent `#D23F31`).

## Review Focus

1. Phone clock still on Korea time while in Shanghai → "지금" and "다음 일정" must use `trip.timeZone`, not the device zone (tests in Task 2).
2. Trip length reduced after planning → items on days beyond `trip.days` must appear under "미정", not vanish (test in Task 3).
3. No signal at launch (metro) → last-synced schedule still shows; edits are queued, not lost (manual check in Task 11).
4. Invite code regenerated → the old code and old link must stop working while existing members keep access (rules test in Task 5).
5. Nothing left today (after the last item, or empty day) → no crash; today screen shows "오늘 남은 일정이 없어요" (test in Task 3, UI in Task 8).

---

## File Structure

```
site/                      deployed as-is to GitHub Pages
  index.html               shell, loads js/app.js
  manifest.webmanifest, sw.js, icons/icon-192.png, icons/icon-512.png
  css/app.css              tokens (from mockups) + components
  js/config.js             APP_NAME, HOME_TZ, firebaseConfig, emulator switch
  js/time.js               pure: zone-aware clock, day dates, trip status
  js/schedule.js           pure: sort, group by day, next item, totals, labels
  js/maps.js               pure: map URL
  js/codes.js              pure: invite / link / recovery code generator
  js/firebase.js           SDK init (app, auth, firestore with persistent cache)
  js/db.js                 all Firestore reads/writes
  js/router.js             hash routes
  js/ui/*.js               one file per screen (see tasks)
  js/app.js                boot: auth → person check → route
tests/unit/*.test.js       node --test
tests/rules/*.test.js      node --test against the Firestore emulator
firestore.rules, firebase.json, .firebaserc, package.json, .gitignore
.github/workflows/pages.yml
```

## Firestore Data Model (used by Tasks 4–10)

| Path | Fields |
| --- | --- |
| `people/{personId}` | `name`, `createdAt`. `personId` = uid of the person's first device |
| `devices/{uid}` | `personId`, `via` (`'self'` \| `'link'` \| `'recovery'`), `code` (when via link/recovery) |
| `linkCodes/{code}` | `personId`, `expiresAt` (now + 10 min) |
| `recoveryCodes/{code}` | `personId` (one per person, shown once at registration) |
| `inviteCodes/{code}` | `tripId` |
| `trips/{tripId}` | `name`, `destination`, `fromCode`, `toCode`, `startDate` (`'YYYY-MM-DD'`\|null), `days` (int\|null), `timeZone`, `countryCode`, `currency`, `notes`, `ownerId`, `memberIds` (personId[]), `createdAt` |
| `trips/{tripId}/private/invite` | `code` (owner-only) |
| `trips/{tripId}/joins/{personId}` | `code` (the code used to join) |
| `trips/{tripId}/items/{id}` | `day`, `start`, `end` (`'HH:MM'`\|null), `title`, `place`, `localName`, `localAddress`, `transit`, `mapUrl`, `category`, `cost` (number\|null), `memo`, `done` |
| `trips/{tripId}/journal/{id}` | `day`, `title`, `body`, `authorId`, `updatedAt` |
| `trips/{tripId}/checklist/{id}` | `name`, `checked`, `order` |

---

### Task 1: Tooling and skeleton

**Files:**
- Create: `package.json`, `.gitignore`, `firebase.json`, `.firebaserc`, `site/index.html`, `tests/unit/smoke.test.js`

**Interfaces:**
- Produces: `npm test` (unit), `npm run test:rules` (emulator), `npm run serve` (static server on 8080).

- [ ] **Step 1: Install dev tools (ask the user first; they run or approve)**

Run: `winget install OpenJS.NodeJS.LTS` and `winget install Microsoft.OpenJDK.21`, reopen the shell.
Expected: `node --version` ≥ v20, `java -version` ≥ 21.

- [ ] **Step 2: `git init`, set `user.name`/`user.email` with the user, create files**

`package.json` (`"type": "module"`, devDependencies `firebase-tools`, `@firebase/rules-unit-testing`, `firebase` (Node-side SDK for rules tests only), `http-server`), scripts:
`"test": "node --test tests/unit/"`, `"test:rules": "firebase emulators:exec --only firestore --project demo-travel \"node --test tests/rules/\""`, `"serve": "http-server site -p 8080 -c-1"`, `"emulators": "firebase emulators:start --only firestore,auth --project demo-travel"`.
`firebase.json`: firestore rules `firestore.rules`, emulators firestore 8081, auth 9099. `.gitignore`: `node_modules/`, `.superpowers/`, `*.log`.
`site/index.html`: `<html lang="ko">`, title `여행 노트`, loads `js/app.js` as module.

- [ ] **Step 3: Smoke test** `tests/unit/smoke.test.js` asserts `1 + 1 === 2`; run `npm test` → 1 passing.

- [ ] **Step 4: Commit** `chore: tooling and skeleton`

---

### Task 2: time.js

**Files:** Create `site/js/time.js`, `tests/unit/time.test.js`

**Interfaces:**
- Produces:
  - `localParts(date: Date, timeZone: string) -> { ymd: string, minutes: number }`
  - `formatHM(minutes: number) -> 'HH:MM'`
  - `addDays(ymd: string, n: number) -> string`
  - `dayDate(trip, day: number) -> string | null` (null when `trip.startDate` is null)
  - `tripStatus(trip, todayYmd: string) -> {kind:'undated'} | {kind:'before', dday:number} | {kind:'during', day:number} | {kind:'after'}`
  - `statusLabel(status) -> string`

- [ ] **Step 1: Write failing tests**

```js
const t = new Date('2027-04-16T05:20:00Z');
assert.deepEqual(localParts(t, 'Asia/Shanghai'), { ymd: '2027-04-16', minutes: 800 });
assert.deepEqual(localParts(t, 'Asia/Seoul'), { ymd: '2027-04-16', minutes: 860 });
assert.deepEqual(localParts(new Date('2027-04-15T16:30:00Z'), 'Asia/Shanghai'), { ymd: '2027-04-16', minutes: 30 });
assert.equal(formatHM(800), '13:20');
assert.equal(addDays('2027-02-27', 2), '2027-03-01');
const trip = { startDate: '2027-04-15', days: 4 };
assert.equal(dayDate(trip, 2), '2027-04-16');
assert.equal(dayDate({ startDate: null, days: 4 }, 2), null);
assert.deepEqual(tripStatus(trip, '2027-04-16'), { kind: 'during', day: 2 });
assert.deepEqual(tripStatus(trip, '2027-04-18'), { kind: 'during', day: 4 });
assert.deepEqual(tripStatus(trip, '2027-03-16'), { kind: 'before', dday: 30 });
assert.deepEqual(tripStatus(trip, '2027-04-19'), { kind: 'after' });
assert.deepEqual(tripStatus({ startDate: null, days: 4 }, '2027-04-16'), { kind: 'undated' });
assert.deepEqual(tripStatus({ startDate: '2027-04-15', days: null }, '2027-04-16'), { kind: 'undated' });
assert.equal(statusLabel({ kind: 'before', dday: 30 }), 'D-30');
assert.equal(statusLabel({ kind: 'during', day: 2 }), '2일차');
assert.equal(statusLabel({ kind: 'after' }), '다녀옴');
assert.equal(statusLabel({ kind: 'undated' }), '날짜 미정');
```

- [ ] **Step 2: Run `npm test`** → FAIL (module missing)
- [ ] **Step 3: Implement** with `Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts`; date math in UTC (`Date.UTC`) so the device zone never matters.
- [ ] **Step 4: Run `npm test`** → PASS
- [ ] **Step 5: Commit** `feat: zone-aware time helpers`

---

### Task 3: schedule.js, maps.js, codes.js

**Files:** Create `site/js/schedule.js`, `site/js/maps.js`, `site/js/codes.js`, `tests/unit/schedule.test.js`, `tests/unit/maps.test.js`, `tests/unit/codes.test.js`

**Interfaces:**
- Produces:
  - `toMinutes('HH:MM') -> number`
  - `sortItems(items) -> Item[]` (by `start` asc; `start: null` last; ties by `title`)
  - `groupByDay(items, days: number|null) -> { byDay: Map<number, Item[]>, undecided: Item[] }` (sorted lists; `day` null, < 1, or > `days` when `days` is set → `undecided`)
  - `findNext(dayItems, nowMinutes) -> { next: Item|null, inProgress: Item[] }` (next = first item with `start > now`; inProgress = `start <= now < end`)
  - `isPast(item, nowMinutes) -> boolean` (`start !== null && start <= now` and not in progress)
  - `untilLabel(diffMinutes) -> string`
  - `costTotals(items) -> { total: number, byDay: Map<number|null, number> }` (null costs ignored)
  - `mapUrl(item, countryCode) -> string`
  - `generateCode(length = 8, fillRandom = crypto.getRandomValues.bind(crypto)) -> string` over alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`

- [ ] **Step 1: Write failing tests**

```js
const a = { id:'a', day:2, start:'09:00', end:null, title:'아침', cost:15 };
const b = { id:'b', day:2, start:'14:00', end:'16:00', title:'신톈디', cost:null };
const c = { id:'c', day:2, start:null, end:null, title:'숙소 휴식', cost:null };
const d = { id:'d', day:5, start:'10:00', end:null, title:'톈쯔팡', cost:40 };
const e = { id:'e', day:null, start:null, end:null, title:'예원', cost:null };
assert.deepEqual(sortItems([c, b, a]).map(i => i.id), ['a', 'b', 'c']);
const g = groupByDay([a, b, c, d, e], 4);
assert.deepEqual(g.byDay.get(2).map(i => i.id), ['a', 'b', 'c']);
assert.deepEqual(g.undecided.map(i => i.id).sort(), ['d', 'e']);          // day 5 > 4 days
assert.deepEqual(findNext([a, b, c], 800), { next: b, inProgress: [] });   // 13:20
assert.deepEqual(findNext([a, b, c], 870), { next: null, inProgress: [b] }); // 14:30
assert.deepEqual(findNext([], 800), { next: null, inProgress: [] });
assert.equal(isPast(a, 800), true);
assert.equal(isPast(b, 870), false);
assert.equal(untilLabel(40), '40분 후');
assert.equal(untilLabel(60), '1시간 후');
assert.equal(untilLabel(130), '2시간 10분 후');
assert.equal(costTotals([a, b, d]).total, 55);
assert.equal(mapUrl({ title:'신톈디 산책', localName:'新天地' }, 'CN'), 'https://uri.amap.com/search?keyword=%E6%96%B0%E5%A4%A9%E5%9C%B0');
assert.equal(mapUrl({ title:'Shibuya' }, 'JP'), 'https://www.google.com/maps/search/?api=1&query=Shibuya');
assert.equal(mapUrl({ title:'x', mapUrl:'https://example.com/m' }, 'CN'), 'https://example.com/m');
assert.equal(generateCode(8, arr => arr.fill(0)), 'AAAAAAAA');
assert.match(generateCode(), /^[A-HJ-NP-Z2-9]{8}$/);
```

- [ ] **Step 2: Run `npm test`** → FAIL
- [ ] **Step 3: Implement** the three modules (no DOM, no Firebase imports).
- [ ] **Step 4: Run `npm test`** → PASS
- [ ] **Step 5: Commit** `feat: schedule, map link and code helpers`

---

### Task 4: Security rules — people, devices, trips

**Files:** Create `firestore.rules`, `tests/rules/setup.js`, `tests/rules/people.test.js`

**Interfaces:**
- Produces rule helpers used by Task 5: `signedIn()`, `me()` (= `get(/devices/$(request.auth.uid)).data.personId`), `isMember(tripId)`, `isOwner(tripId)`.
- `tests/rules/setup.js` exports `makeEnv()` (initializeTestEnvironment, projectId `demo-travel`, rules from file) and `register(env, uid, name)` that seeds `people/{uid}` + `devices/{uid}` with rules disabled.

- [ ] **Step 1: Write failing tests** (`assertSucceeds` / `assertFails`):
  - `self registration`: uid U creates `people/U` and `devices/U {personId:'U', via:'self'}` → succeeds; creating `people/X` or `devices/U {personId:'X', via:'self'}` → fails.
  - `link`: seed `linkCodes/C {personId:'P', expiresAt: now+10min}`; new uid N creates `devices/N {personId:'P', via:'link', code:'C'}` → succeeds; with expired code or wrong personId → fails.
  - `recovery`: seed `recoveryCodes/R {personId:'P'}`; `devices/N {personId:'P', via:'recovery', code:'R'}` → succeeds; unknown code → fails.
  - `linkCodes` create only for your own `personId`; `recoveryCodes` create only for your own `personId` and only if absent.
  - `people` readable by any registered device; unregistered uid cannot read.
  - `trips`: registered P creates trip with `ownerId:'P', memberIds:['P']` → succeeds; with `ownerId` of someone else or `memberIds` not exactly `[me]` → fails.
  - stranger S (registered, not member) `get trips/T` → fails; member → succeeds; `list` trips `where('memberIds','array-contains', me)` → succeeds for P, returns only P's trips.
  - member edits `name`/`startDate` → succeeds; member changes `ownerId` or `memberIds` → fails; member delete → fails; owner delete → succeeds.
- [ ] **Step 2: Run `npm run test:rules`** → FAIL
- [ ] **Step 3: Write `firestore.rules`** to satisfy them (rules_version 2; default deny).
- [ ] **Step 4: Run `npm run test:rules`** → PASS
- [ ] **Step 5: Commit** `feat: rules for people, devices and trips`

---

### Task 5: Security rules — invites, joining, trip contents

**Files:** Modify `firestore.rules`; Create `tests/rules/trip.test.js`

**Interfaces:**
- Consumes: Task 4 helpers.
- Produces the join protocol Task 6 implements: one batched write that (1) sets `trips/T/joins/{me} {code}` and (2) updates `trips/T.memberIds` to `old + [me]`. The trip-update rule allows a non-member exactly this change when `getAfter(joins/{me}).data.code == get(private/invite).data.code`.

- [ ] **Step 1: Write failing tests:**
  - `inviteCodes/{code}`: `get` by any registered device succeeds; `list` fails; create/delete only by the owner of `tripId`.
  - `private/invite`: owner reads/writes; member and stranger fail.
  - join with the current code (batched) → succeeds; with a wrong code → fails; adding anyone other than yourself → fails.
  - after owner changes `private/invite.code` and swaps `inviteCodes` docs: join with the old code → fails; existing member still reads `trips/T` → succeeds. (Review Focus 4)
  - owner removes a member from `memberIds` → succeeds; that person then fails to read `trips/T` and `trips/T/items/*`.
  - owner adds a past companion's personId directly → succeeds; a non-owner member doing the same → fails.
  - `items`, `journal`, `checklist`: member create/update/delete → succeeds; stranger get/list/create → fails. Journal `authorId` must equal `me()` on create.
- [ ] **Step 2: Run `npm run test:rules`** → FAIL
- [ ] **Step 3: Extend `firestore.rules`.**
- [ ] **Step 4: Run `npm run test:rules`** → PASS (all of Task 4 too)
- [ ] **Step 5: Commit** `feat: rules for invites, joining and trip contents`

---

### Task 6: Firebase bootstrap, data layer, entry screens

**Files:** Create `site/js/config.js`, `site/js/firebase.js`, `site/js/db.js`, `site/js/router.js`, `site/js/app.js`, `site/js/ui/welcome.js`, `site/css/app.css`

**Interfaces:**
- `config.js`: `APP_NAME = '여행 노트'`, `HOME_TZ = 'Asia/Seoul'`, `firebaseConfig` (placeholder until Task 11), `USE_EMULATOR = location.hostname === 'localhost'`.
- `firebase.js`: exports `auth`, `db`, `ready: Promise<User>` (anonymous sign-in; Firestore with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`; emulator connect when `USE_EMULATOR`).
- `db.js` exports (all async unless noted):
  `getMyPersonId()`, `registerPerson(name) -> { personId, recoveryCode }`, `createLinkCode() -> code`, `useLinkCode(code)`, `useRecoveryCode(code)`,
  `watchMyTrips(cb) -> unsubscribe`, `createTrip(fields) -> tripId` (also creates invite code docs), `updateTrip(tripId, fields)`, `deleteTrip(tripId)`,
  `getPeople(ids) -> Map<id, name>`, `getInvite(tripId) -> code`, `regenerateInvite(tripId) -> code`, `joinByCode(code) -> tripId`, `removeMember(tripId, personId)`, `addMember(tripId, personId)`,
  `watchItems(tripId, cb)`, `saveItem(tripId, item)`, `deleteItem(tripId, id)`,
  `watchJournal(tripId, cb)`, `saveEntry(tripId, entry)`, `deleteEntry(tripId, id)`,
  `watchChecklist(tripId, cb)`, `saveCheck(tripId, row)`, `deleteCheck(tripId, id)`, `copyChecklist(fromTripId, toTripId)`.
- `router.js`: routes `#/` (trips), `#/trip/{id}/today[/{day}]`, `#/trip/{id}/item/{itemId}`, `#/trip/{id}/journal`, `#/trip/{id}/checklist`, `#/trip/{id}/members`, `#/join/{code}`, `#/link`. `navigate(hash)`, `onRoute(fn)`.
- `ui/welcome.js`: name entry (first open), shows the recovery code once ("이 코드를 저장해 두세요"), "초대 코드 입력", "다른 기기와 연결 코드 입력".

- [ ] **Step 1: Implement**; `app.js` boot: await `ready` → no person → welcome; pending `#/join/{code}` handled after registration.
- [ ] **Step 2: Manual check** — `npm run emulators` + `npm run serve`, open `http://localhost:8080` at 390px width:
  first open shows name entry → after entering, recovery code is shown once → trips screen (empty state). In a second browser profile, entering the recovery code shows the same person.
- [ ] **Step 3: Run `npm test` and `npm run test:rules`** → PASS
- [ ] **Step 4: Commit** `feat: firebase bootstrap, data layer and welcome flow`

---

### Task 7: Trip list and trip form

**Files:** Create `site/js/ui/trips.js`, `site/js/ui/tripForm.js`; Modify `site/css/app.css`

**Interfaces:** Consumes `watchMyTrips`, `createTrip`, `updateTrip`, `deleteTrip`, `tripStatus`, `statusLabel`, `localParts`.

- [ ] **Step 1: Implement.** List shows only my trips (name, destination, status label, dates or "날짜 미정"), sorted: during → before (soonest first) → undated → after. "+ 새 여행" opens the form (name, destination, from/to code, start date optional, days optional, time zone select with `Asia/Shanghai` default for CN, country code, currency, notes). Delete appears only for the owner and asks for confirmation in the page.
  On boot, if a trip has status `during`, open `#/trip/{id}/today` directly.
- [ ] **Step 2: Manual check:** create "2027 상하이" with no dates → label "날짜 미정"; set start 2027-04-15 / 4 days → "D-…"; a non-owner (second profile, joined later in Task 10) sees no delete button.
- [ ] **Step 3: Commit** `feat: trip list and trip form`

---

### Task 8: Today screen (B), next item (A), show-to-driver

**Files:** Create `site/js/ui/today.js`, `site/js/ui/nextItem.js`; Modify `site/css/app.css`

**Interfaces:** Consumes `watchItems`, `groupByDay`, `findNext`, `isPast`, `untilLabel`, `costTotals`, `localParts`, `formatHM`, `dayDate`, `mapUrl`, `HOME_TZ`.

- [ ] **Step 1: Implement per mockup B/A.** Header: trip name, "N일차" (+ date/weekday when known), clock line `상하이 13:20 · 한국 14:20` (trip zone name from a small map `{'Asia/Shanghai':'상하이'}`, fallback to the zone's city). Day chips `1일차…N일차` + `미정`. Timeline with "지금" line (only on today's day), past items dimmed with check, in-progress items marked "진행 중", next item outlined with `untilLabel`. Done toggle per item. "N개 중 M개 끝남 · 이날 예상 ¥X · 여행 전체 ¥Y" from `costTotals`, with the trip currency symbol. Empty or finished day → "오늘 남은 일정이 없어요" (Review Focus 5). Re-render every 60 s.
  Before/after trip or undated → open day 1 (or "미정" if no days), show D-day banner before the trip.
  Tapping the next item → `nextItem.js` (big card A: time, title, localName, transit, memo, buttons "지도 열기" = `mapUrl`, "기사님께 보여주기" = full-screen overlay with `localName` and `localAddress` in large type, falling back to `title`).
- [ ] **Step 2: Manual check** with seeded items from Task 3's example (day 2: 09:00, 10:00, 12:00, 14:00–16:00, 16:30, 19:00, 21:00) and the device clock left on Korea time: at a simulated Shanghai 13:20 (temporary `?now=2027-04-16T05:20:00Z` query param read only when `USE_EMULATOR`), next = 14:00, label "40분 후", header shows `상하이 13:20 · 한국 14:20`.
- [ ] **Step 3: Commit** `feat: today timeline and next item views`

---

### Task 9: Item form

**Files:** Create `site/js/ui/itemForm.js`

**Interfaces:** Consumes `saveItem`, `deleteItem`; categories from Global Constraints.

- [ ] **Step 1: Implement** add/edit sheet: day (`1…days` or `미정`), start/end time (optional), title (required), place, localName, localAddress, transit, mapUrl, category, cost (number, trip currency), memo. Delete with in-page confirm. Opens from "+" on today screen (pre-selects the shown day) and from tapping any item.
- [ ] **Step 2: Manual check:** add an item without a time → it appears at the bottom of its day; change trip days from 4 to 3 → day-4 items show under "미정" (Review Focus 2); turn the network off in DevTools, edit an item, turn it back on → the change syncs.
- [ ] **Step 3: Commit** `feat: item add, edit and delete`

---

### Task 10: Journal, checklist, members and devices

**Files:** Create `site/js/ui/journal.js`, `site/js/ui/checklist.js`, `site/js/ui/members.js`, `site/js/ui/link.js`

**Interfaces:** Consumes the journal/checklist/invite/member/link functions of `db.js`, `getPeople`.

- [ ] **Step 1: Implement.** Journal: entries grouped by day (newest day first), title + body, author name, edit/delete. Checklist: add/rename/check/delete/reorder; when empty, offer "지난 여행에서 가져오기" listing my other trips (copies names unchecked). Members: member names; owner sees invite code + link `…/#/join/{code}` with copy button, "코드 바꾸기", "내보내기" per member, and "함께했던 사람 추가" (people from my other trips not in this trip). Link screen (`#/link`): "이 기기에서 코드 만들기" shows a code valid 10 min; "코드 입력" on another device.
- [ ] **Step 2: Manual check** with two browser profiles: owner invites → second profile joins via link and sees only that trip; owner regenerates code → a third profile cannot join with the old link; owner removes the second profile → its trip disappears; device link moves the owner's identity to a third profile and all trips appear.
- [ ] **Step 3: Run `npm run test:rules`** → PASS
- [ ] **Step 4: Commit** `feat: journal, checklist, members and device linking`

---

### Task 11: PWA, deploy, real project, Shanghai trip

**Files:** Create `site/manifest.webmanifest`, `site/sw.js`, `site/icons/*`, `.github/workflows/pages.yml`; Modify `site/index.html`, `site/js/config.js`, `.firebaserc`

- [ ] **Step 1: PWA.** Manifest (`name`/`short_name` = `APP_NAME`, `display: standalone`, theme `#F3F5F7`). `sw.js`: cache-first for same-origin shell files and the pinned gstatic SDK files, network for everything else; bump a `CACHE_VERSION` constant on each release. Offline banner "오프라인이에요. 연결되면 저장돼요" from `navigator.onLine`.
- [ ] **Step 2: Manual check** (Review Focus 3): load once, go offline in DevTools, reload → app opens and today's schedule shows from cache.
- [ ] **Step 3: User setup, guided step by step** (the user clicks; you explain):
  1. Firebase console → new project (no Analytics) → Build › Authentication → enable **Anonymous**.
  2. Firestore → create database, location `asia-northeast3`, production mode.
  3. Project settings → add Web app → copy `firebaseConfig` into `site/js/config.js`; set project id in `.firebaserc`.
  4. `npx firebase login` then `npx firebase deploy --only firestore:rules`.
  5. GitHub → create account if needed → new public repo → push → Settings › Pages › Source: GitHub Actions.
  6. Firebase Auth › Settings › Authorized domains → add `<user>.github.io`.
- [ ] **Step 4: `pages.yml`**: on push to `main`, `actions/upload-pages-artifact` with `path: site`, then `actions/deploy-pages`. Push → the site loads at `https://<user>.github.io/<repo>/`.
- [ ] **Step 5: Seed the Shanghai trip** through the app on the user's device: name `2027 상하이`, destination `상하이, 중국`, `ICN → PVG`, start date and days empty, `Asia/Shanghai`, `CN`, `CNY`.
- [ ] **Step 6: Phone check with the user:** add to home screen; open from the icon; recovery code saved; link the PC via device code.
- [ ] **Step 7: Commit and push** `feat: pwa and deployment`
