// Zone-aware time helpers. Pure: no DOM, no Firebase.
// Dates are 'YYYY-MM-DD' strings; date math is done in UTC so the device zone never matters.

const formatters = new Map();

function formatterFor(timeZone) {
  let f = formatters.get(timeZone);
  if (!f) {
    const options = {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    };
    try {
      f = new Intl.DateTimeFormat('en-CA', { ...options, timeZone });
    } catch {
      // An unknown zone must not break the screen; fall back to Seoul.
      f = new Intl.DateTimeFormat('en-CA', { ...options, timeZone: 'Asia/Seoul' });
    }
    formatters.set(timeZone, f);
  }
  return f;
}

export function localParts(date, timeZone) {
  const p = {};
  for (const part of formatterFor(timeZone).formatToParts(date)) p[part.type] = part.value;
  return { ymd: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export function formatHM(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toUTC(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(ymd, n) {
  return new Date(toUTC(ymd) + n * 86400000).toISOString().slice(0, 10);
}

function diffDays(fromYmd, toYmd) {
  return Math.round((toUTC(toYmd) - toUTC(fromYmd)) / 86400000);
}

export function dayDate(trip, day) {
  return trip.startDate ? addDays(trip.startDate, day - 1) : null;
}

export function tripStatus(trip, todayYmd) {
  if (!trip.startDate || !trip.days) return { kind: 'undated' };
  const offset = diffDays(trip.startDate, todayYmd);
  if (offset < 0) return { kind: 'before', dday: -offset };
  if (offset >= trip.days) return { kind: 'after' };
  return { kind: 'during', day: offset + 1 };
}

export function statusLabel(status) {
  switch (status.kind) {
    case 'before': return `D-${status.dday}`;
    case 'during': return `${status.day}일차`;
    case 'after': return '다녀옴';
    default: return '날짜 미정';
  }
}
