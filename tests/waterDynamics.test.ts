import { describe, expect, it } from 'vitest';
import { MIRRORFALL_IMPACT, plungeCurrentAt, plungeWaveAt,
  plungeFoamAt, plungeCurrentStep } from '../src/world/waterDynamics';
import { GRAND_LAKE, lakeContains } from '../src/world/highlandLake';
import { newFlightState, stepFlight } from '../src/actors/dragon/flight';

describe('Mirrorfall waterfall-to-lake coupling', () => {
  it('pushes swimmers from the impact with bounded finite velocity', () => {
    const p=plungeCurrentAt(MIRRORFALL_IMPACT.x+10,MIRRORFALL_IMPACT.z);
    expect(p.magnitude).toBeGreaterThan(1.5);
    expect(p.magnitude).toBeLessThanOrEqual(MIRRORFALL_IMPACT.maxCurrent);
    expect(p.x).toBeGreaterThan(0);
    expect(Number.isFinite(p.z)).toBe(true);
    expect(plungeCurrentAt(1900,1900).magnitude).toBe(0);
    expect(plungeCurrentAt(GRAND_LAKE.x,GRAND_LAKE.z).magnitude).toBe(0);
  });
  it('produces decaying travelling impact waves and stronger foam at the plunge', () => {
    const x=MIRRORFALL_IMPACT.x,z=MIRRORFALL_IMPACT.z;
    expect(lakeContains(x,z)).toBe(true);
    expect(plungeFoamAt(x,z)).toBeGreaterThan(0.95);
    expect(plungeFoamAt(GRAND_LAKE.x,GRAND_LAKE.z)).toBe(0);
    expect(plungeWaveAt(x,z,0)).toBeCloseTo(0,6);
    expect(Math.abs(plungeWaveAt(x,z,1))).toBeGreaterThan(0.15);
  });
  it('couples real dragon swimming motion to the waterfall plume', () => {
    const state=newFlightState();
    state.mode='surface';
    state.x=MIRRORFALL_IMPACT.x+14;
    state.z=MIRRORFALL_IMPACT.z;
    state.y=GRAND_LAKE.surfaceY+.45;
    state.waterTargetY=state.y;
    state.speed=0;
    const x=state.x;
    stepFlight(state,{turn:0,pitch:0,bank:0,boost:false,flap:false,move:0},1/60);
    expect(state.x).toBeGreaterThan(x);
  });
  it('limits current displacement through collision and invalid timesteps', () => {
    const x=MIRRORFALL_IMPACT.x+15,z=MIRRORFALL_IMPACT.z;
    const moved=plungeCurrentStep(x,z,1/60,()=>true);
    expect(moved.x).toBeGreaterThan(x);
    expect(plungeCurrentStep(x,z,1/60,()=>false)).toEqual({x,z});
    expect(plungeCurrentStep(x,z,Infinity,()=>true)).toEqual({x,z});
  });
});
