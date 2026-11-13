export const APP_NAME = '여행 노트';
export const HOME_TZ = 'Asia/Seoul';
export const HOME_LABEL = '한국';
export const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';

export const USE_EMULATOR = typeof location !== 'undefined'
  && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

// Public web config of the real project (not a secret; access is enforced by firestore.rules).
const LIVE_CONFIG = {
  apiKey: 'AIzaSyAC55GfWgYRPRmlJf7LoQZ8BQQ6Ue-NFDo',
  authDomain: 'travel-note-34457.firebaseapp.com',
  projectId: 'travel-note-34457',
  storageBucket: 'travel-note-34457.firebasestorage.app',
  messagingSenderId: '124693633778',
  appId: '1:124693633778:web:e3e96f4912b6acb4114e6b',
};

// On this PC (localhost) the app talks to the local emulators instead.
const EMULATOR_CONFIG = {
  apiKey: 'demo-key', authDomain: 'demo-travel.firebaseapp.com', projectId: 'demo-travel', appId: 'demo-app',
};

export const firebaseConfig = USE_EMULATOR ? EMULATOR_CONFIG : LIVE_CONFIG;

export const CATEGORIES = ['이동', '숙소', '관광', '식사', '쇼핑', '기타'];

export const ZONES = [
  { id: 'Asia/Shanghai', label: '상하이' },
  { id: 'Asia/Seoul', label: '서울' },
  { id: 'Asia/Tokyo', label: '도쿄' },
  { id: 'Asia/Taipei', label: '타이베이' },
  { id: 'Asia/Hong_Kong', label: '홍콩' },
  { id: 'Asia/Bangkok', label: '방콕' },
  { id: 'Asia/Ho_Chi_Minh', label: '호찌민' },
  { id: 'Asia/Singapore', label: '싱가포르' },
  { id: 'Europe/London', label: '런던' },
  { id: 'Europe/Paris', label: '파리' },
  { id: 'America/New_York', label: '뉴욕' },
  { id: 'America/Los_Angeles', label: '로스앤젤레스' },
];

export const CURRENCY_SYMBOLS = { CNY: '¥', JPY: '¥', KRW: '₩', USD: '$', EUR: '€', GBP: '£', TWD: 'NT$', HKD: 'HK$', THB: '฿', VND: '₫', SGD: 'S$' };

export function zoneLabel(id) {
  const z = ZONES.find((x) => x.id === id);
  return z ? z.label : id.split('/').pop().replace(/_/g, ' ');
}
