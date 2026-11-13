// Tiny DOM helpers. Text always goes in as text nodes, never as HTML.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = Boolean(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function mount(...children) {
  const root = document.getElementById('app');
  root.replaceChildren();
  append(root, children);
  window.scrollTo(0, 0);
}

let noticeTimer;
export function notice(text) {
  document.querySelector('.notice')?.remove();
  const el = h('div', { class: 'notice', role: 'status' }, text);
  document.body.append(el);
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => el.remove(), 3000);
}

export function field(label, input) {
  return h('label', { class: 'field' }, h('span', {}, label), input);
}

// In-page confirmation (the browser confirm() dialog is not used).
export function confirmButton(label, question, onYes) {
  const wrap = h('div', { class: 'row' });
  const ask = () => {
    wrap.replaceChildren(
      h('p', { style: 'flex-basis:100%' }, question),
      h('button', { type: 'button', class: 'btn danger', onclick: onYes }, '네, ' + label),
      h('button', { type: 'button', class: 'btn', onclick: reset }, '취소'),
    );
  };
  const reset = () => wrap.replaceChildren(h('button', { type: 'button', class: 'btn danger block', onclick: ask }, label));
  reset();
  return wrap;
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); notice('복사했어요'); }
  catch { notice('복사가 안 돼요. 길게 눌러서 복사해 주세요'); }
}
