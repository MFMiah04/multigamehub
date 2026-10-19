import { html, render, nothing } from 'lit-html';
import { serverNow } from './firebase.js';
import { avatar } from './avatar.js';

export { html, nothing, avatar };

export function playerTag(player, { you, host, extra } = {}) {
  return html`<span class="tag wobble">${avatar(player, 22)}<span>${player.name}</span>
    ${you ? html`<small>(you)</small>` : nothing}
    ${host ? html`<small class="hl">host</small>` : nothing}
    ${extra ? html`<small>${extra}</small>` : nothing}</span>`;
}

export function button(label, onClick, { kind = 'yellow', disabled = false, small = false } = {}) {
  return html`<button class="btn btn--${kind} ${small ? 'btn--small' : ''} wobble" ?disabled=${disabled} @click=${onClick}>${label}</button>`;
}

export function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function timer(endsAt, warnAt = 30) {
  if (!endsAt) return nothing;
  const left = endsAt - serverNow();
  return html`<div class="timer ${left <= warnAt * 1000 ? 'timer--warn' : ''}">${formatTime(left)}</div>`;
}

export function selectField(label, value, options, onChange, disabled) {
  return html`<label class="field">
    <span>${label}</span>
    <select class="wobble" ?disabled=${disabled} @change=${e => onChange(e.target.value)}>
      ${options.map(([v, text]) => html`<option value=${v} ?selected=${String(v) === String(value)}>${text}</option>`)}
    </select>
  </label>`;
}

export function progress(done, total, verb) {
  return html`<p class="note center">${done} of ${total} ${verb}</p>`;
}

// ----- overlays -----

const overlayRoot = document.getElementById('overlay');

export function confirmDialog(message, okLabel = 'Yes', kind = 'pink', showCancel = true) {
  return new Promise(resolve => {
    const close = answer => { render(nothing, overlayRoot); resolve(answer); };
    render(html`<div class="dialog-backdrop" @click=${e => e.target === e.currentTarget && close(false)}>
      <div class="dialog wobble" role="dialog" aria-modal="true">
        <div class="dialog__body">${message}</div>
        <div class="row">
          ${showCancel ? button('Cancel', () => close(false), { kind: 'white' }) : nothing}
          ${button(okLabel, () => close(true), { kind })}
        </div>
      </div>
    </div>`, overlayRoot);
  });
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('toast--show'), 3200);
}

// Wraps a click handler: blocks double taps and shows a friendly error if it fails.
const busy = new Set();
export function action(fn) {
  return async e => {
    const target = e?.currentTarget;
    if (busy.has(fn)) return;
    busy.add(fn);
    if (target) target.disabled = true;
    try {
      await fn(e);
    } catch (err) {
      console.error(err);
      toast("Something went wrong. Try again?");
    } finally {
      busy.delete(fn);
      if (target?.isConnected) target.disabled = false;
    }
  };
}
