import { TILE, rng } from './engine.js';
import { PAL, mkCanvas, px, shade, speckle, tint } from './pixel.js';
import type { Light, MapDef } from './types.js';
import type { Ctx } from './pixel.js';

export type GroundType = 'grass' | 'forest' | 'path' | 'flag' | 'metal' | 'void' | 'wood' | 'snow' | 'ice';
export type Side = 'top' | 'bottom' | 'left' | 'right';
/** a tile animated every frame on top of the pre-rendered base */
export type AnimTile = { type: 'water' | 'panel'; x: number; y: number } | { type: 'blink'; x: number; y: number; ph: number; c: string };
/** a map pre-rendered into a ground layer, an above-actors overlay, animated tiles and light sources */
/** pre-rendered map layers; base/over include an apron of border scenery `pad` pixels wide on every side */
export interface MapLayers { base: HTMLCanvasElement; over: HTMLCanvasElement; anim: AnimTile[]; lights: Light[]; pad: number }

// ===== Chronoshard map renderer: autotiled, pre-rendered base + overlay layers, animated tiles, light sources =====
export const TILES: Record<string, { solid: boolean }> = {};
for (const ch of '.,v=sBFMGKnI') TILES[ch] = { solid: false };
for (const ch of '#~WRHDrfLXPk') TILES[ch] = { solid: true };
export function tileAt(map: MapDef, x: number, y: number): string | null { if (x < 0 || y < 0 || x >= map.w || y >= map.h) return null; return map.rows[y][x]; }
export function isSolidTile(ch: string | null | undefined): boolean { const t = ch == null ? undefined : TILES[ch]; return !t || t.solid; }

export const GROUND: Record<string, GroundType> = { '.': 'grass', ',': 'grass', v: 'forest', '=': 'path', s: 'flag', M: 'metal', G: 'metal', K: 'void', F: 'wood', B: 'path', n: 'snow', I: 'ice' };
export const TALL = new Set<string | null>(['W', 'H', 'R', 'D', 'P', 'k', 'L']);
export const GRASSY = new Set<string>(['grass', 'forest', 'snow']);
export const GCOL: Record<GroundType, string> = { grass: PAL.grass, forest: PAL.forest, path: PAL.sand, flag: PAL.rock, metal: PAL.concrete, void: '#1a1028', wood: PAL.tan, snow: '#e6ecf6', ice: '#a8d0ea' };
/** the ground a map is mostly made of, under its trees and walls */
export function defaultGround(map: MapDef): GroundType {
  const flat = map.rows.join('');
  return flat.includes('K') ? 'void' : flat.includes('M') ? 'metal' : flat.includes('n') ? 'snow' : flat.includes('v') ? 'forest' : 'grass';
}
/** a snowbound map: snow-laden trees and rocks */
export const isSnowy = (map: MapDef) => map.rows.some(r => r.includes('n'));

export function pcircle(g: Ctx, cx: number, cy: number, r: number, col: string): void { g.fillStyle = col; for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy) + 0.35); g.fillRect(cx - w, cy + dy, w * 2 + 1, 1); } }
export function pring(g: Ctx, cx: number, cy: number, r: number, col: string): void { g.fillStyle = col; for (let a = 0; a < 6.283; a += 0.5 / r) g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1); }

// ---------- ground painters ----------
export function paintGround(g: Ctx, type: GroundType, X: number, Y: number, r: () => number): void {
  switch (type) {
    case 'grass': case 'forest': {
      const base = type === 'grass' ? PAL.grass : PAL.forest, dark = type === 'grass' ? PAL.leaf : PAL.deep, lite = type === 'grass' ? PAL.lime : PAL.leaf;
      px(g, X, Y, 16, 16, base);
      speckle(g, r, 10, [dark], X, Y);
      for (let i = 0; i < 4; i++) { const x = X + 1 + ((r() * 13) | 0), y = Y + 2 + ((r() * 12) | 0); px(g, x, y, 1, 1, dark); px(g, x + 2, y, 1, 1, dark); px(g, x + 1, y + 1, 1, 1, dark); px(g, x + 1, y - 1, 1, 1, lite); }
      if (type === 'forest' && r() < 0.5) px(g, X + ((r() * 14) | 0), Y + ((r() * 14) | 0), 2, 1, r() < 0.5 ? PAL.tan : PAL.orange);
      break;
    }
    case 'path': px(g, X, Y, 16, 16, PAL.sand); speckle(g, r, 16, [PAL.tan, '#c89c64'], X, Y);
      for (let i = 0; i < 2; i++) { const x = X + 2 + ((r() * 11) | 0), y = Y + 2 + ((r() * 11) | 0); px(g, x, y, 2, 1, PAL.cream); px(g, x, y + 1, 2, 1, PAL.tan); } break;
    case 'flag': px(g, X, Y, 16, 16, PAL.rock);
      px(g, X, Y + 7, 16, 1, PAL.stone); px(g, X, Y + 15, 16, 1, PAL.stone); px(g, X + 5, Y, 1, 7, PAL.stone); px(g, X + 11, Y + 8, 1, 7, PAL.stone);
      px(g, X, Y, 5, 1, '#aeacba'); px(g, X + 6, Y, 10, 1, '#aeacba'); px(g, X, Y + 8, 11, 1, '#aeacba'); px(g, X + 12, Y + 8, 4, 1, '#aeacba');
      speckle(g, r, 3, [PAL.leaf, PAL.grass], X, Y); break;
    case 'metal': {
      px(g, X, Y, 16, 16, PAL.concrete); px(g, X, Y, 16, 1, '#60607a'); px(g, X, Y, 1, 16, '#60607a'); px(g, X + 15, Y, 1, 16, '#2e2e3c'); px(g, X, Y + 15, 16, 1, '#2e2e3c');
      for (const [a, b] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(g, X + a, Y + b, 1, 1, '#82829a');
      const v = r();
      if (v < 0.25) { for (let i = 0; i < 4; i++) px(g, X + 4, Y + 4 + i * 2, 8, 1, '#30303e'); }
      else if (v < 0.5) { speckle(g, r, 10, ['#7a4a30', '#5e3a28', '#94603a'], X + 3, Y + 6, 8, 6); }
      else if (v < 0.65) { let x = X + 3, y = Y + 4; for (let i = 0; i < 8; i++) { px(g, x, y, 1, 1, '#24242e'); x += 1; y += r() < 0.5 ? 1 : 0; } }
      break;
    }
    case 'void': px(g, X, Y, 16, 16, '#1a1028'); px(g, X, Y, 16, 1, '#221636'); px(g, X, Y, 1, 16, '#221636');
      speckle(g, r, 6, ['#2c2044', '#3a2860'], X, Y); if (r() < 0.2) px(g, X + ((r() * 14) | 0), Y + ((r() * 14) | 0), 1, 1, PAL.lilac); break;
    case 'wood': px(g, X, Y, 16, 16, PAL.tan); for (let y = 3; y < 16; y += 4) px(g, X, Y + y, 16, 1, PAL.wood); break;
    case 'snow': { // drifts: soft blue hollows and bright crests
      px(g, X, Y, 16, 16, '#e6ecf6'); speckle(g, r, 10, ['#d2dcec', '#f6f9ff'], X, Y);
      for (let i = 0; i < 3; i++) { const x = X + 1 + ((r() * 11) | 0), y = Y + 2 + ((r() * 12) | 0); px(g, x, y, 4, 1, '#c4d2e8'); px(g, x + 1, y - 1, 3, 1, '#ffffff'); }
      if (r() < 0.25) px(g, X + ((r() * 14) | 0), Y + ((r() * 14) | 0), 1, 1, '#9ab0d0');
      break;
    }
    case 'ice': { // a frozen lake: clear blue with white streaks and the odd crack
      px(g, X, Y, 16, 16, '#a8d0ea'); speckle(g, r, 5, ['#98c4e2', '#bcdcf0'], X, Y);
      for (let i = 0; i < 2; i++) { const x = X + ((r() * 10) | 0), y = Y + 2 + ((r() * 12) | 0); px(g, x, y, 5, 1, '#e4f2fc'); px(g, x + 2, y + 1, 3, 1, '#d0e8f8'); }
      if (r() < 0.3) { let x = X + 3 + ((r() * 8) | 0), y = Y + 3; for (let i = 0; i < 7; i++) { px(g, x, y, 1, 1, '#7aa8cc'); y++; x += r() < 0.5 ? 1 : -1; } }
      break;
    }
  }
}
export function grassEdge(g: Ctx, X: number, Y: number, side: Side, type: GroundType, r: () => number): void {
  const col = GCOL[type], dk = shade(col, 0.3);
  for (let i = 0; i < 16; i++) {
    const d = 1 + ((r() * 3) | 0);
    if (side === 'top') { px(g, X + i, Y, 1, d, col); px(g, X + i, Y + d, 1, 1, dk); }
    if (side === 'bottom') { px(g, X + i, Y + 16 - d, 1, d, col); px(g, X + i, Y + 15 - d, 1, 1, 'rgba(255,255,255,0.15)'); }
    if (side === 'left') { px(g, X, Y + i, d, 1, col); px(g, X + d, Y + i, 1, 1, dk); }
    if (side === 'right') { px(g, X + 16 - d, Y + i, d, 1, col); px(g, X + 15 - d, Y + i, 1, 1, dk); }
  }
}

/** a snow-laden pine: dark tiers, each with a white crest (overlay layer, trunk on the ground layer) */
export function paintPine(o: Ctx, X: number, Y: number, r: () => number): void {
  px(o, X + 7, Y + 8, 2, 6, PAL.bark);
  for (const [w, y] of [[13, 7], [11, 3], [8, -1], [5, -4]] as [number, number][]) {
    const x = X + 8 - (w >> 1);
    px(o, x, Y + y, w, 4, '#1c3a34'); px(o, x + 1, Y + y, w - 2, 1, '#2c5248');
    px(o, x + 1, Y + y - 1, w - 2, 2, '#eef4fc'); px(o, x + 2, Y + y - 1, (w >> 1) - 1, 1, '#ffffff'); // snow lying on the tier
  }
  px(o, X + 7, Y - 6, 2, 2, '#ffffff');
  if (r() < 0.5) px(o, X + 3 + ((r() * 9) | 0), Y + 9, 2, 1, '#d8e4f4');
}
/** snow resting on a rock's crown */
export function snowCap(g: Ctx, X: number, Y: number): void {
  px(g, X + 3, Y + 4, 9, 2, '#eef4fc'); px(g, X + 4, Y + 3, 6, 1, '#ffffff'); px(g, X + 2, Y + 6, 3, 1, '#d8e4f4');
}

// ---------- map build ----------
/** tiles of border scenery around every map, so a view wider than the map never shows black edges */
export const APRON = 10; // the 3D view sees well past the map's edges
/**
 * the map with an apron: filled with its most common border tile (trees, walls, void), except that walkable exits
 * (paths leading off the edge) carry on outward for two tiles
 */
export function apronMap(map: MapDef): MapDef {
  const A = APRON, w = map.w, h = map.h, count: Record<string, number> = {};
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) count[map.rows[y][x]] = (count[map.rows[y][x]] || 0) + 1;
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) count[map.rows[y][x]] = (count[map.rows[y][x]] || 0) + 1;
  const fill = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0], rows: string[] = [];
  for (let y = -A; y < h + A; y++) {
    let r = '';
    for (let x = -A; x < w + A; x++) {
      if (x >= 0 && y >= 0 && x < w && y < h) { r += map.rows[y][x]; continue; }
      const cx = Math.max(0, Math.min(w - 1, x)), cy = Math.max(0, Math.min(h - 1, y)), edge = map.rows[cy][cx];
      const straight = x === cx || y === cy, out = Math.abs(x - cx) + Math.abs(y - cy);
      r += straight && out <= 2 && edge !== fill && !isSolidTile(edge) ? edge : fill;
    }
    rows.push(r);
  }
  return { ...map, w: w + 2 * A, h: h + 2 * A, rows };
}
/**
 * one light per group of touching glow panels, at the group's centre. Lighting each panel separately stacked up to
 * six lights on anything standing among them (Unit-7 in the ruins washed out to white); a group's light instead grows
 * gently with its size, so a bank of panels reads brighter than one panel without blowing out.
 */
export function panelLights(anim: AnimTile[]): Light[] {
  const cells = new Map<string, { x: number; y: number }>(), seen = new Set<string>(), out: Light[] = [];
  for (const a of anim) if (a.type === 'panel') cells.set(`${a.x / TILE},${a.y / TILE}`, a);
  for (const [key] of cells) {
    if (seen.has(key)) continue;
    const group: { x: number; y: number }[] = [], st = [key];
    while (st.length) {
      const k = st.pop()!; if (seen.has(k) || !cells.has(k)) continue;
      seen.add(k); group.push(cells.get(k)!);
      const [tx, ty] = k.split(',').map(Number); st.push(`${tx + 1},${ty}`, `${tx - 1},${ty}`, `${tx},${ty + 1}`, `${tx},${ty - 1}`);
    }
    const n = group.length, x = group.reduce((s, c) => s + c.x, 0) / n + 8, y = group.reduce((s, c) => s + c.y, 0) / n + 8;
    out.push({ x, y, r: 30 + 9 * Math.sqrt(n - 1), c: [80, 200, 255], i: Math.min(0.85, 0.55 + 0.1 * Math.sqrt(n - 1)), pulse: true, h: 4 });
  }
  return out;
}
/** the ground a solid tile stands on: the most common walkable ground among its neighbours, else the map's default */
export function groundUnderAt(map: MapDef, x: number, y: number): GroundType {
  const defGround = defaultGround(map);
  const n: Partial<Record<GroundType, number>> = {};
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const c = tileAt(map, x + dx, y + dy), gt = c == null ? undefined : GROUND[c]; if (gt && gt !== 'path' && gt !== 'flag') n[gt] = (n[gt] || 0) + 1; }
  let best: GroundType = defGround, bn = 0; for (const k of Object.keys(n) as GroundType[]) if (n[k]! > bn) { best = k; bn = n[k]!; }
  return best;
}
export const MapRender = {
  cache: {} as Record<string, MapLayers>,
  get(map: MapDef): MapLayers { return this.cache[map.id] || (this.cache[map.id] = this.buildWithApron(map)); },
  /** builds the map with its apron, then moves positions back to map coordinates and adds the per-map decor */
  buildWithApron(map: MapDef): MapLayers {
    const P = APRON * TILE, R = this.build(apronMap(map));
    for (const a of R.anim) { a.x -= P; a.y -= P; }
    for (const l of R.lights) { l.x -= P; l.y -= P; }
    const g = R.base.getContext('2d')!, o = R.over.getContext('2d')!;
    g.save(); o.save(); g.translate(P, P); o.translate(P, P); this.decor(map, g, o, R.lights); g.restore(); o.restore();
    R.pad = P; return R;
  },
  build(map: MapDef): MapLayers {
    const W2 = map.w * TILE, H2 = map.h * TILE, [base, g] = mkCanvas(W2, H2), [over, o] = mkCanvas(W2, H2);
    const at = (x: number, y: number) => tileAt(map, x, y), anim: AnimTile[] = [], lights: Light[] = [];
    const gnd = (c: string | null): GroundType | undefined => (c == null ? undefined : GROUND[c]);
    const defGround = defaultGround(map), snowy = isSnowy(map);
    const past = map.era === 'Year 400';
    const groundUnder = (x: number, y: number): GroundType => {
      const n: Partial<Record<GroundType, number>> = {}; for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const gt = gnd(at(x + dx, y + dy)); if (gt && gt !== 'path' && gt !== 'flag') n[gt] = (n[gt] || 0) + 1; }
      let best: GroundType = defGround, bn = 0; for (const k of Object.keys(n) as GroundType[]) if (n[k]! > bn) { best = k; bn = n[k]!; } return best;
    };
    // roof groups get their own colour
    const roofCol: Record<string, string> = {}, roofPalette = past ? ['#b8904a'] : ['#b04438', '#4a6aa8', '#3a8a6a', '#9a5a9a'];
    let gid = 0;
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      if (at(x, y) !== 'R' || roofCol[x + ',' + y]) continue;
      const col = roofPalette[gid++ % roofPalette.length], st = [[x, y]];
      while (st.length) { const [a, b] = st.pop()!; if (at(a, b) !== 'R' || roofCol[a + ',' + b]) continue; roofCol[a + ',' + b] = col; st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]); }
    }
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const ch = at(x, y)!, X = x * TILE, Y = y * TILE, r = rng(x * 7919 + y * 104729 + ch.charCodeAt(0) * 31);
      const up = at(x, y - 1), dn = at(x, y + 1), lf = at(x - 1, y), rt = at(x + 1, y);
      const gt = ch === ',' && defGround === 'forest' ? 'forest' : gnd(ch);
      if (gt && ch !== 'B') {
        paintGround(g, gt, X, Y, r);
        if (ch === ',') for (let i = 0; i < 3; i++) { const fx = X + 2 + ((r() * 11) | 0), fy = Y + 2 + ((r() * 11) | 0), pc = [PAL.gold, PAL.pink, PAL.white][i]; px(g, fx - 1, fy, 3, 1, pc); px(g, fx, fy - 1, 1, 3, pc); px(g, fx, fy, 1, 1, PAL.orange); }
        if (gt === 'path' || gt === 'flag') {
          const sides: Record<Side, string | null> = { top: up, bottom: dn, left: lf, right: rt };
          for (const s of Object.keys(sides) as Side[]) { const sc = sides[s], ng = gnd(sc) || (sc && !isSolidTile(sc) ? null : (sc && ['#', 'r', 'f', 'L'].includes(sc) ? groundUnder(x, y) : null)); if (ng && GRASSY.has(ng)) grassEdge(g, X, Y, s, ng, r); }
        }
        if (ch === 'G') { px(g, X + 1, Y + 1, 14, 14, '#1c2438'); px(g, X + 3, Y + 3, 10, 10, '#1e3a58'); px(g, X + 7, Y + 3, 2, 10, '#2a5a80'); px(g, X + 3, Y + 7, 10, 2, '#2a5a80'); anim.push({ type: 'panel', x: X, y: Y }); }
      } else {
        const ug = ['#', 'r', 'f', 'L', 'B', '~'].includes(ch) ? groundUnder(x, y) : null;
        if (ug && ch !== '~' && ch !== 'B') paintGround(g, ug, X, Y, r);
        switch (ch) {
          case '~': case 'B': {
            px(g, X, Y, 16, 16, PAL.water); speckle(g, r, 6, ['#2a62b4'], X, Y);
            const land = (c: string | null) => c !== '~' && c !== 'B' && c !== null;
            if (land(up)) { px(g, X, Y, 16, 2, '#3e3424'); px(g, X, Y + 2, 16, 1, PAL.sea); px(g, X, Y + 3, 16, 1, 'rgba(196,236,255,0.5)'); }
            if (land(dn)) { px(g, X, Y + 15, 16, 1, '#3e3424'); px(g, X, Y + 14, 16, 1, 'rgba(196,236,255,0.45)'); }
            if (land(lf)) { px(g, X, Y, 2, 16, '#3e3424'); px(g, X + 2, Y, 1, 16, 'rgba(196,236,255,0.45)'); }
            if (land(rt)) { px(g, X + 14, Y, 2, 16, '#3e3424'); px(g, X + 13, Y, 1, 16, 'rgba(196,236,255,0.45)'); }
            if (ch === '~') anim.push({ type: 'water', x: X, y: Y });
            else {
              const vert = !(lf === 'B' || rt === 'B') || up === 'B' || dn === 'B';
              if (vert) { px(g, X + 1, Y, 14, 16, PAL.wood); for (let i = 0; i < 16; i += 3) px(g, X + 1, Y + i, 14, 1, PAL.bark); px(g, X + 1, Y, 14, 1, PAL.tan);
                if (lf !== 'B') { px(g, X, Y, 2, 16, PAL.bark); px(g, X, Y + 2, 2, 2, PAL.tan); } if (rt !== 'B') { px(g, X + 14, Y, 2, 16, PAL.bark); px(g, X + 14, Y + 2, 2, 2, PAL.tan); } }
              else { px(g, X, Y + 1, 16, 14, PAL.wood); for (let i = 0; i < 16; i += 3) px(g, X + i, Y + 1, 1, 14, PAL.bark); px(g, X, Y, 16, 2, PAL.bark); px(g, X, Y + 14, 16, 2, PAL.bark); }
            }
            break;
          }
          case '#': {
            px(g, X + 1, Y + 11, 14, 4, 'rgba(10,20,10,0.35)');
            px(g, X + 6, Y + 8, 4, 7, PAL.bark); px(g, X + 7, Y + 8, 1, 6, PAL.wood); px(g, X + 5, Y + 14, 6, 1, PAL.bark);
            if (snowy) { paintPine(o, X, Y, r); break; }
            const cx = X + 8, cy = Y + 3, pastTree = map.era === 'Year 400';
            const c0 = pastTree ? '#123220' : PAL.deep, c1 = pastTree ? '#1e5230' : PAL.forest, c2 = pastTree ? '#2e7438' : PAL.leaf, c3 = pastTree ? PAL.leaf : PAL.grass;
            pcircle(o, cx, cy, 9, c0); pcircle(o, cx, cy - 1, 8, c1);
            pcircle(o, cx - 2, cy - 3, 5, c2); pcircle(o, cx + 3, cy, 4, c2); pcircle(o, cx - 4, cy + 2, 3, c2);
            pcircle(o, cx - 3, cy - 4, 2, c3); px(o, cx - 4, cy - 6, 2, 1, PAL.lime);
            speckle(o, r, 5, [c0], cx - 2, cy + 2, 9, 5); speckle(o, r, 4, [c3], cx - 6, cy - 6, 8, 5);
            break;
          }
          case 'r': px(g, X + 2, Y + 13, 13, 3, 'rgba(10,10,20,0.3)'); pcircle(g, X + 8, Y + 9, 7, '#2e2a3a'); pcircle(g, X + 8, Y + 9, 6, PAL.stone); pcircle(g, X + 7, Y + 8, 5, PAL.rock); pcircle(g, X + 5, Y + 6, 2, '#b8b6c4'); px(g, X + 9, Y + 11, 3, 1, PAL.stone);
            if (snowy) snowCap(g, X, Y); break;
          case 'W': {
            px(g, X, Y, 16, 16, PAL.stone);
            for (let row = 0; row < 4; row++) { const yy = Y + row * 4; px(g, X, yy + 3, 16, 1, '#4c4a58'); for (let xx = (row % 2 ? 4 : 0); xx < 16; xx += 8) { px(g, X + xx, yy, 1, 3, '#4c4a58'); px(g, X + xx + 1, yy, 3, 1, '#8e8c9c'); } }
            if (up !== 'W') { px(g, X, Y, 16, 3, '#a4a2b2'); px(g, X, Y + 3, 16, 1, '#3a3846'); }
            if (dn !== 'W') px(g, X, Y + 14, 16, 2, '#3a3846');
            if (lf !== 'W') px(g, X, Y, 1, 16, '#3a3846'); if (rt !== 'W') px(g, X + 15, Y, 1, 16, '#3a3846');
            break;
          }
          case 'R': {
            const c = roofCol[x + ',' + y] || PAL.brick;
            if (past) {
              px(g, X, Y, 16, 16, c); for (let i = 0; i < 14; i++) px(g, X + ((r() * 16) | 0), Y + ((r() * 14) | 0), 1, 3, r() < 0.5 ? '#8a6430' : '#d8b070');
              if (up !== 'R') { px(g, X, Y, 16, 3, '#7a5428'); px(g, X, Y + 3, 16, 1, '#d8b070'); }
              if (dn !== 'R') for (let i = 0; i < 16; i++) px(g, X + i, Y + 13, 1, 1 + ((r() * 3) | 0), '#7a5428');
            } else {
              for (let row = 0; row < 4; row++) { const yy = Y + row * 4; px(g, X, yy, 16, 4, c); px(g, X, yy, 16, 1, tint(c, 0.22)); px(g, X, yy + 3, 16, 1, shade(c, 0.38)); for (let xx = (row % 2 ? 2 : 6); xx < 16; xx += 8) px(g, X + xx, yy + 1, 1, 2, shade(c, 0.28)); }
              if (up !== 'R') { px(g, X, Y, 16, 2, shade(c, 0.5)); px(g, X, Y + 2, 16, 1, tint(c, 0.4)); }
              if (dn !== 'R') { px(g, X, Y + 13, 16, 1, tint(c, 0.15)); px(g, X, Y + 14, 16, 2, shade(c, 0.6)); }
            }
            if (lf !== 'R') px(g, X, Y, 1, 16, shade(c, 0.55)); if (rt !== 'R') px(g, X + 15, Y, 1, 16, shade(c, 0.55));
            break;
          }
          case 'H': case 'D': {
            const wall = past ? '#d8b888' : PAL.cream, beam = past ? PAL.bark : PAL.wood;
            px(g, X, Y, 16, 16, wall); speckle(g, r, 6, [shade(wall, 0.1)], X, Y);
            px(g, X, Y, 16, 1, beam); px(g, X, Y + 13, 16, 3, PAL.stone); px(g, X, Y + 13, 16, 1, PAL.rock);
            const isH = (c: string | null) => c === 'H' || c === 'D';
            if (!isH(lf)) px(g, X, Y, 2, 13, beam); if (!isH(rt)) px(g, X + 14, Y, 2, 13, beam);
            if (ch === 'H') {
              px(g, X + 4, Y + 3, 8, 7, beam); px(g, X + 5, Y + 4, 6, 5, '#4a7ab8'); px(g, X + 5, Y + 4, 2, 2, '#a8d4f0'); px(g, X + 8, Y + 4, 1, 5, beam); px(g, X + 5, Y + 6, 6, 1, beam);
              px(g, X + 3, Y + 10, 10, 2, PAL.wood); for (let i = 0; i < 4; i++) px(g, X + 4 + i * 2, Y + 9, 1, 1, [PAL.red, PAL.pink, PAL.gold, PAL.red][i]);
            } else {
              px(g, X + 3, Y + 2, 10, 14, PAL.bark); px(g, X + 4, Y + 3, 8, 13, PAL.wood); px(g, X + 5, Y + 2, 6, 1, PAL.bark);
              px(g, X + 6, Y + 4, 1, 11, shade(PAL.wood, 0.3)); px(g, X + 9, Y + 4, 1, 11, shade(PAL.wood, 0.3)); px(g, X + 4, Y + 3, 8, 1, PAL.tan);
              px(g, X + 10, Y + 9, 1, 2, PAL.gold); px(g, X + 2, Y + 15, 12, 1, PAL.rock);
            }
            break;
          }
          case 'f': {
            const L = lf === 'f', Rt = rt === 'f';
            for (const yy of [6, 10]) { px(g, X + (L ? 0 : 2), Y + yy, (Rt ? 16 : 14) - (L ? 0 : 2), 2, PAL.tan); px(g, X + (L ? 0 : 2), Y + yy + 2, (Rt ? 16 : 14) - (L ? 0 : 2), 1, PAL.bark); }
            for (const xx of (Rt ? [1] : [1, 12])) { px(g, X + xx, Y + 4, 3, 11, PAL.wood); px(g, X + xx, Y + 4, 1, 11, PAL.tan); px(g, X + xx, Y + 3, 3, 1, PAL.bark); px(g, X + xx - 1, Y + 14, 5, 1, 'rgba(0,0,0,0.25)'); }
            break;
          }
          case 'L':
            px(g, X + 5, Y + 13, 6, 2, '#2a2438'); px(g, X + 7, Y + 2, 2, 12, '#3a3448'); px(g, X + 7, Y + 2, 1, 12, '#5a5468');
            px(o, X + 4, Y - 3, 8, 1, '#2a2438'); px(o, X + 5, Y - 2, 6, 6, '#2a2438'); px(o, X + 6, Y - 1, 4, 4, PAL.gold); px(o, X + 6, Y - 1, 2, 2, '#fff8c8');
            lights.push({ x: X + 8, y: Y + 1, r: 44, c: [255, 200, 110], i: 0.8, flicker: true, h: 26 }); break;
          case 'X': {
            paintGround(g, 'metal', X, Y, r);
            px(g, X + 1, Y + 12, 15, 4, 'rgba(10,10,20,0.35)');
            for (let i = 0; i < 6; i++) { const cx = X + 2 + ((r() * 10) | 0), cy = Y + 3 + ((r() * 9) | 0), w = 3 + ((r() * 4) | 0), h = 2 + ((r() * 3) | 0), c = ['#6e6864', '#58524e', '#827c76'][i % 3]; px(g, cx, cy, w, h, c); px(g, cx, cy, w, 1, tint(c, 0.3)); px(g, cx, cy + h, w, 1, '#2a2628'); }
            for (let i = 0; i < 4; i++) px(g, X + 4 + i, Y + 3 + i, 1, 1, '#9a5a38');
            break;
          }
          case 'P': {
            px(g, X, Y, 16, 16, '#262a38');
            if (up !== 'P') { px(g, X, Y, 16, 3, '#5a6278'); px(g, X, Y, 16, 1, '#7a8298'); px(g, X, Y + 3, 16, 1, '#14161e'); }
            px(g, X, Y + 5, 16, 3, '#6a7488'); px(g, X, Y + 5, 16, 1, '#a4aec2'); px(g, X, Y + 8, 16, 1, '#2e3242');
            px(g, X, Y + 11, 16, 2, '#4a5266'); px(g, X, Y + 11, 16, 1, '#6a7488');
            const fl = (r() * 12) | 0; px(g, X + fl, Y + 4, 2, 5, '#8a94a8');
            if (dn !== 'P') px(g, X, Y + 15, 16, 1, '#0e1018');
            if (r() < 0.35) { const lx = X + 3 + ((r() * 9) | 0); px(g, lx - 1, Y + 9, 3, 2, '#14161e'); anim.push({ type: 'blink', x: lx, y: Y + 9, ph: r() * 6, c: r() < 0.5 ? '#ff4a4a' : '#4aff9a' }); }
            break;
          }
          case 'k': {
            px(g, X, Y, 16, 16, '#0c0814');
            for (let i = 0; i < 3; i++) { let xx = X + ((r() * 14) | 0), yy = Y + ((r() * 8) | 0); for (let j = 0; j < 5; j++) px(g, xx++, yy++, 1, 1, '#2a1848'); }
            const fl = (c: string | null) => c === 'K' || c === 'G';
            if (fl(dn)) { px(g, X, Y + 13, 16, 1, PAL.lilac); px(g, X, Y + 14, 16, 2, PAL.violet); }
            if (fl(up)) px(g, X, Y, 16, 1, '#3a2060');
            if (fl(lf)) px(g, X, Y, 1, 16, '#4a2a78'); if (fl(rt)) px(g, X + 15, Y, 1, 16, '#4a2a78');
            break;
          }
          default: px(g, X, Y, 16, 16, '#000');
        }
      }
      // cast shadows from tall neighbours (light from the top-left)
      if (!isSolidTile(ch) || ch === 'r' || ch === 'f') {
        if (TALL.has(up)) { px(g, X, Y, 16, 4, 'rgba(20,10,40,0.28)'); px(g, X, Y, 16, 2, 'rgba(20,10,40,0.18)'); }
        if (TALL.has(lf)) px(g, X, Y, 3, 16, 'rgba(20,10,40,0.2)');
      }
    }
    lights.push(...panelLights(anim));
    return { base, over, anim, lights, pad: 0 };
  },
  decor(map: MapDef, g: Ctx, o: Ctx, lights: Light[]): void {
    if (map.id === 'fields') { // clock face on the Old Clocktower
      const cx = 24 * TILE + 8, cy = 2 * TILE + 2;
      pcircle(g, cx, cy, 11, PAL.ink); pcircle(g, cx, cy, 10, PAL.gold); pcircle(g, cx, cy, 8, PAL.cream);
      for (let i = 0; i < 13; i++) { const a = i / 13 * 6.283 - 1.571; px(g, Math.round(cx + Math.cos(a) * 6), Math.round(cy + Math.sin(a) * 6), 1, 1, i === 12 ? PAL.violet : PAL.bark); }
      for (let i = 0; i < 5; i++) px(g, cx, cy - i, 1, 1, PAL.ink); for (let i = 0; i < 4; i++) px(g, cx + i, cy, 1, 1, PAL.ink);
      px(g, 21 * TILE, 0, 7 * TILE, 3, PAL.brick);
    }
    if (map.id === 'core') { // the Heartclock sigil under the Hollow King
      const cx = 12 * TILE + 8, cy = 6 * TILE + 10;
      pring(g, cx, cy, 38, '#3a2266'); pring(g, cx, cy, 30, '#2c1a50'); pring(g, cx, cy, 12, '#4a2a80');
      for (let i = 0; i < 13; i++) { const a = i / 13 * 6.283; px(g, Math.round(cx + Math.cos(a) * 34) - 1, Math.round(cy + Math.sin(a) * 34) - 1, 3, 3, i === 12 ? PAL.pink : PAL.violet); }
      lights.push({ x: cx, y: cy, r: 60, c: [160, 80, 255], i: 0.45, pulse: true });
    }
  },
};

