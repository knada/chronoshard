// ===== Chronoshard camera: the tilted view onto the world, shared by the 3D renderer and the UI =====
// world3d.ts points Three's camera with these numbers, and space.ts projects UI marks (target arrows, damage numbers)
// with Cam.project, so the two line up. This module depends on nothing but the view size, so anything can import it.
import { TILE, VH, VW } from './engine.js';

/** how far the camera looks down from horizontal, and its vertical field of view */
export const PITCH = 45 * Math.PI / 180, FOVY = 20 * Math.PI / 180;
/** height stretch: a wall one tile tall (16 art px of wall art) stands 16 * HS high, and looks 16 px tall on screen */
export const HS = 1 / Math.cos(PITCH);
/** camera distance from the point it looks at, so the view's 240 rows span the art at 1:1 there */
export const CAM_D = (VH * TILE / 2) / Math.tan(FOVY / 2);
export const NEAR = 60, FAR = 2600;
const AW = VW * TILE, AH = VH * TILE;

export type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function perspective(fovy: number, aspect: number, n: number, f: number): Float32Array {
  const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
  m[0] = t / aspect; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m;
}
function lookAt(eye: V3, at: V3): Float32Array {
  const f = norm(sub(at, eye)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), m = new Float32Array(16);
  m[0] = r[0]; m[4] = r[1]; m[8] = r[2]; m[1] = u[0]; m[5] = u[1]; m[9] = u[2]; m[2] = -f[0]; m[6] = -f[1]; m[10] = -f[2];
  m[12] = -dot(r, eye); m[13] = -dot(u, eye); m[14] = dot(f, eye); m[15] = 1; return m;
}
function mul(a: Float32Array, b: Float32Array): Float32Array {
  const m = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; m[c * 4 + r] = s; }
  return m;
}
const PROJ = perspective(FOVY, AW / AH, NEAR, FAR);
/** direction toward the sun: low in the west, so shadows stretch east across the ground where the camera can see them */
export const SUN: V3 = norm([-0.72, 0.62, 0.3]);

/** the camera: looks down at PITCH onto a focus point on the ground (map coordinates: x east, z south, y up) */
export const Cam = {
  vp: new Float32Array(16) as Float32Array, eye: [0, 0, 0] as V3, fx: 0, fz: 0,
  update(fx: number, fz: number): void {
    this.fx = fx; this.fz = fz;
    this.eye = [fx, CAM_D * Math.sin(PITCH), fz + CAM_D * Math.cos(PITCH)];
    this.vp = mul(PROJ, lookAt(this.eye, [fx, 0, fz]));
  },
  /** a 3D point (map x, height y, map z) to art-screen coordinates (0..428 x 0..240) */
  project(x: number, y: number, z: number): [number, number] {
    const m = this.vp, cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(cx / w * 0.5 + 0.5) * AW, (1 - (cy / w * 0.5 + 0.5)) * AH];
  },
};
