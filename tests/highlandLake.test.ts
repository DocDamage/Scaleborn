import { describe, expect, it } from 'vitest';
import { GRAND_LAKE, MIRRORFALL, lakeContains, lakeRadius, lakeShoreDistance, waterSurfaceAt } from '../src/world/highlandLake';
import { heightAt } from '../src/world/terrain';

describe('Mirrorfall Lake common geometry contract', () => {
  it('carves a deep, stable freshwater basin distinct from the ocean', () => {
    const center = heightAt(GRAND_LAKE.x, GRAND_LAKE.z);
    expect(lakeContains(GRAND_LAKE.x, GRAND_LAKE.z)).toBe(true);
    expect(waterSurfaceAt(GRAND_LAKE.x, GRAND_LAKE.z)).toBe(GRAND_LAKE.surfaceY);
    expect(GRAND_LAKE.surfaceY - center).toBeGreaterThan(125);
    expect(heightAt(GRAND_LAKE.x, GRAND_LAKE.z)).toBe(center);
    expect(waterSurfaceAt(1900, 1900)).toBe(0);
  });
  it('provides one irregular landscape with a solid rim and waterfall summit', () => {
    const shoreX = GRAND_LAKE.x + GRAND_LAKE.radiusX * 1.17;
    expect(heightAt(shoreX, GRAND_LAKE.z)).toBeGreaterThan(GRAND_LAKE.surfaceY + 24);
    expect(MIRRORFALL.topY - GRAND_LAKE.surfaceY).toBeGreaterThan(95);
    expect(heightAt(-555, 100)).toBeGreaterThan(50);
  });
  it('anchors the waterfall crest to the actual summit, with impact inside lake',()=>{
    const lip=heightAt(MIRRORFALL.x-1,MIRRORFALL.z);
    expect(Math.abs(lip-MIRRORFALL.topY)).toBeLessThan(9);
    expect(MIRRORFALL.topY-lip).toBeGreaterThan(0);
    const plungeX=MIRRORFALL.x-82;
    expect(lakeContains(plungeX,MIRRORFALL.z)).toBe(true);
    expect(GRAND_LAKE.surfaceY-heightAt(plungeX,MIRRORFALL.z))
      .toBeGreaterThan(10);
    expect(MIRRORFALL.topY-GRAND_LAKE.surfaceY).toBeGreaterThan(100);
  });
  it('does not introduce seam discontinuities at the sculpt radius boundary', () => {
    const z = GRAND_LAKE.z;
    const a = heightAt(GRAND_LAKE.x + GRAND_LAKE.radiusX * 1.715, z);
    const b = heightAt(GRAND_LAKE.x + GRAND_LAKE.radiusX * 1.725, z);
    expect(Math.abs(a - b)).toBeLessThan(15);
    expect(lakeShoreDistance(GRAND_LAKE.x, z)).toBeLessThan(0);
    expect(lakeRadius(GRAND_LAKE.x, z)).toBe(0);
  });
});
