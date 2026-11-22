import { describe, expect, it } from 'vitest';
import {
  FAR_SEGMENTS, NEAR_SEGMENTS, TILE_METERS, lodSegments, stitchedHeight, tileSpec,
} from '../src/world/tileLod';
import { heightAt } from '../src/world/terrain';

const tolerance = 0.000001;
describe('seam-aware streamed terrain', () => {
  it('uses two powers-of-two compatible resolutions', () => {
    expect(NEAR_SEGMENTS % FAR_SEGMENTS).toBe(0);
    expect(lodSegments(0, 0, 2, 2)).toBe(NEAR_SEGMENTS);
    expect(lodSegments(0, 0, 3, 2)).toBe(FAR_SEGMENTS);
  });
  it('keeps all coincident high/high and high/low vertices identical', () => {
    for (const viewX of [-2, 0, 2]) {
      const viewZ = 0;
      for (let tx = -3; tx < 3; tx++) {
        for (const tz of [-3, 0, 2]) {
          const a = tileSpec(viewX, viewZ, tx, tz);
          const b = tileSpec(viewX, viewZ, tx + 1, tz);
          for (let step = 0; step <= Math.min(a.segments, b.segments); step++) {
            const t = step / Math.min(a.segments, b.segments);
            const ay = stitchedHeight(tx, tz, a.segments, t * a.segments, a);
            const by = stitchedHeight(tx + 1, tz, 0, t * b.segments, b);
            expect(Math.abs(ay - by)).toBeLessThan(tolerance);
          }
        }
      }
    }
  });
  it('interpolates fine edges onto the coarse mesh between coarse vertices', () => {
    const fine = tileSpec(0, 0, 2, 0);
    const coarse = tileSpec(0, 0, 3, 0);
    expect(fine.segments).toBe(64);
    expect(coarse.segments).toBe(16);
    for (let row = 0; row <= 64; row++) {
      const t = row / 4;
      const low = Math.min(15, Math.floor(t));
      const frac = t - low;
      const zA = (0 + low / 16) * TILE_METERS;
      const zB = (0 + (low + 1) / 16) * TILE_METERS;
      const expected = heightAt(3 * TILE_METERS, zA) * (1 - frac)
        + heightAt(3 * TILE_METERS, zB) * frac;
      expect(stitchedHeight(2, 0, 64, row, fine)).toBeCloseTo(expected, 6);
    }
  });
  it('never reads outside bounds on a high-to-low corner', () => {
    const edge = tileSpec(0, 0, 2, 2);
    expect(Number.isFinite(stitchedHeight(2, 2, 64, 64, edge))).toBe(true);
    expect(stitchedHeight(2, 2, 64, 64, edge)).toBeCloseTo(heightAt(750, 750), 6);
  });
  it('uses the same world positions for north/south neighbor boundaries', () => {
    const high = tileSpec(0, 0, 0, 2);
    const low = tileSpec(0, 0, 0, 3);
    for (let col = 0; col <= low.segments; col++) {
      const n = col / low.segments;
      const a = stitchedHeight(0, 2, n * high.segments, high.segments, high);
      const b = stitchedHeight(0, 3, n * low.segments, 0, low);
      expect(a).toBeCloseTo(b, 6);
    }
  });
});
