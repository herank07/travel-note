// Map link for an item. China → Amap, elsewhere → Google Maps; the item's own link wins.
export function mapUrl(item, countryCode) {
  if (item.mapUrl) return item.mapUrl;
  const q = encodeURIComponent(item.localName || item.place || item.title || '');
  if (countryCode === 'CN') return `https://uri.amap.com/search?keyword=${q}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
