// ===== Chronoshard diorama: the map as a lit 3D scene =====
// The 2D maps are drawn in a 3/4 view: a building's front wall sits below its roof on screen. Here that art is folded
// into 3D: wall rows stand up at the building's front edge, roof rows become a pitched roof on top, ruins walls
// become blocks, void tiles become drops off a floating platform, and trees, rocks, fences and lamps become standing
// cards. Characters stand as billboards (world3d.ts places them). Heights are stretched by HS so that, seen from the
// tilted camera, everything keeps the proportions of the original pixel art.
import { TILE, rng } from './engine.js';
import { HS, norm } from './camera.js';
import type { V3 } from './camera.js';
import { PAL, mkCanvas, normalOf, px, speckle } from './pixel.js';
import { APRON, MapRender, apronMap, groundUnderAt, isSnowy, paintGround, paintPine, pcircle, snowCap, tileAt } from './tiles.js';
import type { MapDef } from './types.js';

// ---------- the map as geometry ----------
/** a map built for 3D: map-space textures covering world [ox, ox+w] x [oz, oz+h], plus vertex data (x,y,z, u,v, nx,ny,nz) */
export interface Dio3D {
  ox: number; oz: number; w: number; h: number;
  ground: HTMLCanvasElement; art: HTMLCanvasElement; emis: HTMLCanvasElement; groundMask: HTMLCanvasElement;
  props: HTMLCanvasElement; propsN: HTMLCanvasElement;
  walls: Float32Array; cards: Float32Array; water: Float32Array;
}
const CELL_W = 24, CELL_H = 32, OXC = 4, OYC = 10, FOOT = 26; // prop cell: tile origin at (4,10), ground at row 26

// prop painters (no ground under them): tile origin at X, Y of the cell
function paintTree(o: CanvasRenderingContext2D, X: number, Y: number, r: () => number, past: boolean): void {
  px(o, X + 6, Y + 8, 4, 7, PAL.bark); px(o, X + 7, Y + 8, 1, 6, PAL.wood); px(o, X + 5, Y + 14, 6, 1, PAL.bark);
  const cx = X + 8, cy = Y + 3;
  const c0 = past ? '#123220' : PAL.deep, c1 = past ? '#1e5230' : PAL.forest, c2 = past ? '#2e7438' : PAL.leaf, c3 = past ? PAL.leaf : PAL.grass;
  pcircle(o, cx, cy, 9, c0); pcircle(o, cx, cy - 1, 8, c1);
  pcircle(o, cx - 2, cy - 3, 5, c2); pcircle(o, cx + 3, cy, 4, c2); pcircle(o, cx - 4, cy + 2, 3, c2);
  pcircle(o, cx - 3, cy - 4, 2, c3); px(o, cx - 4, cy - 6, 2, 1, PAL.lime);
  speckle(o, r, 5, [c0], cx - 2, cy + 2, 9, 5); speckle(o, r, 4, [c3], cx - 6, cy - 6, 8, 5);
}
function paintRock(o: CanvasRenderingContext2D, X: number, Y: number, r: () => number): void {
  const dy = (r() * 2) | 0;
  pcircle(o, X + 8, Y + 9 + dy, 7, '#2e2a3a'); pcircle(o, X + 8, Y + 9 + dy, 6, PAL.stone); pcircle(o, X + 7, Y + 8 + dy, 5, PAL.rock);
  pcircle(o, X + 5, Y + 6 + dy, 2, '#b8b6c4'); px(o, X + 9, Y + 11 + dy, 3, 1, PAL.stone);
}
function paintFence(o: CanvasRenderingContext2D, X: number, Y: number, L: boolean, Rt: boolean): void {
  for (const yy of [6, 10]) { px(o, X + (L ? 0 : 2), Y + yy, (Rt ? 16 : 14) - (L ? 0 : 2), 2, PAL.tan); px(o, X + (L ? 0 : 2), Y + yy + 2, (Rt ? 16 : 14) - (L ? 0 : 2), 1, PAL.bark); }
  for (const xx of (Rt ? [1] : [1, 12])) { px(o, X + xx, Y + 4, 3, 11, PAL.wood); px(o, X + xx, Y + 4, 1, 11, PAL.tan); px(o, X + xx, Y + 3, 3, 1, PAL.bark); }
}
function paintLamp(o: CanvasRenderingContext2D, X: number, Y: number): void {
  px(o, X + 5, Y + 13, 6, 2, '#2a2438'); px(o, X + 7, Y + 2, 2, 12, '#3a3448'); px(o, X + 7, Y + 2, 1, 12, '#5a5468');
  px(o, X + 4, Y - 3, 8, 1, '#2a2438'); px(o, X + 5, Y - 2, 6, 6, '#2a2438'); px(o, X + 6, Y - 1, 4, 4, PAL.gold); px(o, X + 6, Y - 1, 2, 2, '#fff8c8');
}

export const Dio = {
  cache: {} as Record<string, Dio3D>,
  get(map: MapDef): Dio3D { return this.cache[map.id] || (this.cache[map.id] = this.build(map)); },
  build(map: MapDef): Dio3D {
    const R = MapRender.get(map), P = R.pad, A = APRON, M = apronMap(map), W2 = M.w * TILE, H2 = M.h * TILE;
    const at = (tx: number, ty: number) => tileAt(M, tx, ty), past = map.era === 'Year 400', snowy = isSnowy(map);
    // ground: the base art with standing things (walls, roofs, trees, props) replaced by the ground they stand on
    const [ground, gg] = mkCanvas(W2, H2); gg.drawImage(R.base, 0, 0);
    const [groundMask, mg] = mkCanvas(W2, H2), [emis, eg] = mkCanvas(W2, H2);
    mg.fillStyle = '#fff'; mg.fillRect(0, 0, W2, H2); mg.fillStyle = '#000';
    const STAND = new Set(['R', 'H', 'D', 'W', 'P', '#', 'r', 'f', 'L']);
    const water: number[] = [];
    for (let ty = 0; ty < M.h; ty++) for (let tx = 0; tx < M.w; tx++) {
      const ch = at(tx, ty)!, X = tx * TILE, Y = ty * TILE;
      if (STAND.has(ch)) {
        paintGround(gg, groundUnderAt(M, tx, ty), X, Y, rng(tx * 7919 + ty * 104729 + 7));
        if ('#rL'.includes(ch)) { gg.fillStyle = 'rgba(10,16,10,0.32)'; gg.fillRect(X + 2, Y + 12, 12, 4); gg.fillRect(X + 4, Y + 11, 8, 1); }
      }
      if (ch === '~' || ch === 'k') mg.fillRect(X, Y, TILE, TILE);
      if (ch === '~') {
        // The reflector lies flat in world space, with its local Y pointing toward negative Z.
        const x = X - P, y = P - Y;
        water.push(x, y, 0, x, y - TILE, 0, x + TILE, y - TILE, 0, x, y, 0, x + TILE, y - TILE, 0, x + TILE, y, 0);
      }
    }
    // emissive: glowing floor panels and the blinking lights on ruins walls (the shader pulses them)
    for (const a of R.anim) {
      const X = a.x + P, Y = a.y + P;
      if (a.type === 'panel') { px(eg, X + 7, Y + 3, 2, 10, '#6ae0ff'); px(eg, X + 3, Y + 7, 10, 2, '#6ae0ff'); px(eg, X + 7, Y + 7, 2, 2, '#ffffff'); }
      else if (a.type === 'blink') px(eg, X, Y, 1, 1, a.c);
    }

    // walls, roofs, ruins blocks, void cliffs: textured from the base art (canvas px = world + P)
    const V: number[] = [];
    const quad = (p: V3[], uv: [number, number][], n: V3) => { for (const i of [0, 1, 2, 0, 2, 3]) V.push(p[i][0], p[i][1], p[i][2], uv[i][0] / W2, uv[i][1] / H2, n[0], n[1], n[2]); };
    const tri = (p: V3[], uv: [number, number][], n: V3) => { for (const i of [0, 1, 2]) V.push(p[i][0], p[i][1], p[i][2], uv[i][0] / W2, uv[i][1] / H2, n[0], n[1], n[2]); };
    const flat = (u: number, v: number): [number, number][] => [[u, v], [u, v], [u, v], [u, v]];
    const BLD = new Set(['R', 'H', 'D', 'W']);
    for (let tx = 0; tx < M.w; tx++) {
      let ty = 0;
      while (ty < M.h) {
        if (!BLD.has(at(tx, ty)!)) { ty++; continue; }
        const t0 = ty; while (ty < M.h && BLD.has(at(tx, ty)!)) ty++;
        let nR = 0; while (at(tx, t0 + nR) === 'R') nR++;
        const nF = ty - t0 - nR; if (nF <= 0) continue;
        const X = (tx - A) * TILE, zB = (ty - A) * TILE, faceTop = zB - nF * TILE; let hw = nF * TILE * HS;
        const u0 = X + P, u1 = X + TILE + P, wallUv = flat(X + P + 8, faceTop + P + 1.5);
        quad([[X, 0, zB], [X + TILE, 0, zB], [X + TILE, hw, zB], [X, hw, zB]], [[u0, zB + P], [u1, zB + P], [u1, faceTop + P], [u0, faceTop + P]], [0, 0, 1]);
        const inRun = (x: number) => BLD.has(at(x, ty - 1)!);
        if (nR > 0) {
          // houses get an upper storey: the window row again (above a door, the nearest window), without its foundation
          let wx = tx; for (const dx of [0, 1, -1, 2, -2, 3, -3]) if (at(tx + dx, ty - 1) === 'H') { wx = tx + dx; break; }
          const uu = (wx - A) * TILE + P, top = hw + 13 * HS;
          quad([[X, hw, zB], [X + TILE, hw, zB], [X + TILE, top, zB], [X, top, zB]], [[uu, faceTop + P + 13], [uu + TILE, faceTop + P + 13], [uu + TILE, faceTop + P], [uu, faceTop + P]], [0, 0, 1]);
          hw = top;
        }
        if (nR > 0) { // pitched roof over the footprint the roof rows describe
          const zF = zB, zK = zB - nR * TILE, mid = (zF + zK) / 2, half = (zF - zK) / 2, rise = nR * TILE * 0.62;
          const rT = (t0 - A) * TILE + P, rB = rT + nR * TILE, rM = (rT + rB) / 2, ov = 3; // eaves overhang the wall a little
          const nf = norm([0, half, rise]), nb = norm([0, half, -rise]);
          quad([[X, hw - ov * rise / half, zF + ov], [X + TILE, hw - ov * rise / half, zF + ov], [X + TILE, hw + rise, mid], [X, hw + rise, mid]], [[u0, rB], [u1, rB], [u1, rM], [u0, rM]], nf);
          quad([[X, hw + rise, mid], [X + TILE, hw + rise, mid], [X + TILE, hw, zK], [X, hw, zK]], [[u0, rM], [u1, rM], [u1, rT], [u0, rT]], nb);
          for (const [sx, edge, n] of [[X, !inRun(tx - 1), [-1, 0, 0]], [X + TILE, !inRun(tx + 1), [1, 0, 0]]] as [number, boolean, V3][]) {
            if (!edge) continue;
            quad([[sx, 0, zK], [sx, 0, zF], [sx, hw, zF], [sx, hw, zK]], wallUv, n);
            tri([[sx, hw, zK], [sx, hw, zF], [sx, hw + rise, mid]], wallUv.slice(0, 3), n);
          }
        } else { // roofless (the clocktower): a stone cap and sides, 20 px deep
          const zK = zB - 20, cap = flat(X + P + 8, faceTop + P + 1);
          quad([[X, hw, zB], [X + TILE, hw, zB], [X + TILE, hw, zK], [X, hw, zK]], cap, [0, 1, 0]);
          if (!inRun(tx - 1)) quad([[X, 0, zK], [X, 0, zB], [X, hw, zB], [X, hw, zK]], flat(X + P + 8, faceTop + P + 8), [-1, 0, 0]);
          if (!inRun(tx + 1)) quad([[X + TILE, 0, zK], [X + TILE, 0, zB], [X + TILE, hw, zB], [X + TILE, hw, zK]], flat(X + P + 8, faceTop + P + 8), [1, 0, 0]);
        }
      }
    }
    const hP = 14 * HS, DROP = 64;
    for (let ty = 0; ty < M.h; ty++) for (let tx = 0; tx < M.w; tx++) {
      const ch = at(tx, ty), X = (tx - A) * TILE, Y = (ty - A) * TILE, cu = X + P, cv = Y + P;
      if (ch === 'P') { // ruins wall block: lip on top, panelled face toward the camera
        quad([[X, hP, Y + TILE], [X + TILE, hP, Y + TILE], [X + TILE, hP, Y], [X, hP, Y]], [[cu, cv + 6], [cu + TILE, cv + 6], [cu + TILE, cv], [cu, cv]], [0, 1, 0]);
        if (at(tx, ty + 1) !== 'P') quad([[X, 0, Y + TILE], [X + TILE, 0, Y + TILE], [X + TILE, hP, Y + TILE], [X, hP, Y + TILE]], [[cu, cv + TILE], [cu + TILE, cv + TILE], [cu + TILE, cv + 4], [cu, cv + 4]], [0, 0, 1]);
        if (at(tx - 1, ty) !== 'P') quad([[X, 0, Y], [X, 0, Y + TILE], [X, hP, Y + TILE], [X, hP, Y]], flat(cu + 8, cv + 9.5), [-1, 0, 0]);
        if (at(tx + 1, ty) !== 'P') quad([[X + TILE, 0, Y], [X + TILE, 0, Y + TILE], [X + TILE, hP, Y + TILE], [X + TILE, hP, Y]], flat(cu + 8, cv + 9.5), [1, 0, 0]);
      }
      if (ch !== 'k' && ch != null) { // platform edges dropping into the void
        const kuv = (dx: number, dy: number): [number, number][] => { const u = cu + dx * TILE, v = cv + dy * TILE; return [[u, v + TILE], [u + TILE, v + TILE], [u + TILE, v], [u, v]]; };
        if (at(tx, ty + 1) === 'k') quad([[X, -DROP, Y + TILE], [X + TILE, -DROP, Y + TILE], [X + TILE, 0, Y + TILE], [X, 0, Y + TILE]], kuv(0, 1), [0, 0, 1]);
        if (at(tx - 1, ty) === 'k') quad([[X, -DROP, Y], [X, -DROP, Y + TILE], [X, 0, Y + TILE], [X, 0, Y]], kuv(-1, 0), [-1, 0, 0]);
        if (at(tx + 1, ty) === 'k') quad([[X + TILE, -DROP, Y + TILE], [X + TILE, -DROP, Y], [X + TILE, 0, Y], [X + TILE, 0, Y + TILE]], kuv(1, 0), [1, 0, 0]);
      }
    }

    // standing cards: trees, rocks, fences and lamps, from a small atlas of variants
    const TREES = 6, ROCKS = 3, cells: string[] = [];
    for (let i = 0; i < TREES; i++) cells.push('tree' + i);
    for (let i = 0; i < ROCKS; i++) cells.push('rock' + i);
    for (const f of ['00', '01', '10', '11']) cells.push('fence' + f);
    cells.push('lamp');
    const cols = 8, [props, pg] = mkCanvas(cols * CELL_W, Math.ceil(cells.length / cols) * CELL_H);
    cells.forEach((name, i) => {
      const X = (i % cols) * CELL_W + OXC, Y = Math.floor(i / cols) * CELL_H + OYC, r = rng(9173 + i * 31);
      if (name.startsWith('tree')) { if (snowy) paintPine(pg, X, Y, r); else paintTree(pg, X, Y, r, past); }
      else if (name.startsWith('rock')) { paintRock(pg, X, Y, r); if (snowy) snowCap(pg, X, Y); }
      else if (name.startsWith('fence')) paintFence(pg, X, Y, name[5] === '1', name[6] === '1');
      else paintLamp(pg, X, Y);
    });
    const propsN = normalOf(props), PW = props.width, PH = props.height, C: number[] = [];
    for (let ty = 0; ty < M.h; ty++) for (let tx = 0; tx < M.w; tx++) {
      const ch = at(tx, ty); if (!ch || !'#rfL'.includes(ch)) continue;
      const hsh = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
      const name = ch === '#' ? 'tree' + (hsh % TREES) : ch === 'r' ? 'rock' + (hsh % ROCKS) : ch === 'L' ? 'lamp' : 'fence' + (at(tx - 1, ty) === 'f' ? 1 : 0) + (at(tx + 1, ty) === 'f' ? 1 : 0);
      const ci = cells.indexOf(name), cx = (ci % cols) * CELL_W, cy = Math.floor(ci / cols) * CELL_H;
      const jx = ch === '#' ? ((hsh >> 8) % 5) - 2 : 0, jz = ch === '#' ? -((hsh >> 12) % 4) : 0; // trees aren't planted on a grid
      const X = (tx - A) * TILE - OXC + jx, z = (ty - A) * TILE + TILE + jz, top = FOOT * HS;
      const uv = [[cx, cy + FOOT], [cx + CELL_W, cy + FOOT], [cx + CELL_W, cy], [cx, cy]];
      const p = [[X, 0, z], [X + CELL_W, 0, z], [X + CELL_W, top, z], [X, top, z]];
      for (const i of [0, 1, 2, 0, 2, 3]) C.push(p[i][0], p[i][1], p[i][2], uv[i][0] / PW, uv[i][1] / PH, 0, 0, 1);
    }
    return { ox: -P, oz: -P, w: W2, h: H2, ground, art: R.base, emis, groundMask, props, propsN, walls: new Float32Array(V), cards: new Float32Array(C), water: new Float32Array(water) };
  },
};
