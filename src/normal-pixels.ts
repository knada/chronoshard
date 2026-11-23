// Generates the lighting normals from a sprite silhouette and luminance.
export function normalPixels(source: ImageData, output: ImageData, radius: number): void {
  const { width: w, height: h, data: sd } = source, n = w * h, BIG = 1e3;
  const dist = new Float32Array(n), lum = new Float32Array(n);
  for (let i = 0; i < n; i++) { dist[i] = sd[i * 4 + 3] > 96 ? BIG : 0; lum[i] = (sd[i * 4] * 0.3 + sd[i * 4 + 1] * 0.55 + sd[i * 4 + 2] * 0.15) / 255; }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : dist[y * w + x]);
  // two-pass chamfer distance to the nearest transparent pixel (the canvas border counts as transparent)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (dist[i]) dist[i] = Math.min(dist[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.41, at(x + 1, y - 1) + 1.41); }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (dist[i]) dist[i] = Math.min(dist[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.41, at(x - 1, y + 1) + 1.41); }
  // the bevel is `radius` px wide; for high-resolution art it's wider and proportionally taller, so the shading looks the same
  const R = radius, hk = 2.6 * R / 3.5, ht = new Float32Array(n);
  for (let i = 0; i < n; i++) { if (!dist[i]) continue; const k = Math.min(dist[i], R) / R; ht[i] = Math.sqrt(1 - (1 - k) * (1 - k)) * hk + lum[i] * 0.9; }
  const hAt = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : ht[y * w + x]);
  const od = output.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!dist[i]) continue;
    const nx = -(hAt(x + 1, y) - hAt(x - 1, y)) / 2, ny = -(hAt(x, y + 1) - hAt(x, y - 1)) / 2, l = Math.hypot(nx, ny, 1);
    od[i * 4] = Math.round((nx / l * 0.5 + 0.5) * 255); od[i * 4 + 1] = Math.round((ny / l * 0.5 + 0.5) * 255);
    od[i * 4 + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); od[i * 4 + 3] = sd[i * 4 + 3];
  }
}
