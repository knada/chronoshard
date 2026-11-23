// End to end: the real main loop driven by key presses, from the title screen through the opening, a walk, the
// menu, saving, a battle, and continuing from the save. The 3D renderer is left out (no WebGL here).
import { beforeAll, expect, test, vi } from 'vitest';

vi.mock('../src/world3d.js', () => ({ World3D: { init: () => false, render: () => {} } }));
vi.hoisted(() => {
  globalThis.requestAnimationFrame = () => 0;   // the test calls loop() itself
  globalThis.fetch = (() => Promise.resolve(new Response(null, { status: 404 }))) as typeof fetch; // no sprite sheets: generated sprites stand in
});

const { loop } = await import('../src/main.js');
const { G, Game, SAVE_KEY } = await import('../src/game.js');
const { Battle } = await import('../src/battle.js');

let now = performance.now();
/** runs `n` frames at 60 fps */
const frames = (n = 1) => { for (let i = 0; i < n; i++) { now += 1000 / 60; loop(now); } };
const key = (type: 'keydown' | 'keyup', code: string) => dispatchEvent(new KeyboardEvent(type, { code }));
/** taps a key: down for a frame, then up */
const tap = (code: string) => { key('keydown', code); frames(); key('keyup', code); frames(); };
/** runs frames until `done`, doing `each` before every frame; fails if it takes more than `max` frames */
function until(what: string, done: () => boolean, max = 600, each?: () => void) {
  for (let i = 0; i < max && !done(); i++) { each?.(); frames(); }
  expect(done(), what).toBe(true);
}

beforeAll(() => localStorage.removeItem(SAVE_KEY));

test('a short playthrough', () => {
  // title screen: New Game
  frames(5);
  expect(G.mode).toBe('title');
  tap('Enter');
  until('the new game fades in', () => G.mode === 'field');
  expect(G.map.id).toBe('town');

  // the opening lines: Z shows a whole line, then moves on
  expect(G.script).not.toBeNull();
  until('the opening dialogue can be read through', () => !G.script, 400, () => tap('KeyZ'));

  // walking: at least one direction from the start is open
  const start = { ...G.player };
  for (const code of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
    key('keydown', code); frames(20); key('keyup', code); frames();
    if (G.player.x !== start.x || G.player.y !== start.y) break;
  }
  expect(Math.hypot(G.player.x - start.x, G.player.y - start.y), 'the player walked').toBeGreaterThan(5);

  // the menu: open it, save from the Save tab, close it
  tap('KeyC');
  expect(G.mode).toBe('menu');
  tap('ArrowRight'); tap('ArrowRight'); tap('KeyZ');
  expect(G.menu.msg).toBe('Game saved.');
  tap('Escape');
  expect(G.mode).toBe('field');
  const saved = { map: G.map.id, x: Math.round(G.player.x / 16), y: Math.round(G.player.y / 16) };

  // a fight: mash Z (Attack, then confirm the target) until it's won, then Z to leave
  G.foes = [];
  Game.startBattle({ enemies: [{ k: 'gloop', x: 6, y: 6 }] });
  until('the battle is won by attacking', () => Battle.phase === 'win', 3000, () => tap('KeyZ'));
  expect(G.gold).toBeGreaterThan(50);
  until('the victory screen closes back to the field', () => G.mode === 'field', 300, () => tap('KeyZ'));

  // back at the title, Continue picks up the save
  G.mode = 'title';
  frames();
  tap('ArrowDown'); tap('Enter');
  until('continuing loads the save', () => G.mode === 'field' && G.fade === 0, 300);
  expect([G.map.id, Math.round(G.player.x / 16), Math.round(G.player.y / 16)]).toEqual([saved.map, saved.x, saved.y]);
  expect(G.gold).toBe(50); // the save was made before the fight
});
