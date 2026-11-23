// ===== Chronoshard space: the one place that converts between the flat 2D view and the 3D world =====
// World space is map x (east), height y (up) and map z (south), in art pixels. The game's logic and draw code still
// think in the flat view the pixel art was drawn for: there, something `h` pixels up an object whose feet are on
// ground line gz was drawn at flat y = gz - h, and draw calls use positions relative to a drawing camera. Everything
// recorded for the 3D scene goes through these helpers, so the renderer only ever sees world positions.
import { Frame, S, UX } from './engine.js';
import type { Vec3 } from './engine.js';
import { Cam, HS } from './camera.js';

export type { Vec3 };

export const Space = {
  /** a position given relative to the drawing camera, in map coordinates */
  map(dx: number, dy: number): [number, number] { return [dx + Frame.drawCamX, dy + Frame.drawCamY]; },
  /** world height of `rows` pixels of upright art (heights are stretched so art keeps its proportions on screen) */
  up(rows: number): number { return rows * HS; },
  /** a point on the ground at map (x, z) */
  ground(x: number, z: number): Vec3 { return { x, y: 0, z }; },
  /** a point drawn at flat (x, flatY) on something standing on ground line gz (map coordinates) */
  onObject(x: number, flatY: number, gz: number): Vec3 { return { x, y: (gz - flatY) * HS, z: gz }; },
  /** a free-floating point given as flat (x, flatY) that is `h` world px above the ground (lights, particles) */
  raised(x: number, flatY: number, h: number): Vec3 { return { x, y: h, z: flatY + h / HS }; },
  /** where a world point appears in UI coordinates (the centred 960x720 frame) */
  toUi(p: Vec3): [number, number] { const [ax, ay] = Cam.project(p.x, p.y, p.z); return [ax * S - UX, ay * S]; },
};
