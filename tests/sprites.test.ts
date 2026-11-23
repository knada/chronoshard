// The sprite sheets the game ships match their masters and cover everything the game draws from them.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { DUALS, ENEMIES, HEROES, ITEMS, MAPS } from '../src/data.js';
import { NPC_ALIAS, SPEAKER_ALIAS } from '../src/sheets.js';
import { PORTRAIT_OF } from '../src/sprites.js';
import { storyScripts } from './helpers.js';

interface Entry { name: string; file: string; columns: number; rows: number; pivot: { x: number; y: number }; frames: string[]; gameId?: string; scale?: number }
interface Manifest { frameSize: { width: number; height: number }; collections: Record<string, Entry[]> }
const root = join(import.meta.dirname, '..');
const read = (dir: string): Manifest => JSON.parse(readFileSync(join(root, dir, 'manifest.json'), 'utf8'));
const masters = read('sprite-sheets'), shipped = read('sprite-sheets-webp');
const { width: FW, height: FH } = shipped.frameSize;
const sheets = Object.entries(shipped.collections).flatMap(([collection, list]) => list.map(e => ({ collection, ...e })));

/** a WebP's pixel size, from its header (lossy, lossless or extended format) */
function webpSize(file: string): [number, number] {
  const b = readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`${file} is not a WebP`);
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (chunk === 'VP8L') { const bits = b.readUInt32LE(21); return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)]; }
  if (chunk === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  throw new Error(`${file}: unknown WebP chunk ${chunk}`);
}

test('the shipped manifest lists the same sheets as the masters, with the same frames and pivots', () => {
  expect(shipped.frameSize).toEqual(masters.frameSize);
  const strip = (m: Manifest) => Object.fromEntries(Object.entries(m.collections).map(([c, list]) =>
    [c, list.map(e => ({ name: e.name, columns: e.columns, rows: e.rows, pivot: e.pivot, frames: e.frames, file: e.file.replace(/\.\w+$/, '') }))]));
  expect(strip(shipped)).toEqual(strip(masters));
});

describe.each(sheets.map(s => [s.file, s] as [string, (typeof sheets)[number]]))('%s', (_file, s) => {
  test('is a WebP whose size fits its grid at its scale', () => {
    const k = s.scale ?? 1, file = join(root, 'sprite-sheets-webp', s.file);
    expect(s.file.endsWith('.webp')).toBe(true);
    expect(existsSync(file)).toBe(true);
    expect(Number.isInteger(FW * k) && Number.isInteger(FH * k), 'each frame is a whole number of pixels').toBe(true);
    expect(webpSize(file)).toEqual([s.columns * FW * k, s.rows * FH * k]);
  });
  test('has one name per frame, and its pivot inside the frame', () => {
    expect(s.frames.length).toBeLessThanOrEqual(s.columns * s.rows);
    expect(s.frames.length).toBeGreaterThan(s.columns * (s.rows - 1));
    expect(s.pivot.x).toBeGreaterThanOrEqual(0); expect(s.pivot.x).toBeLessThanOrEqual(FW);
    expect(s.pivot.y).toBeGreaterThanOrEqual(0); expect(s.pivot.y).toBeLessThanOrEqual(FH);
  });
});

describe('every drawn thing has a sheet', () => {
  const names = (c: string) => new Set(shipped.collections[c].map(e => e.name));
  const chars = new Set(shipped.collections.characters.flatMap(e => [e.gameId, e.name]));

  test('enemies', () => {
    const have = names('enemies');
    expect(Object.values(ENEMIES).map(k => k.name).filter(n => !have.has(n))).toEqual([]);
  });

  test('effects: attacks, running, techs, dual techs, enemy moves and items', () => {
    const have = names('effects');
    const used = ['Basic Attack', 'Run', ...Object.values(HEROES).flatMap(h => h.techs.map(t => t.name)), ...DUALS.map(d => d.name),
      ...Object.values(ENEMIES).flatMap(k => k.moves.map(m => m.name)), ...Object.values(ITEMS).map(i => i.name)];
    expect([...new Set(used)].filter(n => !have.has(n))).toEqual([]);
  });

  test('party members and every NPC', () => {
    const ids = [...Object.keys(HEROES), ...Object.values(MAPS).flatMap(m => (m.npcs ?? []).map(n => n.id))];
    expect(ids.filter(id => !chars.has(NPC_ALIAS[id] ?? id))).toEqual([]);
  });

  test('the chest', () => expect(shipped.collections.props?.some(e => e.gameId === 'chest')).toBe(true));

  test('every named speaker with a portrait', () => {
    const speakers = new Set(storyScripts().flatMap(({ script }) => script.flatMap(c => (c[0] === 'say' ? [c[1]] : []))));
    // the Hollow King's portrait is drawn from his enemy sheet; '' is the narrator and '???' a speaker not yet met
    const drawn = [...speakers].filter(n => n && n !== '???' && n !== 'Hollow King');
    expect(drawn.length).toBeGreaterThan(5);
    expect(drawn.filter(n => !chars.has(SPEAKER_ALIAS[n] ?? n)), 'speakers without a character sheet').toEqual([]);
    expect(drawn.filter(n => !PORTRAIT_OF[n]), 'speakers without a portrait').toEqual([]);
  });
});
