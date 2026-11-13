import { h, mount, notice } from './dom.js';
import { createLinkCode } from '../db.js';
import { renderCodeEntry } from './welcome.js';
import { backLink } from './tripShell.js';
import { navigate } from '../router.js';

// Show a short-lived code on this device, or enter one made on another device.
export function renderLink() {
  const codeArea = h('div', {});
  const make = async () => {
    codeArea.replaceChildren(h('p', { class: 'muted' }, '코드를 만드는 중…'));
    try {
      const code = await createLinkCode();
      codeArea.replaceChildren(
        h('div', { class: 'code-box', 'aria-label': '기기 연결 코드' }, code),
        h('p', { class: 'muted' }, '10분 안에 다른 기기의 ‘코드’ 칸에 넣어 주세요.'));
    } catch (e) {
      console.error(e);
      codeArea.replaceChildren(h('p', { class: 'error' }, '코드를 만들지 못했어요. 인터넷 연결을 확인해 주세요.'));
    }
  };
  mount(h('main', { class: 'screen' },
    backLink('#/'),
    h('h1', {}, '기기 연결'),
    h('section', { class: 'card' },
      h('h2', {}, '이 기기에서 코드 만들기'),
      h('p', { class: 'muted' }, '새 휴대폰이나 PC에서 이 코드를 넣으면, 그 기기에서도 내 여행이 모두 보여요.'),
      h('button', { class: 'btn primary block', type: 'button', onclick: make }, '연결 코드 만들기'),
      codeArea),
    renderCodeEntry(() => { notice('연결했어요'); navigate('#/'); location.reload(); }),
  ));
}
