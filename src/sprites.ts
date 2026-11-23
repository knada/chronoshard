import { ctx, inWorld, snapPx } from './engine.js';
import { Sheets } from './sheets.js';
import type { Sheet } from './sheets.js';
import { PAL, blit, flipCanvas, mkCanvas, outline, paintGrid, pixShadow, px, rotCanvas, shade, silhouette, tint, uiWindow } from './pixel.js';
import { drawEnemy, enemyHeight } from './enemies.js';
import { ENEMIES, LOOKS } from './data.js';
import type { Dir, Look, Pose, View } from './types.js';
import type { Palette } from './pixel.js';

type Pt = [number, number];
/** options for drawHero: a battle pose, mirroring, a hit flash, knocked out, or no ground shadow */
/** sheet: whose drawn sprite sheet to use (party or NPC id) when sheets are loaded; talk: mouth open (NPC sheets) */
export interface HeroDrawOpts { pose?: Pose | null; flip?: boolean; flash?: boolean | number; down?: boolean; noShadow?: boolean; sheet?: string; talk?: boolean }

// ===== Chronoshard hero/NPC sprites: generated 20x32 characters (two tiles tall) per look, view, pose and frame =====
// Slots: s skin S skin-shade r mouth e eye | h hair H hair-shade L hair-light | t top T top-shade U top-light
//        a belt b legs B legs-shade k boots | x beard g goggle-lens M metal-dark m metal-light n wood q gem Q gem-light w white
// Body box is 20x32 (x 0..19, y 0..31, feet on row 31) inside a 48x44 canvas so weapons and spikes have room.
export const HB = { W: 48, H: 44, OX: 14, OY: 8 };
export const HAIR_STYLES = new Set(['spiky', 'long', 'cap', 'short', 'bald', 'hood']);

export function lookPal(look: Look): Palette {
  const s = look.skin, h = look.hair, t = look.top, b = look.bottom;
  return { s, S: shade(s, 0.22), r: shade(s, 0.45), e: PAL.ink, w: PAL.white, h, H: shade(h, 0.32), L: tint(h, 0.35), t, T: shade(t, 0.32), U: tint(t, 0.25),
    a: look.belt || PAL.bark, b, B: shade(b, 0.35), k: look.boots || '#2a1a14', x: '#e6e6f0', g: PAL.orange, M: '#4a5068', m: '#dfe6f2', n: PAL.wood, q: '#6ad8ff', Q: PAL.white };
}

export function heroGrid(look: Look, view: View, fi: number, pose: Pose | null): string[] {
  const g = Array.from({ length: HB.H }, () => Array<string>(HB.W).fill('.'));
  const set = (x: number, y: number, c: string) => { x = Math.round(x) + HB.OX; y = Math.round(y) + HB.OY; if (x >= 0 && x < HB.W && y >= 0 && y < HB.H) g[y][x] = c; };
  const span = (y: number, x0: number, x1: number, c: string) => { for (let x = Math.round(x0); x <= Math.round(x1); x++) set(x, y, c); };
  const line = (x0: number, y0: number, x1: number, y1: number, c: string, th = 1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1), flat = Math.abs(x1 - x0) > Math.abs(y1 - y0);
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; for (let k = 0; k < th; k++) set(flat ? x : x + k, flat ? y + k : y, c); }
  };
  const inEll = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const side = view === 'side', up = view === 'up';
  const style = HAIR_STYLES.has(look.hairStyle) ? look.hairStyle : 'short';
  const b = !pose && fi ? 1 : 0;                                  // walk bob: upper body sinks 1px on step frames
  const lean = pose === 'attack' ? 1 : 0;
  const HX = (pose === 'hurt' ? -1 : 0) + lean, HY = (pose === 'hurt' ? 1 : 0) + b;
  const legF = pose === 'attack' ? 1 : pose ? 0 : fi;

  // ---- weapons ----
  const gem = (cx: number, cy: number) => { set(cx, cy - 1, 'q'); span(cy, cx - 1, cx + 1, 'q'); set(cx, cy, 'Q'); set(cx, cy + 1, 'q'); };
  const weapon = (layer: 'back' | 'front') => {
    const W_ = look.weapon; if (!W_) return;
    if (W_ === 'sword') {
      const blade = (x0: number, y0: number, x1: number, y1: number) => { line(x0, y0, x1, y1, 'm'); set(x1, y1, 'w'); };
      if (!pose) {
        if (view === 'down' && layer === 'back') { line(5, 21 + b, 15, 10 + b, 'M'); line(15, 10 + b, 17, 7 + b, 'n'); }
        if (view === 'side' && layer === 'back') { line(6, 21 + b, 8, 11 + b, 'M'); line(8, 11 + b, 7, 8 + b, 'n'); }
        if (up && layer === 'front') { line(5, 21 + b, 15, 10 + b, 'M'); set(15, 10 + b, 'm'); line(15, 9 + b, 17, 7 + b, 'n'); }
      } else if (layer === 'front') {
        if (pose === 'ready') { span(17, 12, 16, 'M'); blade(14, 16, 18, 5); set(13, 20, 'n'); }
        if (pose === 'attack') { set(17, 15, 'n'); line(20, 13, 20, 17, 'M'); line(21, 15, 31, 15, 'm'); line(21, 14, 30, 14, 'w'); set(32, 15, 'w'); }
        if (pose === 'cast') { span(7, 15, 19, 'M'); blade(17, 6, 18, -5); set(16, 10, 'n'); }
        if (pose === 'victory') { span(2, 1, 4, 'M'); blade(2, 1, 2, -7); }
      }
    } else if (W_ === 'staff') {
      if (layer !== 'front') return;
      if (!pose) {
        const sx = view === 'down' ? 18 : side ? 13 : 1;
        line(sx, 1 + b, sx, 30, 'n'); gem(sx, -1 + b);
      } else if (pose === 'ready') { line(14, 0, 14, 30, 'n'); gem(14, -2); }
      else if (pose === 'cast') { line(17, -4, 17, 22, 'n'); gem(17, -6); }
      else if (pose === 'attack') { line(17, 15, 30, 15, 'n'); gem(32, 15); }
      else if (pose === 'victory') { line(2, -4, 2, 20, 'n'); gem(2, -6); }
    } else if (W_ === 'wrench') {
      if (layer !== 'front') return;
      if (!pose) { const wx = view === 'down' ? 14 : side ? 8 : 5; line(wx, 21 + b, wx, 24 + b, 'M'); span(25 + b, wx - 1, wx + 1, 'm'); }
      else if (pose === 'ready') { line(14, 19, 17, 23, 'M'); span(24, 16, 19, 'm'); set(16, 25, 'm'); set(19, 25, 'm'); }
      else if (pose === 'attack') { line(20, 15, 26, 15, 'M', 2); line(27, 12, 27, 18, 'm'); set(28, 12, 'm'); set(28, 18, 'm'); }
      else if (pose === 'cast') { line(17, 7, 17, 2, 'M'); span(1, 16, 19, 'm'); set(16, 0, 'm'); set(19, 0, 'm'); }
      else if (pose === 'victory') { line(2, 2, 2, -3, 'M'); span(-4, 1, 4, 'm'); set(1, -5, 'm'); set(4, -5, 'm'); }
    }
  };

  // ---- arms (side view uses a shoulder-to-hand limb; front/back view uses hanging sleeves) ----
  const sideHands: Partial<Record<Pose | 'walk', [Pt, Pt]>> & { walk: [Pt, Pt] } = {
    walk: ([[[9, 19], [11, 19]], [[7, 19], [13, 19]], [[12, 19], [9, 19]]] as [Pt, Pt][])[fi],
    ready: [[9, 19], [13, 18]], attack: [[7, 18], [18, 15]], cast: [[13, 10], [16, 8]], hurt: [[6, 16], [7, 17]],
  };
  const armS = (hand: Pt, sleeve: string, skin: string) => { const [hx2, hy2] = hand; line(10 + lean, 14 + b, hx2, hy2, sleeve, 2); span(hy2, hx2, hx2 + 1, skin); span(hy2 + 1, hx2, hx2 + 1, skin); };
  const sw = !pose ? (fi === 1 ? 1 : fi === 2 ? -1 : 0) : 0;
  const armD = (x: number, dy: number, out: number) => { for (let y = 13; y <= 17; y++) span(y + b + dy, x, x + 1, 't'); set(out, 13 + b + dy, out < 10 ? 'U' : 'T'); span(18 + b + dy, x, x + 1, 's'); span(19 + b + dy, x, x + 1, 'S'); };

  weapon('back');
  if (side) armS((pose && sideHands[pose] || sideHands.walk)[0], 'T', 'S');   // far arm, behind the body

  // ---- legs ----
  if (!side) {
    const leg = (lx: number, lift: number) => {
      for (let y = 22; y <= 28 - lift; y++) { span(y, lx, lx + 3, 'b'); set(lx < 10 ? lx + 3 : lx, y, 'B'); }
      for (let y = 29 - lift; y <= 31 - lift; y++) span(y, lx < 10 ? lx - 1 : lx, lx < 10 ? lx + 3 : lx + 4, 'k');
    };
    leg(5, legF === 1 ? 1 : 0); leg(11, legF === 2 ? 1 : 0);
  } else {
    const F = ([[[9, 31], [11, 31]], [[6, 30], [14, 31]], [[8, 31], [12, 30]]] as [Pt, Pt][])[legF];
    const legS = ([fx, fy]: Pt, c: string) => { line(10 + lean, 22, fx, fy - 3, c, 3); for (let y = fy - 2; y <= fy; y++) span(y, fx - 1, fx + 2, 'k'); };
    legS(F[0], 'B'); legS(F[1], 'b');
  }

  // ---- torso ----
  if (!side) {
    span(12 + b, 8, 11, 'S');
    for (let y = 13; y <= 21; y++) {
      const x0 = y === 13 ? 5 : 4, x1 = y === 13 ? 14 : 15;
      span(y + b, x0, x1, 't'); if (!up) { set(x0, y + b, 'U'); set(x0 + 1, y + b, 'U'); }
      set(x1, y + b, 'T'); set(x1 - 1, y + b, 'T');
    }
    for (let y = 15; y <= 19; y++) { set(4, y + b, 'T'); set(15, y + b, 'T'); }
    span(20 + b, 4, 15, 'a'); span(21 + b, 5, 14, 'T');
    if (!up) { set(9, 13 + b, 's'); set(10, 13 + b, 's'); set(9, 14 + b, 'S'); set(10, 14 + b, 'S'); set(9, 20 + b, 'm'); set(10, 20 + b, 'm'); }
  } else {
    span(12 + b, 9 + lean, 11 + lean, 'S');
    for (let y = 13; y <= 21; y++) { span(y + b, 7 + lean, 14 + lean, 't'); set(7 + lean, y + b, 'U'); set(13 + lean, y + b, 'T'); set(14 + lean, y + b, 'T'); }
    span(20 + b, 7 + lean, 14 + lean, 'a'); span(21 + b, 7 + lean, 14 + lean, 'T');
  }

  weapon('front');

  // ---- near arms ----
  if (side) armS((pose && sideHands[pose] || sideHands.walk)[1], 't', 's');
  else if (pose === 'victory') { line(3, 13, 2, 5, 't', 2); span(3, 2, 3, 's'); span(4, 2, 3, 's'); armD(16, 0, 17); }
  else { armD(2, sw, 2); armD(16, -sw, 17); }

  // ---- head ----
  if (side) {
    for (let y = 1; y <= 13; y++) for (let x = 4; x <= 18; x++) if (inEll(x, y, 11, 7, 6, 5.6)) set(x + HX, y + HY, y > 10.6 || x < 7 ? 'S' : 's');
    set(17 + HX, 8 + HY, 's'); set(17 + HX, 9 + HY, 'S');                           // nose
    set(14 + HX, 7 + HY, 'e'); set(14 + HX, 8 + HY, 'e'); set(14 + HX, 9 + HY, 'e'); set(15 + HX, 8 + HY, 'e'); set(15 + HX, 9 + HY, 'e'); set(15 + HX, 7 + HY, 'w');
    set(16 + HX, 11 + HY, 'r'); set(9 + HX, 8 + HY, 'S'); set(9 + HX, 9 + HY, 'S');
  } else {
    for (let y = 1; y <= 13; y++) for (let x = 3; x <= 17; x++) if (inEll(x, y, 10, 7, 6.6, 5.6)) set(x + HX, y + HY, x > 14.5 || y > 11 ? 'S' : 's');
    for (const ex of [3, 17]) { set(ex + HX, 7 + HY, 's'); set(ex + HX, 8 + HY, 'S'); }
    if (!up) {
      for (const ex of [6, 12]) { span(7 + HY, ex + HX, ex + 1 + HX, 'e'); span(8 + HY, ex + HX, ex + 1 + HX, 'e'); span(9 + HY, ex + HX, ex + 1 + HX, 'e'); set(ex + HX, 7 + HY, 'w'); }
      span(11 + HY, 9 + HX, 10 + HX, 'r');
    }
  }

  // ---- hair (mask first, then shaded so highlights sit top-left and shade bottom-right) ----
  const hair = new Map<string, string>(); const H = (x: number, y: number, c = 'h') => hair.set(x + ',' + y, c);
  const headIn = (x: number, y: number) => side ? inEll(x, y, 11, 7, 6.3, 5.9) : inEll(x, y, 10, 7, 6.9, 5.9);
  const box = (x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => boolean = () => true, c = 'h') => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (fn(x, y)) H(x, y, c); };
  const spike = (ax: number, ay: number, by: number, hw: number) => { for (let y = ay; y <= by; y++) { const w = Math.round((y - ay) / Math.max(1, by - ay) * hw); for (let x = ax - w; x <= ax + w; x++) H(x, y); } };
  if (style === 'short' || style === 'spiky' || style === 'long') {
    if (!side) {
      box(2, 0, 18, up ? 11 : 5, headIn);
      if (!up) {
        for (const x of [4, 5, 15, 16]) for (let y = 6; y <= 8; y++) H(x, y);
        for (let x = 5; x <= 15; x++) if (x % 2 === 0 || style === 'long') H(x, 6);
        if (style === 'spiky') for (let x = 5; x <= 15; x += 3) H(x, 7);
      }
      if (style === 'long') { box(2, 6, 4, up ? 19 : 17); box(16, 6, 18, up ? 19 : 17); if (up) box(5, 12, 15, 18); }
      if (style === 'spiky') { spike(4, -1, 3, 2); spike(8, -3, 2, 2); spike(12, -3, 2, 2); spike(16, -1, 3, 2); }
    } else {
      box(3, 0, 18, 10, (x, y) => headIn(x, y) && (y <= 4 || x <= 8));
      for (let x = 10; x <= 15; x++) if (x % 2 === 0 || style === 'long') H(x, 5);
      if (style === 'long') box(4, 8, 9, 17);
      if (style === 'spiky') { spike(6, -1, 2, 2); spike(10, -3, 2, 2); spike(14, -2, 2, 2); for (let i = 0; i < 4; i++) { H(4 - i, 3 + (i >> 1)); H(4 - i, 4 + (i >> 1)); } }
    }
  } else if (style === 'cap') {
    if (!side) { box(2, 0, 18, 4, headIn); if (up) box(2, 5, 18, 10, headIn, 'H'); else { box(3, 5, 17, 5, () => true, 'H'); box(4, 6, 5, 8, () => true, 'H'); box(15, 6, 16, 8, () => true, 'H'); } }
    else { box(3, 0, 18, 4, headIn); box(9, 5, 20, 5, () => true, 'H'); box(5, 5, 8, 9, () => true, 'H'); }
  } else if (style === 'hood') {
    const shell = (x: number, y: number) => inEll(x, y, 10, 7.5, side ? 8.4 : 8.6, 7.6);
    const hole = (x: number, y: number) => !up && (side ? inEll(x, y, 13.2, 8.6, 4.6, 4.6) : inEll(x, y, 10, 8.6, 5.4, 4.6));
    box(0, -1, 19, 15, (x, y) => shell(x, y) && !hole(x, y));
    if (side) box(3, 12, 10, 16); else box(2, 12, 17, up ? 17 : 15, (x, y) => up || !(x >= 7 && x <= 12 && y <= 13));
  }
  for (const [k, c0] of hair) {
    const [x, y] = k.split(',').map(Number);
    let c = c0;
    if (c === 'h') {
      if (y >= 0 && y <= 2 && x >= 4 && x <= 9 && (x + y) % 2 === 0) c = 'L';
      if (x >= (side ? 15 : 15) || !hair.has(x + ',' + (y + 1))) c = 'H';
    }
    set(x + HX, y + HY, c);
  }
  if (style === 'bald') {
    if (!up) { set(7 + HX, 3 + HY, 'L'); set(8 + HX, 3 + HY, 'L'); set(7 + HX, 4 + HY, 'L'); }
    else span(10 + HY, 5 + HX, 15 + HX, 'S');
  }

  // ---- extras ----
  if (look.extra === 'beard' && !up) {
    for (let y = 9; y <= 16; y++) for (let x = 3; x <= 18; x++) {
      if (side ? (inEll(x, y, 13.5, 11, 4, 4) && y >= 9.5 && x >= 11) : (inEll(x, y, 10, 11.2, 5.6, 4.2) && y >= 9.5)) set(x + HX, y + HY, y > 13 ? 'x' : (x + y) % 3 ? 'x' : 'w');
    }
    if (!side) span(10 + HY, 7 + HX, 13 + HX, 'x');
  }
  if (look.extra === 'goggles') {
    if (side) { span(4 + HY, 7 + HX, 17 + HX, 'M'); span(3 + HY, 14 + HX, 16 + HX, 'g'); span(4 + HY, 14 + HX, 16 + HX, 'g'); set(14 + HX, 3 + HY, 'w'); }
    else { span(4 + HY, 4 + HX, 16 + HX, 'M'); if (!up) for (const lx of [6, 12]) { span(3 + HY, lx + HX, lx + 2 + HX, 'g'); span(4 + HY, lx + HX, lx + 2 + HX, 'g'); set(lx + HX, 3 + HY, 'w'); } }
  }
  return g.map(r => r.join(''));
}

export const HeroCache = new Map<Look, Map<string, HTMLCanvasElement>>();
export function heroSprite(look: Look, view: View, fi: number, pose: Pose | null, flip: boolean, flash: boolean): HTMLCanvasElement {
  let byLook = HeroCache.get(look); if (!byLook) { byLook = new Map(); HeroCache.set(look, byLook); }
  const key = `${view}|${fi}|${pose || ''}|${flip ? 1 : 0}|${flash ? 1 : 0}`;
  let c = byLook.get(key); if (c) return c;
  if (flash) c = silhouette(heroSprite(look, view, fi, pose, flip, false), '#ffffff');
  else if (flip) c = flipCanvas(heroSprite(look, view, fi, pose, false, false));
  else if (pose === 'ko') c = rotCanvas(heroSprite(look, 'side', 0, 'hurt', false, false));
  else { const [cv, cg] = mkCanvas(HB.W, HB.H); paintGrid(cg, heroGrid(look, view, fi, pose), lookPal(look)); c = outline(cv); }
  byLook.set(key, c); return c;
}

// x,y = top-left of the 16x16 footprint tile (world px); feet land on row y+15. o: {pose, flip, flash, down}
export function drawHero(x: number, y: number, look: Look, dir: Dir, frame: number, o: HeroDrawOpts = {}): void {
  const sh = o.sheet ? Sheets.char(o.sheet) : undefined;
  if (sh) { drawSheetChar(sh, x, y, dir, frame, o); return; }
  const pose = o.down ? 'ko' : o.pose || null;
  let view: View = dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'side', flip = dir === 'left';
  if (pose) { view = pose === 'victory' ? 'down' : 'side'; flip = !!o.flip; }
  const fi = pose ? 0 : [0, 1, 0, 2][(((frame | 0) % 4) + 4) % 4];
  // in the world, snap to screen pixels (the camera does too, so nothing jitters against the ground)
  if (inWorld()) { x = snapPx(x); y = snapPx(y); } else { x = Math.round(x); y = Math.round(y); }
  if (!o.noShadow) pixShadow(ctx, x + 8, y + 15, pose === 'ko' ? 22 : 14);
  const spr = heroSprite(look, view, fi, pose, flip, !!o.flash);
  if (pose === 'ko') blit(spr, x + 8 - 24, y + 15 - 34, 35);     // rotated: body lies across new rows 15..34
  else blit(spr, x + 8 - (HB.OX + 10), y + 15 - (HB.OY + 31), HB.OY + 32); // feet on row OY+31
}

/**
 * A character from its drawn sheet. Party sheets start with front walk, back walk, and battle poses,
 * followed by named side-walk rows. NPC sheets start with idle, walk, and talk, with side rows for wanderers.
 * Feet land at (x + 8, y + 16).
 */
function drawSheetChar(sh: Sheet, x: number, y: number, dir: Dir, frame: number, o: HeroDrawOpts): void {
  const pose = o.down ? 'ko' : o.pose || null, party = sh.names[6] === 'battle-ready', s = Sheets.charScale;
  const step = [0, 1, 0, 2][(((frame | 0) % 4) + 4) % 4];
  let i: number, flip = false;
  if (pose && pose !== 'ko') {
    i = !party ? 0 : pose === 'victory' ? 8 : pose === 'attack' ? 7 : pose === 'cast' ? (sh.id === 'lyra' ? 7 : 8) : 6;
    flip = !!o.flip && party;
  } else {
    const sideFrame = (party || !o.talk) && (dir === 'left' || dir === 'right')
      ? sh.names.indexOf(`${dir}-${['idle', 'step-a', 'step-b'][step]}`)
      : -1;
    if (sideFrame >= 0) i = sideFrame;
    else if (party) { i = (dir === 'up' ? 3 : 0) + step; flip = dir === 'left'; }
    else { i = o.talk ? 2 : step ? 1 : 0; flip = step === 2 || dir === 'left'; }
  }
  if (inWorld()) { x = snapPx(x); y = snapPx(y); } else { x = Math.round(x); y = Math.round(y); }
  if (!o.noShadow) pixShadow(ctx, x + 8, y + 15, pose === 'ko' ? 22 : 14);
  if (pose === 'ko' && !inWorld()) { // in menus a fallen hero stands faded (lying down they'd run across the text)
    const f = sh.frames[0], a = ctx.globalAlpha; ctx.globalAlpha = a * 0.4; blit(f.c, x + 8 - f.px * s, y + 16 - f.py * s, f.py, s); ctx.globalAlpha = a; return;
  }
  const f = pose === 'ko' ? Sheets.variant(sh, 0, 'ko') : o.flash ? Sheets.variant(sh, i, flip ? 'flipflash' : 'flash') : flip ? Sheets.variant(sh, i, 'flip') : sh.frames[i];
  blit(f.c, x + 8 - f.px * s, y + 16 - f.py * s, f.py, s);
}

// ---------- dialogue portraits ----------
export const PORTRAIT_OF: Record<string, string> = { Kael: 'kael', Bram: 'bram', Lyra: 'lyra', Mom: 'mom', 'Elder Moira': 'elder', Innkeeper: 'inn', Hearthkeeper: 'inn', Watchman: 'villager', 'Old Fenn': 'villager', Woodcutter: 'villager', Kid: 'kid', Child: 'kid', 'Unit-7': 'unit7' };
// draws a framed portrait at screen coords; returns true if one was drawn
export function drawPortrait(name: string, x: number, y: number, t: number): boolean {
  const g = ctx, id = PORTRAIT_OF[name];
  if (name === 'Hollow King' || name === '???') {
    uiWindow(x, y, 132, 132); g.save(); g.beginPath(); g.rect(x + 9, y + 9, 114, 114); g.clip();
    g.fillStyle = PAL.void; g.fillRect(x + 9, y + 9, 114, 114);
    g.save(); g.translate(x + 66, y + 4); g.scale(3, 3); drawEnemy(ENEMIES.hollow, -8, enemyHeight(ENEMIES.hollow) - 13, t || 0, { noShadow: true }); g.restore();
    g.restore(); return true;
  }
  const sh = Sheets.speaker(name);
  if (sh) { // head and shoulders from the standing frame of the drawn sheet
    uiWindow(x, y, 132, 132); px(g, x + 9, y + 9, 114, 114, '#1c2860');
    const f = sh.frames[0], c = f.c, side = Math.min(c.width, (f.py - f.top) * 0.46);
    g.save(); g.beginPath(); g.rect(x + 9, y + 9, 114, 114); g.clip(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(c, (c.width - side) / 2, f.top, side, side, x + 9, y + 11, 114, 114); g.imageSmoothingEnabled = false; g.restore();
    return true;
  }
  if (!id || !LOOKS[id]) return false;
  uiWindow(x, y, 132, 132);
  px(g, x + 9, y + 9, 114, 114, '#1c2860');
  // head-and-shoulders crop of the front-facing sprite: body x -1..20, y -3..18
  const c = heroSprite(LOOKS[id], 'down', 0, null, false, false); g.imageSmoothingEnabled = false;
  g.save(); g.beginPath(); g.rect(x + 9, y + 9, 114, 114); g.clip(); g.drawImage(c, HB.OX - 1, HB.OY - 3, 22, 22, x + 11, y + 11, 110, 110); g.restore();
  return true;
}
