import { html, nothing, confirmDialog } from './ui.js';

// Makes the site work like an app: installable to the home screen, quick to open again,
// and the screen stays on while you're in a room.

// Opened from the home screen icon (rather than in a browser tab)?
export const installed = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let installPrompt = null;
let onChange = () => {};

export function startApp(rerender) {
  onChange = rerender;
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
  // Chrome and Edge offer their own install dialog; keep hold of it for the "Get the app" button.
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; onChange(); });
  window.addEventListener('appinstalled', () => { installPrompt = null; onChange(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wantAwake) keepAwake(true); });
}

// The "Get the app" link on the home page. Safari has no install dialog, so iPhones get the steps instead.
export function installButton() {
  if (installed() || (!installPrompt && !isIOS)) return nothing;
  const install = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice.catch(() => {});
      installPrompt = null;
      onChange();
      return;
    }
    confirmDialog(html`<b>Add it to your home screen</b><br>
      Tap the <b>Share</b> button <svg viewBox="0 0 20 22" width="16" height="18" aria-hidden="true" style="vertical-align: -3px"><g fill="none" stroke="#222" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2 V13 M6 6 L10 2 L14 6" /><path d="M6 9 H3 V20 H17 V9 H14" /></g></svg>
      in Safari, then <b>Add to Home Screen</b>. It opens full screen, just like an app.`, 'Got it', 'yellow', false);
  };
  return html`<button class="link get-app" @click=${install}>
    <svg viewBox="0 0 20 24" width="16" height="19" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2" width="14" height="20" rx="3" fill="#fff" /><path d="M8 18 H12" /></g></svg>
    Get the app on your phone or computer</button>`;
}

// Keep the screen from dimming and locking mid-game. Browsers drop the lock when the tab is hidden,
// so it's asked for again whenever the page comes back.
let wantAwake = false;
let lock = null;
export async function keepAwake(on) {
  wantAwake = on;
  if (!('wakeLock' in navigator)) return;
  if (on && !lock && document.visibilityState === 'visible') {
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch { lock = null; }
  } else if (!on && lock) {
    lock.release().catch(() => {});
    lock = null;
  }
}
