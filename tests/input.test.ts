// Controllers: buttons, d-pad and stick feed the same actions as the keyboard, and hints name the device in use.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { Input, STICK_DEADZONE, padLayout } from '../src/engine.js';
import { MAPS } from '../src/data.js';
import { G, Game } from '../src/game.js';
import { reachable, resetGame, walkable } from './helpers.js';

const XBOX = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
const DUALSENSE = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
const SWITCH_PRO = 'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)';
const A = 0, B = 1, Y = 3, START = 9, DPAD_UP = 12, DPAD_RIGHT = 15;

/** what navigator.getGamepads() returns this frame */
let pads: (Gamepad | null)[] = [];
Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => pads });
/** a connected controller holding `buttons`, with its left stick at (x, y) */
function pad(buttons: number[] = [], x = 0, y = 0, id = XBOX): Gamepad {
  return { id, connected: true, mapping: 'standard', index: 0, timestamp: 0, axes: [x, y, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i), touched: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 })) } as unknown as Gamepad;
}
/** one frame: the controller state is read, the game would run, then this frame's presses are cleared */
function frame(...state: (Gamepad | null)[]): void { pads = state; Input.pollPads(); }
const key = (type: 'keydown' | 'keyup', code: string) => dispatchEvent(new KeyboardEvent(type, { code }));

beforeEach(() => { resetGame(); Input.keys = {}; Input.pad = {}; Input.device = 'keyboard'; pads = []; });
afterEach(() => { pads = []; });

describe('buttons', () => {
  test('pressing A is one press of OK, held until it is let go', () => {
    frame(pad([A]));
    expect(Input.pressed('ok')).toBe(true);
    expect(Input.down.ok).toBe(true);
    frame(pad([A]));
    expect(Input.pressed('ok'), 'holding it does not press again').toBe(false);
    frame(pad());
    expect(Input.down.ok).toBe(false);
  });

  test('B is back; Y and Start both open the menu', () => {
    frame(pad([B])); expect(Input.pressed('back')).toBe(true);
    frame(pad()); frame(pad([Y])); expect(Input.pressed('menu')).toBe(true);
    frame(pad()); frame(pad([START])); expect(Input.pressed('menu')).toBe(true);
  });

  test('the d-pad and the stick both steer', () => {
    frame(pad([DPAD_UP]));
    expect(Input.down.up).toBe(true);
    frame(pad([], 0.9, 0));
    expect([Input.down.up, Input.down.right]).toEqual([false, true]);
    frame(pad([], -0.7, 0.8));
    expect([Input.down.left, Input.down.down, Input.down.right]).toEqual([true, true, false]);
  });

  test('a stick resting inside the deadzone does nothing', () => {
    frame(pad([], STICK_DEADZONE * 0.9, -STICK_DEADZONE * 0.9));
    expect(Object.values(Input.down).some(Boolean)).toBe(false);
    expect(Input.device, 'a drifting stick does not take over the hints').toBe('keyboard');
  });

  test('a controller that disconnects lets go of everything', () => {
    frame(pad([A, DPAD_RIGHT]));
    frame(null);
    expect([Input.down.ok, Input.down.right]).toEqual([false, false]);
  });

  test('two controllers can play at once', () => {
    frame(pad([A]), pad([DPAD_RIGHT]));
    expect([Input.down.ok, Input.down.right]).toEqual([true, true]);
  });

  test('letting go on one device keeps an action held on the other', () => {
    key('keydown', 'ArrowRight');
    frame(pad([DPAD_RIGHT]));
    frame(pad());
    expect(Input.down.right, 'still held on the keyboard').toBe(true);
    key('keyup', 'ArrowRight');
    expect(Input.down.right).toBe(false);
  });
});

describe('hints', () => {
  test('name keys until a controller is used, then its buttons', () => {
    expect([Input.label('ok'), Input.label('back'), Input.label('menu')]).toEqual(['Z', 'X', 'C']);
    frame(pad([A]));
    expect([Input.label('ok'), Input.label('back'), Input.label('menu')]).toEqual(['A', 'B', 'Y']);
    key('keydown', 'KeyZ'); key('keyup', 'KeyZ');
    expect(Input.label('ok'), 'typing switches back').toBe('Z');
  });

  test('follow the controller family', () => {
    expect([padLayout(XBOX), padLayout(DUALSENSE), padLayout(SWITCH_PRO), padLayout('Unknown pad')]).toEqual(['xbox', 'playstation', 'nintendo', 'xbox']);
    frame(pad([A], 0, 0, DUALSENSE));
    expect([Input.label('ok'), Input.label('back'), Input.label('menu')]).toEqual(['✕', '○', '△']);
    frame(pad()); frame(pad([A], 0, 0, SWITCH_PRO));
    expect([Input.label('ok'), Input.label('back'), Input.label('menu')]).toEqual(['B', 'A', 'X']);
  });
});

test('the stick walks the player', () => {
  Game.newGame(); G.script = null;
  const m = MAPS.town, [tx, ty] = [...reachable(m, 2, 4)].map(k => k.split(',').map(Number))
    .find(([x, y]) => [1, 2, 3, 4].every(d => walkable(m, x + d, y) && walkable(m, x + d, y + 1) && walkable(m, x + d, y - 1)))!;
  Game.loadMap('town', tx, ty); G.foes = []; G.npcs = [];
  const x = G.player.x;
  for (let i = 0; i < 15; i++) { frame(pad([], 1, 0)); Game.updateField(1 / 60); }
  frame(pad());
  expect(G.player.x).toBeGreaterThan(x + 10);
  expect(G.player.dir).toBe('right');
});
