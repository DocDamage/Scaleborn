import { describe, expect, it } from 'vitest';
import { newFlightState, stepFlight } from '../src/actors/dragon/flight';
import { GRAND_LAKE, MIRRORFALL, headwaterContains, waterSurfaceAt }
  from '../src/world/highlandLake';
import { heightAt } from '../src/world/terrain';
import { riderSurfaceY } from '../src/world/waterPhysics';

const headingWest={
  turn:0,pitch:0,bank:0,boost:false,flap:false,move:1,
};

describe('young rider exits shallow elevated water without cliff snapping',()=>{
  it('prevents stepping down a steep dry river lip in a single swimming tick',()=>{
    const state=newFlightState();
    state.form='small';
    state.mode='ground';
    state.controlTarget='rider';
    state.riderMode='surface';
    const lip=MIRRORFALL.x-1;
    state.riderX=lip+.18;
    state.riderZ=MIRRORFALL.z;
    state.riderY=riderSurfaceY(state.riderX,state.riderZ);
    state.riderTargetY=state.riderY;
    state.riderYaw=-Math.PI/2;
    state.riderSpeed=2.8;
    expect(headwaterContains(state.riderX,state.riderZ)).toBe(true);
    const x=state.riderX;
    for(let i=0;i<60;i++)stepFlight(state,headingWest,1/60);
    expect(state.riderX).toBeLessThan(x);
    expect(state.riderX).toBeGreaterThanOrEqual(lip-.002);
    expect(state.riderMode).toBe('surface');
    expect(state.riderY).toBeGreaterThan(MIRRORFALL.topY-1.8);
    expect(Number.isFinite(state.riderY)).toBe(true);
  });

  it('preserves ordinary dry shorewalking and denies unrelated groundwater',()=>{
    const p=newFlightState();
    p.form='small';p.mode='ground';p.controlTarget='rider';
    p.riderMode='ground';p.riderX=-555;p.riderZ=100;
    p.riderY=heightAt(p.riderX,p.riderZ)+.05;
    p.riderTargetY=p.riderY;
    p.riderSpeed=0;p.riderYaw=0;
    for(let i=0;i<20;i++)stepFlight(p,{...headingWest,move:0},1/60);
    expect(p.riderMode).toBe('ground');
    expect(p.riderY).toBeCloseTo(heightAt(p.riderX,p.riderZ)+.05,5);
    expect(waterSurfaceAt(GRAND_LAKE.x,GRAND_LAKE.z)).toBe(GRAND_LAKE.surfaceY);
  });
});
