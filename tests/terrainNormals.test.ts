import { describe, expect, it } from 'vitest';
import { heightfieldNormalAt, seamNormalWeight } from '../src/world/terrainNormals';

describe('tile-independent terrain lighting', () => {
  it('returns a finite upward-facing unit normal for cliffs, lake and coast', () => {
    for (const [x, z] of [[-550, 100], [330, 740], [1400, 1400], [200, -600]]) {
      const normal = heightfieldNormalAt(x, z);
      expect(normal.every(Number.isFinite)).toBe(true);
      expect(Math.hypot(...normal)).toBeCloseTo(1, 8);
      expect(normal[1]).toBeGreaterThan(0);
      expect(heightfieldNormalAt(x, z)).toEqual(normal);
    }
  });

  it('fades the same analytic normal inward from every tile edge', () => {
    expect(seamNormalWeight(0, 8, 16)).toBe(1);
    expect(seamNormalWeight(16, 8, 16)).toBe(1);
    expect(seamNormalWeight(8, 0, 16)).toBe(1);
    expect(seamNormalWeight(8, 16, 16)).toBe(1);
    expect(seamNormalWeight(1, 8, 16)).toBeCloseTo(0.58);
    expect(seamNormalWeight(2, 8, 16)).toBeCloseTo(0.20);
    expect(seamNormalWeight(3, 8, 16)).toBe(0);
    expect(() => seamNormalWeight(20, 8, 16)).toThrow();
    expect(() => heightfieldNormalAt(0, 0, 0)).toThrow();
  });
});
