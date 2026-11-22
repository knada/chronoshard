import { H, Input, Sound, TILE, VH, VW, W, ctx } from './engine.js';
import { PAL, cursor, gridSprite, pixShadow, px, text, uiWindow, wrapText } from './pixel.js';
import { PORTRAIT_OF, drawHero, drawPortrait } from './sprites.js';
import { drawEnemy } from './enemies.js';
import { drawMapOverlay, drawMapTiles, isSolidTile, tileAt } from './tiles.js';
import { ENEMIES, EVENTS, HEROES, ITEMS, MAPS, MUSIC, SHOP_STOCK, TALK } from './data.js';
import { Battle, heroStats, knownTechs, xpForLevel } from './battle.js';

import type { Dir, Drawable, EnemySpawn, Flags, HeroId, HeroState, Inventory, ItemId, MapDef, NpcDef, Script } from './types.js';
import type { BattleCfg } from './battle.js';

export type Mode = 'title' | 'field' | 'battle' | 'menu' | 'shop' | 'ending';
export interface Player { x: number; y: number; dir: Dir; frame: number; walk: number }
export interface TrailPoint { x: number; y: number; dir: Dir; frame?: number }
/** an NPC placed on the current map, with its wander state */
export interface NpcState extends NpcDef { px: number; py: number; hx: number; hy: number; wt: number; frame: number; mv?: { dx: number; dy: number; t: number } }
/** an enemy roaming the current map; touching it starts a battle */
export interface Foe { def: EnemySpawn; x: number; y: number; hx: number; hy: number; t: number; vx: number; vy: number; cool: number }
export interface Dialog { who: string; full: string; shown: number; lines: string[]; lw?: number }
/** a story script being played: current command, wait timer, open dialogue, and whether it waits on a battle/shop/warp */
export interface ScriptRun { cmds: Script; i: number; wait: number; dlg: Dialog | null; block?: boolean }
export interface MenuState { tab: number; idx: number; sub: { item: ItemId; who: number } | null; msg: string; focus?: 'items' | null }
export interface SaveData { party: HeroState[]; inv: Inventory; gold: number; flags: Flags; map: string; x: number; y: number }
export interface GameState {
  mode: Mode; t: number; camX: number; camY: number; fade: number; fadeTo: number; shake: number;
  party: HeroState[]; inv: Inventory; gold: number; flags: Flags;
  map: MapDef; player: Player; trail: TrailPoint[]; npcs: NpcState[]; foes: Foe[];
  script: ScriptRun | null; onFade: (() => void) | null; banner: { t: number; name: string; era: string } | null;
  lastTile: { x: number; y: number }; menu: MenuState; shopIdx: number; shopMsg: string; riftFlash: number; endT: number;
}

// ===== Chronoshard game: field, scripts, menus, save, title, ending =====
export const SAVE_KEY = 'chronoshard_save_v1';
export const G: GameState = {
  mode: 'title', t: 0, camX: 0, camY: 0, fade: 0, fadeTo: 0, shake: 0,
  party: [], inv: {}, gold: 0, flags: {},
  map: MAPS.town, player: { x: 0, y: 0, dir: 'down', frame: 0, walk: 0 }, trail: [], npcs: [], foes: [],
  script: null, onFade: null, banner: null,
  lastTile: { x: 0, y: 0 }, menu: { tab: 0, idx: 0, sub: null, msg: '' }, shopIdx: 0, shopMsg: '', riftFlash: 0, endT: 0,
};
export const BOSS_WIN: Record<string, string> = { boss1: 'golemWin', boss2: 'hollowWin' };
export const CHEST_GRIDS = [['..dddddddddddd..', '.dwwwwwwwwwwwwd.', '.dwWWWWWWWWWWwd.', '.yyyyyyyyyyyyyy.', '.dwwwwwyywwwwwd.', '.dwwwwwYYwwwwwd.', '.dWWWWWWWWWWWWd.', '.dWWWWWWWWWWWWd.', '.yyyyyyyyyyyyyy.', '..dddddddddddd..'],
  ['..dddddddddddd..', '.dkkkkkkkkkkkkd.', '.dkkkgkkkkgkkkd.', '.yyyyyyyyyyyyyy.', '.dwwwwwyywwwwwd.', '.dwwwwwYYwwwwwd.', '.dWWWWWWWWWWWWd.', '.dWWWWWWWWWWWWd.', '.yyyyyyyyyyyyyy.', '..dddddddddddd..']];
export const CHEST_PAL = { d: PAL.bark, w: PAL.tan, W: PAL.wood, y: PAL.gold, Y: '#b08020', k: '#1a0e0a', g: '#ffe890' };
export let CHEST_SPR: HTMLCanvasElement[] | null = null;

/** the item ids the party currently holds at least one of */
export function ownedItems(): ItemId[] { return (Object.keys(G.inv) as ItemId[]).filter(k => (G.inv[k] ?? 0) > 0); }
export function newHero(id: HeroId, lv = 1): HeroState { const h: HeroState = { id, lv, xp: xpForLevel(lv), hp: 0, mp: 0 }; const s = heroStats(h); h.hp = s.maxhp; h.mp = s.maxmp; return h; }

export const Game = {
  newGame() {
    Object.assign(G, { party: [newHero('kael')], inv: { tonic: 3 }, gold: 50, flags: {} });
    this.loadMap('town', 2, 4, 'down'); G.mode = 'field';
    this.runScript([['say', '', 'Ashvale, Year 1000. The morning the Clocktower rang thirteen times...'], ['say', 'Mom', "Kael! You're finally up. Bram came by. He's at his workshop, the one southwest."]]);
  },
  save() {
    const d: SaveData = { party: G.party, inv: G.inv, gold: G.gold, flags: G.flags, map: G.map.id, x: Math.round(G.player.x / TILE), y: Math.round(G.player.y / TILE) };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
  },
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } },
  load() {
    let d: SaveData | null; try { d = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'); } catch { d = null; }
    if (!d) return this.newGame();
    Object.assign(G, { party: d.party, inv: d.inv, gold: d.gold, flags: d.flags });
    this.loadMap(d.map, d.x, d.y, 'down'); G.mode = 'field'; G.script = null;
  },
  gameOver() {
    if (this.hasSave()) { this.load(); for (const h of G.party) { const s = heroStats(h); h.hp = s.maxhp; h.mp = s.maxmp; } }
    else this.newGame();
    G.fade = 1; G.fadeTo = 0;
  },

  // ---------- maps ----------
  loadMap(id: string, tx: number, ty: number, dir?: Dir): void {
    const m = MAPS[id]; G.map = m;
    G.player = { x: tx * TILE, y: ty * TILE, dir: dir || 'down', frame: 0, walk: 0 };
    G.trail = []; for (let i = 0; i < 30; i++) G.trail.push({ x: G.player.x, y: G.player.y, dir: G.player.dir });
    G.npcs = (m.npcs || []).map(n => ({ ...n, px: n.x * TILE, py: n.y * TILE, hx: n.x, hy: n.y, wt: 1 + Math.random() * 2, frame: 0 }));
    G.foes = (m.enemies || []).filter(e => !(e.flag && G.flags[e.flag])).map(e => ({ def: e, x: e.x * TILE, y: e.y * TILE, hx: e.x * TILE, hy: e.y * TILE, t: Math.random() * 3, vx: 0, vy: 0, cool: 1.2 }));
    G.lastTile = this.ptile(); G.banner = { t: 3, name: m.name, era: m.era };
    Sound.play(MUSIC[m.music]); this.centerCam();
  },
  ptile() { return { x: Math.floor((G.player.x + 8) / TILE), y: Math.floor((G.player.y + 12) / TILE) }; },
  centerCam() {
    const m = G.map, mw = m.w * TILE, mh = m.h * TILE;
    G.camX = mw <= VW * TILE ? (mw - VW * TILE) / 2 : Math.max(0, Math.min(mw - VW * TILE, G.player.x + 8 - VW * TILE / 2));
    G.camY = mh <= VH * TILE ? (mh - VH * TILE) / 2 : Math.max(0, Math.min(mh - VH * TILE, G.player.y + 8 - VH * TILE / 2));
  },
  visibleNpcs() { return G.npcs.filter(n => !(n.hideIf && G.flags[n.hideIf])); },
  blocked(x: number, y: number, self: Player | NpcState): boolean {
    const pts = [[x + 4, y + 10], [x + 11, y + 10], [x + 4, y + 15], [x + 11, y + 15]];
    for (const [a, b] of pts) if (isSolidTile(tileAt(G.map, Math.floor(a / TILE), Math.floor(b / TILE)))) return true;
    for (const n of this.visibleNpcs()) if (n !== self && x + 11 > n.px + 3 && x + 4 < n.px + 13 && y + 15 > n.py + 9 && y + 10 < n.py + 16) return true;
    for (const c of G.map.chests || []) if (x + 11 > c.x * TILE + 1 && x + 4 < c.x * TILE + 15 && y + 15 > c.y * TILE + 4 && y + 10 < c.y * TILE + 16) return true;
    if (self && self !== G.player && x + 11 > G.player.x + 4 && x + 4 < G.player.x + 11 && y + 15 > G.player.y + 10 && y + 10 < G.player.y + 15) return true;
    return false;
  },

  // ---------- scripts ----------
  runScript(cmds: Script | null): void { if (cmds && cmds.length) G.script = { cmds, i: 0, wait: 0, dlg: null }; },
  stepScript(dt: number): void {
    const s = G.script; if (!s) return;
    if (s.wait > 0) { s.wait -= dt; return; }
    if (s.dlg) {
      s.dlg.shown = Math.min(s.dlg.full.length, s.dlg.shown + dt * 60);
      if (Input.pressed('ok')) { if (s.dlg.shown < s.dlg.full.length) s.dlg.shown = s.dlg.full.length; else { s.dlg = null; s.i++; Sound.sfx('cursor'); } }
      return;
    }
    if (s.block) return;
    if (s.i >= s.cmds.length) { G.script = null; return; }
    const c = s.cmds[s.i];
    switch (c[0]) {
      case 'say': s.dlg = { who: c[1], full: c[2], shown: 0, lines: wrapText(c[2], 840, 16) }; return;
      case 'join': if (!G.party.some(p => p.id === c[1])) { const lv = Math.max(1, Math.round(G.party.reduce((a, p) => a + p.lv, 0) / G.party.length)); G.party.push(newHero(c[1], lv)); } break;
      case 'flag': G.flags[c[1]] = true; break;
      case 'sfx': Sound.sfx(c[1]); break;
      case 'heal': for (const h of G.party) { const st = heroStats(h); h.hp = st.maxhp; h.mp = st.maxmp; } Sound.sfx('heal'); break;
      case 'wait': s.wait = c[1]; s.i++; return;
      case 'shake': G.shake = c[1]; break;
      case 'push': { const d = ({ up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] } as Record<Dir, [number, number]>)[G.player.dir]; G.player.x += d[0] * 10; G.player.y += d[1] * 10; G.lastTile = this.ptile(); break; }
      case 'shop': s.block = true; s.i++; G.mode = 'shop'; G.shopIdx = 0; G.shopMsg = ''; return;
      case 'warp': s.block = true; s.i++; this.transition(() => { this.loadMap(c[1], c[2], c[3], 'right'); s.block = false; }); return;
      case 'battle': s.block = true; s.i++; this.startBattle({ enemies: c[1], ...(c[2] || {}) }); return;
      case 'ending': G.script = null; this.transition(() => { G.mode = 'ending'; G.endT = 0; Sound.play(MUSIC.ending); }); return;
    }
    s.i++;
  },
  transition(fn: () => void): void { G.fadeTo = 1; G.onFade = fn; },

  // ---------- battle hooks ----------
  startBattle(cfg: BattleCfg): void { G.mode = 'battle'; Battle.start(cfg); },
  startFieldBattle(foe: Foe): void {
    const d = foe.def, bx = Math.round(foe.x / TILE), by = Math.round(foe.y / TILE);
    this.startBattle({ enemies: d.group.map(g => ({ k: g.k, x: bx + g.dx, y: by + g.dy })), boss: !!d.boss, foe });
  },
  endBattle(result: 'win' | 'run'): void {
    G.mode = 'field';
    const cfg = Battle.cfg;
    if (cfg.foe) {
      if (result === 'win') { G.foes = G.foes.filter(f => f !== cfg.foe); if (cfg.foe.def.flag) G.flags[cfg.foe.def.flag] = true; }
      else { cfg.foe.cool = 3; cfg.foe.x = cfg.foe.hx; cfg.foe.y = cfg.foe.hy; }
    }
    Sound.play(MUSIC[G.map.music]);
    if (G.script && G.script.block) { if (result !== 'win') { G.script = null; } else G.script.block = false; }
    const ev = cfg.foe && result === 'win' && BOSS_WIN[cfg.foe.def.id];
    if (ev) this.runScript(EVENTS[ev](G.flags));
  },

  // ---------- field update ----------
  updateField(dt: number): void {
    if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
    const busy = G.script || G.fadeTo > 0;
    const p = G.player;
    if (!busy) {
      if (Input.pressed('menu')) { G.mode = 'menu'; G.menu = { tab: 0, idx: 0, sub: null, msg: '' }; Sound.sfx('ok'); return; }
      let dx = 0, dy = 0;
      if (Input.down.left) dx = -1; else if (Input.down.right) dx = 1;
      if (Input.down.up) dy = -1; else if (Input.down.down) dy = 1;
      if (dx || dy) {
        p.dir = dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : 'right';
        if (dx && dy && Math.abs(dx) === Math.abs(dy)) p.dir = dx < 0 ? 'left' : 'right';
        const sp = 72 * dt * (dx && dy ? 0.72 : 1);
        let moved = false;
        if (dx && !this.blocked(p.x + dx * sp, p.y, p)) { p.x += dx * sp; moved = true; }
        if (dy && !this.blocked(p.x, p.y + dy * sp, p)) { p.y += dy * sp; moved = true; }
        if (moved) {
          p.walk += dt * 9; p.frame = p.walk | 0;
          const last = G.trail[0]; if (Math.hypot(last.x - p.x, last.y - p.y) >= 1.5) { G.trail.unshift({ x: p.x, y: p.y, dir: p.dir, frame: p.frame }); G.trail.length = 40; }
        }
        this.checkTile();
      } else p.frame = 0;
      if (Input.pressed('ok')) this.interact();
    }
    this.centerCam();
    // NPC wander
    for (const n of this.visibleNpcs()) {
      if (!n.wander || busy) continue;
      n.wt -= dt;
      if (n.wt <= 0) { n.wt = 1.5 + Math.random() * 2.5; const dirs: [Dir, number, number][] = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]], d = dirs[(Math.random() * 4) | 0]; n.dir = d[0]; n.mv = { dx: d[1], dy: d[2], t: 0.4 }; }
      if (n.mv && n.mv.t > 0) {
        n.mv.t -= dt; const nx = n.px + n.mv.dx * 30 * dt, ny = n.py + n.mv.dy * 30 * dt;
        if (Math.abs(nx - n.hx * TILE) < 24 && Math.abs(ny - n.hy * TILE) < 24 && !this.blocked(nx, ny, n)) { n.px = nx; n.py = ny; n.frame = (G.t * 8) | 0; } else n.mv.t = 0;
      } else n.frame = 0;
    }
    // field enemies
    for (const f of G.foes) {
      f.t += dt; f.cool = Math.max(0, f.cool - dt);
      if (busy) continue;
      const dist = Math.hypot(f.x - p.x, f.y - p.y), big = ENEMIES[f.def.kind].size;
      if (!f.def.static && !f.def.boss) {
        let tx, ty;
        if (dist < 64 && f.cool <= 0) { tx = p.x; ty = p.y; } else { tx = f.hx + Math.cos(f.t * 0.7) * 16; ty = f.hy + Math.sin(f.t * 1.1) * 12; }
        const a = Math.atan2(ty - f.y, tx - f.x), sp = dist < 64 && f.cool <= 0 ? 40 : 18, d = Math.hypot(tx - f.x, ty - f.y);
        if (d > 1) { const nx = f.x + Math.cos(a) * sp * dt, ny = f.y + Math.sin(a) * sp * dt; if (!isSolidTile(tileAt(G.map, Math.floor((nx + 8) / TILE), Math.floor((ny + 12) / TILE)))) { f.x = nx; f.y = ny; } }
      }
      if (f.cool <= 0 && dist < 12 + (big - 1) * 14) { this.startFieldBattle(f); return; }
    }
    if (G.shake > 0) G.shake -= dt;
  },
  checkTile() {
    const t = this.ptile(), m = G.map;
    if (t.x === G.lastTile.x && t.y === G.lastTile.y) return;
    G.lastTile = t;
    for (const w of m.warps || []) if (w.x === t.x && w.y === t.y) { this.transition(() => this.loadMap(w.to, w.tx, w.ty, G.player.dir)); return; }
    for (const r of m.rifts || []) if (r.x === t.x && r.y === t.y && G.flags[r.flag]) {
      Sound.sfx('rift'); G.shake = 0.5;
      this.transition(() => { this.loadMap(r.to, r.tx, r.ty, 'down'); G.riftFlash = 1; }); return;
    }
    for (const tr of m.triggers || []) if (tr.x === t.x && tr.y === t.y) { const sc = EVENTS[tr.event](G.flags); if (sc) { this.runScript(sc); return; } }
  },
  interact() {
    const p = G.player, d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[p.dir];
    const fx = p.x + 8 + d[0] * 12, fy = p.y + 12 + d[1] * 12, tx = Math.floor(fx / TILE), ty = Math.floor(fy / TILE);
    for (const n of this.visibleNpcs()) {
      if (fx > n.px - 2 && fx < n.px + 18 && fy > n.py - 2 && fy < n.py + 18) {
        n.dir = ({ up: 'down', down: 'up', left: 'right', right: 'left' } as Record<Dir, Dir>)[p.dir];
        this.runScript(TALK[n.talk](G.flags)); return;
      }
    }
    for (const c of G.map.chests || []) if (c.x === tx && c.y === ty) {
      if (G.flags[c.id]) this.runScript([['say', '', 'The chest is empty.']]);
      else { G.flags[c.id] = true; G.inv[c.item] = (G.inv[c.item] || 0) + c.n; Sound.sfx('item'); this.runScript([['say', '', `Found ${ITEMS[c.item].name}${c.n > 1 ? ' x' + c.n : ''}!`]]); }
      return;
    }
    for (const s of G.map.signs || []) if (s.x === tx && s.y === ty) { this.runScript([['say', '', s.text]]); return; }
  },

  // ---------- drawing ----------
  drawWorld(inBattle: boolean, extras: Drawable[] = [], dim = 0): void {
    const m = G.map, cx = Math.round(G.camX), cy = Math.round(G.camY), g = ctx;
    drawMapTiles(m, cx, cy, G.t);
    if (!CHEST_SPR) CHEST_SPR = [gridSprite(CHEST_GRIDS[0], CHEST_PAL), gridSprite(CHEST_GRIDS[1], CHEST_PAL)];
    for (const c of m.chests || []) { const x = c.x * TILE - cx, y = c.y * TILE - cy; pixShadow(g, x + 8, y + 15, 14); g.drawImage(CHEST_SPR[G.flags[c.id] ? 1 : 0], x, y + 2); }
    for (const r of m.rifts || []) if (G.flags[r.flag]) this.drawRift(r.x * TILE - cx + 8, r.y * TILE - cy + 8);
    if (dim > 0.01) { g.fillStyle = `rgba(8,4,20,${dim})`; g.fillRect(0, 0, VW * TILE, VH * TILE); }
    const list = this.visibleNpcs().map(n => ({ y: n.py, draw: () => drawHero(n.px - cx, n.py - cy, n.look, n.dir, n.frame) })).concat(extras);
    if (!inBattle) {
      for (const f of G.foes) { const k = ENEMIES[f.def.kind]; list.push({ y: f.y, draw: () => drawEnemy(k, f.x - cx, f.y - cy, f.t, { flash: f.cool > 0 && (G.t * 10 | 0) % 2 === 1 }) }); }
      const moving = (Input.down.up || Input.down.down || Input.down.left || Input.down.right) && !G.script;
      for (let i = G.party.length - 1; i >= 0; i--) {
        const h = G.party[i], pos = i === 0 ? G.player : G.trail[Math.min(G.trail.length - 1, i * 9)];
        const fr = i === 0 ? G.player.frame : moving ? G.player.frame + i : 0;
        list.push({ y: pos.y + (i === 0 ? 0.1 : -i * 0.01), draw: () => drawHero(pos.x - cx, pos.y - cy, HEROES[h.id].look, pos.dir, fr) });
      }
    }
    list.sort((a, b) => a.y - b.y).forEach(o => o.draw());
    if (inBattle) g.globalAlpha = 0.45;
    drawMapOverlay(m, cx, cy); g.globalAlpha = 1;
  },
  drawRift(x: number, y: number): void {
    const t = G.t, g = ctx; x = Math.round(x); y = Math.round(y);
    const cols = ['#2a0c50', '#6a2ab8', '#a868f0', '#e0c8ff', '#ffffff'];
    for (let i = 0; i < 5; i++) {
      const rx = 7 - i * 1.4 + Math.sin(t * 4 + i) * 0.8, ry = 11 - i * 2.2; g.fillStyle = cols[i];
      for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry)))); g.fillRect(x - w, y + dy, w * 2 + 1, 1); }
    }
    for (let i = 0; i < 8; i++) { const a = t * 2.2 + i * 0.785, rr = 10 + Math.sin(t * 3 + i) * 2; px(g, Math.round(x + Math.cos(a) * rr * 0.75), Math.round(y + Math.sin(a) * rr * 1.1), 1, 1, i % 2 ? '#e0c8ff' : '#ff8ae0'); }
  },
  drawDialog() {
    const s = G.script; if (!s || !s.dlg) return;
    const d = s.dlg, y = G.player.y - G.camY > VH * TILE * 0.55 ? 18 : 516;
    const hasP = d.who && (PORTRAIT_OF[d.who] || d.who === 'Hollow King' || d.who === '???');
    if (hasP) drawPortrait(d.who, 18, y + 24, G.t);
    const x0 = hasP ? 162 : 18, w = 942 - x0;
    if (!d.lines || d.lw !== w) { d.lines = wrapText(d.full, w - 72, 16); d.lw = w; }
    uiWindow(x0, y, w, 186);
    let off = 0;
    if (d.who) { text(d.who, x0 + 33, y + 27, '#ffe050', 18); off = 36; }
    let left = Math.floor(d.shown);
    d.lines.slice(0, 4).forEach((ln, i) => { const part = ln.slice(0, Math.max(0, left)); left -= ln.length + 1; text(part, x0 + 33, y + 30 + off + i * 30, '#fff', 16); });
    if (d.shown >= d.full.length && (G.t * 2 | 0) % 2) text('▼', x0 + w - 42, y + 150, '#fff', 16);
  },
  drawFieldHud() {
    if (G.banner) { const a = Math.min(1, G.banner.t); ctx.globalAlpha = a; uiWindow(280, 30, 400, 80); text(G.banner.era, 480, 46, '#ffe050', 12, 'center'); text(G.banner.name, 480, 72, '#fff', 18, 'center'); ctx.globalAlpha = 1; }
    if (!G.script) text('Z: talk/check   C: menu', 950, 700, 'rgba(255,255,255,0.55)', 10, 'right');
  },

  // ---------- pause menu ----------
  updateMenu() {
    const m = G.menu, tabs = ['Party', 'Items', 'Save', 'Close'];
    if (m.sub) {
      if (Input.pressed('back')) { m.sub = null; Sound.sfx('back'); return; }
      if (Input.pressed('up')) { m.sub.who = (m.sub.who + G.party.length - 1) % G.party.length; Sound.sfx('cursor'); }
      if (Input.pressed('down')) { m.sub.who = (m.sub.who + 1) % G.party.length; Sound.sfx('cursor'); }
      if (Input.pressed('ok')) {
        const it = ITEMS[m.sub.item], targets = it.all ? G.party : [G.party[m.sub.who]];
        let used = false;
        for (const h of targets) {
          const st = heroStats(h);
          if (it.all) { h.hp = st.maxhp; h.mp = st.maxmp; used = true; }
          else if (it.revive && h.hp <= 0) { h.hp = Math.round(st.maxhp / 2); used = true; }
          else if (it.heal && h.hp > 0 && h.hp < st.maxhp) { h.hp = Math.min(st.maxhp, h.hp + it.heal); used = true; }
          else if (it.mp && h.mp < st.maxmp) { h.mp = Math.min(st.maxmp, h.mp + it.mp); used = true; }
        }
        if (used) { G.inv[m.sub.item] = (G.inv[m.sub.item] ?? 1) - 1; Sound.sfx('heal'); if (!G.inv[m.sub.item]) m.sub = null; } else Sound.sfx('back');
      }
      return;
    }
    if (m.focus === 'items') {
      const keys = ownedItems();
      if (!keys.length || Input.pressed('back')) { m.focus = null; Sound.sfx('back'); return; }
      if (Input.pressed('up')) { m.idx = (m.idx + keys.length - 1) % keys.length; Sound.sfx('cursor'); }
      if (Input.pressed('down')) { m.idx = (m.idx + 1) % keys.length; Sound.sfx('cursor'); }
      m.idx = Math.min(m.idx, keys.length - 1);
      if (Input.pressed('ok')) { m.sub = { item: keys[m.idx], who: 0 }; Sound.sfx('ok'); }
      return;
    }
    if (Input.pressed('left')) { m.tab = (m.tab + 3) % 4; m.msg = ''; Sound.sfx('cursor'); }
    if (Input.pressed('right')) { m.tab = (m.tab + 1) % 4; m.msg = ''; Sound.sfx('cursor'); }
    if (Input.pressed('back') || Input.pressed('menu')) { G.mode = 'field'; Sound.sfx('back'); return; }
    if (Input.pressed('ok')) {
      const tab = tabs[m.tab];
      if (tab === 'Close') { G.mode = 'field'; Sound.sfx('back'); }
      if (tab === 'Save') { m.msg = this.save() ? 'Game saved.' : 'Could not save (storage blocked).'; Sound.sfx('item'); }
      if (tab === 'Items') { m.focus = 'items'; m.idx = 0; Sound.sfx('ok'); }
    }
  },
  drawMenu() {
    const m = G.menu, tabs = ['Party', 'Items', 'Save', 'Close'];
    ctx.fillStyle = 'rgba(0,0,20,0.5)'; ctx.fillRect(0, 0, W, H);
    uiWindow(20, 20, 920, 70);
    tabs.forEach((s, i) => { text(s, 90 + i * 220, 46, i === m.tab ? '#ffe050' : '#fff', 18); if (i === m.tab && !m.focus) cursor(60 + i * 220, 48, G.t); });
    uiWindow(20, 100, 920, 520);
    if (m.tab === 0 || m.tab === 2 || m.tab === 3) {
      G.party.forEach((h, i) => {
        const st = heroStats(h), y = 125 + i * 160, b = HEROES[h.id];
        ctx.save(); ctx.scale(4, 4); drawHero(14, y / 4 + 13, b.look, 'down', 0, { down: h.hp <= 0, noShadow: true }); ctx.restore();
        text(`${b.name}`, 150, y + 8, '#ffe050', 18); text(`Lv ${h.lv}`, 330, y + 8, '#fff', 16);
        text(`HP ${h.hp}/${st.maxhp}`, 150, y + 44, h.hp <= 0 ? '#ff6060' : '#fff', 14); text(`MP ${h.mp}/${st.maxmp}`, 150, y + 72, '#a0d0ff', 14);
        const nx = xpForLevel(h.lv + 1); text(`Next Lv: ${nx - h.xp} XP`, 150, y + 100, '#c0c8f0', 12);
        text(`ATK ${st.atk}  DEF ${st.def}`, 480, y + 44, '#fff', 14); text(`MAG ${st.mag}  SPD ${st.spd}`, 480, y + 72, '#fff', 14);
        wrapText('Techs: ' + knownTechs(h).map(t => t.name).join(', '), 420, 10).slice(0, 2).forEach((ln, j) => text(ln, 480, y + 100 + j * 18, '#c0c8f0', 10));
      });
    } else {
      const keys = ownedItems();
      if (!keys.length) text('No items.', 60, 130, '#a0a8d0', 16);
      keys.forEach((k, i) => { text(ITEMS[k].name, 80, 130 + i * 40, '#fff', 16); text('x' + G.inv[k], 460, 130 + i * 40, '#fff', 16, 'right'); if (m.focus === 'items' && i === m.idx && !m.sub) cursor(50, 132 + i * 40, G.t); });
      if (m.focus === 'items' && keys[m.idx]) text(ITEMS[keys[m.idx]].desc, 60, 580, '#c0c8f0', 12);
      if (!m.focus) text('Press Z to use an item.', 60, 580, '#a0a8d0', 12);
      if (m.sub) {
        uiWindow(520, 120, 400, 60 + G.party.length * 50);
        const sub = m.sub; G.party.forEach((h, i) => { const st = heroStats(h); text(`${HEROES[h.id].name}  ${h.hp}/${st.maxhp}`, 580, 145 + i * 50, h.hp <= 0 ? '#ff6060' : '#fff', 14); if (i === sub.who || ITEMS[sub.item].all) cursor(545, 146 + i * 50, G.t); });
      }
    }
    uiWindow(20, 630, 920, 70);
    text(`Gold: ${G.gold} G`, 50, 656, '#ffe050', 16);
    text(m.msg || `${G.map.era} · ${G.map.name}`, 910, 656, '#fff', 14, 'right');
  },

  // ---------- shop ----------
  updateShop() {
    const n = SHOP_STOCK.length + 1;
    if (Input.pressed('up')) { G.shopIdx = (G.shopIdx + n - 1) % n; Sound.sfx('cursor'); }
    if (Input.pressed('down')) { G.shopIdx = (G.shopIdx + 1) % n; Sound.sfx('cursor'); }
    const leave = () => { G.mode = 'field'; if (G.script) G.script.block = false; Sound.sfx('back'); };
    if (Input.pressed('back')) return leave();
    if (Input.pressed('ok')) {
      if (G.shopIdx === SHOP_STOCK.length) return leave();
      const k = SHOP_STOCK[G.shopIdx], it = ITEMS[k];
      if (G.gold >= it.price) { G.gold -= it.price; G.inv[k] = (G.inv[k] || 0) + 1; G.shopMsg = `Bought ${it.name}.`; Sound.sfx('item'); }
      else { G.shopMsg = 'Not enough gold.'; Sound.sfx('back'); }
    }
  },
  drawShop() {
    uiWindow(180, 100, 600, 80 + (SHOP_STOCK.length + 1) * 44);
    text('Shop', 210, 120, '#ffe050', 16); text(`${G.gold} G`, 750, 120, '#ffe050', 16, 'right');
    SHOP_STOCK.forEach((k, i) => { const it = ITEMS[k]; text(it.name, 240, 160 + i * 44, '#fff', 16); text(`${it.price} G`, 620, 160 + i * 44, G.gold >= it.price ? '#fff' : '#6a6a8a', 16, 'right'); text(`own ${G.inv[k] || 0}`, 750, 164 + i * 44, '#a0a8d0', 11, 'right'); });
    text('Leave', 240, 160 + SHOP_STOCK.length * 44, '#fff', 16);
    cursor(210, 162 + G.shopIdx * 44, G.t);
    const k = SHOP_STOCK[G.shopIdx];
    uiWindow(180, 120 + 80 + (SHOP_STOCK.length + 1) * 44 - 20, 600, 60);
    text(G.shopMsg || (k ? ITEMS[k].desc : 'Come again!'), 480, 120 + 80 + (SHOP_STOCK.length + 1) * 44, '#fff', 14, 'center');
  },
};
