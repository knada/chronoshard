import { TILES } from './tiles.js';
// ===== Chronoshard data: heroes, techs, enemies, items, maps, story =====
TILES.D.solid = true;
export const LOOKS = {
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
export const HEROES = {
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
export const DUALS = [
    { name: 'Blazing Edge', who: ['kael', 'lyra'], mp: [4, 4], target: 'enemy', elem: 'fire', power: 4.5, magic: true, fx: 'fire' },
    { name: 'Gear Crusher', who: ['kael', 'bram'], mp: [4, 4], target: 'enemies', elem: 'phys', power: 2.4, fx: 'spin' },
    { name: 'Storm Engine', who: ['bram', 'lyra'], mp: [5, 5], target: 'enemies', elem: 'shock', power: 2.6, magic: true, fx: 'zap' },
    { name: 'Chrono Rend', who: ['kael', 'bram', 'lyra'], mp: [8, 8, 8], target: 'enemies', elem: 'time', power: 4.2, magic: true, fx: 'time' },
];
export const ITEMS = {
    tonic: { name: 'Tonic', desc: 'Restores 60 HP', price: 10, heal: 60 },
    hitonic: { name: 'Hi-Tonic', desc: 'Restores 200 HP', price: 40, heal: 200 },
    ether: { name: 'Ether', desc: 'Restores 25 MP', price: 30, mp: 25 },
    seed: { name: 'Revival Seed', desc: 'Revives a fallen ally', price: 60, revive: true },
    elixir: { name: 'Elixir', desc: 'Fully restores the party', price: 0, all: true },
};
// ---------- enemies ----------
export const ENEMIES = {
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
    rustbot: { name: 'Rustbot', shape: 'robot', color: '#8a7a6a', color2: '#5a4a3a', size: 1.5, hp: 110, atk: 22, def: 12, mag: 8, spd: 9, xp: 34, gold: 22, weak: ['shock'],
        moves: [{ name: 'Drill Arm', power: 1, target: 'one' }, { name: 'Laser Sweep', power: 0.8, target: 'all', magic: true }] },
    voidwisp: { name: 'Void Wisp', shape: 'voidwisp', color: '#a050f0', color2: '#401060', size: 1.6, hp: 90, atk: 12, def: 25, mag: 22, spd: 13, xp: 38, gold: 25, weak: ['time', 'fire', 'ice'], resist: ['phys'],
        moves: [{ name: 'Null Ray', power: 1.2, target: 'one', magic: true }] },
    sentinel: { name: 'Sentinel', shape: 'sentinel', color: '#4a5a7a', color2: '#c8a040', size: 2.2, hp: 220, atk: 28, def: 16, mag: 12, spd: 8, xp: 70, gold: 50, weak: ['shock'],
        moves: [{ name: 'Crush', power: 1.2, target: 'one' }, { name: 'Overload', power: 1, target: 'all', elem: 'shock', magic: true }] },
    hollow: { name: 'The Hollow King', shape: 'hollow', color: '#4a2878', color2: '#a050f0', size: 3, hp: 3200, atk: 34, def: 18, mag: 30, spd: 10, xp: 0, gold: 0, weak: ['time'], boss: true,
        moves: [{ name: 'Rend', power: 1.2, target: 'one' }, { name: 'Time Fracture', power: 0.9, target: 'all', magic: true }, { name: 'Unmake', power: 1.8, target: 'one', magic: true }, { name: 'Devour Hours', heal: 200 }] },
};
// ---------- music (MIDI note numbers, 0 = rest) ----------
export const MUSIC = {
    town: { tempo: 150, lead: [72, 0, 76, 79, 77, 76, 74, 0, 72, 74, 76, 0, 74, 72, 71, 0, 69, 0, 72, 76, 74, 72, 71, 0, 72, 0, 0, 0, 67, 0, 0, 0], bass: [48, 48, 52, 52, 53, 53, 55, 55, 45, 45, 48, 48, 50, 50, 43, 43] },
    field: { tempo: 170, lead: [67, 72, 74, 76, 0, 74, 76, 79, 0, 77, 76, 74, 72, 0, 74, 0, 67, 72, 74, 76, 0, 79, 81, 79, 77, 76, 74, 76, 72, 0, 0, 0], bass: [48, 0, 55, 0, 53, 0, 55, 0, 45, 0, 52, 0, 50, 0, 55, 0] },
    past: { tempo: 110, wave: 'triangle', len: 0.35, lead: [69, 0, 72, 76, 74, 0, 72, 71, 69, 0, 0, 64, 67, 0, 69, 0, 71, 0, 72, 74, 76, 0, 74, 72, 71, 0, 69, 0, 0, 0, 0, 0], bass: [45, 45, 41, 41, 43, 43, 40, 40] },
    future: { tempo: 120, wave: 'sawtooth', lead: [57, 0, 0, 60, 0, 0, 63, 0, 62, 0, 60, 0, 58, 0, 0, 0, 57, 0, 0, 60, 0, 0, 65, 0, 63, 0, 62, 0, 60, 0, 0, 0], bass: [33, 33, 33, 33, 36, 36, 34, 34] },
    battle: { tempo: 200, lead: [64, 64, 67, 64, 69, 64, 71, 72, 71, 69, 67, 64, 66, 67, 69, 71, 64, 64, 67, 64, 69, 64, 72, 74, 76, 74, 72, 71, 72, 71, 69, 67], bass: [40, 40, 40, 40, 43, 43, 45, 45, 36, 36, 38, 38, 40, 40, 47, 47] },
    boss: { tempo: 210, wave: 'sawtooth', lead: [57, 60, 64, 63, 57, 60, 66, 65, 57, 60, 64, 63, 69, 68, 66, 65, 57, 0, 57, 60, 62, 63, 62, 60, 59, 0, 62, 0, 65, 0, 68, 0], bass: [33, 33, 33, 33, 34, 34, 34, 34, 36, 36, 35, 35, 33, 33, 40, 40] },
    ending: { tempo: 100, wave: 'triangle', len: 0.4, lead: [72, 0, 74, 76, 0, 79, 77, 76, 74, 0, 72, 74, 76, 0, 0, 0, 69, 0, 72, 74, 0, 76, 74, 72, 71, 0, 72, 0, 0, 0, 0, 0], bass: [48, 48, 45, 45, 41, 41, 43, 43] },
};
const MAP_DEFS = {
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
        rifts: [{ x: 3, y: 8, to: 'fields', tx: 22, ty: 7, flag: 'rift1' }, { x: 12, y: 2, to: 'ruins', tx: 4, ty: 8, flag: 'rift2' }],
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
        rifts: [{ x: 3, y: 8, to: 'forest', tx: 12, ty: 3, flag: 'rift2' }],
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
};
export const MAPS = {};
for (const [id, m] of Object.entries(MAP_DEFS)) {
    const w = Math.max(...m.rows.map(r => r.length));
    MAPS[id] = { ...m, id, w, h: m.rows.length, rows: m.rows.map(r => r.padEnd(w, m.rows[0][0])) };
}
// ---------- story scripts ----------
// Commands: say, join, flag, battle, warp, sfx, heal, shop, wait, ending, give, gold, music, shake
export const TALK = {
    mom: F => F.bramJoined ? [['say', 'Mom', 'Be careful out there, you two. And be home for supper!']]
        : [['say', 'Mom', "Kael! Bram's been banging on his workshop door all morning. Something about a 'breakthrough'."], ['say', 'Mom', 'Go see him before he blows the roof off again.']],
    bram: F => [
        ['say', 'Bram', "Kael! Finally. Look at this, the Chronoshard Resonator. I found the crystal in the Clocktower gears."],
        ['say', 'Bram', "It hums at exactly the same pitch as the tower bell. Every time it chimes, the shard... flickers. Like it's somewhere else for a second."],
        ['say', 'Kael', '...That sounds like a great way to explode.'],
        ['say', 'Bram', "Which is why I'm bringing you! Come on, let's take it to the tower. East through the fields."],
        ['join', 'bram'], ['flag', 'bramJoined'], ['sfx', 'item'], ['say', '', 'Bram joined the party!'],
    ],
    innTown: F => [['say', 'Innkeeper', 'Rest at the Sleepy Gear? Free for locals!'], ['heal'], ['say', '', 'The party is fully restored.']],
    innPast: F => [['say', 'Hearthkeeper', 'Travelers from beyond the stream? Rest by our fire.'], ['heal'], ['say', '', 'The party is fully restored.']],
    shop: F => [['shop']],
    kid: F => F.rift1 ? [['say', 'Kid', 'The sky over the tower went PURPLE! Did you see it?!']] : [['say', 'Kid', "I'm gonna be a knight like Kael someday! ...wait, you're not a knight."]],
    oldman: F => [['say', 'Old Fenn', 'Every hundred years the Clocktower bell rings thirteen times. My grandpa said it opens a door.'], ['say', 'Old Fenn', '...My grandpa also said fish could talk.']],
    towerGuard: F => F.rift1 ? [['say', 'Watchman', 'That glowing tear in the air... I am NOT paid enough for this.']]
        : [['say', 'Watchman', 'Tower door sticks. Kick it twice, that usually does it.']],
    elder: F => {
        if (F.golemDown)
            return [['say', 'Elder Moira', 'The Golem sleeps, and the Gate stands open. Beyond it lies the end of all hours.'], ['say', 'Elder Moira', 'Rest and gather supplies before you pass through.']];
        if (F.metElder)
            return [['say', 'Elder Moira', 'The Mossback Golem guards the shrine, north of the forest. Fire will crack its stone hide.']];
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
};
export const EVENTS = {
    tower: F => {
        if (F.rift1)
            return null;
        if (!F.bramJoined)
            return [['say', 'Kael', "The tower... Bram wanted to bring his gadget here. I should get him first."], ['push']];
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
        if (F.lyraJoined)
            return null;
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
        if (F.hollowDown || F.hollowTalk)
            return null;
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
};
export const SHOP_STOCK = ['tonic', 'hitonic', 'ether', 'seed'];
//# sourceMappingURL=data.js.map