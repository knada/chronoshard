// The game's content holds together: every map, warp, NPC, enemy, item and story script refers to things that exist,
// and every place the story needs you to go can be reached on foot.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Sound } from '../src/engine.js';
import { DUALS, ENEMIES, EVENTS, HEROES, ITEMS, MAPS, MUSIC, SHOP_STOCK, TALK } from '../src/data.js';
import { TILES } from '../src/tiles.js';
import { BOSS_WIN } from '../src/game.js';
import { inBounds, mapList, reachable, storyScripts, walkable } from './helpers.js';
import type { MapDef } from '../src/types.js';

/** where a new game starts (Game.newGame) */
const START = { map: 'town', x: 2, y: 4 };

describe.each(mapList.map(m => [m.id, m] as [string, MapDef]))('map %s', (_id, m) => {
  test('is drawn only with known tiles', () => {
    const unknown = new Set(m.rows.join('').split('').filter(ch => !TILES[ch]));
    expect([...unknown]).toEqual([]);
  });

  test('plays a known track', () => expect(MUSIC[m.music]).toBeDefined());

  test('warps and rifts lead onto open ground on a real map', () => {
    for (const w of [...(m.warps ?? []), ...(m.rifts ?? [])]) {
      const to = MAPS[w.to];
      expect(to, `${m.id} (${w.x},${w.y}) -> ${w.to}`).toBeDefined();
      expect(walkable(m, w.x, w.y), `${m.id} warp tile (${w.x},${w.y}) can be stepped on`).toBe(true);
      expect(walkable(to, w.tx, w.ty), `${w.to} arrival (${w.tx},${w.ty}) is open ground`).toBe(true);
    }
  });

  test('places NPCs, chests, signs, triggers and enemies inside the map', () => {
    const things = [...(m.npcs ?? []), ...(m.chests ?? []), ...(m.signs ?? []), ...(m.triggers ?? []), ...(m.enemies ?? [])];
    for (const t of things) expect(inBounds(m, t.x, t.y), `${m.id} (${t.x},${t.y})`).toBe(true);
  });

  test('NPCs have something to say, triggers run real events, chests hold real items', () => {
    for (const n of m.npcs ?? []) expect(TALK[n.talk], `${n.id} talk "${n.talk}"`).toBeDefined();
    for (const t of m.triggers ?? []) expect(EVENTS[t.event], `trigger event "${t.event}"`).toBeDefined();
    for (const c of m.chests ?? []) { expect(ITEMS[c.item], `${c.id} item`).toBeDefined(); expect(c.n).toBeGreaterThan(0); }
  });

  test('field enemies are known kinds, and a boss win runs its event', () => {
    for (const e of m.enemies ?? []) {
      expect(ENEMIES[e.kind], `${e.id} kind "${e.kind}"`).toBeDefined();
      for (const g of e.group) expect(ENEMIES[g.k], `${e.id} group member "${g.k}"`).toBeDefined();
      if (BOSS_WIN[e.id]) expect(EVENTS[BOSS_WIN[e.id]]).toBeDefined();
    }
  });
});

describe('getting around', () => {
  // arrival points of each map: the new-game start, and wherever a warp or rift lands
  const arrivals = new Map<string, [number, number][]>();
  const arrive = (id: string, x: number, y: number) => arrivals.set(id, [...(arrivals.get(id) ?? []), [x, y]]);
  arrive(START.map, START.x, START.y);
  for (const m of mapList) for (const w of [...(m.warps ?? []), ...(m.rifts ?? [])]) arrive(w.to, w.tx, w.ty);
  const onFoot = (m: MapDef) => {
    const tiles = new Set<string>();
    for (const [x, y] of arrivals.get(m.id) ?? []) for (const t of reachable(m, x, y)) tiles.add(t);
    return tiles;
  };
  const near = (tiles: Set<string>, x: number, y: number) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => tiles.has(`${x + dx},${y + dy}`));

  test('a new game starts on open ground', () => expect(walkable(MAPS[START.map], START.x, START.y)).toBe(true));

  test('every map can be reached from the start', () => {
    const seen = new Set([START.map]), queue = [START.map];
    while (queue.length) {
      const m = MAPS[queue.shift()!], tiles = onFoot(m);
      for (const w of [...(m.warps ?? []), ...(m.rifts ?? [])]) if (tiles.has(`${w.x},${w.y}`) && !seen.has(w.to)) { seen.add(w.to); queue.push(w.to); }
    }
    expect([...seen].sort()).toEqual(Object.keys(MAPS).sort());
  });

  test.each(mapList.map(m => [m.id, m] as [string, MapDef]))('on %s, every warp, trigger, NPC, chest and sign can be walked to', (_id, m) => {
    const tiles = onFoot(m);
    for (const w of [...(m.warps ?? []), ...(m.rifts ?? []), ...(m.triggers ?? [])]) expect(tiles.has(`${w.x},${w.y}`), `(${w.x},${w.y})`).toBe(true);
    for (const t of [...(m.npcs ?? []), ...(m.chests ?? []), ...(m.signs ?? [])]) expect(near(tiles, t.x, t.y), `next to (${t.x},${t.y})`).toBe(true);
  });
});

describe('story scripts', () => {
  const scripts = storyScripts();
  afterEach(() => vi.restoreAllMocks());

  test('only refer to heroes, enemies and maps that exist', () => {
    for (const { from, script } of scripts) {
      for (const c of script) {
        if (c[0] === 'join') expect(HEROES[c[1]], `${from}: join ${c[1]}`).toBeDefined();
        if (c[0] === 'give') { expect(ITEMS[c[1]], `${from}: give ${c[1]}`).toBeDefined(); expect(c[2]).toBeGreaterThan(0); }
        if (c[0] === 'battle') for (const e of c[1]) expect(ENEMIES[e.k], `${from}: battle ${e.k}`).toBeDefined();
        if (c[0] === 'warp') {
          expect(MAPS[c[1]], `${from}: warp ${c[1]}`).toBeDefined();
          expect(walkable(MAPS[c[1]], c[2], c[3]), `${from}: warp lands on open ground`).toBe(true);
        }
      }
    }
  });

  test('only play sound effects the game has', () => {
    const tone = vi.spyOn(Sound, 'tone'), noise = vi.spyOn(Sound, 'noise');
    for (const { from, script } of scripts) for (const c of script) if (c[0] === 'sfx') {
      tone.mockClear(); noise.mockClear(); Sound.sfx(c[1]);
      expect(tone.mock.calls.length + noise.mock.calls.length, `${from}: sfx "${c[1]}"`).toBeGreaterThan(0);
    }
  });

  test('never show an empty line of dialogue', () => {
    for (const { from, script } of scripts) for (const c of script) if (c[0] === 'say') expect(c[2].trim(), from).not.toBe('');
  });
});

describe('the road through time', () => {
  /** the flag each boss's win event sets */
  const opens = (event: string) => storyScripts().filter(s => s.from === `event ${event}`).flatMap(s => s.script).flatMap(c => (c[0] === 'flag' ? [c[1]] : []));

  test('each story boss opens a rift onward, which leads to the next era', () => {
    // the Golem opens the way to Frostveil, the Colossus to Cogspire, the Tyrant to the ruins of Ashvale
    for (const [boss, to] of [['golemWin', 'frostveil'], ['colossusWin', 'cogspire'], ['tyrantWin', 'ruins']]) {
      const flags = opens(boss), rifts = mapList.flatMap(m => m.rifts ?? []).filter(r => flags.includes(r.flag) && r.to === to);
      expect(rifts.length, `${boss} opens a rift to ${to}`).toBeGreaterThan(0);
    }
  });

  test('every boss is guarded by its flag, so it stays beaten', () => {
    for (const m of mapList) for (const e of m.enemies ?? []) if (e.boss) expect(e.flag, `${m.id} ${e.id}`).toBeTruthy();
  });

  test('every rift has a way back the other way', () => {
    for (const m of mapList) for (const r of m.rifts ?? []) {
      expect(MAPS[r.to].rifts?.some(b => b.to === m.id && b.flag === r.flag), `${m.id} -> ${r.to} (${r.flag})`).toBe(true);
    }
  });
});

describe('heroes, enemies and items', () => {
  test('dual techs pair real heroes, with an MP cost for each', () => {
    for (const d of DUALS) {
      expect(d.who.length, d.name).toBeGreaterThanOrEqual(2);
      for (const h of d.who) expect(HEROES[h], `${d.name}: ${h}`).toBeDefined();
      expect(d.mp.length, `${d.name}: one MP cost per hero`).toBe(d.who.length);
    }
  });

  test('every enemy has an attack, and no element is both a weakness and a resistance', () => {
    for (const k of Object.values(ENEMIES)) {
      expect(k.moves.some(m => !m.heal), `${k.name} has an attacking move`).toBe(true);
      expect((k.weak ?? []).filter(e => (k.resist ?? []).includes(e)), k.name).toEqual([]);
    }
  });

  test('the shop sells real items, at a price', () => {
    for (const id of SHOP_STOCK) { expect(ITEMS[id]).toBeDefined(); expect(ITEMS[id].price).toBeGreaterThan(0); }
  });
});
