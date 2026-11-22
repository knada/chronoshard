// ===== Chronoshard engine: canvas, input, sound =====
import type { Track } from './types.js';

export const TILE = 16, VW = 20, VH = 15, S = 3;
export const W = VW * TILE * S, H = VH * TILE * S; // 960 x 720
export const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.width = W; canvas.height = H;
export const screenCtx = canvas.getContext('2d')!;
screenCtx.imageSmoothingEnabled = false;
// the world renders into a native-resolution buffer, then is scaled up once (pixel-perfect)
export const LO = document.createElement('canvas'); LO.width = VW * TILE; LO.height = VH * TILE;
export const loCtx = LO.getContext('2d')!; loCtx.imageSmoothingEnabled = false;
/** the context everything draws into: the low-res world buffer or the full-size screen */
export let ctx: CanvasRenderingContext2D = screenCtx;
export function toWorld() { ctx = loCtx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, LO.width, LO.height); }
export function toScreen() { ctx = screenCtx; }
export function blitWorld(ox = 0, oy = 0) { screenCtx.imageSmoothingEnabled = false; screenCtx.drawImage(LO, Math.round(ox / S) * S, Math.round(oy / S) * S, W, H); }

// ---------- seeded random ----------
export function rng(seed: number): () => number {
  let s = Math.imul(seed | 0, 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ---------- input ----------
export const Input = {
  down: {} as Record<string, boolean>, hit: {} as Record<string, boolean>,
  map: <Record<string, string>>{ ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'ok', Enter: 'ok', Space: 'ok', KeyX: 'back', Escape: 'back', Backspace: 'back', KeyC: 'menu', KeyM: 'menu', Tab: 'menu' },
  pressed(a: string): boolean { if (this.hit[a]) { this.hit[a] = false; return true; } return false; },
  clear() { this.hit = {}; },
};
addEventListener('keydown', e => {
  const a = Input.map[e.code]; if (!a) return;
  e.preventDefault();
  if (!Input.down[a]) Input.hit[a] = true;
  Input.down[a] = true;
  Sound.unlock();
});
addEventListener('keyup', e => { const a = Input.map[e.code]; if (a) Input.down[a] = false; });

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
    this.track = track; this.step = 0; clearInterval(this.musicTimer);
    if (!track) return;
    this.musicTimer = setInterval(() => {
      if (!this.ac || !this.musicOn || !this.track) return;
      const t = this.track, i = this.step++;
      const n = t.lead[i % t.lead.length], b = t.bass[i % t.bass.length];
      const mf = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
      if (n) this.tone(mf(n), t.len || 0.18, t.wave || 'square', 0.025);
      if (b && i % 2 === 0) this.tone(mf(b), 0.3, 'triangle', 0.05);
    }, 60000 / track.tempo / 2);
  },
};

