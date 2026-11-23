import { describe, expect, it } from 'vitest';
import { MIRRORFALL_IMPACT, plungeCurrentAt, plungeWaveAt,
  plungeFoamAt, plungeCurrentStep, plungeVelocityAt,
  waterfallCurtainDragAt } from '../src/world/waterDynamics';
import { GRAND_LAKE, MIRRORFALL, lakeContains } from '../src/world/highlandLake';
import { newFlightState, stepFlight } from '../src/actors/dragon/flight';
import { waterfallCenterXAt } from '../src/world/waterfallTrajectory';

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
  it('adds a localized 3D plunge, radial surface transport and bounded recirculation', () => {
    const x = MIRRORFALL_IMPACT.x, z = MIRRORFALL_IMPACT.z;
    const y = GRAND_LAKE.surfaceY;
    const surface = plungeVelocityAt(x, y, z);
    const depth = plungeVelocityAt(x, y - 12, z);
    // The repositioned plunge now lies near the eastern shore: +X is dry
    // cliff bank, while -X is the navigable basin's return-current band.
    expect(lakeContains(x - 35, z)).toBe(true);
    expect(lakeContains(x + 35, z)).toBe(false);
    const rise = plungeVelocityAt(x - 35, y - 12, z);
    expect(plungeVelocityAt(x + 35, y - 12, z).magnitude).toBe(0);
    const far = plungeVelocityAt(GRAND_LAKE.x, y - 12, GRAND_LAKE.z);
    expect(surface.y).toBe(0);
    expect(depth.y).toBeLessThan(-1.0);
    expect(depth.y).toBeGreaterThan(-2.66);
    expect(rise.y).toBeGreaterThan(0.05);
    expect(Math.abs(rise.x)).toBeGreaterThan(0.25);
    expect(far.magnitude).toBe(0);
    expect(plungeVelocityAt(x, y - 100, z).magnitude).toBe(0);
    expect(plungeVelocityAt(1900, -12, 1900).magnitude).toBe(0);
    expect(plungeVelocityAt(Number.NaN, y, z).magnitude).toBe(0);
  });

  it('advects underwater swimmers down gently while permitting control and floor clearance', () => {
    const x = MIRRORFALL_IMPACT.x, z = MIRRORFALL_IMPACT.z;
    const state = newFlightState();
    state.mode = 'underwater';
    state.form = 'small';
    state.x = x;
    state.z = z;
    state.y = GRAND_LAKE.surfaceY - 10;
    state.waterTargetY = state.y;
    state.speed = 0;
    const noMove = { turn: 0, pitch: 0, bank: 0, boost: false, flap: false, move: 0 };
    stepFlight(state, noMove, 1/60);
    expect(state.waterTargetY).toBeLessThan(GRAND_LAKE.surfaceY - 10);
    const yTarget = state.waterTargetY;
    stepFlight(state, { ...noMove, bank: 1 }, 1/60);
    expect(state.waterTargetY).toBeGreaterThan(yTarget);
    const center = plungeVelocityAt(x, GRAND_LAKE.surfaceY - 10, z);
    expect(center.magnitude).toBeGreaterThan(0);
  });

  it('localizes airborne waterfall drag to the rendered curved falling sheet',()=>{
    const t=.70, y=MIRRORFALL.topY-
      (MIRRORFALL.topY-GRAND_LAKE.surfaceY)*t;
    const x=waterfallCenterXAt(t);
    const flow=waterfallCurtainDragAt(x,y,MIRRORFALL.z,3.3);
    expect(flow.strength).toBeGreaterThan(.8);
    expect(flow.x).toBeLessThan(-4);
    expect(flow.y).toBeLessThan(-5);
    expect(Math.abs(flow.z)).toBeLessThan(.1);
    expect(waterfallCurtainDragAt(x+150,y,MIRRORFALL.z).strength).toBe(0);
    expect(waterfallCurtainDragAt(x,y,MIRRORFALL.z+300).strength).toBe(0);
    expect(waterfallCurtainDragAt(x,GRAND_LAKE.surfaceY-20,MIRRORFALL.z).strength).toBe(0);
    expect(waterfallCurtainDragAt(NaN,y,MIRRORFALL.z).strength).toBe(0);
  });

  it('limits current displacement through collision and invalid timesteps', () => {
    const x=MIRRORFALL_IMPACT.x+15,z=MIRRORFALL_IMPACT.z;
    const moved=plungeCurrentStep(x,z,1/60,()=>true);
    expect(moved.x).toBeGreaterThan(x);
    expect(plungeCurrentStep(x,z,1/60,()=>false)).toEqual({x,z});
    expect(plungeCurrentStep(x,z,Infinity,()=>true)).toEqual({x,z});
  });
});
