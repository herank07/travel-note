import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapUrl } from '../../site/js/maps.js';

test('China uses Amap with the local name', () => {
  assert.equal(mapUrl({ title: '신톈디 산책', localName: '新天地' }, 'CN'), 'https://uri.amap.com/search?keyword=%E6%96%B0%E5%A4%A9%E5%9C%B0');
});
test('other countries use Google Maps', () => {
  assert.equal(mapUrl({ title: 'Shibuya' }, 'JP'), 'https://www.google.com/maps/search/?api=1&query=Shibuya');
});
test('an item map link wins', () => {
  assert.equal(mapUrl({ title: 'x', mapUrl: 'https://example.com/m' }, 'CN'), 'https://example.com/m');
});
