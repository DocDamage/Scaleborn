import { describe, expect, it } from 'vitest';
import { MIRRORFALL_IMPACT } from '../src/world/waterDynamics';
import { GRAND_LAKE, lakeContains, waterSurfaceAt } from '../src/world/highlandLake';
import { heightAt } from '../src/world/terrain';
import { underwaterOpticsAt } from '../src/world/underwaterOptics';

describe('shallow but navigable waterfall bubble camera',()=>{
  it('stages a real underwater view of the physical impact column',()=>{
    const x=MIRRORFALL_IMPACT.x-18,z=MIRRORFALL_IMPACT.z+5;
    const surface=waterSurfaceAt(x,z),floor=heightAt(x,z);
    expect(lakeContains(x,z)).toBe(true);
    expect(surface).toBe(GRAND_LAKE.surfaceY);
    expect(surface-floor).toBeGreaterThan(12);
    expect(surface-8).toBeGreaterThan(floor+2);
    const sample=underwaterOpticsAt(x,surface-8,z,true);
    expect(sample.medium).toBe('lake');
    expect(sample.immersion).toBe(1);
    expect(Math.hypot(x-MIRRORFALL_IMPACT.x,z-MIRRORFALL_IMPACT.z))
      .toBeLessThan(25);
  });
});
