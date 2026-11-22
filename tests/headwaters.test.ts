import { describe, expect, it } from 'vitest';
import { GRAND_LAKE, MIRRORFALL, headwaterProfileAt,
  headwaterContains, headwaterWaveAt, lakeContains, waterSurfaceAt,
} from '../src/world/highlandLake';
import { waterWaveOffsetAt } from '../src/world/waterWaves';
import { headwaterCurrentAt, plungeCurrentStep } from '../src/world/waterDynamics';
import { heightAt } from '../src/world/terrain';

describe('terrain-carved upper waterfall headwaters',()=>{
  it('keeps a navigable wet channel above the waterfall lip',()=>{
    for(const t of [0,.15,.4,.7,.92]){
      const x=MIRRORFALL.x-1+t*132;
      const profile=headwaterProfileAt(x,GRAND_LAKE.z+7*Math.sin(Math.PI*t));
      expect(profile).not.toBeNull();
      const p=profile!;
      expect(headwaterContains(x,p.centerZ)).toBe(true);
      expect(waterSurfaceAt(x,p.centerZ)).toBeCloseTo(p.surfaceY,5);
      expect(p.surfaceY).toBeGreaterThanOrEqual(MIRRORFALL.topY);
      expect(heightAt(x,p.centerZ)).toBeLessThan(p.surfaceY);
      expect(p.surfaceY-heightAt(x,p.centerZ)).toBeLessThan(5);
      expect(lakeContains(x,p.centerZ)).toBe(false);
      // Raised shoulders are outside the water's navigable volume.
      const outsideZ=p.centerZ+p.halfWidth*1.40;
      expect(headwaterContains(x,outsideZ)).toBe(false);
      expect(heightAt(x,outsideZ)).toBeGreaterThan(p.surfaceY-.4);
    }
  });

  it('rejoins normal terrain smoothly beyond the upstream source and banks',()=>{
    const x=MIRRORFALL.x+132*1.16;
    expect(headwaterProfileAt(x,GRAND_LAKE.z)).toBeNull();
    expect(waterSurfaceAt(x,GRAND_LAKE.z)).toBe(0);
    const p=headwaterProfileAt(MIRRORFALL.x+75,GRAND_LAKE.z)!;
    expect(p).not.toBeNull();
    const dryZ=p.centerZ+p.halfWidth*2.05;
    expect(headwaterProfileAt(MIRRORFALL.x+75,dryZ)).toBeNull();
    expect(waterSurfaceAt(MIRRORFALL.x+75,dryZ)).toBe(0);
    expect(heightAt(x,GRAND_LAKE.z)).toBe(
      heightAt(x,GRAND_LAKE.z));
  });

  it('adds a downhill current aligned with the curved channel, not the ocean',()=>{
    const x=MIRRORFALL.x+53;
    const p=headwaterProfileAt(x,GRAND_LAKE.z)!;
    const y=p.surfaceY-.72;
    const current=headwaterCurrentAt(x,y,p.centerZ);
    expect(current.x).toBeLessThan(-2);
    expect(current.y).toBe(0);
    expect(Math.abs(current.z)).toBeLessThan(.6);
    expect(current.magnitude).toBeLessThan(4.0);
    const moved=plungeCurrentStep(x,p.centerZ,1/60,()=>true,y);
    expect(moved.x).toBeLessThan(x);
    expect(plungeCurrentStep(x,p.centerZ,1/60,()=>false,y))
      .toEqual({x,z:p.centerZ});
    expect(headwaterCurrentAt(x,y,p.centerZ+p.halfWidth*1.05).magnitude)
      .toBe(0);
    expect(headwaterCurrentAt(x,p.surfaceY+2,p.centerZ).magnitude).toBe(0);
    expect(headwaterCurrentAt(Number.NaN,y,p.centerZ).magnitude).toBe(0);
    expect(headwaterCurrentAt(GRAND_LAKE.x,GRAND_LAKE.surfaceY,GRAND_LAKE.z)
      .magnitude).toBe(0);
  });

  it('shares gentle water motion with the rider/dragon physics sampler',()=>{
    const x=MIRRORFALL.x+55;
    const p=headwaterProfileAt(x,GRAND_LAKE.z)!;
    for(const t of [0,.33,4.12,11]){
      expect(waterWaveOffsetAt(x,p.centerZ,t))
        .toBeCloseTo(headwaterWaveAt(x,p.centerZ,t),6);
      expect(Math.abs(headwaterWaveAt(x,p.centerZ,t))).toBeLessThan(.11);
    }
    expect(headwaterWaveAt(Number.NaN,GRAND_LAKE.z,1)).toBe(0);
    expect(headwaterWaveAt(x,GRAND_LAKE.z,Number.NaN)).toBe(0);
    expect(waterSurfaceAt(GRAND_LAKE.x,GRAND_LAKE.z)).toBe(GRAND_LAKE.surfaceY);
    expect(waterSurfaceAt(1900,1900)).toBe(0);
  });
});
