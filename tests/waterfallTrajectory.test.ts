import { describe, expect, it } from 'vitest';
import { MIRRORFALL, GRAND_LAKE } from '../src/world/highlandLake';
import { heightAt } from '../src/world/terrain';
import { MIRRORFALL_IMPACT, waterfallCurtainDragAt } from '../src/world/waterDynamics';
import { waterfallFallFraction, waterfallCenterAt,
  WATERFALL_LIP_X, WATERFALL_POOL_X } from '../src/world/waterfallTrajectory';

describe('one gravity-inspired centerline for Mirrorfall water and collision',()=>{
  it('joins the feeder lip to the actual lake impact and keeps a monotonic fall',()=>{
    expect(waterfallFallFraction(0)).toBeCloseTo(0,8);
    expect(waterfallFallFraction(1)).toBeCloseTo(1,8);
    expect(waterfallFallFraction(-2)).toBe(0);
    expect(waterfallFallFraction(5)).toBeCloseTo(1,8);
    expect(waterfallFallFraction(Number.NaN)).toBe(0);
    const top=waterfallCenterAt(0);
    const bottom=waterfallCenterAt(1);
    expect(top.x).toBeCloseTo(WATERFALL_LIP_X,6);
    expect(top.y).toBe(MIRRORFALL.topY);
    expect(bottom.x).toBeCloseTo(WATERFALL_POOL_X,6);
    expect(bottom.x).toBeCloseTo(MIRRORFALL_IMPACT.x,6);
    expect(bottom.y).toBeCloseTo(GRAND_LAKE.surfaceY,6);
    let prev=top;
    for(let i=1;i<=100;i++){
      const p=waterfallCenterAt(i/100);
      expect(p.x).toBeLessThan(prev.x);
      expect(p.y).toBeLessThan(prev.y);
      prev=p;
    }
  });

  it('throws the curtain away from the escarpment rather than clipping through it',()=>{
    // The old t² arc kept the sheet at x≈256 when 25% of its elevation
    // was already lost, behind 170m-high rock. The new path clears it.
    for(const t of [.01,.025,.05,.10,.20,.35,.50,.75,.95]){
      const p=waterfallCenterAt(t);
      const bed=heightAt(p.x,p.z);
      expect(p.y).toBeGreaterThan(bed+.2);
      expect(waterfallCurtainDragAt(p.x,p.y,p.z,3.3).strength)
        .toBeGreaterThan(0);
    }
    const upper=waterfallCenterAt(.20);
    const oldX=WATERFALL_LIP_X+
      (WATERFALL_POOL_X-WATERFALL_LIP_X)*(.20*.20*.91+.20*.09);
    expect(upper.x).toBeLessThan(oldX-20);
    expect(heightAt(upper.x,upper.z)).toBeLessThan(upper.y);
  });
});
