import { describe, expect, it } from 'vitest';
import { GRAND_LAKE } from '../src/world/highlandLake';
import { waterWaveOffsetAt, sampleWaterWaves } from '../src/world/waterWaves';
import { MIRRORFALL_IMPACT } from '../src/world/waterDynamics';

describe('CPU water movement agrees with rendered waves',()=>{
  it('gives a deterministic, time-varying surface above sea level and above Mirrorfall',()=>{
    const sea=sampleWaterWaves(1900,1900,1.5);
    const lake=sampleWaterWaves(GRAND_LAKE.x,GRAND_LAKE.z,1.5);
    expect(lake.surfaceY).toBeGreaterThan(59);
    expect(sea.surfaceY).toBeGreaterThan(-3);
    expect(lake.surfaceY).toBeLessThan(65);
    expect(waterWaveOffsetAt(1900,1900,2)).toBe(waterWaveOffsetAt(1900,1900,2));
    expect(waterWaveOffsetAt(1900,1900,1)).not.toBe(waterWaveOffsetAt(1900,1900,2));
  });
  it('damps the waterfall disturbance with distance and includes finite slopes',()=>{
    const fall=sampleWaterWaves(MIRRORFALL_IMPACT.x+15,MIRRORFALL_IMPACT.z,2);
    const far=sampleWaterWaves(GRAND_LAKE.x,GRAND_LAKE.z,2);
    expect(Number.isFinite(fall.slopeX)).toBe(true);
    expect(Number.isFinite(fall.slopeZ)).toBe(true);
    expect(Math.abs(fall.offsetY-far.offsetY)).toBeLessThan(4);
  });
  it('returns a harmless default when coordinates or time are invalid',()=>{
    expect(waterWaveOffsetAt(Infinity,0,1)).toBe(0);
    expect(waterWaveOffsetAt(0,NaN,1)).toBe(0);
  });
});
