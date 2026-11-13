// Hash routes. parseRoute is pure; navigate/onRoute touch window only when called.

const tripRoutes = {
  next: 'next', journal: 'journal', checklist: 'checklist', members: 'members', edit: 'tripEdit',
};

export function parseRoute(hash) {
  const parts = (hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  const [head, a, b, c] = parts;
  if (!head) return { name: 'trips', params: {} };
  if (head === 'new' && parts.length === 1) return { name: 'tripNew', params: {} };
  if (head === 'link' && parts.length === 1) return { name: 'link', params: {} };
  if (head === 'join' && a) return { name: 'join', params: { code: a.toUpperCase() } };
  if (head === 'trip' && a) {
    if (b === 'today') {
      const day = c === undefined ? null : c === 'none' ? 'none' : Number(c);
      return { name: 'today', params: { tripId: a, day: Number.isNaN(day) ? null : day } };
    }
    if (b === 'item' && c) return { name: 'item', params: { tripId: a, itemId: c } };
    if (tripRoutes[b]) return { name: tripRoutes[b], params: { tripId: a } };
  }
  return { name: 'trips', params: {} };
}

export function navigate(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

export function onRoute(fn) {
  const run = () => fn(parseRoute(location.hash));
  window.addEventListener('hashchange', run);
  run();
}
