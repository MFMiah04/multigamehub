import { keyed } from 'lit-html/directives/keyed.js';
import { html, nothing, button, timer, selectField, action, avatar, progress, toast } from '../ui.js';
import { shuffle } from '../room.js';
import { isTimeUp, backToLobbyButton } from './common.js';
import { cue } from '../sound.js';
import { download } from '../draw/reel.js';
import '../draw/board.js';
import '../draw/reel.js';

// Pass-it-on drawing games (like Gartic Phone). Every player starts a chain; each turn everyone works
// on a different chain, then passes it on. Turn r of chain c is drawn by order[(c + r) % N] on
// the board layer `c{c}f{r}`.
//   mode 'animation': each turn is the next frame, with the previous frame faded behind it.
//   mode 'stack': each turn adds to the same picture, on top of everything drawn before.
// At the end the chains are shown one by one: each turn revealed with who did it, then the loop.

const REVEAL_MS = 1700;
const GRACE_MS = 1500; // after time's up, a moment for the last strokes to arrive
const FPS = [4, 6, 8, 10, 12, 15];
const DIRECTIONS = [['forward', 'Forwards'], ['backward', 'Backwards'], ['boomerang', 'Boomerang']];

const layerOf = (chain, step) => `c${chain}f${step}`;
const chainCount = round => (round.order || []).length;
const chainAt = (round, index, step) => ((index - step) % chainCount(round) + chainCount(round)) % chainCount(round);
const authorOf = (round, chain, step) => round.order[(chain + step) % chainCount(round)];
const name = (ctx, id) => ctx.room.players[id]?.name || 'Someone';
const framesOf = (round, chain) => Array.from({ length: round.steps }, (_, step) => layerOf(chain, step));

export function makeChainGame({ mode, texts, stepsFor, settingsView, defaults, ...game }) {
  const advance = (ctx, s) => {
    const { round } = ctx;
    if (round.step + 1 < round.steps) {
      return { 'round/step': round.step + 1, 'round/no': round.step + 2, 'round/done': null, 'round/endsAt': ctx.now() + s.time * 1000 };
    }
    return { phase: 'show', 'round/show': 0, 'round/showAt': ctx.now() + 500, 'round/endsAt': null };
  };

  return {
    ...game,
    canvas: true,
    defaults,
    settingsView,

    canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : null),

    start(ctx, s) {
      const order = shuffle(ctx.players.map(p => p.id));
      return {
        phase: 'draw',
        round: { order, steps: stepsFor(order.length, s), step: 0, no: 1, endsAt: ctx.now() + s.time * 1000, play: { fps: 8, dir: mode === 'animation' ? 'forward' : 'forward' } },
      };
    },

    tick(ctx, s) {
      const { round } = ctx;
      const { phase } = ctx.room;
      if (phase !== 'draw') return null;
      const playing = round.order.filter(id => ctx.room.players[id]?.inGame);
      const allDone = playing.length > 0 && playing.every(id => round.done?.[id]);
      if (allDone || ctx.now() >= round.endsAt + GRACE_MS) return advance(ctx, s);
      return null;
    },

    view(ctx) {
      const { phase } = ctx.room;
      if (phase === 'draw') return drawing(ctx);
      if (phase === 'show') return showing(ctx);
      return ending(ctx);
    },
  };

  // ----- drawing a turn -----

  function drawing(ctx) {
    const { round, local } = ctx;
    const index = round.order.indexOf(ctx.uid);
    if (index < 0) return html`<p class="note center">This round is already going. You'll be in the next one.</p>`;
    const step = round.step;
    const chain = chainAt(round, index, step);
    const done = !!round.done?.[ctx.uid];
    const timeUp = isTimeUp(ctx);
    const before = step > 0 ? authorOf(round, chain, step - 1) : null;
    const under = step === 0 ? null : mode === 'animation' ? [layerOf(chain, step - 1)] : framesOf(round, chain).slice(0, step);
    local.showUnder ??= true;
    local.showMine ??= true;
    const finished = round.order.filter(id => round.done?.[id] && ctx.room.players[id]).length;
    const playing = round.order.filter(id => ctx.room.players[id]?.inGame).length;
    cue(`chain:${round.id}:${step}`, step === 0 ? 'whoosh' : 'pop');

    const toggle = key => { local[key] = !local[key]; ctx.rerender(); };
    return html`
      <div class="chain-top">
        <p class="note center">${texts.stepLabel(step + 1, round.steps)}${before ? html` · continuing <b>${name(ctx, before)}</b>'s` : ''}</p>
        <h2 class="center">${step === 0 ? texts.first : texts.next}</h2>
        ${timer(round.endsAt, 10)}
      </div>
      ${keyed(layerOf(chain, step), html`<sketch-board room=${ctx.room.code} uid=${ctx.uid} layer=${layerOf(chain, step)}
        .config=${{ stats: false, canDraw: !done && !timeUp, under, underMode: mode === 'animation' ? 'faded' : 'base', showUnder: local.showUnder, showMine: local.showMine }}></sketch-board>`)}
      ${mode === 'animation' && under ? html`<div class="chain-toggles">
        ${button(local.showUnder ? 'Hide last frame' : 'Show last frame', () => toggle('showUnder'), { kind: 'white', small: true })}
        ${button(local.showMine ? 'Hide my frame' : 'Show my frame', () => toggle('showMine'), { kind: 'white', small: true })}
      </div>` : nothing}
      ${done
        ? button('Keep drawing', action(() => ctx.update({ [`round/done/${ctx.uid}`]: null })), { kind: 'white', disabled: timeUp })
        : button("I'm done", action(() => ctx.update({ [`round/done/${ctx.uid}`]: true })), { disabled: timeUp })}
      ${progress(finished, playing, 'are done')}`;
  }

  // ----- showing the chains -----

  function controls(ctx) {
    const { round } = ctx;
    const play = round.play || {};
    if (!ctx.isHost) return html`<p class="note center">Playing at ${play.fps || 8} frames a second, ${DIRECTIONS.find(d => d[0] === (play.dir || 'forward'))[1].toLowerCase()}.</p>`;
    return html`<div class="chain-controls">
      ${selectField('Speed', play.fps || 8, FPS.map(f => [f, `${f} frames a second`]), v => ctx.update({ 'round/play/fps': +v }))}
      <div class="chain-dirs">
        ${DIRECTIONS.map(([dir, label]) => button(label, () => ctx.update({ 'round/play/dir': dir }), { kind: (play.dir || 'forward') === dir ? 'yellow' : 'white', small: true }))}
      </div>
    </div>`;
  }

  async function saveGif(ctx, chain, el) {
    const reel = el.closest('.chain-show, .chain-card')?.querySelector('frame-reel');
    if (!reel) return;
    toast('Making your GIF…');
    const blob = await reel.gif();
    download(blob, `${game.id}-${name(ctx, round0(ctx, chain)).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.gif`);
  }

  // Plays a built-up picture's steps once, ending on the finished picture again.
  function replay(el) {
    el.closest('.chain-show, .chain-card')?.querySelector('frame-reel')?.replay();
  }

  // Whose chain it is: whoever started it.
  function round0(ctx, chain) {
    return authorOf(ctx.round, chain, 0);
  }

  function showing(ctx) {
    const { round } = ctx;
    const chain = round.show;
    const frames = framesOf(round, chain);
    const elapsed = ctx.now() - round.showAt;
    const step = Math.max(0, Math.floor(elapsed / REVEAL_MS) + 1);
    const revealing = step <= frames.length;
    const shown = Math.min(step, frames.length);
    if (revealing && step > 0) cue(`show:${round.id}:${chain}:${step}`, 'pop', { at: round.showAt + (step - 1) * REVEAL_MS, now: ctx.now() });
    if (!revealing) cue(`show:${round.id}:${chain}:loop`, 'ding');
    const last = chain + 1 >= chainCount(round);
    const next = () => ctx.update(last ? { phase: 'end' } : { 'round/show': chain + 1, 'round/showAt': ctx.now() + 500 });

    return html`
      <div class="chain-show">
        <p class="note center">${texts.chainLabel} ${chain + 1} of ${chainCount(round)}</p>
        <h2 class="center">${name(ctx, round0(ctx, chain))}'s ${texts.thing}</h2>
        <frame-reel .code=${ctx.room.code} .mode=${mode} .frames=${frames} .step=${revealing ? shown : frames.length}
          .loop=${mode === 'animation'} .fps=${round.play?.fps || 8} .direction=${round.play?.dir || 'forward'}></frame-reel>
        <div class="chain-credits">
          ${frames.map((_, i) => {
            const who = ctx.room.players[authorOf(round, chain, i)];
            return html`<span class="chain-credit ${i < shown ? 'chain-credit--in' : ''} ${revealing && i === shown - 1 ? 'chain-credit--now' : ''}">
              ${who ? avatar(who, 22) : nothing}<small>${i + 1}. ${who?.name || 'Someone'}</small></span>`;
          })}
        </div>
        ${revealing ? html`<p class="note center">${texts.revealNote}</p>` : html`
          ${mode === 'animation' ? controls(ctx) : button('Replay', e => replay(e.currentTarget), { kind: 'white' })}
          ${button('Download GIF', action(e => saveGif(ctx, chain, e.currentTarget)), { kind: 'white' })}
          <div class="push"></div>
          ${ctx.isHost ? button(last ? 'Finish' : `Next ${texts.thing}`, action(next)) : html`<p class="note center">The host will show the next one.</p>`}`}
      </div>`;
  }

  function ending(ctx) {
    const { round } = ctx;
    return html`
      <h1 class="center scribble pop-in">${texts.endTitle}</h1>
      ${mode === 'animation' ? controls(ctx) : nothing}
      <div class="chain-gallery">
        ${Array.from({ length: chainCount(round) }, (_, chain) => html`<div class="chain-card wobble">
          <frame-reel .code=${ctx.room.code} .mode=${mode} .frames=${framesOf(round, chain)} .loop=${mode === 'animation'} .fps=${round.play?.fps || 8} .direction=${round.play?.dir || 'forward'}></frame-reel>
          <b>${name(ctx, round0(ctx, chain))}'s ${texts.thing}</b>
          <div class="chain-card__buttons">
            ${mode === 'animation' ? nothing : button('Replay', e => replay(e.currentTarget), { kind: 'white', small: true })}
            ${button('Download GIF', action(e => saveGif(ctx, chain, e.currentTarget)), { kind: 'white', small: true })}
          </div>
        </div>`)}
      </div>
      <div class="push"></div>
      ${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}
      ${backToLobbyButton(ctx)}`;
  }
}

// Settings both games share.
export const timeField = (s, set, disabled, label = 'Time for each turn') =>
  selectField(label, s.time, [[30, '30 seconds'], [45, '45 seconds'], [60, '1 min'], [90, '1½ min'], [120, '2 min']], v => set({ time: +v }), disabled);
