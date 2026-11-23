// Small pure helpers: sprite normal maps and text wrapping.
import { afterEach, describe, expect, test } from 'vitest';
import { normalPixels } from '../src/normal-pixels.js';
import { Font, measure, wrapText } from '../src/pixel.js';

describe('normal maps', () => {
  const image = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4), colorSpace: 'srgb' }) as ImageData;
  /** a 21x21 grey disc on a transparent background, and its normal map */
  function disc() {
    const n = 21, src = image(n, n), out = image(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (Math.hypot(x - 10, y - 10) <= 8) src.data.set([128, 128, 128, 255], (y * n + x) * 4);
    normalPixels(src, out, 3.5);
    const at = (x: number, y: number) => [...out.data.subarray((y * n + x) * 4, (y * n + x) * 4 + 4)];
    return at;
  }

  test('the middle of a shape faces the camera', () => {
    const [r, g, b, a] = disc()(10, 10);
    expect([r, g]).toEqual([128, 128]); expect(b).toBe(255); expect(a).toBe(255);
  });

  test('edges bevel outward: left edges point left, top edges up', () => {
    const at = disc();
    expect(at(3, 10)[0]).toBeLessThan(110);    // red below 128: normal points left
    expect(at(17, 10)[0]).toBeGreaterThan(146); // right
    expect(at(10, 3)[1]).toBeLessThan(110);    // green below 128: up the image
  });

  test('transparent pixels stay transparent', () => expect(disc()(0, 0)).toEqual([0, 0, 0, 0]));
});

describe('text wrapping', () => {
  afterEach(() => { Font.hd = true; });

  test('splits on spaces so every line fits, keeping every word in order', () => {
    Font.hd = false; // the bitmap font: 6 px per character at size 16, so widths are exact
    const s = 'The morning the Clocktower rang thirteen times, everything changed in Ashvale.';
    const lines = wrapText(s, 200, 16);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(measure(l, 16)).toBeLessThanOrEqual(200);
    expect(lines.join(' ')).toBe(s);
  });

  test('keeps line breaks, and never splits a word too long for a line', () => {
    Font.hd = false;
    expect(wrapText('one\ntwo', 500, 16)).toEqual(['one', 'two']);
    expect(wrapText('Supercalifragilistic', 20, 16)).toEqual(['Supercalifragilistic']);
  });

  test('a non-breaking space holds words together', () => {
    Font.hd = false;
    const lines = wrapText('aaaa bbbb cccc', measure('aaaa bbbb', 16), 16);
    expect(lines).toEqual(['aaaa', 'bbbb cccc']);
  });
});
