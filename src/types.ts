// ===== Chronoshard shared types: the data model every module agrees on =====

export type Dir = 'up' | 'down' | 'left' | 'right';
export type View = 'up' | 'down' | 'side';
export type Pose = 'ready' | 'attack' | 'cast' | 'hurt' | 'victory' | 'ko';
export type Elem = 'phys' | 'fire' | 'ice' | 'shock' | 'time';
export type HeroId = 'kael' | 'bram' | 'lyra';
export type Flags = Record<string, boolean>;
/** RGB triple, 0..255 */
export type RGB = [number, number, number];

// ---------- characters ----------
export type HairStyle = 'spiky' | 'long' | 'cap' | 'short' | 'bald' | 'hood';
export interface Look {
  hair: string; skin: string; top: string; bottom: string;
  hairStyle: HairStyle;
  extra?: 'beard' | 'goggles';
  weapon?: 'sword' | 'staff' | 'wrench';
  belt?: string; boots?: string;
}
export interface Stats { maxhp: number; maxmp: number; atk: number; def: number; mag: number; spd: number }
export type TechTarget = 'enemy' | 'enemies' | 'ally' | 'allies' | 'deadally';
export interface Tech {
  lv?: number; name: string; mp: number; target: TechTarget;
  elem?: Elem; power?: number; magic?: boolean; heal?: number; revive?: boolean;
  fx: 'slash' | 'spin' | 'fire' | 'ice' | 'zap' | 'shot' | 'heal' | 'time';
}
export interface DualTech extends Omit<Tech, 'mp' | 'lv'> { who: HeroId[]; mp: number[]; dual?: true }
export interface HeroDef {
  name: string; look: Look;
  hp: number; mp: number; atk: number; def: number; mag: number; spd: number;
  grow: { hp: number; mp: number; atk: number; def: number; mag: number; spd: number };
  techs: Tech[];
}
/** a party member's saved progress */
export interface HeroState { id: HeroId; lv: number; xp: number; hp: number; mp: number }

export interface Item { name: string; desc: string; price: number; heal?: number; mp?: number; revive?: boolean; all?: boolean }
export type ItemId = 'tonic' | 'hitonic' | 'ether' | 'seed' | 'elixir';
export type Inventory = Partial<Record<ItemId, number>>;

// ---------- enemies ----------
export type EnemyShape = 'blob' | 'emberblob' | 'plant' | 'bat' | 'robot' | 'sentinel' | 'golem' | 'hollow' | 'wisp' | 'voidwisp';
export interface EnemyMove { name: string; power?: number; target?: 'one' | 'all'; elem?: Elem; magic?: boolean; heal?: number }
export interface EnemyKind {
  name: string; shape: EnemyShape; color: string; color2: string; size: number;
  hp: number; atk: number; def: number; mag: number; spd: number; xp: number; gold: number;
  weak?: Elem[]; resist?: Elem[]; boss?: boolean; moves: EnemyMove[];
}

// ---------- maps ----------
export interface NpcDef { id: string; x: number; y: number; look: Look; dir: Dir; talk: string; hideIf?: string; wander?: boolean }
export interface Sign { x: number; y: number; text: string }
export interface Warp { x: number; y: number; to: string; tx: number; ty: number }
export interface Trigger { x: number; y: number; event: string }
export interface Rift extends Warp { flag: string }
export interface GroupMember { k: string; dx: number; dy: number }
export interface EnemySpawn { id: string; x: number; y: number; kind: string; group: GroupMember[]; boss?: boolean; flag?: string; static?: boolean }
export interface Chest { id: string; x: number; y: number; item: ItemId; n: number }
export interface MapDef {
  name: string; era: string; music: string; rows: string[];
  npcs?: NpcDef[]; signs?: Sign[]; warps?: Warp[]; triggers?: Trigger[]; rifts?: Rift[]; enemies?: EnemySpawn[]; chests?: Chest[];
  /** filled in at load */
  id: string; w: number; h: number;
}

// ---------- story scripts ----------
export interface BattleEnemySpec { k: string; x: number; y: number }
export type ScriptCmd =
  | ['say', string, string]
  | ['join', HeroId]
  | ['flag', string]
  | ['battle', BattleEnemySpec[], { noRun?: boolean; boss?: boolean }?]
  | ['warp', string, number, number]
  | ['sfx', string]
  | ['heal'] | ['shop'] | ['push'] | ['ending']
  | ['wait', number]
  | ['shake', number];
export type Script = ScriptCmd[];

// ---------- audio ----------
export interface Track { tempo: number; lead: number[]; bass: number[]; wave?: OscillatorType; len?: number }

// ---------- lighting ----------
export interface Light { x: number; y: number; r: number; c: RGB; i: number; flicker?: boolean; pulse?: boolean }

/** something that can be depth-sorted and drawn in the world */
export interface Drawable { y: number; draw: () => void }
