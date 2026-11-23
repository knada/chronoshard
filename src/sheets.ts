// ===== Chronoshard sprite sheets: the drawn characters, enemies, props and effects =====
// The game loads sprite-sheets-webp/, made from the PNG masters in sprite-sheets/ by `npm run sprites`: WebP, each sheet
// downscaled as far as its on-screen size allows (its `scale`). manifest.json lists each sheet: its grid, frame names and a pivot (the feet for walkers, the centre for flyers
// and effects). Frames are cropped to their art on load and keep their pivot, so drawing code places a frame by
// where its feet (or centre) should be. Each sheet has its own generated-sprite fallback while it loads.
import { flipCanvas, mkCanvas, rotCanvas, silhouette } from './pixel.js';

interface ManifestEntry { name: string; file: string; columns: number; rows: number; pivot: { x: number; y: number }; frames: string[]; gameId?: string; itemId?: string;
  /** sheet pixels per pixel of the drawn original; frameSize and pivots are given in original pixels */
  scale?: number }
interface Manifest { frameSize: { width: number; height: number }; collections: { characters: ManifestEntry[]; enemies: ManifestEntry[]; effects: ManifestEntry[]; props?: ManifestEntry[] } }
/** one frame cropped to its art: px, py is the pivot inside the crop; top is the first row with art */
export interface SheetFrame { c: HTMLCanvasElement; px: number; py: number; top: number }
/** scale: sheet pixels per pixel of the drawn original (code sized for the originals divides by it) */
export interface Sheet { name: string; id: string; frames: SheetFrame[]; names: string[]; scale: number }
interface SheetAsset { entry: ManifestEntry; url: string; requested?: boolean; sheet?: Sheet }

/** dialogue speaker names that don't match a sheet's name exactly */
const SPEAKER_ALIAS: Record<string, string> = { Kid: 'Ashvale Kid', Child: 'Elderwood Child' };
/** NPCs who use a party member's sheet before they join */
const NPC_ALIAS: Record<string, string> = { lyraNpc: 'lyra' };
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
