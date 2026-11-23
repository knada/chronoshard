import { ART_H, Frame, TILE, VW } from './engine.js';
import { Space } from './space.js';
import type { Grade } from './engine.js';
import { PAL, hexRgb } from './pixel.js';
import { MapRender } from './tiles.js';
import { ENEMIES } from './data.js';
import { Battle } from './battle.js';
import { G } from './game.js';
import type { EnemyKind, EnemyShape, Light, MapDef, RGB } from './types.js';

export type ParticleKind = 'petals' | 'pollen' | 'fireflies' | 'ash' | 'motes';
/** a map's mood: ambient light colour, ambient particles, optional cloud shadows / light rays / a light around the party, and its colour grade */
export interface EraFx { ambient: RGB; particles: ParticleKind; clouds?: boolean; rays?: boolean; party?: number; grade: Grade; fog: RGB; sun: number }
/** one ambient particle in world space */
export interface Mote { x: number; y: number; ph: number; s: number; life: number; c: string; ember?: boolean }
/** how much light a glowing creature gives off, by shape */
const EMIT: Partial<Record<EnemyShape, { dy: number; r: number; i: number; c?: string }>> = {
  wisp: { dy: -10, r: 64, i: 1 }, voidwisp: { dy: -10, r: 64, i: 1 }, hollow: { dy: -16, r: 120, i: 0.9, c: '#b070ff' },
  sentinel: { dy: -13, r: 34, i: 0.6, c: '#6ae0ff' }, emberblob: { dy: -4, r: 30, i: 0.55, c: '#ff9040' },
};
const WANT: Record<ParticleKind, number> = { petals: 22, pollen: 18, fireflies: 26, ash: 50, motes: 40 };

// ===== Chronoshard atmosphere: per-era light map, bloom, particles, cloud shadows, light rays, vignette =====
export const ERA_FX: Record<string, EraFx> = {
  town: { ambient: [255, 246, 228], particles: 'petals', clouds: true, fog: [178, 200, 226], sun: 1, grade: { lift: [0.02, 0.02, 0.06], gain: [1.04, 1.0, 0.94], sat: 1.1, con: 1.05 } },
  fields: { ambient: [255, 244, 222], particles: 'pollen', clouds: true, fog: [186, 210, 234], sun: 1, grade: { lift: [0.01, 0.03, 0.06], gain: [1.05, 1.02, 0.92], sat: 1.12, con: 1.05 } },
  forest: { ambient: [176, 204, 158], particles: 'fireflies', rays: true, party: 0.25, fog: [34, 58, 44], sun: 0.6, grade: { lift: [0.0, 0.04, 0.05], gain: [1.02, 1.03, 0.9], sat: 1.06, con: 1.08 } },
  village: { ambient: [232, 214, 176], particles: 'fireflies', rays: true, fog: [86, 78, 62], sun: 0.75, grade: { lift: [0.03, 0.02, 0.05], gain: [1.07, 0.99, 0.86], sat: 1.05, con: 1.06 } },
  ruins: { ambient: [112, 128, 160], particles: 'ash', party: 0.35, fog: [20, 24, 38], sun: 0.25, grade: { lift: [0.02, 0.03, 0.08], gain: [0.95, 1.0, 1.08], sat: 0.85, con: 1.1 } },
  core: { ambient: [84, 64, 124], particles: 'motes', party: 0.4, fog: [22, 12, 40], sun: 0.1, grade: { lift: [0.05, 0.0, 0.09], gain: [1.04, 0.95, 1.1], sat: 1.05, con: 1.1 } },
};
export const Atmos = {
  parts: [] as Mote[], mapId: null as string | null, t: 0,
  init() { /* lighting, bloom and vignette live in world3d.ts */ },
  fx(map: MapDef): EraFx { return ERA_FX[map.id] || ERA_FX.town; },
  update(dt: number, map: MapDef, cx: number, cy: number): void {
    this.t += dt;
    if (this.mapId !== map.id) { this.parts = []; this.mapId = map.id; }
    const f = this.fx(map), vw = VW * TILE, vh = ART_H, P = this.parts;
    const want = WANT[f.particles];
    while (P.length < want) P.push(this.spawn(f.particles, cx, cy, vw, vh, P.length < want * 0.9 && this.t < 0.2));
    for (const p of P) {
      p.life -= dt; p.ph += dt;
      if (f.particles === 'petals') { p.x += (14 + Math.sin(p.ph * 2) * 10) * dt; p.y += 12 * dt; }
      else if (f.particles === 'pollen') { p.x += Math.sin(p.ph * 0.9) * 6 * dt; p.y += Math.cos(p.ph * 0.7) * 4 * dt - 2 * dt; }
      else if (f.particles === 'fireflies') { p.x += Math.sin(p.ph * 0.8 + p.s) * 9 * dt; p.y += Math.cos(p.ph * 0.6 + p.s) * 7 * dt; }
      else if (f.particles === 'ash') { if (p.ember) { p.y -= 14 * dt; p.x += Math.sin(p.ph * 3) * 6 * dt; } else { p.y += 9 * dt; p.x += (4 + Math.sin(p.ph) * 4) * dt; } }
      else if (f.particles === 'motes') { p.y -= (8 + p.s * 6) * dt; p.x += Math.sin(p.ph * 1.5 + p.s) * 5 * dt; }
      const sx = p.x - cx, sy = p.y - cy;
      if (sx < -20 || sy < -20 || sx > vw + 20 || sy > vh + 20) p.life = 0;
    }
    this.parts = P.filter(p => p.life > 0);
  },
  spawn(kind: ParticleKind, cx: number, cy: number, vw: number, vh: number, anywhere: boolean): Mote {
    const r = Math.random, p: Mote = { x: cx + r() * vw, y: cy + r() * vh, ph: r() * 10, s: r() * 6, life: 4 + r() * 6, c: '' };
    if (!anywhere) {
      if (kind === 'petals') { if (r() < 0.5) { p.x = cx - 8; } else { p.y = cy - 8; } }
      if (kind === 'ash') { p.ember = r() < 0.2; if (p.ember) p.y = cy + vh + 4; else p.y = cy - 6; }
      if (kind === 'motes') p.y = cy + vh + 4;
    } else if (kind === 'ash') p.ember = r() < 0.2;
    p.c = kind === 'petals' ? (r() < 0.6 ? '#ffb4dc' : PAL.white) : kind === 'pollen' ? '#fff2a8' : kind === 'fireflies' ? '#d4ff6a' : kind === 'ash' ? (p.ember ? '#ff9a3a' : '#a0a0b0') : (r() < 0.5 ? PAL.lilac : '#ff8ae0');
    return p;
  },
  // extra: [{x,y,r,c,i}] world-space lights (party, spells).
  // Hands the lights, era mood and grade to the compositor (Frame) and draws the particles: glowing kinds on the
  // glow layer (they bloom), the rest on the world so they're lit like everything else.
  draw(map: MapDef, cx: number, cy: number, extra: Light[] = []): void {
    const f = this.fx(map), t = this.t, vw = VW * TILE, vh = ART_H;
    Frame.t = t;
    Frame.ambient = f.ambient; Frame.grade = f.grade; Frame.fog = f.fog; Frame.sun = f.sun; Frame.clouds = f.clouds ? 1 : 0; Frame.rays = f.rays ? 1 : 0;
    const R = MapRender.get(map), L = [...R.lights, ...extra];
    for (const rf of map.rifts || []) if (G.flags && G.flags[rf.flag]) L.push({ x: rf.x * TILE + 8, y: rf.y * TILE + 8, r: 56, c: [190, 120, 255], i: 0.9, pulse: true, h: 10 });
    // glowing creatures light their surroundings
    const glowers = G.mode === 'battle' ? Battle.enemies.filter(e => !e.dead).map((e): [EnemyKind, number, number] => [e.k, e.x, e.y]) : (G.foes || []).map((e): [EnemyKind, number, number] => [ENEMIES[e.def.kind], e.x, e.y]);
    for (const [k, ex, ey] of glowers) { const e = EMIT[k.shape]; if (e) L.push({ x: ex + 8, y: ey + e.dy, r: e.r, c: hexRgb(e.c || k.color), i: e.i, pulse: true, h: Math.max(4, Space.up(16 - e.dy)) }); } // dy is above their feet
    if (f.party && G.player && G.mode !== 'battle') L.push({ x: G.player.x + 8, y: G.player.y + 8, r: 64, c: [255, 236, 200], i: f.party, h: 14 });
    for (const l of L) {
      const sx = l.x - cx, sy = l.y - cy; if (sx < -l.r || sy < -l.r || sx > vw + l.r || sy > vh + l.r) continue;
      let k = l.i; if (l.flicker) k *= 0.9 + 0.1 * Math.sin(t * 13 + l.x); if (l.pulse) k *= 0.75 + 0.25 * Math.sin(t * 2.4 + l.x * 0.1);
      Frame.lights.push({ ...Space.raised(l.x, l.y, l.h ?? 12), r: l.r, c: l.c, k }); // l.h: how high it hangs (default chest height)
    }
    // particles
    // particles become points floating at different heights over the ground
    for (const p of this.parts) {
      const glowy = f.particles === 'fireflies' || f.particles === 'motes' || !!p.ember, on = f.particles === 'fireflies' ? Math.max(0, Math.sin(p.ph * 2 + p.s)) : 1;
      if (on > 0.05) Frame.particles.push({ ...Space.raised(p.x, p.y, 6 + ((p.s * 7.3) % 1) * 30), c: p.c, a: Math.min(1, p.life) * on, add: glowy });
    }
  },
};
