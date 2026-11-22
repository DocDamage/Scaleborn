import { describe, expect, it } from 'vitest';
import { GRAND_LAKE, lakeContains } from '../src/world/highlandLake';
import { heightAt } from '../src/world/terrain';
import { dragonBottomY } from '../src/world/waterPhysics';

describe('actual shallow lakebed browser visual acceptance site',()=>{
  it('places a deep-breathing dragon above a navigable planted freshwater shelf',()=>{
    const x=GRAND_LAKE.x-GRAND_LAKE.radiusX*.905;
    const z=GRAND_LAKE.z;
    const bed=heightAt(x,z);
    const depth=GRAND_LAKE.surfaceY-bed;
    expect(lakeContains(x,z)).toBe(true);
    expect(depth).toBeGreaterThan(8);
    expect(depth).toBeLessThan(25);
    const eye=bed+5.5;
    expect(eye).toBeGreaterThan(dragonBottomY(x,z,'rideable'));
    expect(eye).toBeLessThan(GRAND_LAKE.surfaceY-5);
    // Face west toward the shallow shelf, with chase camera inside lake.
    expect(lakeContains(x+10,z)).toBe(true);
    expect(heightAt(x-10,z)).toBeGreaterThan(bed);
  });
});
