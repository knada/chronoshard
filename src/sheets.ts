// ===== Chronoshard sprite sheets: the drawn characters, enemies, props and effects =====
// The game loads sprite-sheets-webp/, made from the PNG masters in sprite-sheets/ by `npm run sprites`: WebP, each sheet
// downscaled as far as its on-screen size allows (its `scale`). manifest.json lists each sheet: its grid, frame names and a pivot (the feet for walkers, the centre for flyers
// and effects). Frames are cropped to their art on load and keep their pivot, so drawing code places a frame by
// where its feet (or centre) should be. Each sheet has its own generated-sprite fallback while it loads.
import { flipCanvas, mkCanvas, rotCanvas, silhouette } from './pixel.js';
import type { EnemyKind, EnemyMove, Recolor } from './types.js';

interface ManifestEntry { name: string; file: string; columns: number; rows: number; pivot: { x: number; y: number }; frames: string[]; gameId?: string; itemId?: string;
  /** sheet pixels per pixel of the drawn original; frameSize and pivots are given in original pixels */
  scale?: number }
interface Manifest { frameSize: { width: number; height: number }; collections: { characters: ManifestEntry[]; enemies: ManifestEntry[]; effects: ManifestEntry[]; props?: ManifestEntry[] } }
/** one frame cropped to its art: px, py is the pivot inside the crop; top is the first row with art */
export interface SheetFrame { c: HTMLCanvasElement; px: number; py: number; top: number }
/** scale: sheet pixels per pixel of the drawn original (code sized for the originals divides by it) */
export interface Sheet { name: string; id: string; frames: SheetFrame[]; names: string[]; scale: number }
interface SheetAsset { entry: ManifestEntry; url: string; requested?: boolean; sheet?: Sheet; recolor?: Recolor; name?: string }

/** dialogue speaker names that don't match a sheet's name exactly */
export const SPEAKER_ALIAS: Record<string, string> = { Kid: 'Ashvale Kid', Child: 'Elderwood Child', Hermit: 'Woodcutter', Pilgrim: 'Herbalist',
  'Clockmaker Tamsin': 'Old Fenn', Gatewarden: 'Watchman', 'Cogspire Kid': 'Ashvale Kid', Lamplighter: 'Woodcutter' };
/** NPCs who use a party member's sheet before they join */
/** NPCs who use a party member's sheet before they join, and townsfolk of later ages drawn with an earlier sheet */
export const NPC_ALIAS: Record<string, string> = { lyraNpc: 'lyra', hermit: 'vman', pilgrim: 'shopP', innC: 'innkeep', shopC: 'shop1', tamsin: 'old1',
  gatewarden: 'guard', ckid: 'kid1', lamplighter: 'vman' };
/** how tall Kael's standing frame is drawn, in art pixels; every character shares the same scale */
const HERO_HEIGHT = 36;
/** a frame's size in original pixels (manifest frameSize) */
let FW0 = 384, FH0 = 384;

export const Sheets = {
  ready: false,
  chars: new Map<string, SheetAsset>(), byName: new Map<string, SheetAsset>(), enemies: new Map<string, SheetAsset>(), effects: new Map<string, SheetAsset>(),
  props: new Map<string, SheetAsset>(),
  /** art pixels per sheet pixel for characters */
  charScale: 0.1,
  variants: new Map<string, SheetFrame>(),
  /** Read the index once. Gameplay requests only the sprites and effects it encounters. */
  async load(base = 'sprite-sheets-webp/'): Promise<void> {
    try {
      const res = await fetch(base + 'manifest.json'); if (!res.ok) return;
      const m = await res.json() as Manifest, C = m.collections;
      FW0 = m.frameSize.width; FH0 = m.frameSize.height;
      const asset = (entry: ManifestEntry): SheetAsset => ({ entry, url: base + entry.file });
      for (const e of C.characters) {
        const a = asset(e);
        this.chars.set(e.gameId || e.name, a); this.byName.set(e.name, a);
      }
      for (const e of C.enemies) this.enemies.set(e.name, asset(e));
      for (const e of C.effects) this.effects.set(e.name, asset(e));
      for (const e of C.props ?? []) this.props.set(e.gameId || e.name, asset(e));
      this.ready = true;
      this.char('kael'); // ready for a new game while the title is on screen
    } catch (err) { console.warn('sprite sheets unavailable, using generated sprites', err); }
  },
  /** a character's sheet by game id (party member or NPC id), or by a dialogue speaker's name */
  char(id: string): Sheet | undefined { return requestSheet(this.chars.get(NPC_ALIAS[id] || id)); },
  speaker(name: string): Sheet | undefined { return requestSheet(this.byName.get(SPEAKER_ALIAS[name] || name)); },
  enemy(name: string): Sheet | undefined { return requestSheet(this.enemies.get(name)); },
  /** an enemy's sheet: its own, or the recoloured sheet its `art` borrows */
  enemyOf(k: EnemyKind): Sheet | undefined { return requestSheet(recolored(this.enemies, k.name, k.art)); },
  /** the effect an enemy move plays: its own sheet, or the recoloured one its `art` borrows */
  moveEffect(m: EnemyMove): Sheet | undefined { return requestSheet(recolored(this.effects, m.name, m.art)); },
  prop(id: string): Sheet | undefined { return requestSheet(this.props.get(id)); },
  effect(name: string): Sheet | undefined { return requestSheet(this.effects.get(name)); },
  /** a frame mirrored, as a white silhouette, or lying down; made once and kept */
  variant(s: Sheet, i: number, kind: 'flip' | 'flash' | 'flipflash' | 'ko'): SheetFrame {
    const key = `${s.id}:${i}:${kind}`; let v = this.variants.get(key);
    if (!v) {
      const f = s.frames[i];
      if (kind === 'flip') v = { c: flipCanvas(f.c), px: f.c.width - f.px, py: f.py, top: f.top };
      else if (kind === 'flash') v = { ...f, c: silhouette(f.c, '#ffffff') };
      else if (kind === 'flipflash') { const fl = this.variant(s, i, 'flip'); v = { ...fl, c: silhouette(fl.c, '#ffffff') }; }
      else { const r = rotCanvas(f.c); v = { c: r, px: r.width / 2, py: r.height, top: 0 }; } // lying on the ground, feet left
      this.variants.set(key, v);
    }
    return v;
  },
};
/**
 * the asset for `name` in `assets`: its own sheet if the manifest has one, else (with `art`) a recoloured copy of the
 * sheet `art` borrows, made once and kept under `name`
 */
function recolored(assets: Map<string, SheetAsset>, name: string, art?: Recolor): SheetAsset | undefined {
  const own = assets.get(name);
  if (own || !art) return own;
  const base = assets.get(art.from); if (!base) return undefined;
  const copy: SheetAsset = { entry: base.entry, url: base.url, recolor: art, name };
  assets.set(name, copy);
  return copy;
}
function requestSheet(asset: SheetAsset | undefined): Sheet | undefined {
  if (!asset) return;
  if (!asset.requested) { asset.requested = true; void loadSheet(asset); }
  return asset.sheet;
}

async function loadSheet(asset: SheetAsset): Promise<void> {
  try {
    const res = await fetch(asset.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bmp = await createImageBitmap(await res.blob());
    try {
      const sheet = cropSheet(asset.entry, bmp);
      if (asset.recolor) {
        const r = asset.recolor;
        for (const f of sheet.frames) f.c = recolorCanvas(f.c, r);
        sheet.name = sheet.id = asset.name ?? sheet.name;
      }
      const front = sheet.frames[0];
      if (sheet.id === 'kael' && front && front.py > front.top) Sheets.charScale = HERO_HEIGHT / (front.py - front.top);
      asset.sheet = sheet;
    } finally { bmp.close(); }
  } catch (err) { console.warn(`Sprite sheet unavailable: ${asset.entry.file}`, err); }
}
/**
 * cuts a decoded sheet into frames, each cropped to the bounding box of its art (plus a pixel of margin) with its
 * pivot kept. The sheet is read back once; each frame's box is found by scanning in from its edges, so only the
 * empty margins are read.
 */
/** a copy of `src` with every pixel's hue turned and its saturation and lightness scaled (see Recolor) */
export function recolorCanvas(src: HTMLCanvasElement, r: Recolor): HTMLCanvasElement {
  const [c, g] = mkCanvas(src.width, src.height); g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  recolorPixels(img.data, r);
  g.putImageData(img, 0, 0);
  return c;
}
/** recolours RGBA pixel data in place, through HSL (see Recolor); transparent pixels are left alone */
export function recolorPixels(d: Uint8ClampedArray, { hue = 0, colorize, sat = 1, light = 1 }: Recolor): void {
  const turn = (((hue / 360) % 1) + 1) % 1;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const dd = max - min; s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
      h = max === r ? (g - b) / dd + (g < b ? 6 : 0) : max === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h /= 6;
    }
    if (colorize === undefined) h = (h + turn) % 1;
    else { h = colorize / 360; s = Math.max(s, 0.45); } // a tone: even greys take the hue
    s = Math.min(1, s * sat); l = Math.min(1, l * light);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const ch = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    d[i] = Math.round(ch(h + 1 / 3) * 255); d[i + 1] = Math.round(ch(h) * 255); d[i + 2] = Math.round(ch(h - 1 / 3) * 255);
  }
}
function cropSheet(e: ManifestEntry, bmp: ImageBitmap): Sheet {
  const k = e.scale ?? 1, FW = FW0 * k, FH = FH0 * k, pivot = { x: e.pivot.x * k, y: e.pivot.y * k }; // this sheet's grid
  const scan = document.createElement('canvas'); scan.width = bmp.width; scan.height = bmp.height;
  const g = scan.getContext('2d', { willReadFrequently: true })!; g.drawImage(bmp, 0, 0);
  const W = bmp.width, d = g.getImageData(0, 0, bmp.width, bmp.height).data;
  const solid = (x: number, y: number) => d[(y * W + x) * 4 + 3] > 24;
  const frames = e.frames.map((_, i): SheetFrame => {
    const x0 = (i % e.columns) * FW, y0 = Math.floor(i / e.columns) * FH;
    const rowHit = (y: number) => { for (let x = x0; x < x0 + FW; x++) if (solid(x, y)) return true; return false; };
    let top = y0; while (top < y0 + FH && !rowHit(top)) top++;
    if (top >= y0 + FH) { const [c] = mkCanvas(1, 1); return { c, px: 0, py: 0, top: 0 }; }
    let bot = y0 + FH - 1; while (bot > top && !rowHit(bot)) bot--;
    const colHit = (x: number) => { for (let y = top; y <= bot; y++) if (solid(x, y)) return true; return false; };
    let left = x0; while (left < x0 + FW && !colHit(left)) left++;
    let right = x0 + FW - 1; while (right > left && !colHit(right)) right--;
    const minX = Math.max(x0, left - 1), minY = Math.max(y0, top - 1), maxX = Math.min(x0 + FW - 1, right + 1), maxY = Math.min(y0 + FH - 1, bot + 1);
    const [c, cg] = mkCanvas(maxX - minX + 1, maxY - minY + 1);
    cg.drawImage(bmp, minX, minY, c.width, c.height, 0, 0, c.width, c.height);
    return { c, px: pivot.x - (minX - x0), py: pivot.y - (minY - y0), top: top - minY };
  });
  return { name: e.name, id: e.gameId || e.itemId || e.name, frames, names: e.frames, scale: k };
}
