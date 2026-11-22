import { TILE, VH, VW, ctx } from './engine.js';
import { PAL, hexRgb, mkCanvas, px } from './pixel.js';
import { MapRender, pcircle } from './tiles.js';
import { ENEMIES } from './data.js';
import { Battle } from './battle.js';
import { G } from './game.js';
/** how much light a glowing creature gives off, by shape */
const EMIT = {
    wisp: { dy: -10, r: 64, i: 1 }, voidwisp: { dy: -10, r: 64, i: 1 }, hollow: { dy: -16, r: 120, i: 0.9, c: '#b070ff' },
    sentinel: { dy: -13, r: 34, i: 0.6, c: '#6ae0ff' }, emberblob: { dy: -4, r: 30, i: 0.55, c: '#ff9040' },
};
const WANT = { petals: 22, pollen: 18, fireflies: 26, ash: 50, motes: 40 };
// ===== Chronoshard atmosphere: per-era light map, bloom, particles, cloud shadows, light rays, vignette =====
export const ERA_FX = {
    town: { ambient: [255, 246, 228], particles: 'petals', clouds: true },
    fields: { ambient: [255, 244, 222], particles: 'pollen', clouds: true },
    forest: { ambient: [176, 204, 158], particles: 'fireflies', rays: true, party: 0.25 },
    village: { ambient: [232, 214, 176], particles: 'fireflies', rays: true },
    ruins: { ambient: [112, 128, 160], particles: 'ash', party: 0.35 },
    core: { ambient: [84, 64, 124], particles: 'motes', party: 0.4 },
};
export const Atmos = {
    // the light map and vignette are rebuilt at full size by init()
    parts: [], mapId: null, t: 0, lm: mkCanvas(1, 1)[0], lmg: mkCanvas(1, 1)[1], vig: mkCanvas(1, 1)[0],
    init() {
        [this.lm, this.lmg] = mkCanvas(VW * TILE, VH * TILE);
        const [v, g] = mkCanvas(VW * TILE, VH * TILE), cw = VW * TILE, ch = VH * TILE;
        const gr = g.createRadialGradient(cw / 2, ch / 2, ch * 0.35, cw / 2, ch / 2, cw * 0.72);
        gr.addColorStop(0, 'rgba(12,6,24,0)');
        gr.addColorStop(1, 'rgba(12,6,24,0.55)');
        g.fillStyle = gr;
        g.fillRect(0, 0, cw, ch);
        this.vig = v;
    },
    fx(map) { return ERA_FX[map.id] || ERA_FX.town; },
    update(dt, map, cx, cy) {
        this.t += dt;
        if (this.mapId !== map.id) {
            this.parts = [];
            this.mapId = map.id;
        }
        const f = this.fx(map), vw = VW * TILE, vh = VH * TILE, P = this.parts;
        const want = WANT[f.particles];
        while (P.length < want)
            P.push(this.spawn(f.particles, cx, cy, vw, vh, P.length < want * 0.9 && this.t < 0.2));
        for (const p of P) {
            p.life -= dt;
            p.ph += dt;
            if (f.particles === 'petals') {
                p.x += (14 + Math.sin(p.ph * 2) * 10) * dt;
                p.y += 12 * dt;
            }
            else if (f.particles === 'pollen') {
                p.x += Math.sin(p.ph * 0.9) * 6 * dt;
                p.y += Math.cos(p.ph * 0.7) * 4 * dt - 2 * dt;
            }
            else if (f.particles === 'fireflies') {
                p.x += Math.sin(p.ph * 0.8 + p.s) * 9 * dt;
                p.y += Math.cos(p.ph * 0.6 + p.s) * 7 * dt;
            }
            else if (f.particles === 'ash') {
                if (p.ember) {
                    p.y -= 14 * dt;
                    p.x += Math.sin(p.ph * 3) * 6 * dt;
                }
                else {
                    p.y += 9 * dt;
                    p.x += (4 + Math.sin(p.ph) * 4) * dt;
                }
            }
            else if (f.particles === 'motes') {
                p.y -= (8 + p.s * 6) * dt;
                p.x += Math.sin(p.ph * 1.5 + p.s) * 5 * dt;
            }
            const sx = p.x - cx, sy = p.y - cy;
            if (sx < -20 || sy < -20 || sx > vw + 20 || sy > vh + 20)
                p.life = 0;
        }
        this.parts = P.filter(p => p.life > 0);
    },
    spawn(kind, cx, cy, vw, vh, anywhere) {
        const r = Math.random, p = { x: cx + r() * vw, y: cy + r() * vh, ph: r() * 10, s: r() * 6, life: 4 + r() * 6, c: '' };
        if (!anywhere) {
            if (kind === 'petals') {
                if (r() < 0.5) {
                    p.x = cx - 8;
                }
                else {
                    p.y = cy - 8;
                }
            }
            if (kind === 'ash') {
                p.ember = r() < 0.2;
                if (p.ember)
                    p.y = cy + vh + 4;
                else
                    p.y = cy - 6;
            }
            if (kind === 'motes')
                p.y = cy + vh + 4;
        }
        else if (kind === 'ash')
            p.ember = r() < 0.2;
        p.c = kind === 'petals' ? (r() < 0.6 ? '#ffb4dc' : PAL.white) : kind === 'pollen' ? '#fff2a8' : kind === 'fireflies' ? '#d4ff6a' : kind === 'ash' ? (p.ember ? '#ff9a3a' : '#a0a0b0') : (r() < 0.5 ? PAL.lilac : '#ff8ae0');
        return p;
    },
    // extra: [{x,y,r,c,i}] world-space lights (party, spells)
    draw(map, cx, cy, extra = []) {
        const g = ctx, f = this.fx(map), t = this.t, vw = VW * TILE, vh = VH * TILE;
        // cloud shadows drifting over sunny maps
        if (f.clouds) {
            g.fillStyle = 'rgba(30,30,80,0.10)';
            for (let i = 0; i < 3; i++) {
                const span = map.w * TILE + 160, x = ((t * 7 + i * 260) % span) - 80 - cx, y = ((i * 97) % (map.h * TILE)) - cy;
                for (const [dx, dy, rr] of [[0, 0, 26], [22, 6, 20], [-20, 8, 18], [8, -10, 16]])
                    pcircle(g, Math.round(x + dx), Math.round(y + dy), rr, 'rgba(30,30,80,0.07)');
            }
        }
        // light map: ambient + additive lights, multiplied over the scene
        const R = MapRender.get(map), L = [...R.lights, ...extra];
        for (const rf of map.rifts || [])
            if (G.flags && G.flags[rf.flag])
                L.push({ x: rf.x * TILE + 8, y: rf.y * TILE + 8, r: 56, c: [190, 120, 255], i: 0.9, pulse: true });
        // glowing creatures light their surroundings
        const glowers = G.mode === 'battle' ? Battle.enemies.filter(e => !e.dead).map((e) => [e.k, e.x, e.y]) : (G.foes || []).map((e) => [ENEMIES[e.def.kind], e.x, e.y]);
        for (const [k, ex, ey] of glowers) {
            const e = EMIT[k.shape];
            if (e)
                L.push({ x: ex + 8, y: ey + e.dy, r: e.r, c: hexRgb(e.c || k.color), i: e.i, pulse: true });
        }
        if (f.party && G.player && G.mode !== 'battle')
            L.push({ x: G.player.x + 8, y: G.player.y + 8, r: 64, c: [255, 236, 200], i: f.party });
        const lg = this.lmg, [ar, ag, ab] = f.ambient;
        lg.globalCompositeOperation = 'source-over';
        lg.fillStyle = `rgb(${ar},${ag},${ab})`;
        lg.fillRect(0, 0, vw, vh);
        lg.globalCompositeOperation = 'lighter';
        const lit = [];
        for (const l of L) {
            const sx = l.x - cx, sy = l.y - cy;
            if (sx < -l.r || sy < -l.r || sx > vw + l.r || sy > vh + l.r)
                continue;
            let k = l.i;
            if (l.flicker)
                k *= 0.9 + 0.1 * Math.sin(t * 13 + l.x);
            if (l.pulse)
                k *= 0.75 + 0.25 * Math.sin(t * 2.4 + l.x * 0.1);
            const gr = lg.createRadialGradient(sx, sy, 0, sx, sy, l.r);
            gr.addColorStop(0, `rgba(${l.c[0]},${l.c[1]},${l.c[2]},${k})`);
            gr.addColorStop(1, `rgba(${l.c[0]},${l.c[1]},${l.c[2]},0)`);
            lg.fillStyle = gr;
            lg.fillRect(sx - l.r, sy - l.r, l.r * 2, l.r * 2);
            lit.push([sx, sy, l, k]);
        }
        g.save();
        g.globalCompositeOperation = 'multiply';
        g.drawImage(this.lm, 0, 0);
        // bloom on light cores
        g.globalCompositeOperation = 'lighter';
        for (const [sx, sy, l, k] of lit) {
            const rr = l.r * 0.45, gr = g.createRadialGradient(sx, sy, 0, sx, sy, rr);
            gr.addColorStop(0, `rgba(${l.c[0]},${l.c[1]},${l.c[2]},${k * 0.28})`);
            gr.addColorStop(1, `rgba(${l.c[0]},${l.c[1]},${l.c[2]},0)`);
            g.fillStyle = gr;
            g.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
        }
        // light rays through the canopy
        if (f.rays) {
            for (let i = 0; i < 4; i++) {
                const x0 = ((i * 97 + 40) % vw) + Math.sin(t * 0.3 + i) * 10, a = 0.05 + 0.03 * Math.sin(t * 0.5 + i * 2);
                const gr = g.createLinearGradient(0, 0, 0, vh);
                gr.addColorStop(0, `rgba(255,240,180,${a})`);
                gr.addColorStop(1, 'rgba(255,240,180,0)');
                g.fillStyle = gr;
                g.beginPath();
                g.moveTo(x0, 0);
                g.lineTo(x0 + 22, 0);
                g.lineTo(x0 + 22 + vh * 0.5, vh);
                g.lineTo(x0 + vh * 0.5, vh);
                g.fill();
            }
        }
        // particles (glowy kinds are additive)
        for (const p of this.parts) {
            const sx = Math.round(p.x - cx), sy = Math.round(p.y - cy), fade = Math.min(1, p.life);
            if (f.particles === 'fireflies' || f.particles === 'motes' || p.ember) {
                const on = f.particles === 'fireflies' ? Math.max(0, Math.sin(p.ph * 2 + p.s)) : 1;
                if (on <= 0.05)
                    continue;
                g.globalAlpha = on * fade * 0.35;
                px(g, sx - 1, sy - 1, 3, 3, p.c);
                g.globalAlpha = on * fade;
                px(g, sx, sy, 1, 1, p.c);
            }
            else {
                g.globalCompositeOperation = 'source-over';
                g.globalAlpha = fade * 0.9;
                px(g, sx, sy, f.particles === 'petals' ? 2 : 1, 1, p.c);
                g.globalCompositeOperation = 'lighter';
            }
        }
        g.restore();
        g.globalAlpha = 1;
        g.drawImage(this.vig, 0, 0);
    },
};
//# sourceMappingURL=atmos.js.map