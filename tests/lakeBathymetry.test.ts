import { describe, expect, it } from 'vitest';
import { GRAND_LAKE } from '../src/world/highlandLake';
import { BATHYMETRY_RANGE_METERS, lakeDepthAt, makeLakeBathymetry } from '../src/world/lakeBathymetry';

describe('bathymetry shared by rendering and collision', () => {
  it('samples real deep-water terrain and never invents depth beyond the shore', () => {
    expect(lakeDepthAt(GRAND_LAKE.x, GRAND_LAKE.z)).toBeGreaterThan(125);
    expect(lakeDepthAt(2000,2000)).toBe(0);
    expect(BATHYMETRY_RANGE_METERS).toBeGreaterThan(GRAND_LAKE.maxDepth);
  });
  it('writes a linearly filtered GPU depth texture using deterministic world sampling', () => {
    const a = makeLakeBathymetry(64,48);
    const b = makeLakeBathymetry(64,48);
    try {
      const pixelsA = a.image.data as Uint8Array;
      const pixelsB = b.image.data as Uint8Array;
      expect(Array.from(pixelsA)).toEqual(Array.from(pixelsB));
      expect(pixelsA.length).toBe(64*48*4);
      expect(pixelsA[4*(24*64+32)]).toBeGreaterThan(155);
      expect(pixelsA[0]).toBe(0);
    } finally { a.dispose(); b.dispose(); }
  });
  it('rejects invalid resolution so high-quality settings cannot accidentally exhaust memory', () => {
    expect(() => makeLakeBathymetry(0,64)).toThrow();
    expect(() => makeLakeBathymetry(64,3000)).toThrow();
  });
});
