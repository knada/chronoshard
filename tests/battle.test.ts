// Battle rules: stats and levelling, the damage formula, winning and losing, and where the party lines up.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TILE } from '../src/engine.js';
import { ENEMIES, HEROES, MAPS } from '../src/data.js';
import { Battle, heroStats, knownTechs, xpForLevel } from '../src/battle.js';
import { G, Game, newHero } from '../src/game.js';
import { inBounds, mapList, resetGame, walkable } from './helpers.js';
import type { HeroId } from '../src/types.js';

const heroIds = Object.keys(HEROES) as HeroId[];

/** a battle on the fields with a full party, played until the party can act */
function fight(enemies: { k: string; x: number; y: number }[], opts: { boss?: boolean } = {}) {
  Game.newGame(); G.script = null;
  G.party = heroIds.map(id => newHero(id, 3));
  Game.loadMap('fields', 8, 7, 'right'); G.foes = [];
  Game.startBattle({ enemies, ...opts });
  for (let i = 0; i < 60 && Battle.phase === 'intro'; i++) Battle.update(1 / 30);
  return Battle;
}

beforeEach(resetGame);
afterEach(() => vi.restoreAllMocks());

describe('heroes', () => {
  test.each(heroIds)('%s starts at their base stats and grows with each level', id => {
    const b = HEROES[id], lv1 = heroStats({ id, lv: 1, xp: 0, hp: 1, mp: 1 }), lv10 = heroStats({ id, lv: 10, xp: 0, hp: 1, mp: 1 });
    expect(lv1).toEqual({ maxhp: b.hp, maxmp: b.mp, atk: b.atk, def: b.def, mag: b.mag, spd: b.spd });
    for (const k of Object.keys(lv1) as (keyof typeof lv1)[]) expect(lv10[k], k).toBeGreaterThanOrEqual(lv1[k]);
    expect(lv10.maxhp).toBeGreaterThan(lv1.maxhp);
  });

  test('a new hero is fully healed, with the XP of their level', () => {
    const h = newHero('lyra', 4), s = heroStats(h);
    expect([h.hp, h.mp, h.xp]).toEqual([s.maxhp, s.maxmp, xpForLevel(4)]);
  });

  test('each level needs more XP than the last', () => {
    const gap = (lv: number) => xpForLevel(lv) - xpForLevel(lv - 1);
    expect(xpForLevel(1)).toBe(0);
    expect(gap(2)).toBeGreaterThan(0);
    for (let lv = 3; lv < 40; lv++) expect(gap(lv), `Lv ${lv}`).toBeGreaterThan(gap(lv - 1));
  });

  test.each(heroIds)('%s learns techs as they level, never forgetting one', id => {
    let before = 0;
    for (let lv = 1; lv <= 30; lv++) {
      const known = knownTechs({ id, lv, xp: 0, hp: 1, mp: 1 });
      expect(known.length).toBeGreaterThanOrEqual(before); before = known.length;
      for (const t of known) expect(t.lv ?? 1).toBeLessThanOrEqual(lv);
    }
    expect(before).toBe(HEROES[id].techs.length);
  });
});

describe('damage', () => {
  // no critical hits, and the ±10% spread at its midpoint
  const steady = () => vi.spyOn(Math, 'random').mockReturnValue(0.5);

  test('physical damage is attack x power x 2 minus defence', () => {
    const b = fight([{ k: 'gloop', x: 12, y: 6 }]); steady();
    const kael = b.heroes[0], gloop = b.enemies[0];
    expect(b.calcDamage(kael, gloop, 1).dmg).toBe(kael.st.atk * 2 - gloop.k.def);
  });

  test('magic uses the magic stats', () => {
    const b = fight([{ k: 'gloop', x: 12, y: 6 }]); steady();
    const lyra = b.heroes[2], gloop = b.enemies[0];
    expect(b.calcDamage(lyra, gloop, 1, 'ice', true).dmg).toBe(Math.round(lyra.st.mag * 2.2 - gloop.k.mag * 0.4));
  });

  test('a weakness doubles damage and a resistance cuts it to 40%', () => {
    const b = fight([{ k: 'redgloop', x: 12, y: 6 }]); steady();
    const kael = b.heroes[0], ember = b.enemies[0];
    expect(ember.k.weak).toContain('ice'); expect(ember.k.resist).toContain('fire');
    const base = kael.st.atk * 2 - ember.k.def;
    expect(b.calcDamage(kael, ember, 1, 'ice')).toEqual({ dmg: base * 2, tag: 'WEAK!' });
    expect(b.calcDamage(kael, ember, 1, 'fire')).toEqual({ dmg: Math.round(base * 0.4), tag: 'resist' });
  });

  test('every hit does at least 1', () => {
    const b = fight([{ k: 'golem', x: 12, y: 6 }], { boss: true }); steady();
    expect(b.calcDamage(b.heroes[2], b.enemies[0], 0).dmg).toBe(1);
  });

  test('an unlucky roll makes a physical hit critical', () => {
    const b = fight([{ k: 'gloop', x: 12, y: 6 }]);
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    expect(b.calcDamage(b.heroes[0], b.enemies[0], 1).tag).toBe('CRITICAL!');
  });
});

describe('winning and losing', () => {
  test('beating every enemy wins XP and gold, then returns to the field', () => {
    const b = fight([{ k: 'gloop', x: 12, y: 6 }, { k: 'duskbat', x: 13, y: 8 }]);
    const gold = G.gold, xp = G.party.map(h => h.xp);
    for (const e of b.enemies) b.applyDamage(e, 9999, null);
    b.checkEnd();
    expect(b.phase).toBe('win');
    expect(G.gold).toBe(gold + ENEMIES.gloop.gold + ENEMIES.duskbat.gold);
    expect(G.party.map(h => h.xp)).toEqual(xp.map(x => x + ENEMIES.gloop.xp + ENEMIES.duskbat.xp));
    b.finish();
    expect(G.mode).toBe('field');
  });

  test('enough XP levels a hero up and grows their HP', () => {
    const b = fight([{ k: 'golem', x: 12, y: 6 }], { boss: true });
    const kael = G.party[0], lv = kael.lv, hp = kael.hp;
    b.applyDamage(b.enemies[0], 99999, null); b.checkEnd();
    expect(kael.lv).toBeGreaterThan(lv);
    expect(kael.hp).toBeGreaterThan(hp);
    expect(b.result.some(l => l.startsWith('Kael reached Lv'))).toBe(true);
  });

  test('a fallen hero gets back up with 1 HP after a win', () => {
    const b = fight([{ k: 'gloop', x: 12, y: 6 }]);
    G.party[1].hp = 0;
    b.applyDamage(b.enemies[0], 9999, null); b.checkEnd(); b.finish();
    expect(G.party[1].hp).toBe(1);
  });

  test('losing returns to the last save, fully healed', () => {
    const b = fight([{ k: 'gloop', x: 12, y: 6 }]);
    Game.save();
    for (const h of b.heroes) b.applyDamage(h, 9999, null);
    b.checkEnd();
    expect(b.phase).toBe('lose');
    b.finish();
    expect(G.mode).toBe('field');
    expect(G.map.id).toBe('fields');
    for (const h of G.party) expect(h.hp).toBe(heroStats(h).maxhp);
  });

  test('bosses and story fights cannot be run from', () => {
    expect(fight([{ k: 'gloop', x: 12, y: 6 }]).mainOptions()).toContain('Run');
    expect(fight([{ k: 'golem', x: 12, y: 6 }], { boss: true }).mainOptions()).not.toContain('Run');
  });
});

describe('the party lines up on open ground', () => {
  // every field enemy on every map, fought with a full party
  const spawns = mapList.flatMap(m => (m.enemies ?? []).map(e => [`${m.id} ${e.id}`, m.id, e] as const));
  test.each(spawns)('%s', (_name, mapId, e) => {
    Game.newGame(); G.script = null;
    G.party = heroIds.map(id => newHero(id, 5));
    Game.loadMap(mapId, e.x, e.y); G.foes = [];
    Game.startBattle({ enemies: e.group.map(g => ({ k: g.k, x: e.x + g.dx, y: e.y + g.dy })), boss: !!e.boss });
    const m = MAPS[mapId], spots: string[] = [];
    for (const a of Battle.heroes) {
      const tx = Math.floor((a.hx + 8) / TILE), ty = Math.floor((a.hy + 12) / TILE);
      expect(inBounds(m, tx, ty), `${a.name} inside the map`).toBe(true);
      expect(walkable(m, tx, ty), `${a.name} at (${tx},${ty}) stands on open ground`).toBe(true);
      spots.push(`${tx},${ty}`);
    }
    expect(new Set(spots).size, 'no two heroes on one tile').toBe(spots.length);
  });
});
