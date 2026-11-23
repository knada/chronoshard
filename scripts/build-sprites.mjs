// Turns the drawn PNG sprite sheets (sprite-sheets/, the master copies) into the WebP sheets the game loads
// (sprite-sheets-webp/), each downscaled as far as it can go without losing detail on screen. Writes a matching
// manifest.json that records every sheet's scale, so the game can place frames and pivots on the smaller sheets.
// Needs `cwebp` (brew install webp). Only sheets whose PNG (or this script) changed are re-encoded; pass --force to
// redo them all.  Usage: npm run sprites
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'sprite-sheets'), OUT = join(root, 'sprite-sheets-webp');
const force = process.argv.includes('--force');

/**
 * Sheet pixels kept per original pixel. Measured in the game: the most screen pixels one original sheet pixel ever
 * covers (the 3D world renders at a fixed 1284x720; perspective near the bottom of the view adds up to ~25%):
 * characters 0.34 in the world, but dialogue portraits crop the head and already enlarge it 1.6-2.5x, so they stay
 * full size; effects 0.39; the chest 0.26; enemies from 0.30 (Gloop) to 0.87 (Mossback Golem). Each sheet is cut as
 * far as it can go while it still has at least one pixel for every screen pixel it covers.
 */
const SCALE = { characters: 1, enemies: 0.5, effects: 0.5, props: 0.5 };
const ENEMY_SCALE = { Thornling: 0.75, Rustbot: 0.75, Sentinel: 0.75, 'Mossback Golem': 1, 'The Hollow King': 1 };
/** lossy WebP at quality 90 with lossless alpha measures ~48 dB PSNR on these sheets: indistinguishable by eye */
const CWEBP = ['-q', '90', '-alpha_q', '100', '-m', '6', '-sharp_yuv', '-quiet', '-mt'];

/** a PNG's size, from its header */
function pngSize(file) {
  const b = readFileSync(file).subarray(0, 24);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

const manifest = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'));
const { width: FW, height: FH } = manifest.frameSize;
const scriptTime = statSync(fileURLToPath(import.meta.url)).mtimeMs;
const jobs = [];
for (const [collection, entries] of Object.entries(manifest.collections)) {
  for (const e of entries) {
    const scale = collection === 'enemies' ? ENEMY_SCALE[e.name] ?? SCALE.enemies : SCALE[collection] ?? 1;
    const src = join(SRC, e.file), file = e.file.replace(/\.png$/i, '.webp'), out = join(OUT, file);
    const [w, h] = pngSize(src);
    if (w !== e.columns * FW || h !== e.rows * FH) console.warn(`${e.file}: ${w}x${h}, expected ${e.columns * FW}x${e.rows * FH}`);
    // frames stay whole pixels wide so each one starts exactly on its grid cell
    if (!Number.isInteger(FW * scale) || !Number.isInteger(FH * scale)) throw new Error(`${e.name}: scale ${scale} splits a frame`);
    e.file = file; e.scale = scale;
    const stale = force || !existsSync(out) || statSync(out).mtimeMs < Math.max(statSync(src).mtimeMs, scriptTime);
    if (stale) jobs.push({ src, out, w: Math.round(w * scale), h: Math.round(h * scale), scale });
  }
}

let done = 0, before = 0, after = 0;
async function encode({ src, out, w, h, scale }) {
  mkdirSync(dirname(out), { recursive: true });
  const resize = scale === 1 ? [] : ['-resize', String(w), String(h)];
  await run('cwebp', [...CWEBP, ...resize, src, '-o', out]);
  before += statSync(src).size; after += statSync(out).size;
  process.stdout.write(`\r${++done}/${jobs.length} sheets`);
}
const queue = [...jobs];
await Promise.all(Array.from({ length: Math.max(1, Math.min(cpus().length, 8)) }, async () => {
  for (let j; (j = queue.shift());) await encode(j);
}));
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
if (jobs.length) console.log(`\r${jobs.length} sheets: ${(before / 1048576).toFixed(1)} MB of PNG -> ${(after / 1048576).toFixed(1)} MB of WebP`);
else console.log('WebP sheets are up to date');
