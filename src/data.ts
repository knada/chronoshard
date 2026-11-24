import { TILES } from './tiles.js';

import type { DualTech, EnemyKind, Flags, HeroDef, HeroId, Item, ItemId, Look, MapDef, Script, Track } from './types.js';

// ===== Chronoshard data: heroes, techs, enemies, items, maps, story =====
TILES.D.solid = true;

export const LOOKS: Record<string, Look> = {
  kael: { hair: '#d8442c', skin: '#f2c8a0', top: '#2f5fbf', bottom: '#3a2a1a', hairStyle: 'spiky', weapon: 'sword', belt: '#5a3a22' },
  bram: { hair: '#5a3a20', skin: '#d9a878', top: '#d0882a', bottom: '#4a4a5a', hairStyle: 'cap', extra: 'goggles', weapon: 'wrench' },
  lyra: { hair: '#7fd0ff', skin: '#f5d6c0', top: '#7a3fb0', bottom: '#4a2a70', hairStyle: 'long', weapon: 'staff', belt: '#d8b040' },
  mom: { hair: '#a06030', skin: '#f2c8a0', top: '#c05a7a', bottom: '#7a3a5a', hairStyle: 'long' },
  elder: { hair: '#e8e8e8', skin: '#e0b890', top: '#3f7a4a', bottom: '#2a4a2a', hairStyle: 'bald', extra: 'beard' },
  villager: { hair: '#3a2a1a', skin: '#e0b890', top: '#6a8a3a', bottom: '#4a3a2a', hairStyle: 'short' },
  kid: { hair: '#f0c040', skin: '#f2c8a0', top: '#e05050', bottom: '#3050a0', hairStyle: 'spiky' },
  merchant: { hair: '#2a2a2a', skin: '#c89060', top: '#a05a2a', bottom: '#5a3a1a', hairStyle: 'cap' },
  inn: { hair: '#8a3a2a', skin: '#f2c8a0', top: '#f0f0f0', bottom: '#5a5a7a', hairStyle: 'long' },
  monk: { hair: '#6a4a8a', skin: '#e0b890', top: '#6a4a8a', bottom: '#4a2a5a', hairStyle: 'hood' },
  unit7: { hair: '#8a94a8', skin: '#b0b8c8', top: '#5a6478', bottom: '#3a4050', hairStyle: 'bald', extra: 'goggles' },
};

// ---------- party ----------
export const HEROES: Record<HeroId, HeroDef> = {
  kael: { name: 'Kael', look: LOOKS.kael, hp: 120, mp: 20, atk: 15, def: 8, mag: 5, spd: 12, grow: { hp: 14, mp: 2, atk: 3, def: 1.5, mag: 1, spd: 0.6 },
    techs: [
      { lv: 1, name: 'Arc Slash', mp: 2, target: 'enemy', elem: 'phys', power: 1.8, fx: 'slash' },
      { lv: 3, name: 'Gale Spin', mp: 5, target: 'enemies', elem: 'phys', power: 1.3, fx: 'spin' },
      { lv: 6, name: 'Dawnbreaker', mp: 9, target: 'enemy', elem: 'fire', power: 3.2, fx: 'fire' },
    ] },
  bram: { name: 'Bram', look: LOOKS.bram, hp: 140, mp: 24, atk: 12, def: 10, mag: 7, spd: 9, grow: { hp: 16, mp: 2, atk: 2.4, def: 2, mag: 1.2, spd: 0.4 },
    techs: [
      { lv: 1, name: 'Patch Kit', mp: 3, target: 'ally', heal: 1.0, fx: 'heal' },
      { lv: 2, name: 'Rivet Shot', mp: 3, target: 'enemy', elem: 'phys', power: 2.0, fx: 'shot' },
      { lv: 4, name: 'Shock Mine', mp: 6, target: 'enemies', elem: 'shock', power: 1.5, fx: 'zap' },
    ] },
  lyra: { name: 'Lyra', look: LOOKS.lyra, hp: 95, mp: 40, atk: 7, def: 6, mag: 16, spd: 11, grow: { hp: 10, mp: 4, atk: 1, def: 1, mag: 3, spd: 0.5 },
    techs: [
      { lv: 1, name: 'Ember', mp: 3, target: 'enemy', elem: 'fire', power: 1.6, magic: true, fx: 'fire' },
      { lv: 1, name: 'Mend', mp: 4, target: 'allies', heal: 0.8, fx: 'heal' },
      { lv: 4, name: 'Glacier', mp: 8, target: 'enemies', elem: 'ice', power: 1.6, magic: true, fx: 'ice' },
      { lv: 6, name: 'Rekindle', mp: 12, target: 'ally', revive: true, fx: 'heal' },
    ] },
};

// Combo techs: all listed members must be ready and alive; each pays its MP.
export const DUALS: DualTech[] = [
  { name: 'Blazing Edge', who: ['kael', 'lyra'], mp: [4, 4], target: 'enemy', elem: 'fire', power: 4.5, magic: true, fx: 'fire' },
  { name: 'Gear Crusher', who: ['kael', 'bram'], mp: [4, 4], target: 'enemies', elem: 'phys', power: 2.4, fx: 'spin' },
  { name: 'Storm Engine', who: ['bram', 'lyra'], mp: [5, 5], target: 'enemies', elem: 'shock', power: 2.6, magic: true, fx: 'zap' },
  { name: 'Chrono Rend', who: ['kael', 'bram', 'lyra'], mp: [8, 8, 8], target: 'enemies', elem: 'time', power: 4.2, magic: true, fx: 'time', fxSize: 3.2 },
];

export const ITEMS: Record<ItemId, Item> = {
  tonic: { name: 'Tonic', desc: 'Restores 60 HP', price: 10, heal: 60 },
  hitonic: { name: 'Hi-Tonic', desc: 'Restores 200 HP', price: 40, heal: 200 },
  ether: { name: 'Ether', desc: 'Restores 25 MP', price: 30, mp: 25 },
  seed: { name: 'Revival Seed', desc: 'Revives a fallen ally', price: 60, revive: true },
  elixir: { name: 'Elixir', desc: 'Fully restores the party', price: 0, all: true },
};

// ---------- enemies ----------
export const ENEMIES: Record<string, EnemyKind> = {
  gloop: { name: 'Gloop', shape: 'blob', color: '#6fd06a', color2: '#b8f5b0', size: 1.3, hp: 32, atk: 9, def: 2, mag: 3, spd: 7, xp: 7, gold: 5, weak: ['fire'],
    moves: [{ name: 'Tackle', power: 1, target: 'one' }] },
  redgloop: { name: 'Ember Gloop', shape: 'emberblob', color: '#e86a4a', color2: '#ffc0a0', size: 1.3, hp: 50, atk: 12, def: 4, mag: 8, spd: 8, xp: 12, gold: 9, weak: ['ice'], resist: ['fire'],
    moves: [{ name: 'Tackle', power: 1, target: 'one' }, { name: 'Spit Flame', power: 1.3, target: 'one', elem: 'fire', magic: true }] },
  thornling: { name: 'Thornling', shape: 'plant', color: '#9a4ab0', color2: '#e070f0', size: 1.4, hp: 55, atk: 13, def: 4, mag: 6, spd: 8, xp: 14, gold: 10, weak: ['fire'],
    moves: [{ name: 'Lash', power: 1, target: 'one' }, { name: 'Pollen Burst', power: 0.7, target: 'all', magic: true }] },
  duskbat: { name: 'Duskbat', shape: 'bat', color: '#4a3a6a', color2: '#8a5ab8', size: 1.4, hp: 40, atk: 12, def: 3, mag: 4, spd: 15, xp: 12, gold: 8, weak: ['shock', 'ice'],
    moves: [{ name: 'Bite', power: 1, target: 'one' }] },
  wisp: { name: 'Elder Wisp', shape: 'wisp', color: '#7fe0ff', color2: '#ffffff', size: 1.6, hp: 60, atk: 8, def: 20, mag: 14, spd: 11, xp: 18, gold: 14, weak: ['ice', 'fire'], resist: ['phys'],
    moves: [{ name: 'Spirit Flare', power: 1.2, target: 'one', magic: true }] },
  golem: { name: 'Mossback Golem', shape: 'golem', color: '#7a7a68', color2: '#4a8a3a', size: 2.6, hp: 900, atk: 22, def: 12, mag: 14, spd: 7, xp: 220, gold: 200, weak: ['fire'], boss: true,
    moves: [{ name: 'Stone Fist', power: 1.3, target: 'one' }, { name: 'Quake', power: 0.9, target: 'all' }, { name: 'Moss Regrowth', heal: 80 }] },
  rustbot: { name: 'Rustbot', shape: 'robot', color: '#8a7a6a', color2: '#5a4a3a', size: 1.5, hp: 160, atk: 27, def: 15, mag: 10, spd: 10, xp: 48, gold: 30, weak: ['shock'],
    moves: [{ name: 'Drill Arm', power: 1, target: 'one' }, { name: 'Laser Sweep', power: 0.8, target: 'all', magic: true }] },
  voidwisp: { name: 'Void Wisp', shape: 'voidwisp', color: '#a050f0', color2: '#401060', size: 1.6, hp: 130, atk: 14, def: 27, mag: 27, spd: 14, xp: 52, gold: 32, weak: ['time', 'fire', 'ice'], resist: ['phys'],
    moves: [{ name: 'Null Ray', power: 1.2, target: 'one', magic: true }] },
  sentinel: { name: 'Sentinel', shape: 'sentinel', color: '#4a5a7a', color2: '#c8a040', size: 2.2, hp: 300, atk: 33, def: 19, mag: 15, spd: 9, xp: 95, gold: 64, weak: ['shock'],
    moves: [{ name: 'Crush', power: 1.2, target: 'one' }, { name: 'Overload', power: 1, target: 'all', elem: 'shock', magic: true }] },
  hollow: { name: 'The Hollow King', shape: 'hollow', color: '#4a2878', color2: '#a050f0', size: 3, hp: 4800, atk: 40, def: 20, mag: 36, spd: 11, xp: 0, gold: 0, weak: ['time'], boss: true,
    moves: [{ name: 'Rend', power: 1.2, target: 'one' }, { name: 'Time Fracture', power: 0.9, target: 'all', magic: true }, { name: 'Unmake', power: 1.8, target: 'one', magic: true }, { name: 'Devour Hours', heal: 260 }] },

  // ----- Year 1000, optional: a crowned gloop guarding the fields' far corner -----
  gloopking: { name: 'Gloop King', shape: 'blob', color: '#f0c040', color2: '#fff0a0', size: 3.2, hp: 420, atk: 14, def: 6, mag: 8, spd: 8, xp: 120, gold: 150, weak: ['fire'], boss: true,
    art: { from: 'Gloop', hue: -78, sat: 1.4, light: 1.08 },
    moves: [{ name: 'Tackle', power: 1.1, target: 'one' }, { name: 'Royal Bellyflop', power: 0.8, target: 'all', art: { from: 'Quake', hue: 40, sat: 1.3 } },
      { name: 'Gloop Up', heal: 60, art: { from: 'Moss Regrowth', hue: -60 } }] },

  // ----- Year 1600: Frostveil Pass -----
  frostgloop: { name: 'Frost Gloop', shape: 'blob', color: '#8ad8ff', color2: '#e8f8ff', size: 1.3, hp: 80, atk: 16, def: 8, mag: 10, spd: 9, xp: 26, gold: 18, weak: ['fire'], resist: ['ice'],
    art: { from: 'Gloop', hue: 92, sat: 0.6, light: 1.35 },
    moves: [{ name: 'Tackle', power: 1, target: 'one' }, { name: 'Frost Breath', power: 1.2, target: 'one', elem: 'ice', magic: true, art: { from: 'Spit Flame', hue: 180, light: 1.1 } }] },
  rimebat: { name: 'Rime Bat', shape: 'bat', color: '#5a7aa8', color2: '#c8e8ff', size: 1.4, hp: 70, atk: 18, def: 6, mag: 6, spd: 17, xp: 24, gold: 16, weak: ['fire', 'shock'],
    art: { from: 'Duskbat', hue: -70, sat: 0.75, light: 1.45 },
    moves: [{ name: 'Bite', power: 1, target: 'one' }, { name: 'Frost Fang', power: 1.3, target: 'one', elem: 'ice', art: { from: 'Bite', hue: 180, light: 1.1 } }] },
  frostbloom: { name: 'Frostbloom', shape: 'plant', color: '#5aa8c8', color2: '#e0f4ff', size: 1.4, hp: 95, atk: 17, def: 8, mag: 12, spd: 9, xp: 30, gold: 20, weak: ['fire'],
    art: { from: 'Thornling', hue: -130, sat: 0.85, light: 1.3 },
    moves: [{ name: 'Lash', power: 1, target: 'one' }, { name: 'Snow Squall', power: 0.8, target: 'all', elem: 'ice', magic: true, art: { from: 'Pollen Burst', hue: 160, sat: 0.6, light: 1.2 } }] },
  colossus: { name: 'Glacial Colossus', shape: 'golem', color: '#9ab8d0', color2: '#e8f4ff', size: 2.8, hp: 1500, atk: 25, def: 14, mag: 18, spd: 8, xp: 420, gold: 300, weak: ['fire'], resist: ['ice'], boss: true,
    art: { from: 'Mossback Golem', hue: 145, sat: 0.7, light: 1.35 },
    moves: [{ name: 'Frost Fist', power: 1.3, target: 'one', art: { from: 'Stone Fist', hue: 170, light: 1.1 } }, { name: 'Avalanche', power: 0.9, target: 'all', elem: 'ice', art: { from: 'Quake', hue: 170, sat: 0.5, light: 1.3 } },
      { name: 'Permafrost', heal: 120, art: { from: 'Moss Regrowth', hue: 100, light: 1.1 } }] },

  // ----- Year 1800: the Gearworks under Cogspire -----
  brassbot: { name: 'Brass Automaton', shape: 'robot', color: '#c8a040', color2: '#7a5a20', size: 1.5, hp: 130, atk: 22, def: 14, mag: 8, spd: 9, xp: 44, gold: 30, weak: ['shock'],
    art: { from: 'Rustbot', hue: 15, sat: 1.7, light: 1.15 },
    moves: [{ name: 'Piston Punch', power: 1.1, target: 'one', art: { from: 'Drill Arm', hue: 20 } }, { name: 'Steam Vent', power: 0.8, target: 'all', elem: 'fire', magic: true, art: { from: 'Laser Sweep', hue: 200, sat: 0.4, light: 1.3 } }] },
  sparkwisp: { name: 'Spark Wisp', shape: 'wisp', color: '#ffe060', color2: '#fffbe0', size: 1.5, hp: 85, atk: 10, def: 22, mag: 20, spd: 14, xp: 40, gold: 26, weak: ['ice', 'time'], resist: ['phys', 'shock'],
    art: { from: 'Elder Wisp', hue: -145, sat: 1.1 },
    moves: [{ name: 'Arc Flare', power: 1.2, target: 'one', elem: 'shock', magic: true, art: { from: 'Spirit Flare', hue: -145 } }] },
  steamsentinel: { name: 'Steam Sentinel', shape: 'sentinel', color: '#8a5a3a', color2: '#e0a050', size: 2.2, hp: 200, atk: 26, def: 16, mag: 12, spd: 8, xp: 76, gold: 48, weak: ['shock'], resist: ['fire'],
    art: { from: 'Sentinel', colorize: 22, sat: 0.95, light: 0.95 },
    moves: [{ name: 'Crush', power: 1.2, target: 'one' }, { name: 'Scald', power: 1, target: 'all', elem: 'fire', magic: true, art: { from: 'Overload', hue: 175 } }] },
  tyrant: { name: 'The Clockwork Tyrant', shape: 'sentinel', color: '#d8b048', color2: '#6a3a18', size: 2.8, hp: 2300, atk: 29, def: 18, mag: 22, spd: 10, xp: 700, gold: 500, weak: ['shock', 'time'], boss: true,
    art: { from: 'Sentinel', colorize: 44, sat: 1.25, light: 1.12 },
    moves: [{ name: 'Gear Grind', power: 1.3, target: 'one', art: { from: 'Crush', hue: 30 } }, { name: 'Overclock', power: 1, target: 'all', elem: 'shock', magic: true, art: { from: 'Overload', hue: 200 } },
      { name: 'Tick Lock', power: 1.6, target: 'one', elem: 'time', magic: true, art: { from: 'Time Fracture', hue: 150 } }, { name: 'Rewind', heal: 220, art: { from: 'Devour Hours', hue: 150 } }] },
};

// ---------- music (MIDI note numbers, 0 = rest) ----------
export const MUSIC: Record<string, Track> = {
  town: { tempo: 150, lead: [72, 0, 76, 79, 77, 76, 74, 0, 72, 74, 76, 0, 74, 72, 71, 0, 69, 0, 72, 76, 74, 72, 71, 0, 72, 0, 0, 0, 67, 0, 0, 0], bass: [48, 48, 52, 52, 53, 53, 55, 55, 45, 45, 48, 48, 50, 50, 43, 43] },
  field: { tempo: 170, lead: [67, 72, 74, 76, 0, 74, 76, 79, 0, 77, 76, 74, 72, 0, 74, 0, 67, 72, 74, 76, 0, 79, 81, 79, 77, 76, 74, 76, 72, 0, 0, 0], bass: [48, 0, 55, 0, 53, 0, 55, 0, 45, 0, 52, 0, 50, 0, 55, 0] },
  past: { tempo: 110, wave: 'triangle', len: 0.35, lead: [69, 0, 72, 76, 74, 0, 72, 71, 69, 0, 0, 64, 67, 0, 69, 0, 71, 0, 72, 74, 76, 0, 74, 72, 71, 0, 69, 0, 0, 0, 0, 0], bass: [45, 45, 41, 41, 43, 43, 40, 40] },
  future: { tempo: 120, wave: 'sawtooth', lead: [57, 0, 0, 60, 0, 0, 63, 0, 62, 0, 60, 0, 58, 0, 0, 0, 57, 0, 0, 60, 0, 0, 65, 0, 63, 0, 62, 0, 60, 0, 0, 0], bass: [33, 33, 33, 33, 36, 36, 34, 34] },
  battle: { tempo: 200, lead: [64, 64, 67, 64, 69, 64, 71, 72, 71, 69, 67, 64, 66, 67, 69, 71, 64, 64, 67, 64, 69, 64, 72, 74, 76, 74, 72, 71, 72, 71, 69, 67], bass: [40, 40, 40, 40, 43, 43, 45, 45, 36, 36, 38, 38, 40, 40, 47, 47] },
  boss: { tempo: 210, wave: 'sawtooth', lead: [57, 60, 64, 63, 57, 60, 66, 65, 57, 60, 64, 63, 69, 68, 66, 65, 57, 0, 57, 60, 62, 63, 62, 60, 59, 0, 62, 0, 65, 0, 68, 0], bass: [33, 33, 33, 33, 34, 34, 34, 34, 36, 36, 35, 35, 33, 33, 40, 40] },
  snow: { tempo: 96, wave: 'triangle', len: 0.4, lead: [76, 0, 74, 71, 0, 69, 71, 0, 72, 0, 71, 69, 67, 0, 0, 0, 64, 0, 67, 71, 0, 74, 72, 71, 69, 0, 71, 0, 0, 0, 0, 0], bass: [40, 40, 45, 45, 43, 43, 38, 38] },
  clock: { tempo: 160, lead: [72, 0, 79, 0, 76, 0, 79, 0, 74, 0, 79, 0, 77, 0, 79, 0, 72, 0, 76, 79, 84, 0, 79, 76, 74, 0, 77, 0, 72, 0, 0, 0], bass: [48, 0, 48, 0, 43, 0, 43, 0, 45, 0, 45, 0, 41, 0, 43, 0] },
  ending: { tempo: 100, wave: 'triangle', len: 0.4, lead: [72, 0, 74, 76, 0, 79, 77, 76, 74, 0, 72, 74, 76, 0, 0, 0, 69, 0, 72, 74, 0, 76, 74, 72, 71, 0, 72, 0, 0, 0, 0, 0], bass: [48, 48, 45, 45, 41, 41, 43, 43] },
};

// ---------- maps ----------
// Tiles: . grass  , flowers  v forest floor  = path  # tree  ~ water  W stone  R roof  H wall  D door
//        F wood floor  B bridge  r rock  f fence  L lamp  s flagstone  M metal  X rubble  P pipes  G panel  K void floor  k void wall
/** a map as authored; id, w and h are derived below */
type MapSource = Omit<MapDef, 'id' | 'w' | 'h'>;
const MAP_DEFS: Record<string, MapSource> = {
  town: {
    name: 'Ashvale', era: 'Year 1000', music: 'town',
    rows: [
      '########################',
      '#RRRR....,.....,...RRRR#',
      '#RRRR..............RRRR#',
      '#HDHH..f.f.f.f.....HHDH#',
      '#.=....,......,......=.#',
      '#.===========.=======..#',
      '#.....,..=....=........#',
      '#.RRRRR..=....=..RRRRR.#',
      '#.RRRRR..======..RRRRR.=',
      '#.HHDHH..=.~~.=..HDHHH.=',
      '#...=....=.~~.=...=....=',
      '#...======....======...=',
      '#.,......=.,.....,.....#',
      '#..L.....=.........L...#',
      '#...,....=.....,.......#',
      '########################',
    ],
    npcs: [
      { id: 'mom', x: 3, y: 4, look: LOOKS.mom, dir: 'down', talk: 'mom' },
      { id: 'bram', x: 5, y: 10, look: LOOKS.bram, dir: 'down', talk: 'bram', hideIf: 'bramJoined' },
      { id: 'innkeep', x: 20, y: 4, look: LOOKS.inn, dir: 'down', talk: 'innTown' },
      { id: 'shop1', x: 18, y: 10, look: LOOKS.merchant, dir: 'down', talk: 'shop' },
      { id: 'kid1', x: 12, y: 12, look: LOOKS.kid, dir: 'left', talk: 'kid', wander: true },
      { id: 'old1', x: 7, y: 6, look: LOOKS.villager, dir: 'down', talk: 'oldman' },
    ],
    signs: [
      { x: 2, y: 3, text: "Kael's house. Smells like burnt toast." },
      { x: 21, y: 3, text: 'The Sleepy Gear Inn.' },
      { x: 4, y: 9, text: "Bram's Workshop. KEEP OUT (unless you're Kael)." },
      { x: 18, y: 9, text: 'General Store.' },
    ],
    warps: [{ x: 23, y: 8, to: 'fields', tx: 1, ty: 7 }, { x: 23, y: 9, to: 'fields', tx: 1, ty: 8 }, { x: 23, y: 10, to: 'fields', tx: 1, ty: 9 }, { x: 23, y: 11, to: 'fields', tx: 1, ty: 9 }],
    chests: [{ id: 'c_town1', x: 1, y: 14, item: 'tonic', n: 2 }],
  },
  fields: {
    name: 'Dawnmere Fields', era: 'Year 1000', music: 'field',
    rows: [
      '##############################',
      '#...,....#.....,.....WWWWWWW.#',
      '#.....r.......#......WWWWWWW.#',
      '#.,.......,..........WWWWWWW.#',
      '#....#.........,.....WWWDWWW.#',
      '#..........r.........r..=....#',
      '#.,....#.........,......=..,.#',
      '========================.....#',
      '=.....,...#.....r.......=....#',
      '=...........,...........=.#..#',
      '#..#....,.......#.......=....#',
      '#.......~~~~~BB~~~~~....=..,.#',
      '#.,....~~~~~~BB~~~~~~.......r#',
      '#......,...........,...#.....#',
      '#....r.........,.............#',
      '##############################',
    ],
    npcs: [{ id: 'guard', x: 26, y: 5, look: LOOKS.villager, dir: 'down', talk: 'towerGuard' }],
    signs: [{ x: 24, y: 4, text: 'The Old Clocktower. Built in Year 612. Still runs 4 minutes slow.' }],
    warps: [{ x: 0, y: 7, to: 'town', tx: 22, ty: 9 }, { x: 0, y: 8, to: 'town', tx: 22, ty: 9 }, { x: 0, y: 9, to: 'town', tx: 22, ty: 10 }],
    triggers: [{ x: 24, y: 5, event: 'tower' }],
    rifts: [{ x: 22, y: 6, to: 'forest', tx: 4, ty: 8, flag: 'rift1' }],
    enemies: [
      { id: 'f1', x: 8, y: 4, kind: 'gloop', group: [{ k: 'gloop', dx: 0, dy: 0 }, { k: 'gloop', dx: 2, dy: 1 }] },
      { id: 'f2', x: 15, y: 9, kind: 'gloop', group: [{ k: 'gloop', dx: 0, dy: 0 }, { k: 'redgloop', dx: 1, dy: -2 }] },
      { id: 'f3', x: 5, y: 13, kind: 'redgloop', group: [{ k: 'redgloop', dx: 0, dy: 0 }, { k: 'gloop', dx: 2, dy: 0 }, { k: 'gloop', dx: 1, dy: -2 }] },
      { id: 'f4', x: 20, y: 2, kind: 'gloop', group: [{ k: 'gloop', dx: 0, dy: 0 }, { k: 'gloop', dx: -2, dy: 1 }, { k: 'gloop', dx: 1, dy: 2 }] },
      // optional: guards the chest in the corner
      { id: 'boss0', x: 26, y: 12, kind: 'gloopking', boss: true, flag: 'gloopKingDown', static: true,
        group: [{ k: 'gloopking', dx: 0, dy: 0 }, { k: 'gloop', dx: -1, dy: -2 }, { k: 'gloop', dx: -1, dy: 2 }] },
    ],
    chests: [{ id: 'c_f1', x: 28, y: 13, item: 'ether', n: 1 }, { id: 'c_f2', x: 1, y: 1, item: 'tonic', n: 3 }],
  },
  forest: {
    name: 'Forest of First Light', era: 'Year 400', music: 'past',
    rows: [
      '##############################',
      '########sssssssss#############',
      '#######sssssssssss############',
      '#######sssssssssss############',
      '##vvvv###vvvvvvv####vvvvvv####',
      '#vvvvvvv##vvvvv##vvvvvvvvvvv##',
      '#vv,vvvvvvvvvvvvvvvvv#vvvvvvv#',
      '#vvvvvvvvvvvv#vvvvvvvvvv,vvvv#',
      '#vvvvvvvvvvvvvvvvvv~~vvvvvvvvv',
      '#vvv#vvvvv,vvvvvvv~~~~vvvvvvvv',
      '#vvvvvvvvvvvvvvvvvv~~vvvv#vvvv',
      '##vvvv##vvvvvv#vvvvvvvvvvvvvv#',
      '#vvvvvvvvvvvvvvvvvvvvvv,vvvvv#',
      '#vv,vvv#vvvvvvvvv#vvvvvvvvvvv#',
      '###vvvvvvvvv,vvvvvvvvvvvvvv###',
      '#####vvvvvvvvvvvvvvvvvvvvv####',
      '##############################',
    ],
    npcs: [{ id: 'lyraNpc', x: 16, y: 9, look: LOOKS.lyra, dir: 'left', talk: 'lyraNpc', hideIf: 'lyraJoined' }],
    warps: [{ x: 29, y: 8, to: 'village', tx: 1, ty: 7 }, { x: 29, y: 9, to: 'village', tx: 1, ty: 7 }, { x: 29, y: 10, to: 'village', tx: 1, ty: 8 }],
    triggers: [{ x: 9, y: 8, event: 'lyraMeet' }, { x: 9, y: 9, event: 'lyraMeet' }, { x: 9, y: 7, event: 'lyraMeet' }, { x: 9, y: 10, event: 'lyraMeet' }, { x: 9, y: 6, event: 'lyraMeet' }],
    rifts: [{ x: 3, y: 8, to: 'fields', tx: 22, ty: 7, flag: 'rift1' }, { x: 12, y: 2, to: 'frostveil', tx: 3, ty: 8, flag: 'rift2' }],
    enemies: [
      { id: 'p1', x: 6, y: 12, kind: 'thornling', group: [{ k: 'thornling', dx: 0, dy: 0 }, { k: 'gloop', dx: 2, dy: 1 }] },
      { id: 'p2', x: 18, y: 6, kind: 'duskbat', group: [{ k: 'duskbat', dx: 0, dy: 0 }, { k: 'duskbat', dx: 2, dy: 1 }, { k: 'thornling', dx: 1, dy: -1 }] },
      { id: 'p3', x: 22, y: 13, kind: 'wisp', group: [{ k: 'wisp', dx: 0, dy: 0 }, { k: 'duskbat', dx: -2, dy: 0 }] },
      { id: 'p4', x: 14, y: 10, kind: 'thornling', group: [{ k: 'thornling', dx: 0, dy: 0 }, { k: 'thornling', dx: 2, dy: 0 }, { k: 'wisp', dx: 1, dy: 2 }] },
      { id: 'boss1', x: 12, y: 4, kind: 'golem', boss: true, flag: 'golemDown', group: [{ k: 'golem', dx: 0, dy: 2 }] },
    ],
    chests: [{ id: 'c_p1', x: 2, y: 13, item: 'seed', n: 1 }, { id: 'c_p2', x: 27, y: 5, item: 'hitonic', n: 2 }, { id: 'c_p3', x: 8, y: 1, item: 'ether', n: 2 }],
  },
  village: {
    name: 'Elderwood Hamlet', era: 'Year 400', music: 'past',
    rows: [
      '######################',
      '#vvvRRRRvvvvvvvRRRRvv#',
      '#vvvRRRRvvv,vvvRRRRvv#',
      '#vvvHHDHvvvvvvvHDHHvv#',
      '#vvvv=vvvvvvvvvv=vvvv#',
      '#vvvv=========ss=vvvv#',
      '#v,vvvvvvvvvvssssvv,v#',
      '=============sssssvvv#',
      '=vvvvvvvvvvvvvsssvvvv#',
      '#vvvRRRRRvvvvvvvvvvvv#',
      '#vvvRRRRRvvv,vvvv#vvv#',
      '#vvvHHDHHvvvvvvvvvvvv#',
      '#v,vvvvvvvvvvvvvv,vvv#',
      '#vvvvvvvv,vvvvvvvvvvv#',
      '######################',
    ],
    npcs: [
      { id: 'elder', x: 15, y: 6, look: LOOKS.elder, dir: 'down', talk: 'elder' },
      { id: 'innP', x: 6, y: 4, look: LOOKS.inn, dir: 'down', talk: 'innPast' },
      { id: 'shopP', x: 6, y: 12, look: LOOKS.monk, dir: 'down', talk: 'shop' },
      { id: 'vkid', x: 10, y: 9, look: LOOKS.kid, dir: 'down', talk: 'pastKid', wander: true },
      { id: 'vman', x: 18, y: 4, look: LOOKS.villager, dir: 'left', talk: 'pastMan' },
    ],
    signs: [{ x: 6, y: 3, text: 'Hearth House. Rest here, travelers.' }, { x: 6, y: 11, text: 'Herbalist.' }],
    warps: [{ x: 0, y: 7, to: 'forest', tx: 28, ty: 9 }, { x: 0, y: 8, to: 'forest', tx: 28, ty: 9 }],
  },
  ruins: {
    name: 'Ashvale Ruins', era: 'Year 2300', music: 'future',
    rows: [
      'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
      'PMMMMXMMMMMMMMMXXMMMMMMMMMMMMP',
      'PMMMMMMMMXMMMMMMMMMMMMXMMMMMMP',
      'PMXXMMMMMMMMMPPPPMMMMMMMMMXMMP',
      'PMMMMMMMMMMMMPGGPMMMMMMMMMMMMP',
      'PMMMMMXMMMMMMPGGPMMMXXMMMMMMMP',
      'PMMMMMMMMMMMMMGGMMMMMMMMMMMMMP',
      'PMMMMMMMMMMMMMMMMMMMMMMMMMMMMG',
      'PMMMMXMMMMMMMMMMMMMMMMMXMMMMMG',
      'PMMMMMMMMMMMMXMMMMMMMMMMMMMMMG',
      'PMXMMMMMMXXMMMMMMMMMXMMMMMMMMP',
      'PMMMMMMMMMMMMMMMMMMMMMMMMMXMMP',
      'PMMMMMXMMMMMMMMMMXMMMMMMMMMMMP',
      'PMMMMMMMMMMMMMMMMMMMMMMXMMMMMP',
      'PMMMMMMMMMMMXMMMMMMMMMMMMMMMMP',
      'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
    ],
    npcs: [{ id: 'unit7', x: 15, y: 6, look: LOOKS.unit7, dir: 'down', talk: 'unit7' }],
    signs: [{ x: 3, y: 3, text: '...ASHVALE MUNICIPAL CLOCK... (the rest is melted)' }],
    warps: [{ x: 29, y: 7, to: 'core', tx: 1, ty: 7 }, { x: 29, y: 8, to: 'core', tx: 1, ty: 7 }, { x: 29, y: 9, to: 'core', tx: 1, ty: 8 }],
    rifts: [{ x: 3, y: 8, to: 'gearworks', tx: 25, ty: 8, flag: 'rift4' }],
    enemies: [
      { id: 'r1', x: 9, y: 4, kind: 'rustbot', group: [{ k: 'rustbot', dx: 0, dy: 0 }, { k: 'voidwisp', dx: 2, dy: 1 }] },
      { id: 'r2', x: 10, y: 12, kind: 'voidwisp', group: [{ k: 'voidwisp', dx: 0, dy: 0 }, { k: 'voidwisp', dx: 2, dy: -1 }, { k: 'rustbot', dx: 1, dy: -2 }] },
      { id: 'r3', x: 20, y: 9, kind: 'sentinel', group: [{ k: 'sentinel', dx: 0, dy: 0 }, { k: 'rustbot', dx: 3, dy: -2 }] },
      { id: 'r4', x: 24, y: 3, kind: 'rustbot', group: [{ k: 'rustbot', dx: 0, dy: 0 }, { k: 'rustbot', dx: 2, dy: 1 }, { k: 'voidwisp', dx: 0, dy: 2 }] },
      { id: 'r5', x: 26, y: 12, kind: 'sentinel', group: [{ k: 'sentinel', dx: 0, dy: 0 }, { k: 'sentinel', dx: -3, dy: -2 }] },
    ],
    chests: [{ id: 'c_r1', x: 1, y: 14, item: 'hitonic', n: 3 }, { id: 'c_r2', x: 28, y: 1, item: 'elixir', n: 1 }, { id: 'c_r3', x: 14, y: 14, item: 'seed', n: 2 }],
  },
  core: {
    name: 'The Hollow Core', era: 'Year 2300', music: 'future',
    rows: [
      'kkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkKKKKKKkkkkkkk',
      'kkkkkKKKKKKKKKKkkkkk',
      'kkkkKKKKKKKKKKKKkkkk',
      'kkkKKKKGKKKKGKKKKkkk',
      'kkKKKKKKKKKKKKKKKKkk',
      'kKKKKKKKKKKKKKKKKKKk',
      'GKKKKGKKKKKKKKGKKKKk',
      'GKKKKKKKKKKKKKKKKKKk',
      'kKKKKKKKKKKKKKKKKKKk',
      'kkKKKKKKKKKKKKKKKKkk',
      'kkkKKKKGKKKKGKKKKkkk',
      'kkkkKKKKKKKKKKKKkkkk',
      'kkkkkKKKKKKKKKKkkkkk',
      'kkkkkkkkkkkkkkkkkkkk',
    ],
    npcs: [],
    warps: [{ x: 0, y: 7, to: 'ruins', tx: 28, ty: 8 }, { x: 0, y: 8, to: 'ruins', tx: 28, ty: 8 }],
    triggers: [{ x: 6, y: 7, event: 'hollow' }, { x: 6, y: 8, event: 'hollow' }],
    enemies: [{ id: 'boss2', x: 12, y: 6, kind: 'hollow', boss: true, flag: 'hollowDown', group: [{ k: 'hollow', dx: 0, dy: 0 }], static: true }],
  },
  // Year 1600: the forest of Year 400, buried under a winter that never ended
  frostveil: {
    name: 'Frostveil Pass', era: 'Year 1600', music: 'snow',
    rows: [
      '##############################',
      '###nnn####nnnnnnn####nnnnn####',
      '##nnnnnn#nnnnnrnnnn#nnnnnnnn##',
      '#nnrnnnnnnnnnnIIIIIIn#nnnnnnn#',
      '#nnnnn#nnnnnIIIIIIIIIInnWsssW#',
      '#nnnnnnnnnnrIIIIIIIIIInnsssss#',
      '#nnnnnnnnnnnnnIIIIIInnnnsssss#',
      '#nnnnnnnnnnnnnnnnnnnnnnnsssss#',
      '#n======================sssss#',
      '#nnnnnnnnnnnnnnnnnnnnnnnsssss#',
      '#nnnnnnnnnnnnnnn#nnnrnnnsssss#',
      '#nnn#nnnnn#nnnnnnnnnnnnnWsssW#',
      '#nnnnnnnrnnnn#nnnnnnnn#nnnnnn#',
      '##nnnnnnnnnnnnnnnn#nnnnnnnnn##',
      '####nnnnn##nnnnnn###nnnnn#####',
      '##############################',
    ],
    npcs: [
      { id: 'hermit', x: 6, y: 6, look: LOOKS.villager, dir: 'down', talk: 'hermit' },
      { id: 'pilgrim', x: 20, y: 12, look: LOOKS.monk, dir: 'up', talk: 'pilgrim' },
    ],
    signs: [{ x: 24, y: 4, text: 'An old shrine stone, worn smooth: SHRINE OF THE FIRST GEAR.' }],
    triggers: [...[2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13].map(y => ({ x: 5, y, event: 'frostveil' })), ...[2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(y => ({ x: 21, y, event: 'colossus' }))],
    rifts: [{ x: 1, y: 8, to: 'forest', tx: 12, ty: 3, flag: 'rift2' }, { x: 26, y: 8, to: 'cogspire', tx: 3, ty: 8, flag: 'rift3' }],
    enemies: [
      { id: 'fv1', x: 9, y: 4, kind: 'frostgloop', group: [{ k: 'frostgloop', dx: 0, dy: 0 }, { k: 'frostgloop', dx: 2, dy: 1 }] },
      { id: 'fv2', x: 14, y: 10, kind: 'rimebat', group: [{ k: 'rimebat', dx: 0, dy: 0 }, { k: 'rimebat', dx: 2, dy: 1 }, { k: 'frostgloop', dx: 1, dy: -2 }] },
      { id: 'fv3', x: 10, y: 13, kind: 'frostbloom', group: [{ k: 'frostbloom', dx: 0, dy: 0 }, { k: 'rimebat', dx: 2, dy: -1 }] },
      { id: 'fv4', x: 17, y: 2, kind: 'frostbloom', group: [{ k: 'frostbloom', dx: 0, dy: 0 }, { k: 'frostbloom', dx: 2, dy: 1 }, { k: 'frostgloop', dx: 1, dy: 3 }] },
      { id: 'boss3', x: 26, y: 7, kind: 'colossus', boss: true, flag: 'colossusDown', group: [{ k: 'colossus', dx: 0, dy: 0 }], static: true },
    ],
    chests: [{ id: 'c_fv1', x: 2, y: 12, item: 'hitonic', n: 2 }, { id: 'c_fv2', x: 13, y: 1, item: 'ether', n: 2 }, { id: 'c_fv3', x: 28, y: 5, item: 'seed', n: 1 }],
  },
  // Year 1800: a clockwork town where every clock reads the same minute
  cogspire: {
    name: 'Cogspire', era: 'Year 1800', music: 'clock',
    rows: [
      '##############################',
      '#.RRRRR..RRRRRR.....RRRRR..###',
      '#.RRRRR..RRRRRR.....RRRRR....#',
      '#.HHDHH..HHDHHH.....HHDHH....#',
      '#...s...L..s.sss..L...s......#',
      '#ssssssssssssssssssssssssssss#',
      '#..........ss~~sss........L..#',
      '#..........ss~~sss...........#',
      '#sssssssssssssssssssssssssssss',
      '#sssssssssssssssssssssssssssss',
      '#...s...L..sssssssL...s......#',
      '#.RRRRR.............RRRRR.L..#',
      '#.RRRRR..,,.....,,..RRRRR....#',
      '#.HHDHH..,.......,..HHDHH....#',
      '##.........................###',
      '##############################',
    ],
    npcs: [
      { id: 'innC', x: 5, y: 4, look: LOOKS.inn, dir: 'down', talk: 'innCog' },
      { id: 'shopC', x: 23, y: 4, look: LOOKS.merchant, dir: 'down', talk: 'shop' },
      { id: 'tamsin', x: 16, y: 7, look: LOOKS.villager, dir: 'left', talk: 'tamsin' },
      { id: 'ckid', x: 9, y: 7, look: LOOKS.kid, dir: 'right', talk: 'cogKid', wander: true },
      { id: 'gatewarden', x: 27, y: 7, look: LOOKS.villager, dir: 'left', talk: 'gatewarden' },
      { id: 'lamplighter', x: 19, y: 11, look: LOOKS.villager, dir: 'down', talk: 'lamplighter' },
    ],
    signs: [
      { x: 3, y: 3, text: 'The Wound Spring Inn.' },
      { x: 10, y: 3, text: "Tamsin's Clockworks. Repairs while you wait (forever, lately)." },
      { x: 21, y: 3, text: 'Brass & Bolt Provisions.' },
      { x: 13, y: 7, text: 'The Heartclock Fountain. Toss a cog for luck.' },
    ],
    warps: [{ x: 29, y: 8, to: 'gearworks', tx: 1, ty: 7 }, { x: 29, y: 9, to: 'gearworks', tx: 1, ty: 8 }],
    triggers: [4, 5, 6, 7, 8, 9, 10, 14].map(y => ({ x: 5, y, event: 'cogspire' })),
    rifts: [{ x: 1, y: 8, to: 'frostveil', tx: 25, ty: 8, flag: 'rift3' }],
    chests: [{ id: 'c_cg1', x: 28, y: 13, item: 'hitonic', n: 1 }],
  },
  gearworks: {
    name: 'The Gearworks', era: 'Year 1800', music: 'clock',
    rows: [
      'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
      'PMMMMMMPPMMMMMMMMMMMPMMMMMMMMP',
      'PMMMMMMPPMMXMMMMMMMMPMMMMMMMMP',
      'PMMXMMMPPMMMMMPPMMMMPMMMMMMMMP',
      'PMMMMMMPPMMMMMPPMGMMPMMMMMMMMP',
      'PMMMMMMPPMMMMMPPMMMMMMMMMGMMMP',
      'PMMMMMMMMMMMMMPPMMMMMMMMMMMMMP',
      'MMMMMMMMMMGMMMMMMMXMMMMMMMMMMP',
      'MMMMMMMMMMGMMMMMMMMMMMMMMMMMMP',
      'PMMMMMMMMMMMMMPPMMMMMMMMMMMMMP',
      'PMMMMMMPPMMMMMPPMMMMMMMMMGMMMP',
      'PMMMMMMPPMMMMMPPMGMMPMMMMMMMMP',
      'PMMMXMMPPMMMMMPPMMMMPMMMMMMMMP',
      'PMMMMMMPPMMMXMMMMXMMPMMMMMMMMP',
      'PMMMMMMPPMMMMMMMMMMMPMMMMMMMMP',
      'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
    ],
    npcs: [],
    warps: [{ x: 0, y: 7, to: 'cogspire', tx: 28, ty: 8 }, { x: 0, y: 8, to: 'cogspire', tx: 28, ty: 9 }],
    triggers: [5, 6, 7, 8, 9, 10].map(y => ({ x: 20, y, event: 'tyrant' })),
    rifts: [{ x: 26, y: 8, to: 'ruins', tx: 4, ty: 8, flag: 'rift4' }],
    enemies: [
      { id: 'gw1', x: 4, y: 5, kind: 'brassbot', group: [{ k: 'brassbot', dx: 0, dy: 0 }, { k: 'sparkwisp', dx: 2, dy: 1 }] },
      { id: 'gw2', x: 11, y: 10, kind: 'sparkwisp', group: [{ k: 'sparkwisp', dx: 0, dy: 0 }, { k: 'sparkwisp', dx: 2, dy: -1 }, { k: 'brassbot', dx: 1, dy: 2 }] },
      { id: 'gw3', x: 17, y: 2, kind: 'steamsentinel', group: [{ k: 'steamsentinel', dx: 0, dy: 0 }, { k: 'brassbot', dx: 2, dy: 1 }] },
      { id: 'gw4', x: 18, y: 12, kind: 'steamsentinel', group: [{ k: 'steamsentinel', dx: 0, dy: 0 }, { k: 'sparkwisp', dx: -2, dy: 0 }] },
      { id: 'boss4', x: 25, y: 7, kind: 'tyrant', boss: true, flag: 'tyrantDown', group: [{ k: 'tyrant', dx: 0, dy: 0 }], static: true },
    ],
    chests: [{ id: 'c_gw1', x: 1, y: 1, item: 'hitonic', n: 2 }, { id: 'c_gw2', x: 12, y: 14, item: 'elixir', n: 1 }, { id: 'c_gw3', x: 28, y: 14, item: 'ether', n: 3 }, { id: 'c_gw4', x: 28, y: 1, item: 'seed', n: 2 }],
  },
};
export const MAPS: Record<string, MapDef> = {};
for (const [id, m] of Object.entries(MAP_DEFS)) {
  const w = Math.max(...m.rows.map(r => r.length));
  MAPS[id] = { ...m, id, w, h: m.rows.length, rows: m.rows.map(r => r.padEnd(w, m.rows[0][0])) };
}

// ---------- story scripts ----------
// Commands: say, join, flag, battle, warp, sfx, heal, shop, wait, ending, give, shake
export const TALK: Record<string, (F: Flags) => Script> = {
  mom: F => F.bramJoined ? [['say', 'Mom', 'Be careful out there, you two. And be home for supper!']]
    : [['say', 'Mom', "Kael! Bram's been banging on his workshop door all morning. Something about a 'breakthrough'."], ['say', 'Mom', 'Go see him before he blows the roof off again.']],
  bram: F => [
    ['say', 'Bram', "Kael! Finally. Look at this, the Chronoshard Resonator. I found the crystal in the Clocktower gears."],
    ['say', 'Bram', "It hums at exactly the same pitch as the tower bell. Every time it chimes, the shard... flickers. Like it's somewhere else for a second."],
    ['say', 'Kael', '...That sounds like a great way to explode.'],
    ['say', 'Bram', "Which is why I'm bringing you! Come on, let's take it to the tower. East through the fields."],
    ['join', 'bram'], ['flag', 'bramJoined'], ['sfx', 'item'], ['say', '', 'Bram joined the party!'],
  ],
  innTown: F => [['status'], ['say', 'Innkeeper', 'Rest at the Sleepy Gear? Free for locals!'], ['heal'], ['say', '', 'The party is fully restored.']],
  innPast: F => [['status'], ['say', 'Hearthkeeper', 'Travelers from beyond the stream? Rest by our fire.'], ['heal'], ['say', '', 'The party is fully restored.']],
  shop: F => [['shop']],
  kid: F => F.rift1 ? [['say', 'Kid', 'The sky over the tower went PURPLE! Did you see it?!']] : [['say', 'Kid', "I'm gonna be a knight like Kael someday! ...wait, you're not a knight."]],
  oldman: F => [['say', 'Old Fenn', 'Every hundred years the Clocktower bell rings thirteen times. My grandpa said it opens a door.'], ['say', 'Old Fenn', '...My grandpa also said fish could talk.']],
  towerGuard: F => F.rift1 ? [['say', 'Watchman', 'That glowing tear in the air... I am NOT paid enough for this.']]
    : [['say', 'Watchman', 'Tower door sticks. Kick it twice, that usually does it.']],
  elder: F => {
    if (F.golemDown) return [['say', 'Elder Moira', 'The Golem sleeps, and the Gate stands open. Beyond it the road runs forward through every age, to the end of all hours.'], ['say', 'Elder Moira', 'Rest and gather supplies before you pass through.']];
    if (F.metElder) return [['say', 'Elder Moira', 'The Mossback Golem guards the shrine, north of the forest. Fire will crack its stone hide.']];
    return [
      ['say', 'Elder Moira', 'Lyra brings strangers... and they carry a shard of the Heartclock. So the prophecy wakes.'],
      ['say', 'Elder Moira', 'Long ago the Heartclock kept time flowing in one direction. In some far tomorrow, a thing called the Hollow King shatters it, and devours the hours one by one.'],
      ['say', 'Elder Moira', 'Your shard is a splinter of it. It pulled you here because time is running out... in every age.'],
      ['say', 'Lyra', 'The Shrine Gate leads forward, to the end of days. But the Mossback Golem has slept in front of it for three centuries.'],
      ['say', 'Kael', "Then we wake it up. Politely. With swords."],
      ['flag', 'metElder'],
    ];
  },
  lyraNpc: F => EVENTS.lyraMeet(F) || [],
  pastKid: F => [['say', 'Child', 'Your clothes are so weird! Are you from the sky?']],
  pastMan: F => [['say', 'Woodcutter', 'Ember Gloops wandered in from the east last spring. Never seen the like. Hit them with frost, they hate it.']],
  unit7: F => F.metUnit7 ? [['say', 'Unit-7', 'REPAIR CYCLE ENGAGED. PLEASE HOLD STILL.'], ['heal'], ['say', '', 'The party is fully restored.'], ['shop']]
    : [
      ['say', 'Unit-7', 'ORGANIC LIFE DETECTED. ...THREE OF YOU. STATISTICALLY IMPROBABLE.'],
      ['say', 'Unit-7', 'THIS WAS ASHVALE. THE HOLLOW KING EMERGED FROM THE CORE TO THE EAST. TIME HERE IS... THIN.'],
      ['say', 'Bram', "Ashvale? This is our home? Then the Clocktower... that melted sign..."],
      ['say', 'Unit-7', 'I CAN REPAIR YOU AND TRADE SUPPLIES. I CANNOT FIGHT. I AM A TOASTER, ORIGINALLY.'],
      ['flag', 'metUnit7'], ['heal'], ['say', '', 'The party is fully restored.'],
    ],
  // ----- Year 1600 -----
  hermit: F => F.colossusDown ? [['say', 'Hermit', 'The sun came up warm this morning. First time in forty years. I cried into my soup.']]
    : [['say', 'Hermit', "Forty winters and the snow hasn't stopped. Ever since the Colossus woke in the old shrine east of here, the hours just... froze."],
      ['say', 'Hermit', "Folk say it was carved to guard the Heartclock's first gear. Fire is the only thing that makes it flinch."]],
  pilgrim: F => [['status'], ['say', 'Pilgrim', 'You look half frozen. Sit by my brazier a while.'], ['heal'], ['say', '', 'The party is fully restored.']],
  // ----- Year 1800 -----
  innCog: F => [['status'], ['say', 'Innkeeper', 'Welcome to the Wound Spring! Rooms are free for anyone brave enough to visit Cogspire these days.'], ['heal'], ['say', '', 'The party is fully restored.']],
  tamsin: F => {
    if (F.tyrantDown) return [['say', 'Clockmaker Tamsin', 'Listen! Tick, tick, tick! Every clock in Cogspire is running again. Bless you, travelers.']];
    if (F.metTamsin) return [['say', 'Clockmaker Tamsin', 'The Gearworks lie east, past the Gatewarden. The Regent hates a short circuit, mind. Bring lightning if you have it.']];
    return [
      ['say', 'Clockmaker Tamsin', 'Travelers? Through the winter pass? Then you have seen what happens when the hours stop.'],
      ['say', 'Clockmaker Tamsin', 'After the long winter we built the Regent: a clockwork mind to keep perfect time, so it would never slip again.'],
      ['say', 'Clockmaker Tamsin', 'Now it calls itself the Clockwork Tyrant. It holds the mainspring down in the Gearworks and keeps this one minute... forever.'],
      ['say', 'Bram', "A mainspring that holds time still? That's a piece of the Heartclock. Our shard is practically singing."],
      ['say', 'Kael', 'Then we take it back.'],
      ['flag', 'metTamsin'],
    ];
  },
  gatewarden: F => F.tyrantDown ? [['say', 'Gatewarden', 'The Gearworks hum like they used to. Go on through, heroes.']]
    : [['say', 'Gatewarden', 'The Gearworks are east. Nobody who went in after the Regent has come back out. ...You will, I am sure.']],
  cogKid: F => F.tyrantDown ? [['say', 'Cogspire Kid', 'My windup bird is singing again! It only knows one song, but still!']]
    : [['say', 'Cogspire Kid', 'My windup bird stopped singing when the clocks stopped. Can you fix time? He looks like he can fix anything.']],
  lamplighter: F => F.tyrantDown ? [['say', 'Lamplighter', 'Night is finally falling. Do you know how long I have waited to say that?']]
    : [['say', 'Lamplighter', 'The lamps never go out, because the evening never ends. I have lit the same lamp nine thousand times.']],
};

export const EVENTS: Record<string, (F: Flags) => Script | null> = {
  tower: F => {
    if (F.rift1) return null;
    if (!F.bramJoined) return [['say', 'Kael', "The tower... Bram wanted to bring his gadget here. I should get him first."], ['push']];
    return [
      ['say', 'Bram', 'Okay. Resonator online. When the bell chimes, I sync the shard and...'],
      ['sfx', 'magic'], ['shake', 0.6], ['say', '', 'DONG... DONG... DONG...'],
      ['say', 'Bram', "Thirteen?! It's never rung thirteen... Kael, the shard is SCREAMING--"],
      ['sfx', 'rift'], ['flag', 'rift1'], ['shake', 1.2], ['wait', 0.8],
      ['say', 'Kael', 'A hole... in the air?! It is pulling us in!'],
      ['warp', 'forest', 4, 8], ['wait', 0.5],
      ['say', 'Bram', 'Ugh... where are we? These trees are enormous. And the tower is gone.'],
      ['say', 'Kael', 'That tear followed us. Maybe it leads back. But first... someone is yelling up ahead.'],
    ];
  },
  lyraMeet: F => {
    if (F.lyraJoined) return null;
    return [
      ['say', '???', 'Back, you overgrown weeds! Back!'],
      ['say', 'Kael', 'Someone is surrounded! Bram, come on!'],
      ['battle', [{ k: 'thornling', x: 13, y: 8 }, { k: 'thornling', x: 14, y: 10 }, { k: 'gloop', x: 15, y: 7 }], { noRun: true }],
      ['join', 'lyra'], ['flag', 'lyraJoined'],
      ['say', 'Lyra', 'Thanks... I had them right where I wanted them. Mostly.'],
      ['say', 'Lyra', "I'm Lyra, warden of these woods. Your clothes are strange and that crystal in your pocket is singing. You came through the tear, didn't you?"],
      ['say', 'Bram', "We're from Ashvale. Year 1000. And you are... six hundred years before that?"],
      ['say', 'Lyra', 'Then Elder Moira must see you. Her hamlet lies east. I will come along.'],
      ['sfx', 'item'], ['say', '', 'Lyra joined the party!'],
      ['say', '', 'TIP: When two allies are ready, open Tech to unleash Dual Techs!'],
    ];
  },
  hollow: F => {
    if (F.hollowDown || F.hollowTalk) return null;
    return [
      ['flag', 'hollowTalk'],
      ['say', '???', 'Little hours... ticking, ticking. You came all this way to be eaten.'],
      ['say', 'Kael', 'You are the Hollow King. You broke the Heartclock!'],
      ['say', 'Hollow King', 'I AM the space between seconds. Every age tastes the same in the end. Yours will taste of brass and smoke.'],
      ['say', 'Lyra', 'Then we fight together. All three ages at once!'],
      ['say', '', 'TIP: Chrono Rend, the triple tech, cuts through the Hollow.'],
    ];
  },
  golemWin: F => [
    ['say', 'Lyra', "It's crumbling... look! The Shrine Gate behind it is glowing."],
    ['sfx', 'rift'], ['shake', 0.6], ['flag', 'rift2'],
    ['say', 'Bram', "Another rift. The shard's pulling forward this time. Way forward."],
    ['say', 'Kael', 'Elder Moira said the end of days. Let us rest first, then step through.'],
  ],
  hollowWin: F => [['ending']],
  // ----- Year 1000, optional -----
  gloopKingWin: F => [
    ['say', '', 'The Gloop King wobbles, deflates, and leaves behind a sticky little crown.'],
    ['sfx', 'item'], ['give', 'elixir', 1], ['give', 'hitonic', 2], ['say', '', 'Found an Elixir and 2 Hi-Tonics!'],
  ],
  // ----- Year 1600 -----
  frostveil: F => {
    if (F.frostTalk) return null;
    return [
      ['flag', 'frostTalk'],
      ['say', 'Bram', "Brr! Snow? The shard yanked us forward, but it's stuttering. Like a gear slipping its teeth."],
      ['say', 'Lyra', 'These pines... this is my forest, only older. Buried. How long has it been winter here?'],
      ['say', 'Kael', "Someone's camped by the path. Let's ask."],
    ];
  },
  colossus: F => {
    if (F.colossusDown || F.colossusTalk) return null;
    return [
      ['flag', 'colossusTalk'],
      ['shake', 0.5], ['say', '', 'The shrine ice groans. Something vast unfolds from the snow.'],
      ['say', 'Lyra', 'That is no golem of my age. It has frost where its heart should be.'],
      ['say', 'Bram', "It's guarding something. Feel that? The shard is pulling right through it."],
      ['say', 'Kael', 'Then it moves. Lyra, keep the fire coming!'],
    ];
  },
  colossusWin: F => [
    ['say', 'Lyra', 'The ice is breaking... listen. Water. Birds.'],
    ['sfx', 'rift'], ['shake', 0.6], ['flag', 'rift3'],
    ['say', 'Bram', "There's the tear again, behind the shrine. Forward we go."],
    ['say', 'Kael', 'In every age we pass through, something has broken time a little more. Let us find out who.'],
  ],
  // ----- Year 1800 -----
  cogspire: F => {
    if (F.cogTalk) return null;
    return [
      ['flag', 'cogTalk'],
      ['say', 'Bram', 'Clocks! Clocks on every wall! Kael, I think I have died and gone to heaven.'],
      ['say', 'Kael', 'Every one of them reads the same minute. And none of them are ticking.'],
      ['say', 'Lyra', 'Someone by the fountain is waving at us.'],
    ];
  },
  tyrant: F => {
    if (F.tyrantDown || F.tyrantTalk) return null;
    return [
      ['flag', 'tyrantTalk'],
      ['shake', 0.5], ['say', '', 'Gears the size of houses grind to a halt. A brass figure turns its many faces toward you.'],
      ['say', '???', 'IRREGULARITY DETECTED. THREE UNSCHEDULED SECONDS.'],
      ['say', 'Bram', "That's the Regent. Look at those coils. One good jolt and it'll seize right up."],
      ['say', 'Lyra', 'Then we shall be very irregular.'],
    ];
  },
  tyrantWin: F => [
    ['say', '', 'The Tyrant shudders. Its faces spin, and every clock above begins, at last, to tick.'],
    ['sfx', 'rift'], ['shake', 0.8], ['flag', 'rift4'],
    ['say', 'Bram', 'The mainspring! The shard drank it right up. And now it is pulling... far. Further than ever.'],
    ['say', 'Kael', 'The end of days. Elder Moira was right. Whatever broke the Heartclock is waiting there.'],
  ],
};

export const SHOP_STOCK: ItemId[] = ['tonic', 'hitonic', 'ether', 'seed'];
