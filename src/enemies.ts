import { ctx, rng } from './engine.js';
import { PAL, gridSprite, hexRgb, mkCanvas, paintGrid, pixShadow, px, rgbHex, shade, silhouette, tint } from './pixel.js';
import type { EnemyKind, EnemyShape } from './types.js';
import type { Ctx, Palette } from './pixel.js';

/** an enemy's animation frames, plus white silhouettes for hit flashes */
export interface EnemyFrames { frames: HTMLCanvasElement[]; flash: HTMLCanvasElement[]; w: number; h: number }
export interface PixelPoint { x: number; y: number; c: string }

// ===== Chronoshard enemy sprites: grids per shape, recoloured per enemy, bottom-centre anchored =====
// Slots: c body C body-shade l body-light x accent X accent-shade e eye-dark w white y glow r red k black m metal M metal-dark v stem V stem-dark p pink
export const ENEMY_GRIDS: Partial<Record<EnemyShape, string[][]>> = {
  // every shape is generated below at native pixel scale
};

// The Hollow King is generated at native pixel scale (56x64) so it towers over the party
// without chunky upscaled pixels. Two frames: the tattered hem flutters.
export function hollowGrid(frame: number): string[] {
  const W = 56, H = 64, cx = 28, R = rng(4242 + frame * 977);
  const g = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const set = (x: number, y: number, c: string) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  const span = (y: number, x0: number, x1: number, c: string) => { for (let x = Math.round(x0); x <= Math.round(x1); x++) set(x, y, c); };
  // crown: five spikes over a gold band with gems
  for (const [dx, h] of [[-9, 4], [-4.5, 6], [0, 8], [4.5, 6], [9, 4]]) for (let i = 0; i < h; i++) { const w = i < h - 3 ? 1 : 0; span(8 - i, cx + dx - w, cx + dx + w, i === h - 1 ? 'w' : w ? 'y' : 'Y'); set(cx + dx - w, 8 - i, i === h - 1 ? 'w' : 'y'); if (w) set(cx + dx + w, 8 - i, 'Y'); }
  span(7, cx - 11, cx + 11, 'y'); span(8, cx - 11, cx + 11, 'Y'); span(9, cx - 11, cx + 11, 'y');
  set(cx, 8, 'p'); set(cx - 6, 8, 'x'); set(cx + 6, 8, 'x');
  // hood
  for (let y = 10; y <= 29; y++) {
    const hw = Math.round(9 + 8 * Math.min(1, Math.sqrt((y - 10) / 12)));
    span(y, cx - hw, cx + hw, 'c'); span(y, cx - hw, cx - hw + 1, 'l'); span(y, cx + hw - 3, cx + hw, 'C'); set(cx - hw, y, 'x');
  }
  // void face inside the hood, ringed by shadow
  for (let y = 13; y <= 28; y++) {
    const dy = (y - 20.5) / 8.5, w = 8.5 * Math.sqrt(Math.max(0, 1 - dy * dy));
    if (w < 1) continue;
    span(y, cx - w - 1, cx + w + 1, 'C'); span(y, cx - w, cx + w, 'k');
  }
  for (const s of [-1, 1]) { span(19, cx + s * 4 - 1, cx + s * 4 + 1, 'p'); span(20, cx + s * 4 - 1, cx + s * 4 + 1, 'p'); set(cx + s * 4, 19, 'P'); }
  // robe flaring out from the shoulders, with folds
  let hw = 18;
  for (let y = 30; y <= 56; y++) {
    const t = (y - 30) / 26; hw = Math.round(18 + 9 * t + (y < 33 ? 1 : 0));
    span(y, cx - hw, cx + hw, 'c'); span(y, cx + Math.round(hw * 0.35), cx + hw, 'C'); span(y, cx - hw, cx - hw + 1, 'l');
    if (y >= 34) [-0.75, -0.4, 0, 0.4, 0.75].forEach((f, i) => { const fx = cx + Math.round(f * hw + Math.sin(y * 0.35 + i + frame * 1.7)); set(fx, y, 'C'); if (f <= 0) set(fx - 1, y, 'l'); });
  }
  span(31, cx - 2, cx + 2, 'y'); span(32, cx - 1, cx + 1, 'Y'); set(cx, 31, 'p');
  // clawed hands reaching from the sleeves
  for (const s of [-1, 1]) {
    const x0 = cx + s * 15;
    for (let y = 39; y <= 42; y++) span(y, x0 - 2, x0 + 2, 'k');
    for (const f of [-2, 0, 2]) { set(x0 + f, 43, 'k'); set(x0 + f, 44, 'k'); set(x0 + f + s * (f === 0 ? 0 : 1), 45, 'p'); }
  }
  // tattered hem that streams into wisps
  for (let x = cx - hw; x <= cx + hw; x++) {
    const len = R() < 0.18 ? 0 : 1 + Math.floor(R() * 7);
    for (let i = 0; i < len; i++) set(x, 57 + i, i < len - 2 ? 'C' : 'X');
  }
  return g.map(r => r.join(''));
}
ENEMY_GRIDS.hollow = [hollowGrid(0), hollowGrid(1)];

// The Mossback Golem, generated at native pixel scale (52x57). Frame 1 = upper body sinks 1px (slow breathing).
export function golemGrid(frame: number): string[] {
  const W = 52, H = 57, cx = 26, R = rng(9001), b = frame;
  const g = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const set = (x: number, y: number, c: string) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  const get = (x: number, y: number): string => (g[y] && g[y][x]) || '.';
  const span = (y: number, x0: number, x1: number, c: string) => { for (let x = Math.round(x0); x <= Math.round(x1); x++) set(x, y, c); };
  const slab = (y: number, x0: number, x1: number) => { span(y, x0, x1, 'c'); span(y, x0, x0 + 1, 'l'); span(y, x1 - Math.round((x1 - x0) * 0.3), x1, 'C'); };
  const disc = (x0: number, y0: number, r: number, c: string) => { for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy) + 0.3); span(y0 + dy, x0 - w, x0 + w, c); } };
  // legs and feet (planted: they don't breathe)
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? cx - 11 : cx + 3, x1 = x0 + 8;
    for (let y = 40; y <= 52; y++) slab(y, x0, x1);
    for (let y = 53; y <= 56; y++) slab(y, x0 - 1, x1 + 1);
    span(56, x0 - 1, x1 + 1, 'C'); span(47, x0, x1, 'C');
  }
  // torso, tapering toward the waist
  for (let y = 18 + b; y <= 42; y++) { const hw = Math.round(15 - 4 * (y - 18) / 24); slab(y, cx - hw, cx + hw); }
  span(41, cx - 11, cx + 11, 'C');
  // cracks in the stone
  for (let i = 0; i < 6; i++) { let x = cx - 12 + ((R() * 24) | 0), y = 21 + b + ((R() * 16) | 0); for (let j = 0; j < 5; j++) { if ('cCl'.includes(get(x, y))) set(x, y, 'k'); x += R() < 0.5 ? 1 : -1; y++; } }
  // glowing clock rune on the chest
  const ry = 29 + b;
  for (let a = 0; a < 6.283; a += 0.2) set(cx + Math.cos(a) * 4.4, ry + Math.sin(a) * 4.4, 'y');
  for (let k = 1; k <= 3; k++) set(cx, ry - k, 'Y'); for (let k = 1; k <= 2; k++) set(cx + k, ry, 'Y'); set(cx, ry, 'w');
  // shoulder boulders
  for (const s of [-1, 1]) { const sx = cx + s * 19, sy = 19 + b; disc(sx, sy, 7, 'C'); disc(sx - 1, sy - 1, 6, 'c'); disc(sx - 3, sy - 3, 2, 'l'); }
  // arms hanging to huge fists
  for (const s of [-1, 1]) {
    const ax0 = s < 0 ? cx - 23 : cx + 16;
    for (let y = 24 + b; y <= 44 + b; y++) { slab(y, ax0, ax0 + 7); set(s < 0 ? ax0 + 7 : ax0, y, 'C'); }
    const fx0 = s < 0 ? cx - 25 : cx + 14;
    for (let y = 44 + b; y <= 52; y++) slab(y, fx0, fx0 + 11);
    span(52, fx0, fx0 + 11, 'C');
    for (let k = 0; k < 3; k++) { set(fx0 + 3 + k * 3, 46 + b, 'C'); set(fx0 + 3 + k * 3, 47 + b, 'C'); }
  }
  // boulder head with brow, glowing eyes and a cracked mouth
  for (let y = 4 + b; y <= 17 + b; y++) { const r0 = y - 4 - b, hw = r0 === 0 ? 7 : r0 === 1 ? 9 : 10; slab(y, cx - hw, cx + hw); }
  span(9 + b, cx - 9, cx + 9, 'C');
  for (const s of [-1, 1]) {
    const e0 = s < 0 ? cx - 7 : cx + 3;
    span(10 + b, e0, e0 + 4, 'k'); span(11 + b, e0, e0 + 4, 'k'); span(10 + b, e0 + 1, e0 + 3, 'y'); span(11 + b, e0 + 1, e0 + 3, 'Y'); set(e0 + 2, 10 + b, 'w');
  }
  for (let x = cx - 5; x <= cx + 5; x++) set(x, 14 + b + (x % 2), 'k');
  // moss: thick on the crown and shoulders, dripping down, with tiny flowers
  for (let x = cx - 11; x <= cx + 11; x++) { const h = 2 + ((R() * 3) | 0) + (Math.abs(x - cx) < 5 ? 2 : 0); for (let i = 0; i < h; i++) set(x, 6 + b - i, i === h - 1 ? 'X' : 'x'); if (R() < 0.3) for (let i = 0; i < 1 + ((R() * 3) | 0); i++) set(x, 7 + b + i, 'X'); }
  for (const s of [-1, 1]) for (let dx = -7; dx <= 7; dx++) { const x = cx + s * 19 + dx, top = 19 + b - Math.floor(Math.sqrt(49 - dx * dx)); set(x, top, 'x'); set(x, top - 1, 'x'); if (R() < 0.4) set(x, top + 1, 'X'); }
  for (let i = 0; i < 6; i++) { const x = cx - 10 + ((R() * 21) | 0); let y = 0; while (y < H && get(x, y) === '.') y++; set(x, y, i % 2 ? 'p' : 'w'); } // flowers sit on top of the moss
  for (let i = 0; i < 7; i++) set(cx + 9 + (i % 2), 8 + b + i, 'X'); // vine down the right cheek
  return g.map(r => r.join(''));
}
ENEMY_GRIDS.golem = [golemGrid(0), golemGrid(1)];

// The Sentinel, a heavy security mech generated at native pixel scale (40x50).
// Frame 0/1: the visor eye sweeps across, the antenna tip blinks and the chest core pulses.
export function sentinelGrid(frame: number): string[] {
  const W = 40, H = 50, cx = 20;
  const g = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const set = (x: number, y: number, c: string) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  const span = (y: number, x0: number, x1: number, c: string) => { for (let x = Math.round(x0); x <= Math.round(x1); x++) set(x, y, c); };
  const slab = (y: number, x0: number, x1: number, base = 'c') => { span(y, x0, x1, base); span(y, x0, x0, base === 'c' ? 'l' : 'm'); span(y, x1 - Math.round((x1 - x0) * 0.3), x1, base === 'c' ? 'C' : 'M'); };
  // legs: thighs, knee joints, shins with pistons, broad feet
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? cx - 9 : cx + 3, x1 = x0 + 6;
    for (let y = 35; y <= 41; y++) slab(y, x0, x1);
    span(42, x0 - 1, x1 + 1, 'M'); span(43, x0 - 1, x1 + 1, 'M'); set(x0 + 3, 42, 'm');
    for (let y = 44; y <= 46; y++) slab(y, x0, x1);
    for (let y = 43; y <= 46; y++) set(s < 0 ? x0 + 1 : x1 - 1, y, 'm');
    span(47, x0 - 2, x1 + 2, 'M'); span(48, x0 - 2, x1 + 2, 'M'); span(49, x0 - 2, x1 + 2, 'k'); set(x0 - 1, 47, 'm');
  }
  // hips and segmented abdomen
  for (let y = 32; y <= 35; y++) slab(y, cx - 9, cx + 9, 'M');
  // torso: armoured chest plate
  for (let y = 16; y <= 31; y++) { const hw = y < 18 ? 8 : y > 27 ? 8 : 9; slab(y, cx - hw, cx + hw); }
  for (const y of [27, 29, 31]) span(y, cx - 7, cx + 7, 'C');
  span(17, cx - 6, cx + 6, 'x'); span(18, cx - 5, cx + 5, 'X');
  // chest core: cyan ring, brighter on frame 1
  for (let a = 0; a < 6.283; a += 0.25) set(cx + Math.cos(a) * 3.2, 23 + Math.sin(a) * 3.2, 'M');
  for (let dy = -2; dy <= 2; dy++) { const w = dy === 0 || Math.abs(dy) === 1 ? 2 : 1; span(23 + dy, cx - w, cx + w, 'q'); }
  set(cx, 23, 'Q'); if (frame) { set(cx - 1, 22, 'Q'); set(cx + 1, 24, 'Q'); }
  // left arm: hydraulic limb ending in a three-fingered claw
  for (let y = 20; y <= 33; y++) { slab(y, cx - 16, cx - 12, 'M'); set(cx - 14, y, y % 3 ? 'm' : 'M'); }
  span(34, cx - 17, cx - 11, 'M');
  for (const fx of [-17, -14, -11]) { set(cx + fx, 35, 'k'); set(cx + fx, 36, 'k'); set(cx + fx + (fx === -14 ? 0 : fx < -14 ? -1 : 1), 37, 'm'); }
  // right arm: cannon housing with a glowing muzzle
  for (let y = 20; y <= 26; y++) slab(y, cx + 12, cx + 16, 'M');
  for (let y = 27; y <= 36; y++) slab(y, cx + 11, cx + 18);
  span(28, cx + 11, cx + 18, 'x'); span(37, cx + 12, cx + 17, 'M'); span(38, cx + 13, cx + 16, 'k'); span(38, cx + 14, cx + 15, frame ? 'r' : 'R');
  // shoulder plates with warning stripes
  for (const s of [-1, 1]) {
    const px0 = s < 0 ? cx - 19 : cx + 9, px1 = px0 + 10;
    for (let y = 14; y <= 20; y++) slab(y, px0 + (y === 14 ? 2 : 0), px1 - (y === 14 ? 2 : 0));
    for (let x = px0; x <= px1; x++) { set(x, 19, (x + 19) % 4 < 2 ? 'y' : 'k'); set(x, 20, (x + 20) % 4 < 2 ? 'y' : 'k'); }
    set(px0 + 2, 15, 'm'); set(px1 - 2, 15, 'm');
  }
  // neck
  span(14, cx - 3, cx + 3, 'M'); span(15, cx - 3, cx + 3, 'M');
  // helm with crest, visor and scanning eye
  for (let y = 4; y <= 13; y++) { const hw = y === 4 ? 4 : y === 5 ? 6 : 7; slab(y, cx - hw, cx + hw); }
  for (let y = 4; y <= 7; y++) set(cx, y, 'x');
  span(8, cx - 6, cx + 6, 'k'); span(9, cx - 6, cx + 6, 'k'); span(10, cx - 5, cx + 5, 'k');
  const ex = frame ? cx + 1 : cx - 4;
  span(9, ex, ex + 2, 'r'); set(ex + 1, 9, 'w'); set(ex + 1, 8, 'R'); set(ex + 1, 10, 'R');
  for (const vx of [-4, -2, 0, 2, 4]) { set(cx + vx, 12, 'k'); }
  span(13, cx - 5, cx + 5, 'M');
  // antenna with a blinking tip
  for (let y = 0; y <= 4; y++) set(cx + 5, y + 1, 'M');
  set(cx + 5, 0, frame ? 'r' : 'R');
  return g.map(r => r.join(''));
}
ENEMY_GRIDS.sentinel = [sentinelGrid(0), sentinelGrid(1)];

// The Rustbot, a scrappy drill-armed scavenger on treads (28x32).
// Frame 0/1: the eye scans, the drill's spiral turns and the tread links roll.
export function rustbotGrid(frame: number): string[] {
  const W = 34, H = 32, cx = 21, R = rng(3131);
  const g = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const set = (x: number, y: number, c: string) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  const get = (x: number, y: number): string => (g[y] && g[y][x]) || '.';
  const span = (y: number, x0: number, x1: number, c: string) => { for (let x = Math.round(x0); x <= Math.round(x1); x++) set(x, y, c); };
  const slab = (y: number, x0: number, x1: number) => { span(y, x0, x1, 'c'); set(x0, y, 'l'); span(y, x1 - Math.round((x1 - x0) * 0.3), x1, 'C'); };
  const rust = (x0: number, y0: number, x1: number, y1: number, n: number) => { for (let i = 0; i < n; i++) { const x = x0 + ((R() * (x1 - x0 + 1)) | 0), y = y0 + ((R() * (y1 - y0 + 1)) | 0); if ('cCl'.includes(get(x, y))) set(x, y, R() < 0.6 ? 'u' : 'U'); } };
  // treads: rounded track, wheels, rolling links
  for (let y = 24; y <= 30; y++) { const inset = y === 24 || y === 30 ? 2 : y === 25 || y === 29 ? 1 : 0; span(y, cx - 10 + inset, cx + 10 - inset, 'M'); }
  for (let x = cx - 8; x <= cx + 8; x++) { if ((x + frame) % 2 === 0) { set(x, 24, 'k'); set(x, 30, 'k'); } }
  for (const wx of [-7, -2, 3, 8]) { span(26, cx + wx - 1, cx + wx + 1, 'm'); span(27, cx + wx - 1, cx + wx + 1, 'm'); span(28, cx + wx - 1, cx + wx + 1, 'm'); set(cx + wx, 27, 'k'); }
  span(31, cx - 8, cx + 8, 'k');
  // chassis
  for (let y = 13; y <= 23; y++) slab(y, cx - 8, cx + 8);
  span(13, cx - 8, cx + 8, 'M'); span(23, cx - 8, cx + 8, 'C');
  for (const y of [17, 19, 21]) span(y, cx - 1, cx + 5, 'k');           // vent grille
  set(cx - 5, 16, 'y'); set(cx - 5, 15, 'Y');                              // warning lamp
  span(20, cx - 7, cx - 3, 'C'); set(cx - 6, 18, 'k'); set(cx - 4, 18, 'k'); // panel seam + bolts
  rust(cx - 8, 14, cx + 8, 22, 14);
  // dome head with a visor and a single scanning eye
  for (let y = 3; y <= 12; y++) { const hw = y === 3 ? 3 : y === 4 ? 5 : y === 5 ? 6 : 7; slab(y, cx - hw, cx + hw); }
  span(7, cx - 6, cx + 6, 'k'); span(8, cx - 6, cx + 6, 'k'); span(9, cx - 5, cx + 5, 'k');
  const ex = frame ? cx + 1 : cx - 4;
  span(8, ex, ex + 2, 'r'); set(ex + 1, 8, 'w'); set(ex + 1, 7, 'R'); set(ex + 1, 9, 'R');
  span(12, cx - 6, cx + 6, 'M');
  rust(cx - 6, 4, cx + 6, 6, 5); rust(cx - 6, 10, cx + 6, 11, 4);
  // bent antenna
  set(cx - 4, 2, 'M'); set(cx - 5, 1, 'M'); set(cx - 5, 0, 'r');
  // shoulder laser emitter (right)
  span(11, cx + 7, cx + 12, 'M'); span(12, cx + 8, cx + 12, 'M'); set(cx + 12, 11, frame ? 'r' : 'R'); set(cx + 9, 11, 'm');
  // drill arm (left), aimed at the party, spiral turning between frames
  span(15, cx - 11, cx - 8, 'M'); span(16, cx - 11, cx - 8, 'M'); set(cx - 10, 15, 'm');
  for (let i = 0; i <= 8; i++) {
    const x = cx - 12 - i, half = Math.max(0, Math.round(3 - i * 0.37));
    for (let dy = -half; dy <= half; dy++) set(x, 16 + dy, ((x + dy * 2 + frame * 2) & 3) < 2 ? 'm' : 'M'); // diagonal spiral bands
  }
  set(cx - 21, 16, 'w');
  return g.map(r => r.join(''));
}
ENEMY_GRIDS.robot = [rustbotGrid(0), rustbotGrid(1)];

// The Duskbat (40x24): membrane wings over three finger bones. Poses: 0 up, 1 level, 2 down.
export function batGrid(pose: number): string[] {
  const W = 40, H = 20, cx = 20;
  const g = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const set = (x: number, y: number, c: string) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  const span = (y: number, x0: number, x1: number, c: string) => { for (let x = Math.round(x0); x <= Math.round(x1); x++) set(x, y, c); };
  const line = (x0: number, y0: number, x1: number, y1: number, c: string) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); };
  const inPoly = (px: number, py: number, pts: [number, number][]) => { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
  const TIPS = [[[14, -8], [15, -2], [10, 4]], [[15, -2], [14, 3], [9, 6]], [[13, 4], [11, 8], [6, 10]]][pose];
  // wings: membrane polygon from shoulder through the finger tips back to the flank, then bones on top
  for (const s of [-1, 1]) {
    const sx = cx + s * 4, sy = 8, tips = TIPS.map(([dx, dy]): [number, number] => [sx + s * dx, sy + dy]);
    const pts: [number, number][] = [[sx, sy], ...tips, [cx + s * 3, 14]];
    // scallop the trailing edge: pull a point inward between each pair of tips
    const poly = [pts[0], pts[1]];
    for (let k = 1; k < tips.length; k++) { const [ax, ay] = tips[k - 1], [bx, by] = tips[k]; poly.push([(ax + bx) / 2 - s * 1.5, (ay + by) / 2 + 1.5], [bx, by]); }
    poly.push(pts[pts.length - 1]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inPoly(x + 0.5, y + 0.5, poly)) set(x, y, (x + y) % 5 === 0 ? 'X' : 'x');
    line(sx, sy, tips[0][0], tips[0][1], 'C');                     // leading-edge bone
    for (const [tx, ty] of tips.slice(1)) line(sx, sy + 1, tx, ty, 'X'); // finger bones
    set(sx + s * Math.round(TIPS[0][0] * 0.55), sy + Math.round(TIPS[0][1] * 0.55) - 1, 'k'); // thumb claw
  }
  // body: furry oval, lit from the top-left
  for (let y = 7; y <= 16; y++) { const dy = (y - 11.5) / 5, hw = Math.round(5 * Math.sqrt(Math.max(0, 1 - dy * dy))); if (hw < 1) continue; span(y, cx - hw, cx + hw, 'c'); set(cx - hw, y, 'l'); span(y, cx + Math.max(1, hw - 1), cx + hw, 'C'); }
  span(12, cx - 2, cx + 1, 'l'); span(14, cx - 1, cx + 1, 'l');      // fur tufts
  // head with big ears
  for (let y = 3; y <= 10; y++) { const dy = (y - 6.5) / 4, hw = Math.round(4.2 * Math.sqrt(Math.max(0, 1 - dy * dy))); if (hw < 1) continue; span(y, cx - hw, cx + hw, 'c'); set(cx - hw, y, 'l'); set(cx + hw, y, 'C'); }
  for (const s of [-1, 1]) for (let i = 0; i <= 4; i++) { const ex = cx + s * 3, w = i < 2 ? 1 : 0; span(4 - i, ex - w, ex + w, i === 4 ? 'C' : 'c'); if (w) set(ex, 4 - i, 'x'); }
  set(cx - 2, 6, 'y'); set(cx - 3, 6, 'y'); set(cx + 2, 6, 'y'); set(cx + 3, 6, 'y'); set(cx - 2, 7, 'Y'); set(cx + 2, 7, 'Y');
  span(9, cx - 1, cx + 1, 'k'); set(cx - 1, 10, 'w'); set(cx + 1, 10, 'w');  // mouth and fangs
  // clawed feet tucked under
  for (const s of [-1, 1]) { set(cx + s * 2, 17, 'k'); set(cx + s * 2, 18, 'k'); set(cx + s * 3, 18, 'k'); }
  return g.map(r => r.join(''));
}
ENEMY_GRIDS.bat = [0, 1, 2, 1].map(batGrid); // flap cycle: up, level, down, level

// The Thornling (32x38): a carnivorous bloom on a thorny stem. Frame 1 sways the head and opens the jaws.
export function thornlingGrid(frame: number): string[] {
  const W = 32, H = 38, cx = 16;
  const g = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const set = (x: number, y: number, c: string) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  const span = (y: number, x0: number, x1: number, c: string) => { for (let x = Math.round(x0); x <= Math.round(x1); x++) set(x, y, c); };
  const line = (x0: number, y0: number, x1: number, y1: number, c: string) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); };
  const sway = frame, hx = cx + sway, hy = 11;
  // roots gripping the ground
  for (const [dx, c] of [[-12, 'V'], [-6, 'v'], [6, 'v'], [12, 'V']] as [number, string][]) { line(cx, 33, cx + dx, 37, c); set(cx + dx + Math.sign(dx), 37, c); }
  span(34, cx - 3, cx + 3, 'V'); span(33, cx - 2, cx + 2, 'v');
  // curving stem with thorns
  const stemX = (y: number) => cx + Math.round(Math.sin((y - 17) * 0.32) * 2 + sway * (33 - y) / 16);
  for (let y = 17; y <= 33; y++) { const x = stemX(y); span(y, x - 1, x + 1, 'v'); set(x + 1, y, 'V'); set(x - 1, y, 'n'); }
  for (let y = 19; y <= 31; y += 4) { const s = ((y - 19) / 4) % 2 ? 1 : -1, x = stemX(y) + s * 2; set(x, y, 't'); set(x + s, y - 1, 't'); }
  // two broad leaves
  for (const [ly, s, len] of [[26, -1, 9], [29, 1, 8]]) {
    const x0 = stemX(ly);
    for (let i = 1; i <= len; i++) { const w = Math.round(Math.sin(i / len * Math.PI) * 2.6), x = x0 + s * i, y = ly - Math.round(i * 0.45); for (let d = -w; d <= w; d++) set(x, y + d, d === -w ? 'n' : d === w ? 'V' : 'v'); }
    line(x0 + s, ly, x0 + s * len, ly - Math.round(len * 0.45), 'V');  // midrib
  }
  // petals: eight around the head, shaded inner to tip
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * 6.283 + 0.39 + frame * 0.12, pcx = hx + Math.cos(a) * 8, pcy = hy + Math.sin(a) * 8;
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
      const u = x * Math.cos(a) + y * Math.sin(a), v = -x * Math.sin(a) + y * Math.cos(a);
      if ((u * u) / 20 + (v * v) / 6.5 > 1) continue;
      const d = Math.hypot(pcx + x - hx, pcy + y - hy);
      set(pcx + x, pcy + y, d > 10.6 ? 'p' : d < 7 ? 'X' : 'x');
    }
  }
  // face disc
  for (let y = -7; y <= 7; y++) { const w = Math.round(Math.sqrt(Math.max(0, 49 - y * y))); if (!w) continue; span(hy + y, hx - w, hx + w, 'c'); set(hx - w, hy + y, 'l'); set(hx + w, hy + y, 'C'); if (y > 3) span(hy + y, hx + 1, hx + w, 'C'); }
  span(hy - 6, hx - 3, hx - 1, 'l');
  // glowing slit-pupil eyes under an angry brow
  for (const s of [-1, 1]) { const ex = hx + s * 3; span(hy - 3, ex - 1, ex + 1, 'y'); span(hy - 2, ex - 1, ex + 1, 'Y'); set(ex, hy - 3, 'k'); set(ex, hy - 2, 'k'); set(ex - s, hy - 5, 'C'); set(ex, hy - 4, 'C'); set(ex + s, hy - 4, 'C'); }
  // fanged maw (opens wider on frame 1)
  const m0 = hy + 1, m1 = hy + (frame ? 5 : 4), mid = (m0 + m1) / 2, hh = (m1 - m0) / 2 + 0.6;
  for (let y = m0; y <= m1; y++) { const w = Math.round(5 * Math.sqrt(Math.max(0, 1 - ((y - mid) / hh) ** 2))); span(y, hx - w, hx + w, 'k'); }
  for (let x = hx - 4; x <= hx + 4; x++) { if ((x - hx) % 2 === 0) set(x, m0, 'w'); else set(x, m1, 'w'); }
  span(m1 - 1, hx - 1, hx + 1, 'r');
  return g.map(r => r.join(''));
}
ENEMY_GRIDS.plant = [thornlingGrid(0), thornlingGrid(1)];

// The Gloop (28 wide): a glossy jelly dome. Poses: 0 rest, 1 squash, 2 stretch. ember adds a flame tuft.
export function gloopGrid(pose: number, ember: boolean): string[] {
  const [rx, ry] = [[12, 15], [13.5, 12.5], [10.5, 17]][pose];
  const flame = ember ? 6 : 0, W = 30, H = 19 + flame, cx = 15, base = H - 1, top = base - Math.round(ry);
  const g = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const set = (x: number, y: number, c: string) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  const span = (y: number, x0: number, x1: number, c: string) => { for (let x = Math.round(x0); x <= Math.round(x1); x++) set(x, y, c); };
  const disc = (x0: number, y0: number, r: number, c: string) => { for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy) + 0.4); span(y0 + dy, x0 - w, x0 + w, c); } };
  // body: flat-bottomed dome, lit from the top-left
  for (let y = top; y <= base; y++) {
    const d = (base - y) / ry, w = Math.round(rx * Math.sqrt(Math.max(0, 1 - Math.pow(d, 2.2))));
    if (w < 1) continue;
    span(y, cx - w, cx + w, 'c'); span(y, cx - w, cx - w + 1, 'l'); span(y, cx + Math.round(w * 0.68), cx + w, 'C');
  }
  span(base, cx - rx + 1, cx + rx - 1, 'C');
  span(base, cx - rx - 1, cx - rx, 'C'); span(base, cx + rx, cx + rx + 1, 'C');   // puddle spreading at the base
  // suspended bubbles
  for (const [bx, by, r] of [[0.3, 0.3, 1], [-0.15, 0.18, 0], [0.55, 0.15, 0]]) { const x = cx + rx * bx, y = base - ry * by; if (r) { set(x, y - 1, 'x'); set(x - 1, y, 'x'); set(x + 1, y, 'X'); set(x, y + 1, 'X'); } else set(x, y, 'x'); }
  // glossy highlight and sparkle
  disc(Math.round(cx - rx * 0.45), Math.round(top + ry * 0.28), 2, 'x'); set(Math.round(cx - rx * 0.45) - 1, Math.round(top + ry * 0.28) - 1, 'w');
  span(top + 1, cx - 2, cx + 1, 'l');
  // big eyes looking left toward the party, and a small mouth
  const ey = Math.round(base - ry * 0.55);
  for (const s of [-1, 1]) {
    const ex = Math.round(cx + s * rx * 0.36);
    for (let y = ey - 2; y <= ey + 1; y++) span(y, ex - 1, ex + 1, 'w');
    span(ey - 1, ex - 1, ex, 'e'); span(ey, ex - 1, ex, 'e'); set(ex - 1, ey - 1, 'w');
  }
  const my = ey + 3;
  if (pose === 1) { span(my, cx - 2, cx + 1, 'e'); span(my + 1, cx - 1, cx, 'e'); } else { set(cx - 2, my, 'e'); span(my + 1, cx - 1, cx, 'e'); set(cx + 1, my, 'e'); }
  // Ember Gloop: a flickering flame tuft
  if (ember) {
    const fx = cx + (pose === 2 ? 1 : pose === 1 ? -1 : 0), widths = [0, 1, 1, 2, 2, 3];
    for (let i = 0; i < widths.length; i++) { const y = top - widths.length + i + 1, w = widths[i]; span(y, fx - w, fx + w, i < 2 ? 'r' : 'U'); if (w > 1) span(y, fx - w + 2, fx + w - 2, 'y'); }
    set(fx + (pose === 1 ? 2 : -2), top - 3, 'r');
  }
  return g.map(r => r.join(''));
}
ENEMY_GRIDS.blob = [0, 1, 0, 2].map(p => gloopGrid(p, false));       // rest, squash, rest, stretch
ENEMY_GRIDS.emberblob = [0, 1, 0, 2].map(p => gloopGrid(p, true));

// Wisps (32x40): a glowing head with a flickering crown and a swaying tail. Drawn without an outline, over a soft glow.
// Elder Wisp: bright core and gentle dark eyes. Void Wisp: a dark hollow heart and glowing slit eyes.
export function wispGrid(frame: number, isVoid: boolean): string[] {
  const W = 32, H = 40, cx = 16, hy = 14, R = 10, ph = frame / 4 * 6.283;
  const g = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const set = (x: number, y: number, c: string) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  const span = (y: number, x0: number, x1: number, c: string) => { for (let x = Math.round(x0); x <= Math.round(x1); x++) set(x, y, c); };
  const disc = (x0: number, y0: number, r: number, c: string) => { for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy) + 0.4); span(y0 + dy, x0 - w, x0 + w, c); } };
  // swaying tail, thinning and dimming toward the tip, with a bright inner streak
  for (let y = H - 2; y >= hy + 5; y--) {
    const t = (y - hy - 5) / (H - hy - 7), r = 8 * (1 - t) + 0.6, x = cx + Math.sin(ph + t * 4) * 4 * t;
    span(y, x - r, x + r, t > 0.72 ? 'C' : 'c');
    if (t < 0.65) { set(x - 2, y, 'l'); set(x - 1, y, 'l'); }
  }
  // head
  disc(cx, hy, R, 'c');
  // flickering crown of flame licks
  [[-5, 3 + (frame % 2)], [0, 4 + ((frame + 1) % 3)], [5, 3 + ((frame + 2) % 2)]].forEach(([dx, h]) => { for (let i = 0; i < h; i++) set(cx + dx + (i > 1 ? Math.round(Math.sin(ph + dx) * 0.8) : 0), hy - R + 1 - i, i === h - 1 ? 'l' : 'c'); });
  if (isVoid) {
    disc(cx, hy, 8, 'l'); disc(cx, hy + 1, 4, 'X'); disc(cx, hy + 1, 1, 'k');      // bright rim around a small hollow heart
    span(hy - 3, cx - 6, cx - 3, 'w'); span(hy - 3, cx + 3, cx + 6, 'w'); set(cx - 6, hy - 4, 'w'); set(cx + 6, hy - 4, 'w'); // slanted slit eyes
  } else {
    disc(cx - 1, hy, 7, 'l'); disc(cx - 2, hy - 2, 3, 'w');                          // white-hot core, offset to the light
    for (const ex of [cx - 4, cx + 3]) { set(ex, hy, 'e'); set(ex, hy + 1, 'e'); set(ex, hy + 2, 'e'); }
    span(hy + 4, cx - 1, cx, 'e');
  }
  // drifting motes
  for (let i = 0; i < 4; i++) { const a = ph + i * 1.57; set(cx + Math.cos(a) * 14, hy + 3 + Math.sin(a) * 11, isVoid ? 'l' : 'x'); }
  return g.map(r => r.join(''));
}
ENEMY_GRIDS.wisp = [0, 1, 2, 3].map(f => wispGrid(f, false));
ENEMY_GRIDS.voidwisp = [0, 1, 2, 3].map(f => wispGrid(f, true));
export const SPIRIT = new Set<EnemyShape>(['wisp', 'voidwisp']);

export function enemyPal(k: EnemyKind): Palette {
  return { c: k.color, C: shade(k.color, 0.35), l: tint(k.color, 0.35), x: k.color2, X: shade(k.color2, 0.3), e: PAL.ink, w: PAL.white, y: '#ffe040', Y: '#c89020', r: '#ff3838',
    k: '#1a1622', m: '#9aa4b8', M: '#4c5468', v: PAL.leaf, V: PAL.forest, p: '#ff40ff', P: '#ffd0ff', q: '#6ae0ff', Q: '#e0fcff', R: '#a02028', u: '#9a5430', U: '#c8803e', t: '#ecdca8', n: PAL.lime };
}
export const EnemyCache = new Map<EnemyKind, EnemyFrames | null>();
export function enemyFrames(k: EnemyKind): EnemyFrames | null {
  let e = EnemyCache.get(k); if (e) return e;
  const grids = ENEMY_GRIDS[k.shape];
  if (!grids) { e = null; EnemyCache.set(k, e); return e; }
  const frames = grids.map(rows => {
    if (!SPIRIT.has(k.shape)) return gridSprite(rows, enemyPal(k));
    const w = Math.max(...rows.map(r => r.length)), [c, g] = mkCanvas(w + 2, rows.length + 2);  // spirits: no dark outline
    paintGrid(g, rows, enemyPal(k), 1, 1); return c;
  });
  e = { frames, flash: frames.map(f => silhouette(f, '#ffffff')), w: frames[0].width, h: frames[0].height };
  EnemyCache.set(k, e); return e;
}
export function enemyHeight(k: EnemyKind): number { const e = enemyFrames(k); return e ? e.h : 18; }

// x,y = top-left of the enemy's 16x16 footprint tile (world px)
export function drawEnemy(kind: EnemyKind, x: number, y: number, t: number, o: { flash?: boolean; noShadow?: boolean } = {}): void {
  const g = ctx, cx = Math.round(x + 8), by = Math.round(y + 16);
  const E = enemyFrames(kind);
  if (!E) return;
  const spirit = SPIRIT.has(kind.shape), speed = kind.shape === 'golem' ? 1.1 : spirit ? 5 : 2.2;
  const n = E.frames.length, phase = (fly: boolean) => Math.floor(fly ? t * 10 : t * speed + Math.abs(x) * 0.1);
  const fly = kind.shape === 'bat', fr = n > 1 ? ((phase(fly) % n) + n) % n : 0; // never negative, even off-screen left
  const bob = fly ? Math.round(Math.sin(t * 5 + x) * 2) - 6 : kind.shape === 'hollow' ? Math.round(Math.sin(t * 1.6) * 2) - 4 : spirit ? Math.round(Math.sin(t * 3 + x * 0.1) * 2) - 4 : 0;
  if (!o.noShadow) pixShadow(g, cx, by - 1, Math.min(E.w - 4, kind.shape === 'hollow' ? 44 : kind.shape === 'golem' ? 40 : fly ? 14 : spirit ? 10 : E.w - 2));
  if (kind.shape === 'hollow') hollowAura(g, cx, by - E.h / 2 + bob, t);
  if (spirit) { // soft additive glow behind the spirit
    const gy = by - E.h * 0.62 + bob, prev = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(cx, gy, 2, cx, gy, 34); gr.addColorStop(0, hexA(kind.color, 0.6)); gr.addColorStop(1, hexA(kind.color, 0));
    g.fillStyle = gr; g.fillRect(cx - 34, gy - 34, 68, 68); g.globalCompositeOperation = prev;
  }
  const flashing = o.flash && ((t * 30) | 0) % 2 === 0;
  if (spirit) g.globalAlpha *= 0.92;
  g.drawImage(flashing ? E.flash[fr] : E.frames[fr], cx - (E.w >> 1), by - E.h + 1 + bob);
  if (spirit) g.globalAlpha /= 0.92;
}
export function hollowAura(g: Ctx, cx: number, cy: number, t: number): void {
  const prev = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(cx, cy, 4, cx, cy, 54); gr.addColorStop(0, 'rgba(170,90,255,0.5)'); gr.addColorStop(1, 'rgba(90,20,160,0)');
  g.fillStyle = gr; g.fillRect(cx - 54, cy - 54, 108, 108);
  g.globalCompositeOperation = prev;
  for (let i = 0; i < 10; i++) { // orbiting time shards (front half; the back half is hidden behind the robe)
    const a = i / 10 * 6.283 + t * 0.7, sx = Math.round(cx + Math.cos(a) * 38), sy = Math.round(cy + 6 + Math.sin(a) * 14);
    if (Math.sin(a) < 0) { px(g, sx, sy, 2, 2, '#6a40a0'); continue; }
    px(g, sx - 1, sy, 3, 1, '#c890ff'); px(g, sx, sy - 1, 1, 3, '#c890ff'); px(g, sx, sy, 1, 1, '#ffffff');
  }
}
export function hexA(c: string, a: number): string { const [r, g, b] = hexRgb(c); return `rgba(${r},${g},${b},${a})`; }

// pixels of an enemy sprite for the death dissolve: [{x,y,c}] relative to bottom-centre
export const EnemyPixCache = new Map<EnemyKind, PixelPoint[]>();
export function enemyPixels(k: EnemyKind): PixelPoint[] {
  let p = EnemyPixCache.get(k); if (p) return p;
  const E = enemyFrames(k); p = [];
  if (E) {
    const c = E.frames[0], d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; if (d[i + 3] > 128) p.push({ x: x - (c.width >> 1), y: y - c.height + 1, c: rgbHex(d[i], d[i + 1], d[i + 2]) }); }
  } else for (let i = 0; i < 70; i++) p.push({ x: ((i * 7) % 10) - 5, y: -((i * 3) % 12) - 3, c: i % 3 ? k.color : k.color2 });
  EnemyPixCache.set(k, p); return p;
}
