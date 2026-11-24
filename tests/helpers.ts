// Shared helpers: walking the game's content (maps, story scripts) and resetting state between tests.
import { Input, TILE } from '../src/engine.js';
import { EVENTS, MAPS, TALK } from '../src/data.js';
import { isSolidTile, tileAt } from '../src/tiles.js';
import { G, SAVE_KEY } from '../src/game.js';
import type { Flags, MapDef, Script } from '../src/types.js';

export const mapList = Object.values(MAPS);
export const walkable = (m: MapDef, x: number, y: number) => !isSolidTile(tileAt(m, x, y));
export const inBounds = (m: MapDef, x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h;

let flagsCache: string[] | undefined;
/** every story flag the game can set or test: map flags, chest ids, and every script `flag` command */
export function allFlags(): string[] {
  if (flagsCache) return flagsCache;
  const names = new Set<string>();
  for (const m of mapList) {
    for (const n of m.npcs ?? []) if (n.hideIf) names.add(n.hideIf);
    for (const r of m.rifts ?? []) names.add(r.flag);
    for (const e of m.enemies ?? []) if (e.flag) names.add(e.flag);
    for (const c of m.chests ?? []) names.add(c.id);
  }
  // a flag one script sets can open another script's branch, so keep collecting until nothing new turns up
  for (let size = -1; size !== names.size;) {
    size = names.size;
    for (const { script } of storyScripts([...names])) for (const c of script) if (c[0] === 'flag') names.add(c[1]);
  }
  return (flagsCache = [...names]);
}

/**
 * every script the story can play, labelled with where it comes from: each NPC talk and event under no flags, all
 * the given flags, and each flag on its own (enough to reach every branch of these small if/else chains)
 */
export function storyScripts(flags: string[] = allFlags()): { from: string; script: Script }[] {
  const sets: Flags[] = [{}, Object.fromEntries(flags.map(f => [f, true])), ...flags.map(f => ({ [f]: true }))];
  const out: { from: string; script: Script }[] = [];
  for (const [k, talk] of Object.entries(TALK)) for (const F of sets) out.push({ from: `talk ${k}`, script: talk({ ...F }) });
  for (const [k, ev] of Object.entries(EVENTS)) for (const F of sets) { const s = ev({ ...F }); if (s) out.push({ from: `event ${k}`, script: s }); }
  return out;
}

/** where the player first sets foot on a map: the new-game start in town, else the landing of a warp or rift into it */
export function arrival(m: MapDef): [number, number] {
  if (m.id === 'town') return [2, 4];
  const w = mapList.flatMap(o => [...(o.warps ?? []), ...(o.rifts ?? [])]).find(w => w.to === m.id);
  if (!w) throw new Error(`nothing leads to ${m.id}`);
  return [w.tx, w.ty];
}

/** tiles reachable on foot from (x, y), 4-way, through walkable tiles */
export function reachable(m: MapDef, x: number, y: number): Set<string> {
  const seen = new Set<string>(), queue: [number, number][] = [[x, y]];
  while (queue.length) {
    const [a, b] = queue.pop()!, key = `${a},${b}`;
    if (seen.has(key) || !inBounds(m, a, b) || !walkable(m, a, b)) continue;
    seen.add(key);
    queue.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
  }
  return seen;
}

/** a fresh game, no save, no keys held */
export function resetGame(): void {
  localStorage.removeItem(SAVE_KEY);
  Input.down = {}; Input.hit = {};
  G.script = null; G.fade = G.fadeTo = 0; G.onFade = null;
}

/** puts the player's feet on tile (tx, ty) as if they had just walked there */
export function standOn(tx: number, ty: number): void {
  G.player.x = tx * TILE; G.player.y = ty * TILE;
  G.lastTile = { x: -1, y: -1 };
}
