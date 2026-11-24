// ===== Chronoshard engine: canvas, UI layer, world-drawing mode, input, sound =====
import type { MapDef, RGB, Track } from './types.js';

// the world view is 428x240 art pixels (26.75 x 15 tiles), shown at exactly 3x: a 1284x720 (16:9) screen
export const TILE = 16, VW = 26.75, VH = 15, S = 3;
/** the UI frame: menus and windows are laid out on a 960x720 frame centred on the wider screen */
export const W = 960, H = VH * TILE * S;
/** the full logical screen width, and where the centred UI frame starts on it */
export const SW = VW * TILE * S, UX = (SW - W) / 2; // 1284, 162
/** the visible canvas: Three.js (world3d.ts) renders the world into it and lays the UI layer on top */
export const canvas = document.getElementById('game') as HTMLCanvasElement;
const mk2d = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; return [c, g];
};
// UI layer: menus, text and the title/ending, drawn at UIK x the logical size so text stays sharp
export let UIK = 2;
export const [uiCanvas, screenCtx] = mk2d(SW * UIK, H * UIK);
/** picks the UI resolution from the canvas's on-screen size; returns true when it changed */
export function fitResolution(): boolean {
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const k = Math.max(1, Math.min(3, Math.ceil(((r.height || H) * dpr) / H - 0.15)));
  if (k === UIK && uiCanvas.width === SW * k) return false;
  UIK = k; uiCanvas.width = SW * k; uiCanvas.height = H * k; return true;
}
/**
 * World drawing. The game's draw code runs with `ctx` pointed at a 1x1 stand-in canvas; that's the signal for the
 * drawing helpers (blit, pixShadow, drawEnemy...) to record what's on screen into Frame (billboards, shadows, glows,
 * lights) for world3d.ts instead of painting pixels. Positions are still given the 2D way, relative to a drawing
 * camera whose window reaches TOPX art px above the view and BOTX below it (the tilted 3D camera sees further than the
 * old flat view), which is what particles and lights are culled against.
 */
export const TOPX = 160, BOTX = 64;
/** height of the drawing window in art pixels */
export const ART_H = VH * TILE + TOPX + BOTX;
const [, worldCtx] = mk2d(1, 1);
/** rounds a world position to the nearest screen pixel (a third of an art pixel) */
export function snapPx(v: number): number { return Math.round(v * S) / S; }
/** the context drawing goes to: the UI layer, or the world stand-in while the world is being described */
export let ctx: CanvasRenderingContext2D = screenCtx;
/** true while drawing the world (so sprites, shadows and glows are recorded into Frame) */
export function inWorld(): boolean { return ctx === worldCtx; }
export function toWorld() {
  ctx = worldCtx;
  Frame.lights.length = 0; Frame.shadows.length = 0; Frame.sprites.length = 0; Frame.effects.length = 0; Frame.glows.length = 0; Frame.particles.length = 0; Frame.shards.length = 0; Frame.dim = 0;
}
export function toScreen() { ctx = screenCtx; }
/** starts a frame's UI drawing: transparent, scaled and shifted so code keeps using the centred 960x720 frame */
export function beginScreen() {
  ctx = screenCtx; screenCtx.setTransform(1, 0, 0, 1, 0, 0); screenCtx.globalAlpha = 1; screenCtx.globalCompositeOperation = 'source-over';
  screenCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height); screenCtx.setTransform(UIK, 0, 0, UIK, UX * UIK, 0); screenCtx.imageSmoothingEnabled = false;
  Frame.world = false;
}
/** fills the whole screen (not just the centred UI frame), e.g. for fades and flashes */
export function fillScreen(color: string): void { ctx.fillStyle = color; ctx.fillRect(-UX, 0, SW, H); }
/** marks the world as drawn this frame (world3d renders it under the UI), with an optional screen-shake offset */
export function blitWorld(ox = 0, oy = 0) { Frame.world = true; Frame.shakeX = Math.round(ox / S); Frame.shakeY = Math.round(oy / S); }

/** a position in the 3D world: map x (east), height y (up), map z (south), in art pixels (see space.ts) */
export interface Vec3 { x: number; y: number; z: number }
/** a point light at a world position; r its reach, c its colour (0..255), k its intensity */
export interface FrameLight extends Vec3 { r: number; c: RGB; k: number }
/** a soft contact shadow on the ground at map (x, z); w the footprint width (art px) */
export interface Shadow { x: number; z: number; w: number }
/** per-era colour grade: lift tints shadows, gain tints highlights */
export interface Grade { lift: RGB; gain: RGB; sat: number; con: number }
/** a sprite standing upright: its left edge at map x, standing on ground line z; image row `foot` touches the ground */
export interface Billboard { img: HTMLCanvasElement; x: number; z: number; foot: number; scale: number; glow?: number }
/** a drawn effect animation whose pivot (px, py in the image) sits at a world position */
/** overlay: drawn over the scenery rather than hidden by it (effects too big to fit between the ground and the walls) */
export interface EffectSprite extends Vec3 { img: HTMLCanvasElement; px: number; py: number; scale: number; alpha: number; dynamic?: boolean; overlay?: boolean }
/** a soft additive glow centred at a world position (a wisp, the Hollow King, a rift) */
export interface GlowSprite extends Vec3 { r: number; c: RGB; a: number }
/** an ambient particle or spell debris at a world position; add = it glows (additive) */
export interface Particle3D extends Vec3 { c: string; a: number; add: boolean }
/** what the world pass hands to the compositor each frame */
export const Frame = {
  world: false, shakeX: 0, shakeY: 0, t: 0,
  /** the drawing camera's offset (map coords = drawn coords + this; Space.map converts) */
  drawCamX: 0, drawCamY: 0,
  lights: [] as FrameLight[], shadows: [] as Shadow[], sprites: [] as Billboard[], effects: [] as EffectSprite[], glows: [] as GlowSprite[], particles: [] as Particle3D[],
  /** the Hollow King's orbiting time shards */
  shards: [] as Vec3[],
  /** battle focus: darkens the scenery (not the combatants) */
  dim: 0,
  /** 3D: the view's centre on the ground, in map coordinates; the map; the distance haze colour; how strongly the sun shapes things */
  focusX: 0, focusY: 0, map: null as MapDef | null, fog: [0, 0, 0] as RGB, sun: 1,
  /** the player's middle, so scenery in front of them turns see-through; null in battle */
  seeThrough: null as Vec3 | null,
  ambient: [255, 255, 255] as RGB, clouds: 0, rays: 0, dof: 0, bloom: 1,
  grade: { lift: [0, 0, 0], gain: [1, 1, 1], sat: 1, con: 1 } as Grade,
};

// ---------- seeded random ----------
export function rng(seed: number): () => number {
  let s = Math.imul(seed | 0, 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ---------- input ----------
// The game reads actions (up, down, left, right, ok, back, menu), held (`down`) or just pressed (`hit`), from the
// keyboard and any connected controller alike. Key hints on screen name the device the player last touched.
export type Action = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back' | 'menu';
/** button labels per controller family (the standard mapping is positional: button 0 is always the bottom face) */
export type PadLayout = 'xbox' | 'playstation' | 'nintendo';
const PAD_LABELS: Record<PadLayout, Partial<Record<Action, string>>> = {
  xbox: { ok: 'A', back: 'B', menu: 'Y' },
  playstation: { ok: '✕', back: '○', menu: '△' },
  nintendo: { ok: 'B', back: 'A', menu: 'X' },
};
const KEY_LABELS: Partial<Record<Action, string>> = { ok: 'Z', back: 'X', menu: 'C' };
/** controller buttons (standard mapping): bottom face, right face, top face, start/options/+, then the d-pad */
const PAD_BUTTONS: [number, Action][] = [[0, 'ok'], [1, 'back'], [3, 'menu'], [9, 'menu'], [12, 'up'], [13, 'down'], [14, 'left'], [15, 'right']];
/** how far the left stick has to lean before it counts as a direction */
export const STICK_DEADZONE = 0.5;

export const Input = {
  down: {} as Record<string, boolean>, hit: {} as Record<string, boolean>,
  map: <Record<string, Action>>{ ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'ok', Enter: 'ok', Space: 'ok', KeyX: 'back', Escape: 'back', Backspace: 'back', KeyC: 'menu', KeyM: 'menu', Tab: 'menu' },
  /** what the keyboard and the controllers each hold, so letting go of one doesn't cancel the other */
  keys: {} as Record<string, boolean>, pad: {} as Record<string, boolean>,
  /** the device the player last used, and the family of the last controller used */
  device: 'keyboard' as 'keyboard' | 'pad', padLayout: 'xbox' as PadLayout,
  pressed(a: string): boolean { if (this.hit[a]) { this.hit[a] = false; return true; } return false; },
  clear() { this.hit = {}; },
  /** a key or button going down (from `source`): starts the action, and counts as a press if it wasn't already held */
  press(a: Action, source: 'keys' | 'pad'): void {
    this[source][a] = true;
    if (!this.down[a]) this.hit[a] = true;
    this.down[a] = true;
  },
  release(a: Action, source: 'keys' | 'pad'): void {
    this[source][a] = false;
    this.down[a] = !!(source === 'keys' ? this.pad[a] : this.keys[a]);
  },
  /** reads every connected controller into the actions; called once a frame */
  pollPads(): void {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const now: Partial<Record<Action, boolean>> = {};
    for (const p of pads) {
      if (!p || !p.connected) continue;
      let active = false;
      for (const [i, a] of PAD_BUTTONS) if (p.buttons[i]?.pressed) { now[a] = true; active = true; }
      const [x = 0, y = 0] = p.axes;
      if (x < -STICK_DEADZONE) now.left = true; else if (x > STICK_DEADZONE) now.right = true;
      if (y < -STICK_DEADZONE) now.up = true; else if (y > STICK_DEADZONE) now.down = true;
      if (active || Math.abs(x) > STICK_DEADZONE || Math.abs(y) > STICK_DEADZONE) { this.device = 'pad'; this.padLayout = padLayout(p.id); }
    }
    for (const a of ['up', 'down', 'left', 'right', 'ok', 'back', 'menu'] as Action[]) {
      if (now[a] && !this.pad[a]) { this.press(a, 'pad'); Sound.unlock(); }
      else if (!now[a] && this.pad[a]) this.release(a, 'pad');
    }
  },
  /** what to call an action's key or button in on-screen hints, on the device in use */
  label(a: Action): string { return (this.device === 'pad' ? PAD_LABELS[this.padLayout][a] : KEY_LABELS[a]) ?? a; },
};
/** which family a controller belongs to, from its id (which carries its USB vendor id) */
export function padLayout(id: string): PadLayout {
  if (/054c|playstation|dualshock|dualsense/i.test(id)) return 'playstation';
  if (/057e|nintendo|switch|joy-con/i.test(id)) return 'nintendo';
  return 'xbox';
}
addEventListener('keydown', e => {
  const a = Input.map[e.code]; if (!a) return;
  e.preventDefault();
  Input.device = 'keyboard';
  Input.press(a, 'keys');
  Sound.unlock();
});
addEventListener('keyup', e => { const a = Input.map[e.code]; if (a) Input.release(a, 'keys'); });
// a click or tap on the page may also start the audio (browsers only allow it after the player does something)
addEventListener('pointerdown', () => Sound.unlock());

// ---------- sound ----------
export const Sound = {
  ac: null as AudioContext | null, musicOn: true, musicTimer: undefined as number | undefined, track: null as Track | null, step: 0,
  unlock() { if (!this.ac) { try { this.ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { /* audio unavailable */ } } if (this.ac && this.ac.state === 'suspended') this.ac.resume(); },
  tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.06, slide = 0, when = 0): void {
    const ac = this.ac; if (!ac) return;
    const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur: number, vol = 0.08): void {
    const ac = this.ac; if (!ac) return;
    const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ac.createBufferSource(), g = ac.createGain(); g.gain.value = vol;
    s.buffer = b; s.connect(g); g.connect(ac.destination); s.start();
  },
  sfx(n: string): void {
    switch (n) {
      case 'cursor': this.tone(880, 0.05, 'square', 0.03); break;
      case 'ok': this.tone(660, 0.06); this.tone(990, 0.08, 'square', 0.05, 0, 0.05); break;
      case 'back': this.tone(440, 0.08, 'square', 0.04, -200); break;
      case 'hit': this.noise(0.12, 0.12); this.tone(160, 0.1, 'sawtooth', 0.06, -80); break;
      case 'crit': this.noise(0.2, 0.16); this.tone(300, 0.2, 'sawtooth', 0.08, -250); break;
      case 'magic': for (let i = 0; i < 5; i++) this.tone(500 + i * 180, 0.12, 'triangle', 0.05, 0, i * 0.04); break;
      case 'fire': this.noise(0.35, 0.1); this.tone(220, 0.3, 'sawtooth', 0.05, 300); break;
      case 'ice': for (let i = 0; i < 4; i++) this.tone(1400 - i * 150, 0.1, 'sine', 0.05, 0, i * 0.05); break;
      case 'heal': for (let i = 0; i < 4; i++) this.tone(520 * [1, 1.25, 1.5, 2][i], 0.15, 'sine', 0.05, 0, i * 0.07); break;
      case 'zap': this.tone(1200, 0.25, 'sawtooth', 0.05, -1100); break;
      case 'battle': [330, 392, 494, 659].forEach((f, i) => this.tone(f, 0.1, 'square', 0.05, 0, i * 0.06)); break;
      case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'square', 0.05, 0, i * 0.11)); break;
      case 'rift': this.tone(100, 1.2, 'sine', 0.08, 900); this.tone(150, 1.2, 'triangle', 0.05, 1300); break;
      case 'item': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.06, 0, i * 0.08)); break;
      case 'die': this.tone(300, 0.5, 'square', 0.05, -250); break;
      case 'step': this.tone(90, 0.03, 'triangle', 0.02); break;
    }
  },
  // tiny looping chiptune: track = {tempo, lead:[midi|0...], bass:[...]}
  play(track: Track | null): void {
    if (this.track === track) return;
    this.track = track; this.step = 0; window.clearInterval(this.musicTimer);
    if (!track) return;
    this.musicTimer = window.setInterval(() => {
      if (!this.ac || !this.musicOn || !this.track) return;
      const t = this.track, i = this.step++;
      const n = t.lead[i % t.lead.length], b = t.bass[i % t.bass.length];
      const mf = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
      if (n) this.tone(mf(n), t.len || 0.18, t.wave || 'square', 0.025);
      if (b && i % 2 === 0) this.tone(mf(b), 0.3, 'triangle', 0.05);
    }, 60000 / track.tempo / 2);
  },
};

