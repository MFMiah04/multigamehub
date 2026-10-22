import { html, svg, nothing } from 'lit-html';

// Every sound is made on the fly with the Web Audio API, so there are no audio files to load.
// Browsers only allow sound after the page has been tapped, so the audio starts on the first tap.

const SETTINGS_KEY = 'mgh:sound';
const settings = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (saved && typeof saved.volume === 'number') return { volume: saved.volume, muted: !!saved.muted };
  } catch { /* use the defaults */ }
  return { volume: 0.6, muted: false };
})();
const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* not saved */ } };

let audio = null;
let master = null;

function ensureAudio() {
  if (!audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audio = new Ctx();
    master = audio.createGain();
    master.connect(audio.destination);
    applyVolume();
  }
  if (audio.state === 'suspended') audio.resume();
  return audio;
}
['pointerdown', 'keydown'].forEach(type => window.addEventListener(type, ensureAudio, { capture: true, passive: true }));

function applyVolume() {
  if (master) master.gain.value = settings.muted ? 0 : settings.volume * settings.volume * 0.8;
}

// ----- building blocks -----

function tone(freq, { at = 0, length = 0.15, type = 'sine', volume = 0.3, slideTo, attack = 0.005 } = {}) {
  const t = audio.currentTime + at;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + length);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

let noiseBuffer = null;
function noise({ at = 0, length = 0.1, volume = 0.2, filter = 'bandpass', freq = 2000, q = 1, sweepTo } = {}) {
  if (!noiseBuffer) {
    noiseBuffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = audio.currentTime + at;
  const src = audio.createBufferSource();
  src.buffer = noiseBuffer;
  const f = audio.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + length);
  f.Q.value = q;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  src.connect(f).connect(gain).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + length + 0.05);
}

// ----- the sounds -----

const SOUNDS = {
  // A soft pencil tap for buttons.
  tap: () => noise({ length: 0.04, volume: 0.12, filter: 'highpass', freq: 3000 }),
  // A quick scribble, for sending an answer or vote.
  scribble: () => {
    noise({ length: 0.09, volume: 0.16, freq: 2500, q: 2, sweepTo: 4500 });
    noise({ at: 0.1, length: 0.11, volume: 0.14, freq: 3800, q: 2, sweepTo: 2200 });
  },
  // Something appearing: a reveal row, a card, a clue.
  pop: () => tone(520, { length: 0.12, slideTo: 900, volume: 0.25 }),
  // Someone joining the room.
  join: () => { tone(660, { length: 0.1, volume: 0.2 }); tone(990, { at: 0.09, length: 0.16, volume: 0.2 }); },
  // The big moment: the answer, the truth, the bullseye.
  ding: () => {
    tone(1318, { length: 1.1, volume: 0.25, type: 'sine' });
    tone(2637, { length: 0.7, volume: 0.08, type: 'sine' });
    tone(1975, { at: 0.08, length: 0.9, volume: 0.1, type: 'triangle' });
  },
  // Points going up on the scoreboard.
  score: () => [0, 0.07, 0.14].forEach((at, i) => tone([880, 1175, 1568][i], { at, length: 0.12, type: 'square', volume: 0.06 })),
  // A clock tick for the last few seconds.
  tick: () => tone(1500, { length: 0.03, type: 'square', volume: 0.07 }),
  tock: () => tone(1000, { length: 0.05, type: 'square', volume: 0.09 }),
  // A drumroll that builds up while you wait for the answer.
  drumroll: (length = 1.8) => {
    const hits = Math.floor(length * 22);
    for (let i = 0; i < hits; i++) noise({ at: i / 22, length: 0.06, volume: 0.05 + 0.2 * (i / hits), filter: 'lowpass', freq: 900 });
  },
  // Getting something wrong.
  buzz: () => { tone(140, { length: 0.35, type: 'sawtooth', volume: 0.14 }); tone(147, { length: 0.35, type: 'sawtooth', volume: 0.1 }); },
  // Wah-wah, for losing.
  sad: () => [[392, 0], [370, 0.3], [349, 0.6], [330, 0.9]].forEach(([f, at], i) =>
    tone(f, { at, length: i === 3 ? 0.7 : 0.28, type: 'triangle', volume: 0.18, slideTo: i === 3 ? 300 : undefined })),
  // A little fanfare for the winner.
  fanfare: () => [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.38]].forEach(([f, at], i) =>
    tone(f, { at, length: i === 3 ? 0.8 : 0.16, type: 'triangle', volume: 0.22 })),
  // A whoosh, for a wheel spinning or a card flipping.
  whoosh: () => noise({ length: 0.35, volume: 0.18, freq: 400, q: 0.8, sweepTo: 3000 }),
};

export function play(name, ...args) {
  if (settings.muted || !settings.volume) return;
  if (!ensureAudio() || audio.state !== 'running') return;
  SOUNDS[name]?.(...args);
}

// Screens redraw twice a second, so sounds tied to something on screen are "cued": each key plays once.
// `at` is when the moment happened (server time). If it was a while ago, e.g. you've just reconnected,
// it stays quiet instead of replaying everything at once.
const cued = new Set();
export function cue(key, name, { at, now, late = 1500, args = [] } = {}) {
  if (cued.has(key)) return;
  cued.add(key);
  if (at !== undefined && now !== undefined && now - at > late) return;
  play(name, ...args);
}

// ----- the speaker button and its volume popover -----

let open = false;
// The speaker shows a cross when silent, one sound wave up to half volume, and two above that.
const SPEAKER = level => html`<svg viewBox="0 0 28 24" width="26" height="22" aria-hidden="true">${svg`
  <g fill="none" stroke="#222" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 9 h4 l6 -5 v16 l-6 -5 h-4 z" fill="#fff" />
    ${level === 0 ? svg`<path d="M18 8 l7 8 M25 8 l-7 8" />` : svg`<path d="M17 9 q2.5 3 0 6" />`}
    ${level > 0.5 ? svg`<path d="M20.5 6 q5 6 0 12" />` : ''}
  </g>`}</svg>`;

export function soundControl(rerender) {
  const level = settings.muted ? 0 : settings.volume;
  const quiet = level === 0;
  const setVolume = v => {
    settings.volume = v;
    settings.muted = v === 0;
    applyVolume();
    save();
    rerender();
  };
  const toggleMute = () => {
    settings.muted = !settings.muted;
    if (!settings.muted && !settings.volume) settings.volume = 0.6;
    applyVolume();
    save();
    if (!settings.muted) { ensureAudio(); setTimeout(() => play('pop'), 30); }
    rerender();
  };
  return html`<span class="sound">
    <button class="link sound__button" aria-label="Sound settings" aria-expanded=${open ? 'true' : 'false'}
      @click=${() => { open = !open; rerender(); }}>${SPEAKER(level)}</button>
    ${open ? html`<div class="sound__panel wobble">
      <button class="link" @click=${toggleMute}>${quiet ? 'Turn sound on' : 'Mute'}</button>
      <input class="sound__slider" type="range" min="0" max="100" step="5" aria-label="Volume"
        .value=${String(Math.round((settings.muted ? 0 : settings.volume) * 100))}
        @input=${e => setVolume(+e.target.value / 100)} @change=${() => play('pop')}>
    </div>` : nothing}
  </span>`;
}

// Closes the volume popover when you tap anywhere else.
document.addEventListener('click', e => {
  if (open && !e.target.closest?.('.sound')) { open = false; }
});
