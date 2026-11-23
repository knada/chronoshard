// World space: the flat-view conversions in space.ts, and the camera maths that places UI (arrows, damage numbers)
// over the 3D render agreeing with the Three.js camera that draws it.
import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { Frame, S, TILE, UX, VH, VW } from '../src/engine.js';
import { Cam, FAR, FOVY, HS, NEAR, PITCH } from '../src/camera.js';
import { Space } from '../src/space.js';

const AW = VW * TILE, AH = VH * TILE;

describe('flat view to world', () => {
  test('a position relative to the drawing camera becomes a map position', () => {
    Frame.drawCamX = 100; Frame.drawCamY = -40;
    expect(Space.map(5, 7)).toEqual([105, -33]);
  });

  test('upright art is stretched by 1/cos(pitch), so it keeps its proportions on screen', () => {
    expect(HS).toBeCloseTo(1 / Math.cos(PITCH));
    expect(Space.up(16)).toBeCloseTo(16 * HS);
  });

  test("a point on an object's ground line is on the ground; higher rows stand taller", () => {
    expect(Space.onObject(30, 200, 200)).toEqual({ x: 30, y: 0, z: 200 });
    const p = Space.onObject(30, 184, 200);
    expect(p.y).toBeCloseTo(16 * HS); expect(p.z).toBe(200);
  });

  test('a floating point keeps its height and moves back so it shows where the flat view drew it', () => {
    const p = Space.raised(10, 50, 12);
    expect(p.y).toBe(12); expect(p.z).toBeCloseTo(50 + 12 / HS);
  });
});

describe('the camera', () => {
  /** the Three.js camera exactly as world3d.ts sets it up */
  function threeCamera(): THREE.PerspectiveCamera {
    const c = new THREE.PerspectiveCamera(FOVY * 180 / Math.PI, AW / AH, NEAR, FAR);
    c.position.set(...Cam.eye); c.lookAt(Cam.fx, 0, Cam.fz); c.updateMatrixWorld();
    return c;
  }
  const focusPoints: [number, number][] = [[214, 150], [600, 420], [0, 0]];

  test.each(focusPoints)('UI placement matches the 3D render (focus %i, %i)', (fx, fz) => {
    Cam.update(fx, fz);
    const cam = threeCamera();
    for (const [dx, y, dz] of [[0, 0, 0], [-150, 0, -60], [120, 40, 30], [200, 0, 100], [-90, 80, -110]]) {
      const v = new THREE.Vector3(fx + dx, y, fz + dz).project(cam);
      const [ax, ay] = Cam.project(fx + dx, y, fz + dz);
      expect(ax, `x of (${dx}, ${y}, ${dz})`).toBeCloseTo((v.x + 1) / 2 * AW, 2);
      expect(ay, `y of (${dx}, ${y}, ${dz})`).toBeCloseTo((1 - v.y) / 2 * AH, 2);
    }
  });

  test('the point the camera looks at is the middle of the screen', () => {
    Cam.update(300, 200);
    const [ax, ay] = Cam.project(300, 0, 200);
    expect(ax).toBeCloseTo(AW / 2); expect(ay).toBeCloseTo(AH / 2);
    // (the projection matrix is 32-bit, so allow a few thousandths of a pixel)
    expect(Space.toUi({ x: 300, y: 0, z: 200 })).toEqual([AW / 2 * S - UX, AH / 2 * S].map(v => expect.closeTo(v, 3)));
  });

  test('a 16-row piece of upright art at the focus looks 16 art px tall', () => {
    Cam.update(300, 200);
    const [, foot] = Cam.project(300, 0, 200), [, head] = Cam.project(300, Space.up(16), 200);
    expect(foot - head).toBeGreaterThan(16 * 0.95);
    expect(foot - head).toBeLessThan(16 * 1.05);
  });
});
