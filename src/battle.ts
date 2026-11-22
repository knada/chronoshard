import { H, Input, S, Sound, TILE, VH, VW, W, blitWorld, ctx, toScreen, toWorld } from './engine.js';
import { PAL, bar, cursor, hexRgb, px, text, uiWindow, wrapText } from './pixel.js';
import { drawHero } from './sprites.js';
import { drawEnemy, enemyHeight, enemyPixels } from './enemies.js';
import { isSolidTile, pring, tileAt } from './tiles.js';
import { Atmos } from './atmos.js';
import { DUALS, ENEMIES, HEROES, ITEMS, MUSIC } from './data.js';
import { G, Game, ownedItems } from './game.js';

import type { BattleEnemySpec, Dir, DualTech, Elem, EnemyKind, EnemyMove, HeroId, HeroState, Item, ItemId, Pose, RGB, Stats, Tech, TechTarget } from './types.js';
import type { Foe } from './game.js';
import type { Ctx } from './pixel.js';

export interface BattleCfg { enemies: BattleEnemySpec[]; boss?: boolean; noRun?: boolean; foe?: Foe }
interface ActorBase { name: string; x: number; y: number; hx: number; hy: number; atb: number; flash: number; pose?: Pose | null; moving?: boolean }
export interface HeroActor extends ActorBase { side: 'hero'; h: HeroState; id: HeroId; st: Stats; dir: Dir; frame: number; hurtT?: number }
export interface EnemyActor extends ActorBase { side: 'enemy'; k: EnemyKind; hp: number; maxhp: number; dead: boolean; fade: number; dir?: Dir; frame?: number }
export type Actor = HeroActor | EnemyActor;
/** what the player picked in the command menu, before targets are chosen */
export interface PendingCmd { type: 'attack' | 'tech' | 'item'; target: TechTarget; tech?: Tech | DualTech; dual?: boolean; parts?: HeroActor[]; item?: ItemId }
export interface HeroAction extends PendingCmd { actor: HeroActor; actors: HeroActor[]; targets: Actor[] }
export interface EnemyAction { type: 'enemy'; actor: EnemyActor; actors: EnemyActor[]; move: EnemyMove; targets: Actor[] }
export type Action = HeroAction | EnemyAction;
export interface TechOption { t: Tech | DualTech; ok: boolean; label: string; cost: number; dual?: boolean; parts?: HeroActor[] }
export interface ItemOption { k: ItemId; it: Item; n: number }
export interface BattleMenu { actor: HeroActor; level: 'main' | 'tech' | 'item' | 'target'; idx: number; sub: number; scroll: number; pending?: PendingCmd; tIdx: number }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; g?: number; glow?: boolean; delay?: number }
export interface Pop { x: number; y: number; s: string; color: string; t: number }
export interface Ring { x: number; y: number; r: number; vr: number; life: number; max: number; c: string }
export interface FxLight { x: number; y: number; r: number; c: RGB; life: number; max: number; i: number }
/** something that can deal damage: an enemy, a hero, or the pooled stats of a dual tech */
export type DamageSource = { side: 'hero'; st: { atk: number; mag: number } } | EnemyActor;
/** a battle animation: yields seconds to wait (0 = next frame) */
export type Anim = Generator<number, void, unknown>;
export const isHero = (a: Actor): a is HeroActor => a.side === 'hero';
export const isDual = (t: Tech | DualTech): t is DualTech => Array.isArray(t.mp);

// ===== Chronoshard battle: on-field Active Time Battle with dual techs =====
export function heroStats(h: HeroState): Stats {
  const b = HEROES[h.id], l = h.lv - 1, gr = b.grow;
  return { maxhp: Math.round(b.hp + gr.hp * l), maxmp: Math.round(b.mp + gr.mp * l), atk: Math.round(b.atk + gr.atk * l), def: Math.round(b.def + gr.def * l),
    mag: Math.round(b.mag + gr.mag * l), spd: Math.round(b.spd + gr.spd * l) };
}
export function xpForLevel(lv: number): number { return Math.round(20 * (lv - 1) * (lv - 1) + 30 * (lv - 1)); }
export function knownTechs(h: HeroState): Tech[] { return HEROES[h.id].techs.filter(t => (t.lv ?? 1) <= h.lv); }

export const Battle = {
  active: false,
  cfg: { enemies: [] } as BattleCfg,
  t: 0, dt: 0, introT: 0, phase: 'intro' as 'intro' | 'active' | 'win' | 'lose' | 'run',
  enemies: [] as EnemyActor[], heroes: [] as HeroActor[], queue: [] as Action[], ready: [] as HeroActor[],
  menu: null as BattleMenu | null, msg: null as { s: string; t: number } | null, result: [] as string[],
  co: null as Anim | null, coWait: 0,
  fx: [] as Particle[], pops: [] as Pop[], rings: [] as Ring[], lights: [] as FxLight[], clock: null as { x: number; y: number; t: number; life: number } | null,
  hitStop: 0, dim: 0, dimT: 0, flashT: 0, shakeT: 0, camTX: 0, camTY: 0, cam0: { x: 0, y: 0 },
  start(cfg: BattleCfg): void {
    // cfg: {enemies:[{k,x,y}] (tile coords), boss, noRun, onWin, entity}
    this.cfg = cfg; this.active = true; this.t = 0; this.phase = 'intro'; this.introT = 0;
    this.fx = []; this.pops = []; this.rings = []; this.lights = []; this.clock = null; this.hitStop = 0; this.dim = 0; this.dimT = 0; this.co = null; this.coWait = 0; this.queue = []; this.ready = []; this.menu = null; this.msg = null; this.flashT = 0; this.shakeT = 0;
    this.enemies = cfg.enemies.map((e): EnemyActor => {
      const k = ENEMIES[e.k];
      return { side: 'enemy', k, name: k.name, hp: k.hp, maxhp: k.hp, x: e.x * TILE, y: e.y * TILE, hx: e.x * TILE, hy: e.y * TILE, atb: Math.random() * 40, dead: false, fade: 1, flash: 0 };
    });
    // fights near the bottom edge of a map lift up so nobody stands behind the command menu
    const limitY = Math.max(0, G.map.h * TILE - VH * TILE) + 138; // keep feet above the target-name window (screen y 470)
    const lift = Math.max(0, ...this.enemies.map(e => e.hy - limitY));
    if (lift) for (const e of this.enemies) { e.hy -= lift; e.y = e.hy; }
    const cx = this.enemies.reduce((a, e) => a + e.hx, 0) / this.enemies.length, cy = this.enemies.reduce((a, e) => a + e.hy, 0) / this.enemies.length;
    const m = G.map, offs = [[-4.5, 0], [-3.5, -1.8], [-3.5, 1.8]], taken: [number, number][] = [];
    // formation spots that land in trees/walls slide to the nearest open ground, never onto another hero
    const open = (x: number, y: number) => !isSolidTile(tileAt(m, Math.floor((x + 8) / TILE), Math.floor((y + 12) / TILE))) && !taken.some(([a, b]) => Math.abs(a - x) < 12 && Math.abs(b - y) < 12);
    const settle = (x: number, y: number): [number, number] => {
      if (open(x, y)) return [x, y];
      const cands: [number, number, number][] = [];
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx || dy) cands.push([x + dx * TILE, y + dy * TILE, dx * dx + dy * dy + (dx > 0 ? 0.5 : 0)]);
      cands.sort((p, q) => p[2] - q[2]);
      const c = cands.find(([a, b]) => a >= TILE && b >= 2 * TILE && a <= m.w * TILE - 2 * TILE && b <= m.h * TILE - 2 * TILE && b <= limitY && open(a, b));
      return c ? [c[0], c[1]] : [x, y];
    };
    const big = this.enemies.some(e => e.k.size > 1.5) ? -1.5 : 0;
    this.heroes = G.party.map((h, i): HeroActor => {
      const st = heroStats(h), [ox, oy] = offs[i];
      let hx = cx + (ox + big) * TILE, hy = cy + oy * TILE;
      hx = Math.max(TILE, Math.min(m.w * TILE - 2 * TILE, hx)); hy = Math.max(2 * TILE, Math.min(m.h * TILE - 2 * TILE, limitY, hy)); // 2 tiles: room for a 32px-tall hero and the arrow above
      [hx, hy] = settle(hx, hy); taken.push([hx, hy]);
      const f = G.trail[Math.min(G.trail.length - 1, i * 8)] || G.player;
      return { side: 'hero', h, id: h.id, name: HEROES[h.id].name, st, x: f.x, y: f.y, hx, hy, atb: h.hp > 0 ? 30 + Math.random() * 50 : 0, dir: 'right', frame: 0, flash: 0 };
    });
    const allX = [...this.heroes.map(a => a.hx), ...this.enemies.map(e => e.hx)], allY = [...this.heroes.map(a => a.hy - 22), ...this.enemies.map(e => e.hy + 16 - enemyHeight(e.k) - 14), ...this.heroes.map(a => a.hy), ...this.enemies.map(e => e.hy)];
    this.camTX = (Math.min(...allX) + Math.max(...allX)) / 2 + 8 - VW * TILE / 2;
    this.camTY = (Math.min(...allY) + Math.max(...allY)) / 2 + 42 - VH * TILE / 2;
    this.camTX = Math.max(0, Math.min(m.w * TILE - VW * TILE, this.camTX)); this.camTY = Math.max(0, Math.min(m.h * TILE - VH * TILE, this.camTY));
    this.cam0 = { x: G.camX, y: G.camY };
    Sound.sfx('battle'); Sound.play(cfg.boss ? MUSIC.boss : MUSIC.battle);
  },
  alive<A extends Actor>(list: A[]): A[] { return list.filter(a => a.side === 'hero' ? a.h.hp > 0 : !a.dead); },

  // ---------- update ----------
  update(dt: number): void {
    this.dt = dt;
    if (this.hitStop > 0) { this.hitStop -= dt; return; }
    this.t += dt;
    for (const r of this.rings) { r.life -= dt; r.r += r.vr * dt; } this.rings = this.rings.filter(r => r.life > 0);
    for (const l of this.lights) l.life -= dt; this.lights = this.lights.filter(l => l.life > 0);
    if (this.clock && (this.clock.t += dt) > this.clock.life) this.clock = null;
    this.dim += (this.dimT - this.dim) * Math.min(1, dt * 8);
    for (const a of this.heroes) a.hurtT = Math.max(0, (a.hurtT || 0) - dt);
    for (const p of this.pops) { p.t += dt; p.y -= dt * 20 * Math.max(0, 1 - p.t * 2); }
    this.pops = this.pops.filter(p => p.t < 1.2);
    for (const f of this.fx) { if (f.delay && f.delay > 0) { f.delay -= dt; continue; } f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.g || 0) * dt; }
    this.fx = this.fx.filter(f => f.life > 0);
    this.flashT = Math.max(0, this.flashT - dt); this.shakeT = Math.max(0, this.shakeT - dt);
    for (const a of [...this.heroes, ...this.enemies]) { a.flash = Math.max(0, a.flash - dt); if (a.side === 'enemy' && a.dead) a.fade = Math.max(0, a.fade - dt * 1.5); }

    if (this.phase === 'intro') {
      this.introT += dt; const k = Math.min(1, this.introT / 0.7), e = k * (2 - k);
      G.camX = this.cam0.x + (this.camTX - this.cam0.x) * e; G.camY = this.cam0.y + (this.camTY - this.cam0.y) * e;
      for (const a of this.heroes) { a.x += (a.hx - a.x) * Math.min(1, dt * 8); a.y += (a.hy - a.y) * Math.min(1, dt * 8); a.frame = (this.t * 10) | 0; }
      if (k >= 1) { for (const a of this.heroes) { a.x = a.hx; a.y = a.hy; } this.phase = 'active'; }
      return;
    }
    if (this.phase === 'win' || this.phase === 'lose') {
      if (this.co) this.runCo();
      else if (Input.pressed('ok')) this.finish();
      return;
    }
    if (this.phase === 'run') { this.runCo(); return; }

    // run current action
    if (this.co) { this.runCo(); }
    else if (this.queue.length) { const act = this.queue.shift(); if (act && this.validActor(act)) this.co = this.perform(act); }

    // ATB fills while nothing is animating and player isn't deep in a submenu (wait mode)
    const waiting = this.co || (this.menu && this.menu.level !== 'main');
    if (!waiting) {
      for (const a of this.heroes) {
        if (a.h.hp <= 0) { a.atb = 0; continue; }
        if (a.atb < 100) { a.atb += (a.st.spd + 8) * dt * 4.2; if (a.atb >= 100) { a.atb = 100; if (!this.ready.includes(a)) { this.ready.push(a); Sound.sfx('cursor'); } } }
      }
      for (const e of this.enemies) {
        if (e.dead || this.queue.some(q => q.actor === e)) continue;
        e.atb += (e.k.spd + 8) * dt * 3.6;
        if (e.atb >= 100) { e.atb = 0; this.queue.push(this.enemyAI(e)); }
      }
    }
    this.ready = this.ready.filter(a => a.h.hp > 0);
    if (!this.menu && this.ready.length && !this.co) this.openMenu(this.ready[0]);
    if (this.menu && !this.ready.includes(this.menu.actor)) this.menu = null;
    if (this.menu) this.menuInput();
    this.checkEnd();
  },
  runCo(): void {
    if (!this.co) return;
    if (this.coWait > 0) { this.coWait -= this.dt; return; }
    const r = this.co.next();
    if (r.done) { this.co = null; this.checkEnd(); } else this.coWait = r.value || 0;
  },
  validActor(act: Action): boolean {
    if (act.type === 'enemy') return !act.actor.dead && this.alive(this.heroes).length > 0;
    return act.actors.every(a => a.h.hp > 0);
  },
  checkEnd() {
    if (this.phase !== 'active' || this.co) return;
    if (!this.alive(this.enemies).length) this.win();
    else if (!this.alive(this.heroes).length) this.lose();
  },

  // ---------- menus ----------
  openMenu(actor: HeroActor): void { this.menu = { actor, level: 'main', idx: 0, sub: 0, scroll: 0, tIdx: 0 }; },
  mainOptions(): string[] { const o = ['Attack', 'Tech', 'Item']; if (!this.cfg.noRun && !this.cfg.boss) o.push('Run'); return o; },
  techOptions(actor: HeroActor): TechOption[] {
    const out: TechOption[] = knownTechs(actor.h).map(t => ({ t, ok: actor.h.mp >= t.mp, label: t.name, cost: t.mp }));
    for (const d of DUALS) {
      if (!d.who.includes(actor.id)) continue;
      if (!d.who.every(id => G.party.some(p => p.id === id))) continue;
      const parts = d.who.map(id => this.heroes.find(a => a.id === id)).filter((a): a is HeroActor => !!a);
      if (parts.length !== d.who.length) continue;
      const ok = parts.every((a, i) => a.h.hp > 0 && this.ready.includes(a) && a.h.mp >= d.mp[i]);
      out.push({ t: d, dual: true, ok, label: d.name, cost: d.mp[d.who.indexOf(actor.id)], parts });
    }
    return out;
  },
  itemOptions(): ItemOption[] { return ownedItems().map(k => ({ k, it: ITEMS[k], n: G.inv[k] ?? 0 })); },
  menuInput(): void {
    const m = this.menu; if (!m) return;
    const nav = (n: number, d: number) => { m.idx = (m.idx + d + n) % n; Sound.sfx('cursor'); };
    if (m.level === 'main') {
      const o = this.mainOptions();
      if (Input.pressed('up')) nav(o.length, -1);
      if (Input.pressed('down')) nav(o.length, 1);
      if (Input.pressed('back') && this.ready.length > 1) { this.ready.push(this.ready.shift()!); this.openMenu(this.ready[0]); Sound.sfx('cursor'); return; }
      if (Input.pressed('ok')) {
        Sound.sfx('ok'); const c = o[m.idx];
        if (c === 'Attack') this.beginTarget({ type: 'attack', target: 'enemy' });
        if (c === 'Tech') { m.level = 'tech'; m.sub = 0; }
        if (c === 'Item') { if (this.itemOptions().length) { m.level = 'item'; m.sub = 0; } else Sound.sfx('back'); }
        if (c === 'Run') this.tryRun();
      }
    } else if (m.level === 'tech' || m.level === 'item') {
      const n = m.level === 'tech' ? this.techOptions(m.actor).length : this.itemOptions().length;
      if (Input.pressed('up')) { m.sub = (m.sub - 1 + n) % n; Sound.sfx('cursor'); }
      if (Input.pressed('down')) { m.sub = (m.sub + 1) % n; Sound.sfx('cursor'); }
      if (Input.pressed('back')) { m.level = 'main'; Sound.sfx('back'); }
      if (Input.pressed('ok') && n) {
        if (m.level === 'tech') {
          const c = this.techOptions(m.actor)[m.sub];
          if (!c.ok) { Sound.sfx('back'); return; }
          Sound.sfx('ok'); this.beginTarget({ type: 'tech', tech: c.t, dual: c.dual, parts: c.parts, target: c.t.target });
        } else {
          const c = this.itemOptions()[m.sub];
          Sound.sfx('ok'); this.beginTarget({ type: 'item', item: c.k, target: c.it.all ? 'allies' : c.it.revive ? 'deadally' : 'ally' });
        }
      }
    } else if (m.level === 'target' && m.pending) {
      const p = m.pending, tg = p.target, list = this.targetList(tg);
      if (!list.length) { m.level = 'main'; return; }
      if (tg === 'enemy' || tg === 'ally' || tg === 'deadally') {
        if (Input.pressed('up') || Input.pressed('left')) { m.tIdx = (m.tIdx - 1 + list.length) % list.length; Sound.sfx('cursor'); }
        if (Input.pressed('down') || Input.pressed('right')) { m.tIdx = (m.tIdx + 1) % list.length; Sound.sfx('cursor'); }
        m.tIdx = Math.min(m.tIdx, list.length - 1);
      }
      if (Input.pressed('back')) { m.level = p.type === 'attack' ? 'main' : p.type; Sound.sfx('back'); }
      if (Input.pressed('ok')) {
        Sound.sfx('ok');
        const targets = (tg === 'enemies' || tg === 'allies') ? list : [list[m.tIdx]];
        this.commit(p, targets);
      }
    }
  },
  targetList(tg: TechTarget): Actor[] {
    if (tg === 'enemy' || tg === 'enemies') return this.alive(this.enemies).sort((a, b) => a.hy - b.hy || a.hx - b.hx);
    if (tg === 'deadally') return this.heroes.filter(a => a.h.hp <= 0);
    return this.alive(this.heroes);
  },
  beginTarget(p: PendingCmd): void {
    const m = this.menu; if (!m) return;
    if (p.tech && p.tech.revive) p.target = 'deadally';
    const list = this.targetList(p.target);
    if (!list.length) { Sound.sfx('back'); return; }
    m.level = 'target'; m.pending = p; m.tIdx = 0;
    if (p.target === 'ally') { // start on the most injured ally
      const weakest = list.filter(isHero).sort((a, b) => a.h.hp / a.st.maxhp - b.h.hp / b.st.maxhp)[0];
      m.tIdx = Math.max(0, list.indexOf(weakest));
    }
  },
  commit(p: PendingCmd, targets: Actor[]): void {
    const m = this.menu; if (!m) return;
    const actors = p.dual && p.parts ? p.parts : [m.actor];
    for (const a of actors) { a.atb = 0; this.ready = this.ready.filter(r => r !== a); }
    if (p.type === 'tech' && p.tech) { const tech = p.tech; if (isDual(tech)) actors.forEach((a, i) => a.h.mp -= tech.mp[i]); else actors[0].h.mp -= tech.mp; }
    if (p.type === 'item' && p.item) G.inv[p.item] = (G.inv[p.item] ?? 1) - 1;
    this.queue.unshift({ ...p, actor: actors[0], actors, targets });
    this.menu = null;
  },
  tryRun() {
    const ok = Math.random() < 0.75;
    this.menu = null; this.ready = []; this.heroes.forEach(a => a.atb = 0);
    this.phase = 'run';
    const self = this;
    this.co = (function* () {
      if (!ok) { self.say('Couldn\'t escape!'); yield 0.9; self.msg = null; self.phase = 'active'; return; }
      Sound.sfx('back'); self.say('The party fled!');
      for (let i = 0; i < 30; i++) { for (const a of self.heroes) { a.x -= 3; a.dir = 'left'; a.frame = (self.t * 12) | 0; } yield 0; }
      self.active = false; Game.endBattle('run');
    })();
  },
  say(s: string): void { this.msg = { s, t: 0 }; },

  // ---------- enemy AI ----------
  enemyAI(e: EnemyActor): EnemyAction {
    let moves = e.k.moves.filter(m => !m.heal || e.hp < e.maxhp * 0.5);
    if (!moves.length) moves = e.k.moves.filter(m => !m.heal);
    const mv = moves[(Math.random() * moves.length) | 0];
    const alive = this.alive(this.heroes);
    const targets = mv.heal ? [e] : mv.target === 'all' ? alive : [alive[(Math.random() * alive.length) | 0]];
    return { type: 'enemy', actor: e, actors: [e], move: mv, targets };
  },

  // ---------- damage ----------
  calcDamage(src: DamageSource, dst: Actor, power: number, elem: Elem = 'phys', magic = false): { dmg: number; tag: string | null } {
    const s = src.side === 'hero' ? src.st : src.k, d = dst.side === 'hero' ? dst.st : dst.k;
    let dmg = magic ? s.mag * power * 2.2 - d.mag * 0.4 : s.atk * power * 2 - d.def;
    dmg = Math.max(1, dmg) * (0.9 + Math.random() * 0.2);
    let tag = null;
    if (dst.side === 'enemy') {
      if (dst.k.weak && dst.k.weak.includes(elem)) { dmg *= 2; tag = 'WEAK!'; }
      else if (dst.k.resist && dst.k.resist.includes(elem)) { dmg *= 0.4; tag = 'resist'; }
    }
    if (!magic && Math.random() < 0.08) { dmg *= 1.6; tag = 'CRITICAL!'; }
    return { dmg: Math.round(dmg), tag };
  },
  applyDamage(dst: Actor, dmg: number, tag: string | null): void {
    dst.flash = 0.35; this.hitStop = Math.max(this.hitStop, tag === 'CRITICAL!' || tag === 'WEAK!' ? 0.11 : 0.05);
    const [mx, my] = this.center(dst); this.light(mx, my, [255, 255, 255], 30, 0.14, 0.6);
    if (dst.side === 'hero') { dst.hurtT = 0.35; dst.h.hp = Math.max(0, dst.h.hp - dmg); if (dst.h.hp <= 0) { dst.atb = 0; Sound.sfx('die'); } }
    else { dst.hp = Math.max(0, dst.hp - dmg); if (dst.hp <= 0 && !dst.dead) { dst.dead = true; Sound.sfx('die'); this.dissolve(dst); } }
    this.pop(dst, String(dmg), dst.side === 'hero' ? '#ffc0c0' : '#ffffff');
    if (tag) this.pop(dst, tag, tag === 'resist' ? '#a0a0b8' : '#ffe050', -8);
  },
  dissolve(e: EnemyActor): void {
    const pix = enemyPixels(e.k), bx = e.x + 8, by = e.y + 16 - (e.k.shape === 'bat' ? 6 : 0), h = enemyHeight(e.k);
    for (const p of pix) this.fx.push({ x: bx + p.x, y: by + p.y, vx: (Math.random() - 0.5) * 30, vy: -12 - Math.random() * 36, g: -10, life: 0.4 + Math.random() * 0.6, delay: 0.08 + (p.y + h) / h * 0.5, color: p.c, size: 1 });
    const [mx, my] = this.center(e); this.ring(mx, my, '#ffffff', 2, 140, 0.3); this.light(mx, my, [255, 240, 220], 60, 0.4, 0.8);
  },
  center(a: Actor): [number, number] { if (a.side === 'hero') return [a.x + 8, a.y - 1]; const h = enemyHeight(a.k); return [a.x + 8, a.y + 16 - h * 0.5 - (a.k.shape === 'bat' ? 6 : 0)]; },
  ring(x: number, y: number, c: string, r0 = 2, vr = 120, life = 0.4): void { this.rings.push({ x, y, r: r0, vr, life, max: life, c }); },
  light(x: number, y: number, c: RGB, r = 60, life = 0.5, i = 0.9): void { this.lights.push({ x, y, r, c, life, max: life, i }); },
  glow(x: number, y: number, vx: number, vy: number, life: number, color: string, size = 1, g = 0): void { this.fx.push({ x, y, vx, vy, life, color, size, g, glow: true }); },
  heal(dst: Actor, amt: number): void {
    if (dst.side === 'hero') dst.h.hp = Math.min(dst.st.maxhp, dst.h.hp + amt); else dst.hp = Math.min(dst.maxhp, dst.hp + amt);
    this.pop(dst, String(amt), '#7dffa0'); this.sparkle(dst, '#7dffa0');
  },
  pop(a: Actor, s: string, color: string, dy = 0): void { const top = a.side === 'hero' ? a.y - 18 : a.y + 16 - enemyHeight(a.k) - (a.k.shape === 'bat' ? 6 : 0); this.pops.push({ x: a.x + 8, y: top + dy, s, color, t: 0 }); },
  burst(x: number, y: number, color: string, n = 10, spd = 60): void { for (let i = 0; i < n; i++) { const an = Math.random() * 6.28, v = spd * (0.4 + Math.random()); this.glow(x, y, Math.cos(an) * v, Math.sin(an) * v, 0.3 + Math.random() * 0.4, color, Math.random() < 0.3 ? 2 : 1); } },
  sparkle(a: Actor, color: string): void { for (let i = 0; i < 12; i++) this.glow(a.x + 2 + Math.random() * 12, a.y + 14 - Math.random() * 6, (Math.random() - 0.5) * 8, -20 - Math.random() * 34, 0.8, color); this.light(a.x + 8, a.y + 6, hexRgb(color), 40, 0.6, 0.7); },

  // ---------- action animations (generators) ----------
  *moveTo(a: Actor, tx: number, ty: number, dur: number): Anim {
    const sx = a.x, sy = a.y; let el = 0; a.moving = true;
    while (el < dur) { el += this.dt; const k = Math.min(1, el / dur); a.x = sx + (tx - sx) * k; a.y = sy + (ty - sy) * k; a.frame = (this.t * 14) | 0; yield 0; }
    a.moving = false;
  },
  *perform(act: Action): Anim {
    try { yield* this.performInner(act); }
    finally { for (const p of act.actors) { p.pose = null; p.moving = false; } this.dimT = 0; }
  },
  *performInner(act: Action): Anim {
    if (act.type === 'enemy') {
      const a = act.actor, mv = act.move; this.say(`${a.name}: ${mv.name}`);
      if (mv.heal) { Sound.sfx('heal'); yield 0.4; this.heal(a, mv.heal); yield 0.6; this.msg = null; return; }
      if (!mv.magic && mv.target !== 'all') {
        const t = act.targets[0];
        yield* this.moveTo(a, t.x + 14, t.y, 0.18); Sound.sfx('hit');
        const r = this.calcDamage(a, t, mv.power ?? 1, mv.elem, false); this.applyDamage(t, r.dmg, null); this.shakeT = 0.15;
        yield 0.2; yield* this.moveTo(a, a.hx, a.hy, 0.2);
      } else {
        a.flash = 0.5; yield 0.4; Sound.sfx(mv.elem === 'shock' ? 'zap' : mv.elem === 'fire' ? 'fire' : 'magic');
        for (const t of act.targets) { this.burst(t.x + 8, t.y + 8, a.k.color2, 14); const r = this.calcDamage(a, t, mv.power ?? 1, mv.elem, mv.magic); this.applyDamage(t, r.dmg, null); }
        this.shakeT = 0.25; yield 0.5;
      }
      this.msg = null; yield 0.15; return;
    }
    const hero = act.actor;
    if (act.type === 'attack') {
      const t = act.targets[0];
      if (t.side === 'enemy' && t.dead) { const alt = this.alive(this.enemies)[0]; if (!alt) return; act.targets[0] = alt; }
      const tt = act.targets[0];
      hero.dir = tt.x < hero.x ? 'left' : 'right';
      yield* this.moveTo(hero, tt.x + (tt.x < hero.x ? 14 : -14), tt.y, 0.16);
      hero.pose = 'attack'; Sound.sfx('hit'); this.slash(tt); this.burst(...this.center(tt), '#ffffff', 6, 60);
      const r = this.calcDamage(hero, tt, 1, 'phys', false); if (r.tag === 'CRITICAL!') Sound.sfx('crit');
      this.applyDamage(tt, r.dmg, r.tag); this.shakeT = 0.12;
      yield 0.18; hero.pose = null; hero.dir = 'right'; yield* this.moveTo(hero, hero.hx, hero.hy, 0.18); return;
    }
    if (act.type === 'item') {
      if (!act.item) return;
      hero.pose = 'cast'; const it = ITEMS[act.item]; this.say(`${hero.name} used ${it.name}`); Sound.sfx('heal'); yield 0.35;
      for (const t of act.targets.filter(isHero)) {
        if (it.all) { t.h.hp = t.st.maxhp; t.h.mp = t.st.maxmp; this.sparkle(t, '#ffe080'); this.pop(t, 'FULL', '#7dffa0'); }
        if (it.revive) { t.h.hp = Math.round(t.st.maxhp * 0.5); this.sparkle(t, '#ffffff'); this.pop(t, 'REVIVED', '#7dffa0'); }
        if (it.heal && t.h.hp > 0) this.heal(t, it.heal);
        if (it.mp) { t.h.mp = Math.min(t.st.maxmp, t.h.mp + it.mp); this.pop(t, it.mp + ' MP', '#80c0ff'); }
      }
      yield 0.6; this.msg = null; return;
    }
    // techs
    const tech = act.tech; if (!tech) return;
    this.say(tech.name);
    this.dimT = tech.heal || tech.revive ? 0.35 : act.actors.length > 1 ? 0.7 : 0.55;
    for (const p of act.actors) { p.flash = 0.6; p.pose = 'cast'; this.sparkle(p, act.dual ? '#ffe080' : '#a0e0ff'); }
    if (act.dual) { for (const p of act.actors) yield* this.moveTo(p, p.x, p.y - 6, 0.08); for (const p of act.actors) p.y += 6; }
    yield 0.35;
    if (tech.heal || tech.revive) {
      Sound.sfx('heal');
      for (const t of act.targets.filter(isHero)) {
        if (tech.revive) { if (t.h.hp <= 0) { t.h.hp = Math.round(t.st.maxhp * 0.4); this.sparkle(t, '#fff'); this.pop(t, 'REVIVED', '#7dffa0'); } }
        else if (t.h.hp > 0) this.heal(t, Math.round(hero.st.mag * (tech.heal ?? 0) * 4 + 25));
      }
      yield 0.7; this.msg = null; return;
    }
    let targets = act.targets.filter(t => !(t.side === 'enemy' && t.dead));
    if (!targets.length) targets = this.alive(this.enemies).slice(0, 1);
    if (!targets.length) { this.msg = null; return; }
    yield* this.techFx(tech, hero, act.actors, targets);
    // combined stats for duals
    const src: DamageSource = act.actors.length > 1
      ? { side: 'hero', st: { atk: act.actors.reduce((s, p) => s + p.st.atk, 0) * 0.6, mag: act.actors.reduce((s, p) => s + Math.max(p.st.mag, p.st.atk * 0.8), 0) * 0.6 } }
      : hero;
    for (const t of targets) { const r = this.calcDamage(src, t, tech.power ?? 1, tech.elem, !!tech.magic); this.applyDamage(t, r.dmg, r.tag); }
    this.shakeT = 0.3; yield 0.55;
    for (const p of act.actors) { p.pose = null; if (Math.abs(p.x - p.hx) > 1 || Math.abs(p.y - p.hy) > 1) yield* this.moveTo(p, p.hx, p.hy, 0.15); }
    this.msg = null;
  },
  slash(t: Actor, col = '#ffffff'): void {
    const [mx, my] = this.center(t);
    for (let i = -7; i <= 7; i++) this.glow(mx + i, my - i, 0, 0, 0.14 + (i + 7) * 0.006, Math.abs(i) < 5 ? col : '#a0c8ff');
    this.light(mx, my, [255, 255, 255], 30, 0.15, 0.6);
  },
  *techFx(tech: Tech | DualTech, hero: HeroActor, actors: HeroActor[], targets: Actor[]): Anim {
    const fx = tech.fx, E = targets.map(t => this.center(t));
    if (fx === 'slash') {
      const t = targets[0]; hero.pose = null; hero.dir = 'right'; yield* this.moveTo(hero, t.x - 14, t.y, 0.12); hero.pose = 'attack';
      for (let k = 0; k < 3; k++) { Sound.sfx('hit'); this.slash(t, k === 2 ? '#fff4a0' : '#ffffff'); this.burst(E[0][0], E[0][1], '#ffffff', 8, 70); this.ring(E[0][0], E[0][1], '#ffffff', 2, 90, 0.2); this.hitStop = 0.05; yield 0.09; }
    } else if (fx === 'shot') {
      hero.pose = 'attack'; Sound.sfx('zap');
      const hx = hero.x + 18, hy = hero.y + 3;
      for (let i = 0; i < 18; i++) { const k = i / 18; this.glow(hx + (E[0][0] - hx) * k, hy + (E[0][1] - hy) * k, 0, 0, 0.08 + k * 0.15, i % 3 ? '#ffd060' : '#ffffff'); }
      this.light(hx, hy, [255, 200, 90], 40, 0.2); yield 0.15;
      this.burst(E[0][0], E[0][1], '#ffd060', 14, 80); this.ring(E[0][0], E[0][1], '#ffd060', 2, 100, 0.25);
    } else if (fx === 'spin') {
      for (let ti = 0; ti < targets.length; ti++) {
        const t = targets[ti];
        for (const p of actors) { p.dir = 'right'; p.pose = null; yield* this.moveTo(p, t.x - 12, t.y, 0.08); p.pose = 'attack'; }
        Sound.sfx('hit');
        for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; this.glow(E[ti][0] + Math.cos(a) * 10, E[ti][1] + Math.sin(a) * 6, -Math.sin(a) * 60, Math.cos(a) * 40, 0.3, '#e0f0ff'); }
        this.slash(t); this.ring(E[ti][0], E[ti][1], '#c8e0ff', 3, 110, 0.25); this.hitStop = 0.04; yield 0.07;
      }
    } else if (fx === 'fire') {
      Sound.sfx('fire');
      for (let w = 0; w < 3; w++) {
        for (const [mx, my] of E) { for (let i = 0; i < 14; i++) this.glow(mx - 6 + Math.random() * 12, my + 8, (Math.random() - 0.5) * 24, -40 - Math.random() * 70, 0.35 + Math.random() * 0.4, ['#ff4020', '#ff9020', '#ffe040', '#fff4c0'][i % 4], i % 3 === 0 ? 2 : 1); this.light(mx, my, [255, 130, 50], 70, 0.5, 1); }
        yield 0.1;
      }
      if (actors.length > 1) { this.flashT = 0.15; for (const t of targets) { actors[0].pose = null; yield* this.moveTo(actors[0], t.x - 12, t.y, 0.08); actors[0].pose = 'attack'; this.slash(t, '#ffb040'); } }
      for (const [mx, my] of E) this.ring(mx, my, '#ff9020', 3, 130, 0.35);
      yield 0.25;
    } else if (fx === 'ice') {
      Sound.sfx('ice');
      for (const [mx, my] of E) for (let i = 0; i < 16; i++) this.glow(mx - 8 + Math.random() * 16, my - 50 - Math.random() * 30, 0, 160, 0.32 + Math.random() * 0.1, ['#c0f0ff', '#80c8ff', '#ffffff'][i % 3], i % 4 === 0 ? 2 : 1);
      yield 0.35;
      for (const [mx, my] of E) {
        this.burst(mx, my, '#c0f0ff', 14, 90); this.ring(mx, my, '#a0e0ff', 2, 120, 0.35); this.light(mx, my, [140, 210, 255], 70, 0.5);
        for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; for (let k = 2; k < 9; k++) this.glow(mx + Math.cos(a) * k, my + Math.sin(a) * k * 0.7, 0, 0, 0.35, k > 6 ? '#ffffff' : '#9ad8ff'); }
      }
      this.hitStop = 0.08;
    } else if (fx === 'zap') {
      for (let k = 0; k < 3; k++) {
        Sound.sfx('zap');
        for (const [mx, my] of E) { let x = mx, y = my - 60; for (let i = 0; i < 20; i++) { x += Math.round((Math.random() - 0.5) * 6); y += 3; this.glow(x, y, 0, 0, 0.12, i % 3 ? '#fff080' : '#ffffff'); } this.light(mx, my, [255, 240, 140], 80, 0.15, 1); this.ring(mx, my, '#fff080', 2, 90, 0.15); }
        this.flashT = 0.06; yield 0.12;
      }
    } else if (fx === 'time') {
      Sound.sfx('rift');
      const cx = E.reduce((s, e) => s + e[0], 0) / E.length, cy = E.reduce((s, e) => s + e[1], 0) / E.length;
      this.clock = { x: cx, y: cy, t: 0, life: 1.1 }; this.light(cx, cy, [200, 140, 255], 120, 1.2, 1);
      for (let i = 0; i < 60; i++) { const a = i / 60 * 6.283; this.glow(cx + Math.cos(a) * 70, cy + Math.sin(a) * 45, -Math.cos(a) * 110, -Math.sin(a) * 70, 0.6, ['#ffe080', '#c080ff', '#80e0ff'][i % 3]); }
      yield 0.9; Sound.sfx('crit'); this.flashT = 0.35; this.hitStop = 0.12;
      for (const [mx, my] of E) { this.burst(mx, my, '#ffffff', 24, 130); this.ring(mx, my, '#ffe080', 3, 160, 0.5); }
      this.ring(cx, cy, '#c080ff', 10, 200, 0.6);
    }
  },
  drawClockFx(g: Ctx, x: number, y: number, t: number): void {
    x = Math.round(x); y = Math.round(y);
    const r = Math.round(10 + Math.min(1, t * 2) * 26);
    g.globalAlpha = Math.max(0, 1 - Math.max(0, t - 0.7) * 3);
    pring(g, x, y, r, '#ffe080'); pring(g, x, y, r - 3, '#c080ff');
    for (let i = 0; i < 13; i++) { const a = i / 13 * 6.283 - 1.571; px(g, Math.round(x + Math.cos(a) * (r - 6)) - 1, Math.round(y + Math.sin(a) * (r - 6)) - 1, 2, 2, i === 12 ? '#ff6ad5' : '#ffe080'); }
    for (const [len, ang, c] of [[r - 8, t * 14, '#ffffff'], [r * 0.5, -t * 5, '#ffe080']] as [number, number, string][]) for (let k = 0; k < len; k++) px(g, Math.round(x + Math.cos(ang) * k), Math.round(y + Math.sin(ang) * k), 1, 1, c);
    g.globalAlpha = 1;
  },

  // ---------- end of battle ----------
  win() {
    this.phase = 'win'; this.menu = null; this.msg = null;
    const xp = this.enemies.reduce((s, e) => s + e.k.xp, 0), gold = this.enemies.reduce((s, e) => s + e.k.gold, 0);
    G.gold += gold;
    const lines = [xp || gold ? `Victory!  +${xp} XP   +${gold} G` : `${this.enemies[0].name} is defeated!`];
    for (const a of this.heroes) {
      if (a.h.hp <= 0) continue;
      a.h.xp += xp; const before = knownTechs(a.h).length;
      while (a.h.xp >= xpForLevel(a.h.lv + 1)) {
        const old = heroStats(a.h); a.h.lv++; const nw = heroStats(a.h);
        a.h.hp += nw.maxhp - old.maxhp; a.h.mp += nw.maxmp - old.maxmp; lines.push(`${a.name} reached Lv ${a.h.lv}!`);
      }
      for (const t of knownTechs(a.h).slice(before)) lines.push(`${a.name} learned ${t.name}!`);
    }
    if (!this.cfg.boss && Math.random() < 0.35) { const k = Math.random() < 0.7 ? 'tonic' : 'ether'; G.inv[k] = (G.inv[k] || 0) + 1; lines.push(`Found a ${ITEMS[k].name}.`); }
    this.result = lines; Sound.play(null); Sound.sfx('win');
    const self = this;
    this.co = (function* () { for (const a of self.heroes) a.dir = 'down'; yield 0.6; })();
  },
  lose() { this.phase = 'lose'; this.menu = null; this.result = ['The party has fallen...', 'Press Z to rise again from your last save.']; Sound.play(null); Sound.sfx('die'); },
  finish() {
    this.active = false;
    if (this.phase === 'lose') { Game.gameOver(); return; }
    for (const a of this.heroes) if (a.h.hp <= 0) a.h.hp = 1;
    Game.endBattle('win');
  },

  // ---------- draw ----------
  draw() {
    const shx = this.shakeT > 0 ? (Math.random() - 0.5) * 12 : 0, shy = this.shakeT > 0 ? (Math.random() - 0.5) * 12 : 0;
    toWorld();
    const cx = Math.round(G.camX), cy = Math.round(G.camY), t = this.t, extras = [];
    for (const e of this.enemies) if (!e.dead) extras.push({ y: e.y, draw: () => drawEnemy(e.k, e.x - cx, e.y - cy, t, { flash: e.flash > 0 }) });
    for (const a of this.heroes) {
      const alive = a.h.hp > 0;
      let pose = a.pose || (a.moving || this.phase === 'intro' || this.phase === 'run' ? null : 'ready');
      if (this.phase === 'win' && alive && !a.moving) pose = 'victory';
      if ((a.hurtT ?? 0) > 0 && alive) pose = 'hurt';
      extras.push({ y: a.y, draw: () => drawHero(a.x - cx, a.y - cy, HEROES[a.id].look, a.dir, a.frame, { pose, flip: a.dir === 'left', flash: a.flash > 0 && (t * 20 | 0) % 2, down: !alive }) });
    }
    Game.drawWorld(true, extras, this.dim);
    const L = this.lights.map(l => ({ x: l.x, y: l.y, r: l.r, c: l.c, i: l.i * Math.min(1, l.life / l.max * 1.5) }));
    for (const a of this.heroes) L.push({ x: a.x + 8, y: a.y + 6, r: 40, c: [255, 236, 210], i: 0.22 });
    Atmos.draw(G.map, cx, cy, L);
    // spell layer: unlit, mostly additive
    const g = ctx; g.save();
    g.globalCompositeOperation = 'lighter';
    for (const r of this.rings) { g.globalAlpha = Math.max(0, r.life / r.max); pring(g, Math.round(r.x - cx), Math.round(r.y - cy), Math.max(1, Math.round(r.r)), r.c); }
    g.globalAlpha = 1;
    if (this.clock) this.drawClockFx(g, this.clock.x - cx, this.clock.y - cy, this.clock.t);
    for (const f of this.fx) {
      const x = Math.round(f.x - cx), y = Math.round(f.y - cy), a = (f.delay ?? 0) > 0 ? 1 : Math.max(0, Math.min(1, f.life * 3));
      if (f.glow) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * 0.3; px(g, x - 1, y - 1, f.size + 2, f.size + 2, f.color); g.globalAlpha = a; px(g, x, y, f.size, f.size, f.color); }
      else { g.globalCompositeOperation = 'source-over'; g.globalAlpha = a; px(g, x, y, f.size, f.size, f.color); }
    }
    g.restore();
    // pixel arrows: targets (white) and the hero whose command menu is open (gold)
    const arrow = (x: number, y: number, col: string) => { x = Math.round(x); y = Math.round(y + Math.sin(t * 10) * 1.5); px(g, x - 4, y - 1, 9, 1, PAL.ink); for (let i = 0; i < 4; i++) { px(g, x - 4 + i, y + i, 9 - i * 2, 1, PAL.ink); px(g, x - 3 + i, y + i, 7 - i * 2, 1, col); } px(g, x, y + 4, 1, 1, PAL.ink); };
    const top = (a: Actor) => a.side === 'hero' ? a.y - 26 : a.y + 16 - enemyHeight(a.k) - 6 - (a.k.shape === 'bat' ? 6 : 0);
    const m = this.menu;
    if (m && m.level === 'target' && m.pending) {
      const list = this.targetList(m.pending.target), multi = m.pending.target === 'enemies' || m.pending.target === 'allies';
      for (const a of (multi ? list : [list[m.tIdx]])) if (a) arrow(a.x + 8 - cx, top(a) - cy, PAL.white);
    } else if (m) arrow(m.actor.x + 8 - cx, top(m.actor) - cy, PAL.gold);
    toScreen(); blitWorld(shx, shy);
    if (this.flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, this.flashT * 1.5)})`; ctx.fillRect(0, 0, W, H); }
    for (const p of this.pops) {
      const bounce = p.t < 0.25 ? -Math.sin(p.t / 0.25 * Math.PI) * 18 : 0;
      ctx.globalAlpha = Math.max(0, Math.min(1, (1.2 - p.t) * 3));
      text(p.s, (p.x - cx) * S, (p.y - cy) * S - 12 + bounce, p.color, p.s.length > 5 ? 14 : 20, 'center');
    }
    ctx.globalAlpha = 1;
    this.drawUI();
  },
  drawUI() {
    const m = this.menu, t = this.t;
    if (this.phase === 'intro') return;
    // party panel
    uiWindow(330, 540, 620, 170);
    this.heroes.forEach((a, i) => {
      const y = 560 + i * 48, h = a.h, dead = h.hp <= 0;
      text(a.name, 350, y + 4, dead ? '#ff6060' : m && m.actor === a ? '#ffe050' : '#fff');
      text(`${h.hp}`, 560, y + 4, dead ? '#ff6060' : h.hp < a.st.maxhp * 0.3 ? '#ffd060' : '#fff', 16, 'right');
      text(`/${a.st.maxhp}`, 565, y + 8, '#a0a8d0', 10);
      text(`${h.mp}`, 700, y + 4, '#a0d0ff', 16, 'right'); text('MP', 705, y + 8, '#a0a8d0', 10);
      bar(760, y + 6, 170, 14, a.atb / 100, a.atb >= 100 ? '#ffe050' : '#40b0ff');
    });
    // command windows
    if (m) {
      uiWindow(10, 540, 310, 170);
      const mode = m.level === 'target' ? m.pending?.type ?? 'attack' : m.level;
      if (mode === 'main' || mode === 'attack') {
        const o = this.mainOptions();
        o.forEach((s, i) => text(s, 60, 560 + i * 36, '#fff', 18));
        cursor(30, 562 + m.idx * 36, t);
        if (this.ready.length > 1) text('X: switch', 180, 680, '#a0a8d0', 10);
      } else {
        const isTech = mode === 'tech';
        const rows: { label: string; right: string; color: string; rightColor: string; desc: string }[] = isTech
          ? this.techOptions(m.actor).map(c => ({
            label: (c.dual ? '★ ' : '') + c.label, right: `${c.cost} MP`,
            color: c.ok ? (c.dual ? '#ffe8a0' : '#fff') : '#6a6a8a', rightColor: c.ok ? '#a0d0ff' : '#6a6a8a',
            desc: isDual(c.t) ? `Dual tech with ${c.t.who.filter(w => w !== m.actor.id).map(w => HEROES[w].name).join(' & ')}${c.ok ? '' : ' (all must be ready)'}` : techDesc(c.t),
          }))
          : this.itemOptions().map(c => ({ label: c.it.name, right: `x${c.n}`, color: '#fff', rightColor: '#fff', desc: c.it.desc }));
        const sel = m.sub, start = Math.max(0, Math.min(sel - 2, rows.length - 4));
        uiWindow(10, 330, 600, 200);
        text(isTech ? `${m.actor.name}'s Techs` : 'Items', 30, 345, '#ffe050', 14);
        rows.slice(start, start + 4).forEach((r, j) => {
          const i = start + j, y = 375 + j * 36;
          text(r.label, 60, y, r.color, 16); text(r.right, 580, y, r.rightColor, 14, 'right');
          if (i === sel && m.level !== 'target') cursor(30, y + 2, t);
        });
        const c = rows[sel];
        if (c) wrapText(c.desc, 270, 11).slice(0, 3).forEach((ln, j) => text(ln, 30, 560 + j * 20, '#c0c8f0', 11));
        text('Z: use  X: back', 30, 680, '#a0a8d0', 10);
      }
      if (m.level === 'target' && m.pending) {
        const tg = m.pending.target, list = this.targetList(tg), cur = list[m.tIdx];
        const name = tg === 'enemies' ? 'All enemies' : tg === 'allies' ? 'All allies' : cur ? cur.name : '';
        uiWindow(330, 470, 620, 60); text(name, 640, 490, '#fff', 16, 'center');
        if (cur && cur.side === 'enemy' && tg === 'enemy') bar(780, 494, 150, 10, cur.hp / cur.maxhp, '#ff5050');
      }
    }
    if (this.msg) { uiWindow(180, 20, 600, 60); text(this.msg.s, 480, 42, '#fff', 18, 'center'); }
    if (this.phase === 'win' || this.phase === 'lose') {
      const L = this.result, h = 50 + L.length * 32;
      // keep the result window clear of the party: below them when they stand in the upper half of the screen
      const partyY = this.heroes.reduce((sum, a) => sum + (a.y - G.camY) * S, 0) / this.heroes.length, wy = partyY < 300 ? Math.min(330, 525 - h) : 120;
      uiWindow(180, wy, 600, h); L.forEach((s, i) => text(s, 480, wy + 25 + i * 32, i === 0 ? '#ffe050' : '#fff', i === 0 ? 18 : 14, 'center'));
      if (!this.co && (t * 2 | 0) % 2) text('▼', 750, wy + h - 30, '#fff', 14);
    }
  },
};
export function techDesc(t: Tech | DualTech): string {
  if (t.revive) return 'Revives a fallen ally';
  if (t.heal) return t.target === 'allies' ? 'Heals all allies' : 'Heals one ally';
  const tg = t.target === 'enemies' ? 'all enemies' : 'one enemy';
  const el = t.elem ?? 'phys';
  return `${el === 'phys' ? 'Physical' : el[0].toUpperCase() + el.slice(1)} damage to ${tg}`;
}
