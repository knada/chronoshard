import { Frame, ctx, inWorld } from './engine.js';
import { Space } from './space.js';
import type { RGB } from './types.js';
import { normalPixels } from './normal-pixels.js';

/** maps a grid character to a colour */
export type Palette = Record<string, string>;
export type Ctx = CanvasRenderingContext2D;

// ===== Chronoshard pixel kit: palette, colour utils, grid sprites, bitmap font, UI frames =====

// ---------- shared palette (~32 colours) ----------
export const PAL = {
  ink: '#140c1c', void: '#1e1430', plum: '#3a2450', violet: '#6a3fa0', lilac: '#a878f0', pink: '#ff6ad5',
  night: '#141a34', navy: '#22305a', steel: '#3c4c78', slate: '#5c6c94', fog: '#94a4c8', mist: '#d4ddf0', white: '#f6f4ea',
  deep: '#173d26', forest: '#24602e', leaf: '#3a8a38', grass: '#5aa844', lime: '#94d05a',
  water: '#2754a0', sea: '#3a7ad0', sky: '#70b8f0', foam: '#c4ecff',
  bark: '#3e2418', wood: '#74482a', tan: '#ad7a4a', sand: '#d6b07a', cream: '#efdcae',
  brick: '#8a3530', red: '#c8503c', orange: '#ec9040', gold: '#f8d060',
  stone: '#6c6a7a', rock: '#8e8c9a', concrete: '#4a4a58',
};

// ---------- colour helpers ----------
export function hexRgb(c: string): RGB { c = c.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); const n = parseInt(c, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function rgbHex(r: number, g: number, b: number): string { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
export function mix(a: string, b: string, t: number): string { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
// shading leans toward cool purple, highlights toward warm cream: classic hue-shifted pixel shading
export function shade(c: string, f = 0.3): string { return mix(c, '#24143a', f); }
export function tint(c: string, f = 0.3): string { return mix(c, '#fff4d4', f); }

export function px(g: Ctx, x: number, y: number, w: number, h: number, c: string): void { g.fillStyle = c; g.fillRect(x, y, w, h); }
export function speckle(g: Ctx, r: () => number, n: number, cols: string[], x0 = 0, y0 = 0, w = 16, h = 16): void { for (let i = 0; i < n; i++) px(g, x0 + ((r() * w) | 0), y0 + ((r() * h) | 0), 1, 1, cols[(r() * cols.length) | 0]); }
export function mkCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; return [c, g]; }

// ---------- grid sprites ----------
// A grid is an array of strings; each char is a palette slot ('.' or ' ' = transparent).
export function paintGrid(g: Ctx, rows: readonly string[], pal: Palette, ox = 0, oy = 0, flipW = 0): void {
  for (let y = 0; y < rows.length; y++) {
    const r = rows[y];
    for (let x = 0; x < r.length; x++) {
      const ch = r[x]; if (ch === '.' || ch === ' ') continue;
      const col = pal[ch]; if (!col) continue;
      g.fillStyle = col; g.fillRect(flipW ? ox + flipW - 1 - x : ox + x, oy + y, 1, 1);
    }
  }
}
// Selective outline: each empty pixel touching an opaque one becomes a dark, hue-shifted version of that neighbour.
export function outline(c: HTMLCanvasElement, strength = 0.62): HTMLCanvasElement {
  const g = c.getContext('2d')!, w = c.width, h = c.height, src = g.getImageData(0, 0, w, h), d = src.data, out = g.createImageData(w, h), o = out.data;
  o.set(d);
  const ink = hexRgb(PAL.ink);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (d[i + 3] > 0) continue;
    let n = -1;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = (Y * w + X) * 4; if (d[j + 3] > 200) { n = j; break; } }
    if (n < 0) continue;
    for (let k = 0; k < 3; k++) o[i + k] = d[n + k] * (1 - strength) * 0.55 + ink[k] * strength;
    o[i + 3] = 255;
  }
  g.putImageData(out, 0, 0); return c;
}
export function silhouette(c: HTMLCanvasElement, color = '#ffffff'): HTMLCanvasElement { const [s, g] = mkCanvas(c.width, c.height); g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); return s; }
export function flipCanvas(c: HTMLCanvasElement): HTMLCanvasElement { const [s, g] = mkCanvas(c.width, c.height); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return s; }
export function rotCanvas(c: HTMLCanvasElement): HTMLCanvasElement { const [s, g] = mkCanvas(c.height, c.width); g.translate(0, c.width); g.rotate(-Math.PI / 2); g.drawImage(c, 0, 0); return s; }
export function gridSprite(rows: readonly string[], pal: Palette, pad = 1): HTMLCanvasElement {
  const w = Math.max(...rows.map(r => r.length)), [c, g] = mkCanvas(w + pad * 2, rows.length + pad * 2);
  paintGrid(g, rows, pal, pad, pad); return outline(c);
}
// contact shadow: in the world it goes to the lighting shader as a soft ellipse; elsewhere (UI) it stays pixel art
export function pixShadow(g: Ctx, cx: number, by: number, w: number): void {
  if (g === ctx && inWorld()) { const [x, z] = Space.map(cx, by - 0.5); Frame.shadows.push({ x, z, w }); return; }
  pixShadowFlat(g, cx, by, w);
}
export function pixShadowFlat(g: Ctx, cx: number, by: number, w: number): void { g.fillStyle = 'rgba(20,12,28,0.32)'; g.fillRect(Math.round(cx - w / 2 + 1), Math.round(by - 1), Math.round(w - 2), 3); g.fillRect(Math.round(cx - w / 2), Math.round(by), Math.round(w), 1); }

// ---------- normal maps: sprites catch light from the side it comes from ----------
const NORMALS = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
/**
 * a normal map for a sprite, generated once: the silhouette is bevelled (distance to the edge, rounded), with a
 * little relief from each pixel's brightness, then turned into per-pixel normals. Alpha marks sprite pixels.
 */
export function normalOf(src: HTMLCanvasElement, radius = 3.5): HTMLCanvasElement {
  const hit = NORMALS.get(src); if (hit) return hit;
  const w = src.width, h = src.height, [c, g] = mkCanvas(w, h);
  NORMALS.set(src, c);
  if (!w || !h) return c;
  const source = src.getContext('2d')!.getImageData(0, 0, w, h), out = g.createImageData(w, h);
  normalPixels(source, out, radius);
  g.putImageData(out, 0, 0);
  return c;
}

let normalWorker: Worker | null | undefined;
let nextNormalId = 0;
const normalJobs = new Map<number, (image: ImageData | null) => void>();

function getNormalWorker(): Worker | null {
  if (normalWorker !== undefined) return normalWorker;
  normalWorker = null;
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return null;
  try {
    const worker = new Worker(new URL('./normal.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: number; result: ImageData | null }>) => {
      const { id, result } = event.data;
      normalJobs.get(id)?.(result);
      normalJobs.delete(id);
    };
    worker.onerror = () => {
      normalWorker = null; worker.terminate();
      for (const finish of normalJobs.values()) finish(null);
      normalJobs.clear();
    };
    normalWorker = worker;
  } catch { /* normalOf remains available for browsers without workers */ }
  return normalWorker;
}

/** Prepares 3D sprite lighting without computing normals during the draw call. */
export async function prepareNormal(src: HTMLCanvasElement, radius: number): Promise<HTMLCanvasElement> {
  const worker = getNormalWorker();
  if (worker) {
    try {
      const bitmap = await createImageBitmap(src);
      const result = await new Promise<ImageData | null>(resolve => {
        if (normalWorker !== worker) { bitmap.close(); resolve(null); return; }
        const id = nextNormalId++;
        normalJobs.set(id, resolve);
        try { worker.postMessage({ id, bitmap, radius }, [bitmap]); }
        catch { normalJobs.delete(id); bitmap.close(); resolve(null); }
      });
      if (result) {
        const [canvas, ctx] = mkCanvas(result.width, result.height);
        ctx.putImageData(result, 0, 0);
        return canvas;
      }
    } catch { /* fall back to generating a normal outside the draw call */ }
  }
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  return normalOf(src, radius);
}
/**
 * draws a sprite: in the world it becomes a 3D billboard standing where row `foot` of the image meets the ground;
 * on the UI layer (menus, portraits, the ending) it's painted
 */
export function blit(img: HTMLCanvasElement, x: number, y: number, foot = img.height, scale = 1): void {
  if (inWorld()) { const [mx, my] = Space.map(x, y); Frame.sprites.push({ img, x: mx, z: my + foot * scale, foot, scale }); return; }
  if (scale !== 1) { // high-resolution sheet art, drawn smaller: smooth it rather than dropping pixels
    const s = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale); ctx.imageSmoothingEnabled = s; return;
  }
  ctx.drawImage(img, x, y);
}

// ---------- bitmap font (5x7, columns LSB-top, ASCII 32..126 + extras) ----------
export const FONT_HEX =
  '0000000000' + '00005f0000' + '0007000700' + '147f147f14' + '242a7f2a12' + '2313086462' + '3649552250' + '0005030000' +
  '001c224100' + '0041221c00' + '082a1c2a08' + '08083e0808' + '0050300000' + '0808080808' + '0060600000' + '2010080402' +
  '3e5149453e' + '00427f4000' + '4261514946' + '2141454b31' + '1814127f10' + '2745454539' + '3c4a494930' + '0171090503' +
  '3649494936' + '064949291e' + '0036360000' + '0056360000' + '0008142241' + '1414141414' + '4122140800' + '0201510906' +
  '3249794136' + '7e1111117e' + '7f49494936' + '3e41414122' + '7f4141221c' + '7f49494941' + '7f09090101' + '3e41415132' +
  '7f0808087f' + '00417f4100' + '2040413f01' + '7f08142241' + '7f40404040' + '7f0204027f' + '7f0408107f' + '3e4141413e' +
  '7f09090906' + '3e4151215e' + '7f09192946' + '4649494931' + '01017f0101' + '3f4040403f' + '1f2040201f' + '7f2018207f' +
  '6314081463' + '0304780403' + '6151494543' + '00007f4141' + '0204081020' + '41417f0000' + '0402010204' + '4040404040' +
  '0001020400' + '2054545478' + '7f48444438' + '3844444420' + '384444487f' + '3854545418' + '087e090102' + '081454543c' +
  '7f08040478' + '00447d4000' + '2040443d00' + '007f102844' + '00417f4000' + '7c04180478' + '7c08040478' + '3844444438' +
  '7c14141408' + '081414187c' + '7c08040408' + '4854545420' + '043f444020' + '3c4040207c' + '1c2040201c' + '3c4030403c' +
  '4428102844' + '0c5050503c' + '4464544c44' + '0008364100' + '00007f0000' + '0041360800' + '0201020402';
export const FONT_EXTRA: Record<string, number[]> = { '→': [0x08, 0x08, 0x2a, 0x1c, 0x08], '▼': [0x04, 0x0c, 0x1c, 0x0c, 0x04], '★': [0x24, 0x1c, 0x0e, 0x1c, 0x24], '·': [0, 0, 0x08, 0, 0], '▶': [0x3e, 0x1c, 0x08, 0, 0], '’': [0, 0x05, 0x03, 0, 0], '—': [8, 8, 8, 8, 8] };
export const Font = {
  atlas: null as HTMLCanvasElement | null, idx: {} as Record<string, number>, tinted: new Map<string, HTMLCanvasElement>(),
  /** true: smooth high-resolution serif drawn at the UI layer's full resolution; false: the 5x7 bitmap font */
  hd: true, family: '"Palatino", "Palatino Linotype", "Book Antiqua", "Iowan Old Style", Georgia, serif',
};
// the HD font is sized so its capitals match the bitmap glyphs' 7-pixel height at the same scale
const hdPx = (size: number) => fontScale(size) * 10;
const hdFont = (size: number) => `600 ${hdPx(size)}px ${Font.family}`;
const MEASURE = document.createElement('canvas').getContext('2d')!, MCACHE = new Map<string, number>();
(function buildFont() {
  const glyphs: number[][] = [];
  for (let i = 0; i < 95; i++) glyphs.push([0, 1, 2, 3, 4].map(k => parseInt(FONT_HEX.substr(i * 10 + k * 2, 2), 16)));
  for (let i = 0; i < 95; i++) Font.idx[String.fromCharCode(32 + i)] = i;
  Font.idx['\u00a0'] = Font.idx[' ']; // non-breaking space: drawn as a space, but wrapText won't break on it
  for (const k in FONT_EXTRA) { Font.idx[k] = glyphs.length; glyphs.push(FONT_EXTRA[k]); }
  const [c, g] = mkCanvas(glyphs.length * 6, 8);
  g.fillStyle = '#fff';
  glyphs.forEach((cols, i) => cols.forEach((bits, x) => { for (let y = 0; y < 8; y++) if (bits >> y & 1) g.fillRect(i * 6 + x, y, 1, 1); }));
  Font.atlas = c;
})();
export function fontAtlas(color: string): HTMLCanvasElement {
  let a = Font.tinted.get(color);
  if (!a) { a = silhouette(Font.atlas!, color); Font.tinted.set(color, a); }
  return a;
}
export function fontScale(size: number): number { return size >= 44 ? 6 : size >= 34 ? 5 : size >= 24 ? 4 : size >= 18 ? 3 : 2; }
export function measure(s: string, size = 16): number {
  const k = fontScale(size);
  if (!Font.hd) return s.length * 6 * k - k;
  const key = k + '|' + s; let w = MCACHE.get(key);
  if (w === undefined) { MEASURE.font = hdFont(size); w = Math.ceil(MEASURE.measureText(s).width); if (MCACHE.size > 4000) MCACHE.clear(); MCACHE.set(key, w); }
  return w;
}
export function glyphRun(g: Ctx, s: string, x: number, y: number, k: number, atlas: HTMLCanvasElement): void {
  for (let i = 0; i < s.length; i++) {
    let gi = Font.idx[s[i]]; if (gi === undefined) gi = Font.idx['?'];
    g.drawImage(atlas, gi * 6, 0, 5, 8, x + i * 6 * k, y, 5 * k, 8 * k);
  }
}
export function text(s: string | number, x: number, y: number, color = '#fff', size = 16, align: 'left' | 'center' | 'right' = 'left'): void {
  s = String(s); const k = fontScale(size), w = measure(s, size);
  x = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x); y = Math.round(y);
  const g = ctx;
  if (Font.hd) {
    // baseline sits where the bitmap glyphs' bottom row was; a soft drop shadow replaces the hard one
    g.font = hdFont(size); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    const by = y + 7 * k, a = g.globalAlpha;
    g.fillStyle = 'rgba(8,4,20,0.85)'; g.fillText(s, x + k * 0.6, by + k * 0.6);
    g.globalAlpha = a; g.fillStyle = color; g.fillText(s, x, by);
    return;
  }
  g.imageSmoothingEnabled = false;
  glyphRun(g, s, x + k, y + k, k, fontAtlas('#0c0818'));
  glyphRun(g, s, x, y, k, fontAtlas(color));
}
export function wrapText(s: string, maxW: number, size = 16): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const w of para.split(' ')) { const t = line ? line + ' ' + w : w; if (measure(t, size) > maxW && line) { out.push(line); line = w; } else line = t; }
    out.push(line);
  }
  return out;
}

// ---------- UI frames (drawn in 3px "pixel units" to match the world scale) ----------
export const UI = { u: 3, light: '#e4e8ff', mid: '#7480c8', dark: '#2a2f6a', top: '#3a4ab0', bot: '#141a52' };
export function uiWindow(x: number, y: number, w: number, h: number, alpha = 0.95): void {
  const g = ctx, u = UI.u; x = Math.round(x / u) * u; y = Math.round(y / u) * u; w = Math.round(w / u) * u; h = Math.round(h / u) * u;
  const a0 = g.globalAlpha; // respect a fade the caller has set
  g.globalAlpha = a0 * alpha * 0.5; px(g, x + u * 2, y + u * 2, w, h, '#05030c'); g.globalAlpha = a0 * alpha;
  px(g, x + u, y, w - u * 2, h, PAL.ink); px(g, x, y + u, w, h - u * 2, PAL.ink);
  px(g, x + u * 2, y + u, w - u * 4, h - u * 2, UI.light); px(g, x + u, y + u * 2, w - u * 2, h - u * 4, UI.light);
  px(g, x + u * 2, y + u * 2, w - u * 4, h - u * 4, UI.mid);
  const ix = x + u * 3, iy = y + u * 3, iw = w - u * 6, ih = h - u * 6;
  const steps = Math.max(1, Math.floor(ih / (u * 4)));
  for (let i = 0; i < steps; i++) { const y0 = iy + Math.floor(ih * i / steps / u) * u, y1 = iy + Math.floor(ih * (i + 1) / steps / u) * u; px(g, ix, y0, iw, y1 - y0, mix(UI.top, UI.bot, i / Math.max(1, steps - 1))); }
  px(g, ix, iy, iw, u, 'rgba(255,255,255,0.14)'); px(g, ix, iy + ih - u, iw, u, 'rgba(0,0,0,0.25)');
  // corner rivets
  for (const [cx, cy] of [[x + u * 2, y + u * 2], [x + w - u * 3, y + u * 2], [x + u * 2, y + h - u * 3], [x + w - u * 3, y + h - u * 3]]) px(g, cx, cy, u, u, PAL.gold);
  g.globalAlpha = a0;
}
export const CURSOR_GRID = ['ww.....', 'wwWW...', 'wwwwWW.', 'wwwwwwW', 'wwwwWW.', 'wwWW...', 'ww.....'];
export let CURSOR_SPR: HTMLCanvasElement | null = null;
export function cursor(x: number, y: number, t: number): void {
  const spr = CURSOR_SPR ??= gridSprite(CURSOR_GRID, { w: PAL.white, W: PAL.fog });
  const o = Math.round(Math.sin(t * 10) * 1.5) * UI.u; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spr, Math.round(x + o - 3), Math.round(y - 3), spr.width * 2 + 3, spr.height * 2 + 3);
}
export function bar(x: number, y: number, w: number, h: number, frac: number, col: string, bg = '#1a1430'): void {
  const u = UI.u, g = ctx; x = Math.round(x); y = Math.round(y);
  px(g, x, y, w, h, PAL.ink); px(g, x + u, y + u, w - u * 2, h - u * 2, bg);
  const fw = Math.round(Math.max(0, Math.min(1, frac)) * (w - u * 2) / u) * u;
  if (fw > 0) { px(g, x + u, y + u, fw, h - u * 2, col); px(g, x + u, y + u, fw, u, tint(col, 0.45)); px(g, x + u, y + h - u * 2, fw, u, shade(col, 0.3)); }
}
