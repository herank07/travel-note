import { h, mount, field } from './dom.js';
import { registerPerson, useLinkCode, useRecoveryCode } from '../db.js';
import { APP_NAME } from '../config.js';

// First open on a device: become a new person, or connect to an existing one.
export function renderWelcome(onDone) {
  const error = h('p', { class: 'error', role: 'alert' });
  const name = h('input', { id: 'name', autocomplete: 'nickname', maxlength: 30, placeholder: '예: 혜원' });

  const start = async (e) => {
    e.preventDefault();
    const value = name.value.trim();
    if (!value) { error.textContent = '이름을 적어 주세요.'; return; }
    try {
      const { recoveryCode } = await registerPerson(value);
      renderRecovery(recoveryCode, onDone);
    } catch (err) {
      console.error(err);
      error.textContent = '등록하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.';
    }
  };

  mount(h('main', { class: 'screen' },
    h('h1', {}, APP_NAME),
    h('p', { class: 'muted' }, '여행 일정과 기록을 함께 쓰는 곳이에요. 처음이면 이름만 적으면 돼요.'),
    h('form', { class: 'card form', onsubmit: start },
      field('내 이름', name),
      h('button', { class: 'btn primary block', type: 'submit' }, '시작하기'),
      error),
    renderCodeEntry(onDone),
  ));
  name.focus();
}

// Connect this device to an existing person with a device-link or recovery code.
export function renderCodeEntry(onDone) {
  const error = h('p', { class: 'error', role: 'alert' });
  const code = h('input', { id: 'device-code', autocapitalize: 'characters', autocomplete: 'one-time-code', placeholder: '연결 코드 또는 복구 코드' });
  const submit = async (e) => {
    e.preventDefault();
    const value = code.value.trim().toUpperCase();
    if (!value) return;
    try {
      if (value.length <= 6) await useLinkCode(value); else await useRecoveryCode(value);
      onDone();
    } catch (err) {
      console.error(err);
      error.textContent = err.message.startsWith('코드') || err.message.startsWith('시간') ? err.message : '연결하지 못했어요. 코드를 다시 확인해 주세요.';
    }
  };
  return h('form', { class: 'card form', onsubmit: submit },
    h('h2', {}, '이미 쓰던 사람이에요'),
    h('p', { class: 'muted' }, '다른 기기에서 만든 연결 코드나, 처음에 받은 복구 코드를 넣으면 내 여행이 그대로 보여요.'),
    field('코드', code),
    h('button', { class: 'btn block', type: 'submit' }, '이 기기 연결하기'),
    error);
}

function renderRecovery(code, onDone) {
  mount(h('main', { class: 'screen' },
    h('h1', {}, '복구 코드를 저장해 두세요'),
    h('p', {}, '휴대폰을 잃어버리거나 브라우저 데이터를 지우면, 이 코드로 내 여행을 되찾을 수 있어요. 지금 한 번만 보여 드려요.'),
    h('div', { class: 'code-box', 'aria-label': '복구 코드' }, code),
    h('p', { class: 'muted' }, '사진으로 찍거나 메모 앱에 적어 두세요.'),
    h('button', { class: 'btn primary block', type: 'button', onclick: onDone }, '저장했어요'),
  ));
}
