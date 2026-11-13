// Day-schedule logic. Pure: no DOM, no Firebase.
// Item: { id, day: number|null, start: 'HH:MM'|null, end: 'HH:MM'|null, title, cost: number|null, ... }

export function toMinutes(hm) {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

export function sortItems(items) {
  return [...items].sort((x, y) => {
    if (x.start === y.start) return (x.title || '').localeCompare(y.title || '', 'ko');
    if (x.start === null) return 1;
    if (y.start === null) return -1;
    return toMinutes(x.start) - toMinutes(y.start);
  });
}

export function groupByDay(items, days) {
  const byDay = new Map();
  const undecided = [];
  for (const item of items) {
    const d = item.day;
    if (d === null || d === undefined || d < 1 || (days && d > days)) undecided.push(item);
    else {
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(item);
    }
  }
  for (const [d, list] of byDay) byDay.set(d, sortItems(list));
  return { byDay, undecided: sortItems(undecided) };
}

function inProgressAt(item, now) {
  return item.start !== null && item.end !== null && item.end !== undefined
    && toMinutes(item.start) <= now && now < toMinutes(item.end);
}

export function findNext(dayItems, nowMinutes) {
  const sorted = sortItems(dayItems);
  const next = sorted.find(i => i.start !== null && toMinutes(i.start) > nowMinutes) || null;
  const inProgress = sorted.filter(i => inProgressAt(i, nowMinutes));
  return { next, inProgress };
}

export function isPast(item, nowMinutes) {
  return item.start !== null && toMinutes(item.start) <= nowMinutes && !inProgressAt(item, nowMinutes);
}

export function untilLabel(diff) {
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m}분 후`;
  if (m === 0) return `${h}시간 후`;
  return `${h}시간 ${m}분 후`;
}

export function costTotals(items) {
  const byDay = new Map();
  let total = 0;
  for (const item of items) {
    if (typeof item.cost !== 'number') continue;
    total += item.cost;
    const key = item.day ?? null;
    byDay.set(key, (byDay.get(key) || 0) + item.cost);
  }
  return { total, byDay };
}

// Where the "지금" line goes in a sorted day list: after every item that has started.
export function nowIndex(sorted, nowMinutes) {
  return sorted.filter((i) => i.start !== null && toMinutes(i.start) <= nowMinutes).length;
}

// The day the timeline opens on when the URL names none.
export function defaultDay(status, days, items) {
  if (status.kind === 'during') return status.day;
  if (days) return 1;
  const numbered = items.map((i) => i.day).filter((d) => Number.isInteger(d) && d >= 1);
  return numbered.length ? Math.min(...numbered) : 'none';
}

// What the big card shows: the next item, or the one running when nothing is left to start.
export function focusItem(dayItems, nowMinutes) {
  const { next, inProgress } = findNext(dayItems, nowMinutes);
  if (next) return { item: next, kind: 'next' };
  if (inProgress.length) return { item: inProgress[inProgress.length - 1], kind: 'running' };
  return { item: null, kind: null };
}
