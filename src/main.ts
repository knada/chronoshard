import { H, Input, Sound, W, blitWorld, ctx, rng, toScreen, toWorld } from './engine.js';
import { cursor, px, text } from './pixel.js';
import { drawHero } from './sprites.js';
import { Atmos } from './atmos.js';
import { HEROES } from './data.js';
import { Battle } from './battle.js';
import { G, Game } from './game.js';
import type { HeroId } from './types.js';

// ===== Chronoshard main: title, ending, loop =====
export const Title = { idx: 0 };
export const STARS = Array.from({ length: 140 }, (_, i) => { const r = rng(i + 7); return { x: r() * W, y: r() * H, s: r() * 2 + 1, v: r() * 20 + 5 }; });

export function drawStars(t: number, tint = '#0a0820'): void {
  ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H);
  for (const s of STARS) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t + s.x)); px(ctx, s.x, (s.y + t * s.v) % H, s.s, s.s, '#fff'); }
  ctx.globalAlpha = 1;
}
export function drawClock(cx: number, cy: number, r: number, t: number): void {
  ctx.save(); ctx.translate(cx, cy);
  ctx.strokeStyle = '#c8a050'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = '#806030'; ctx.beginPath(); ctx.arc(0, 0, r - 14, 0, 7); ctx.stroke();
  for (let i = 0; i < 13; i++) { const a = i / 13 * 6.283 - 1.57; ctx.fillStyle = i === 12 ? '#c080ff' : '#e8d090'; ctx.fillRect(Math.cos(a) * (r - 8) - 3, Math.sin(a) * (r - 8) - 3, 6, 6); }
  ctx.strokeStyle = '#ffe8a0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t * 0.3) * r * 0.5, Math.sin(t * 0.3) * r * 0.5); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = '#c080ff'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(-t * 1.7) * r * 0.8, Math.sin(-t * 1.7) * r * 0.8); ctx.stroke();
  ctx.fillStyle = '#ffe8a0'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
  ctx.restore();
}

export function updateTitle() {
  const opts = Game.hasSave() ? ['New Game', 'Continue'] : ['New Game'];
  if (Input.pressed('up') || Input.pressed('down')) { Title.idx = (Title.idx + 1) % opts.length; Sound.sfx('cursor'); }
  Title.idx = Math.min(Title.idx, opts.length - 1);
  if (Input.pressed('ok')) {
    Sound.unlock(); Sound.sfx('ok');
    const pick = opts[Title.idx];
    G.fade = 0; G.fadeTo = 1; G.onFade = () => (pick === 'Continue' ? Game.load() : Game.newGame());
  }
}
export function drawTitle() {
  const t = G.t; drawStars(t * 0.3);
  drawClock(480, 250, 150, t);
  ctx.globalAlpha = 0.35; ctx.fillStyle = '#c080ff'; ctx.beginPath(); ctx.ellipse(480, 250, 40 + Math.sin(t * 2) * 6, 70, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  text('CHRONOSHARD', 480, 430, '#ffe8a0', 48, 'center');
  text('Thirteen Chimes', 480, 495, '#c0a8ff', 16, 'center');
  const opts = Game.hasSave() ? ['New Game', 'Continue'] : ['New Game'];
  opts.forEach((s, i) => text(s, 480, 560 + i * 40, i === Title.idx ? '#fff' : '#8a8ab0', 18, 'center'));
  cursor(360, 562 + Title.idx * 40, t);
  text('Arrows/WASD move · Z/Enter confirm · X/Esc back · C menu', 480, 690, '#6a6a90', 10, 'center');
}

export const ENDING = [
  'The Hollow King unravels into a thousand silent seconds.',
  'The shard in Bram\'s pocket glows, and its broken edges knit back together.',
  'Across every age, the Heartclock beats once more.',
  '',
  'Lyra returns to the Forest of First Light, where the trees remember her name.',
  'Unit-7 watches a green shoot break through the metal floor of Year 2300.',
  'And in Ashvale, Year 1000, the Clocktower rings exactly twelve times.',
  '',
  'Four minutes slow. Just like always.',
  '',
  '',
  'CHRONOSHARD',
  'Thank you for playing!',
];
export function updateEnding(dt: number): void {
  G.endT += dt;
  if (G.endT > ENDING.length * 2.2 + 6 && Input.pressed('ok')) { G.fadeTo = 1; G.onFade = () => { G.mode = 'title'; Sound.play(null); }; }
}
export function drawEnding() {
  const t = G.endT; drawStars(G.t * 0.3, '#080614');
  const y0 = H - t * 38;
  ENDING.forEach((s, i) => { const y = y0 + i * 60; if (y > -40 && y < H) text(s, 480, y, i >= ENDING.length - 2 ? '#ffe8a0' : '#fff', i === ENDING.length - 2 ? 36 : 14, 'center'); });
  const fy = Math.max(470, y0 + ENDING.length * 60 + 40);
  ctx.save(); ctx.scale(4, 4);
  (['kael', 'bram', 'lyra'] as HeroId[]).forEach((id, i) => drawHero(96 + i * 22, fy / 4, HEROES[id].look, 'down', (G.t * 4 | 0) % 2 && t > ENDING.length * 2.2 ? 1 : 0));
  ctx.restore();
  if (t > ENDING.length * 2.2 + 6 && (G.t * 2 | 0) % 2) text('Press Z', 480, 680, '#a0a8d0', 12, 'center');
}

// ---------- main loop ----------
Atmos.init();
export let lastTime = performance.now();
export function loop(now: number): void {
  const dt = Math.min(0.05, (now - lastTime) / 1000); lastTime = now; G.t += dt;

  // fades
  if (G.fadeTo > 0) { G.fade = Math.min(1, G.fade + dt * 3.5); if (G.fade >= 1) { G.fadeTo = 0; const f = G.onFade; G.onFade = null; if (f) f(); } }
  else if (G.fade > 0) G.fade = Math.max(0, G.fade - dt * 3);
  const fading = G.fadeTo > 0;

  if (!fading) {
    if (G.mode === 'title') updateTitle();
    else if (G.mode === 'field') { Game.stepScript(dt); if (G.mode === 'field') Game.updateField(dt); }
    else if (G.mode === 'battle') Battle.update(dt);
    else if (G.mode === 'menu') Game.updateMenu();
    else if (G.mode === 'shop') Game.updateShop();
    else if (G.mode === 'ending') updateEnding(dt);
  }

  if (G.map && G.mode !== 'title' && G.mode !== 'ending') Atmos.update(dt, G.map, Math.round(G.camX), Math.round(G.camY));
  // draw
  toScreen(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (G.mode === 'title') drawTitle();
  else if (G.mode === 'ending') drawEnding();
  else if (G.mode === 'battle') Battle.draw();
  else {
    toWorld(); Game.drawWorld(false); Atmos.draw(G.map, Math.round(G.camX), Math.round(G.camY)); toScreen();
    blitWorld(G.shake > 0 ? (Math.random() - 0.5) * 12 : 0, G.shake > 0 ? (Math.random() - 0.5) * 12 : 0);
    if (G.riftFlash > 0) { ctx.fillStyle = `rgba(200,150,255,${G.riftFlash})`; ctx.fillRect(0, 0, W, H); G.riftFlash -= dt * 1.5; }
    if (G.mode === 'field') Game.drawFieldHud();
    if (G.mode === 'menu') Game.drawMenu();
    if (G.mode === 'shop') Game.drawShop();
    Game.drawDialog();
  }
  if (G.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${G.fade})`; ctx.fillRect(0, 0, W, H); }
  Input.clear();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
