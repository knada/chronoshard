// The field: walking and walls, warps, talking, chests, story triggers, and saving.
import { beforeEach, describe, expect, test } from 'vitest';
import { Input, TILE } from '../src/engine.js';
import { MAPS, TALK } from '../src/data.js';
import { G, Game, SAVE_KEY } from '../src/game.js';
import { arrival, mapList, reachable, resetGame, standOn, walkable } from './helpers.js';
import type { Dir, MapDef } from '../src/types.js';

beforeEach(() => { resetGame(); Game.newGame(); G.script = null; });
/** the script playing now (read through a call, so TypeScript doesn't assume it's still what a test set it to) */
const script = () => G.script;

/** holds a direction for `seconds` of game time */
function walk(dir: Dir, seconds: number): void {
  Input.down = { [dir]: true };
  for (let t = 0; t < seconds; t += 1 / 60) Game.updateField(1 / 60);
  Input.down = {};
}

describe('walking', () => {
  test('holding a direction moves the player that way and faces them along it', () => {
    // somewhere in town with four tiles of open ground to the right
    const m = MAPS.town, open = [...reachable(m, 2, 4)].map(k => k.split(',').map(Number))
      .find(([x, y]) => [1, 2, 3, 4].every(d => walkable(m, x + d, y) && walkable(m, x + d, y + 1) && walkable(m, x + d, y - 1)))!;
    Game.loadMap('town', open[0], open[1]); G.foes = []; G.npcs = [];
    const x = G.player.x;
    walk('right', 0.25);
    expect(G.player.x).toBeGreaterThan(x + 10);
    expect(G.player.dir).toBe('right');
  });

  test.each(mapList.map(m => [m.id, m] as [string, MapDef]))('on %s, walls stop the player', (_id, m) => {
    // from where the player first arrives, walk each way for a while: their feet never end up in a wall
    const [x, y] = arrival(m);
    for (const dir of ['up', 'left', 'down', 'right'] as Dir[]) {
      Game.loadMap(m.id, x, y); G.foes = []; G.npcs = [];
      walk(dir, 3);
      const t = Game.ptile();
      expect(walkable(m, t.x, t.y), `${m.id}: walked ${dir} into (${t.x},${t.y})`).toBe(true);
    }
  });
});

describe('warps', () => {
  const warps = mapList.flatMap(m => (m.warps ?? []).map(w => [`${m.id} (${w.x},${w.y}) -> ${w.to}`, m.id, w] as const));
  test.each(warps)('%s', (_name, from, w) => {
    Game.loadMap(from, w.x, w.y); standOn(w.x, w.y);
    Game.checkTile();
    expect(G.onFade, 'stepping on the warp starts a fade').toBeTypeOf('function');
    G.onFade!();
    expect(G.map.id).toBe(w.to);
    expect(Game.ptile()).toEqual({ x: w.tx, y: w.ty });
  });

  test('a rift only opens once its flag is set', () => {
    const m = mapList.find(o => o.rifts?.length)!, r = m.rifts![0];
    Game.loadMap(m.id, r.x, r.y); standOn(r.x, r.y);
    Game.checkTile();
    expect(G.onFade).toBeNull();
    G.flags[r.flag] = true; standOn(r.x, r.y);
    Game.checkTile(); G.onFade!();
    expect(G.map.id).toBe(r.to);
  });
});

describe('talking and looking', () => {
  /** stands the player on open, reachable ground next to (x, y), facing it */
  function faceTile(m: MapDef, x: number, y: number): boolean {
    const open = reachable(m, ...arrival(m));
    for (const [dx, dy, dir] of [[0, 1, 'up'], [0, -1, 'down'], [-1, 0, 'right'], [1, 0, 'left']] as [number, number, Dir][]) {
      if (!open.has(`${x + dx},${y + dy}`)) continue;
      G.player.x = (x + dx) * TILE; G.player.y = (y + dy) * TILE; G.player.dir = dir;
      return true;
    }
    return false;
  }

  const npcs = mapList.flatMap(m => (m.npcs ?? []).map(n => [`${m.id} ${n.id}`, m, n] as const));
  test.each(npcs)('%s answers when spoken to', (_name, m, n) => {
    Game.loadMap(m.id, n.x, n.y);
    expect(faceTile(m, n.x, n.y), 'there is room to stand next to them').toBe(true);
    Game.interact();
    expect(G.script?.cmds).toEqual(TALK[n.talk](G.flags));
  });

  test('a chest gives its item once', () => {
    const m = mapList.find(o => o.chests?.length)!, c = m.chests![0];
    Game.loadMap(m.id, c.x, c.y); G.npcs = [];
    expect(faceTile(m, c.x, c.y)).toBe(true);
    const had = G.inv[c.item] ?? 0;
    Game.interact();
    expect(G.inv[c.item]).toBe(had + c.n);
    expect(G.flags[c.id]).toBe(true);
    G.script = null; Game.interact();
    expect(G.inv[c.item]).toBe(had + c.n);
    expect(script()?.cmds[0]).toEqual(['say', '', 'The chest is empty.']);
  });
});

describe('story', () => {
  test('a new game opens in Ashvale with Kael, three Tonics and 50 gold, and a story to read', () => {
    Game.newGame();
    expect(G.map.id).toBe('town');
    expect(G.party.map(h => h.id)).toEqual(['kael']);
    expect(G.inv).toEqual({ tonic: 3 });
    expect(G.gold).toBe(50);
    expect(G.script?.cmds[0][0]).toBe('say');
  });

  test('reading through a script applies its commands in order', () => {
    Game.runScript([['say', 'Kael', 'Hi.'], ['flag', 'met'], ['join', 'bram'], ['heal']]);
    G.party[0].hp = 1;
    Game.stepScript(0.1);
    expect(G.script?.dlg?.full).toBe('Hi.');
    Input.hit = { ok: true }; Game.stepScript(0.1); // first press shows the whole line
    Input.hit = { ok: true }; Game.stepScript(0.1); // second press moves on
    for (let i = 0; i < 5; i++) Game.stepScript(0.1);
    expect(G.script).toBeNull();
    expect(G.flags.met).toBe(true);
    expect(G.party.map(h => h.id)).toEqual(['kael', 'bram']);
    expect(G.party[0].hp).toBeGreaterThan(1);
  });

  test("the Hollow King's trigger plays once", () => {
    const core = MAPS.core, t = core.triggers![0];
    Game.loadMap('core', t.x - 1, t.y); standOn(t.x, t.y);
    Game.checkTile();
    expect(G.script).not.toBeNull();
    for (let i = 0; i < 200 && G.script; i++) { Input.hit = { ok: true }; Game.stepScript(0.1); }
    expect(G.flags.hollowTalk).toBe(true);
    standOn(t.x, t.y); Game.checkTile();
    expect(G.script).toBeNull();
  });
});

describe('saving', () => {
  test('a save restores the party, items, gold, story and place', () => {
    Game.loadMap('village', 5, 6);
    G.party.push({ id: 'bram', lv: 4, xp: 200, hp: 90, mp: 10 });
    G.inv = { tonic: 2, ether: 1 }; G.gold = 321; G.flags = { bramJoined: true };
    expect(Game.save()).toBe(true);
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    expect(saved.map).toBe('village');

    Game.newGame();
    Game.load();
    expect(G.map.id).toBe('village');
    expect(Game.ptile()).toEqual({ x: 5, y: 6 });
    expect(G.party.map(h => [h.id, h.lv, h.hp])).toEqual([['kael', 1, 120], ['bram', 4, 90]]);
    expect(G.inv).toEqual({ tonic: 2, ether: 1 });
    expect(G.gold).toBe(321);
    expect(G.flags).toEqual({ bramJoined: true });
  });

  test('loading without a save starts a new game', () => {
    expect(Game.hasSave()).toBe(false);
    Game.load();
    expect(G.map.id).toBe('town');
  });
});
