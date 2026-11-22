import { describe, expect, it } from 'vitest';
import { GRAND_LAKE, waterSurfaceAt } from '../src/world/highlandLake';
import { heightAt } from '../src/world/terrain';
import { canStand, safeFlightY } from '../src/world/collision';
import { newFlightState, stepFlight, toggleLanding } from '../src/actors/dragon/flight';
import { canDragonDive, canEnterSea, dragonBottomY, dragonSurfaceY, riderCanSwim, riderSurfaceY } from '../src/world/waterPhysics';
const idle = {turn:0,pitch:0,bank:0,boost:false,flap:false,move:0};

describe('fully traversable highland freshwater lake', () => {
  it('recognizes water more than 120m deep and prevents false lake-bed landing', () => {
    const {x,z,surfaceY}=GRAND_LAKE;
    expect(surfaceY-heightAt(x,z)).toBeGreaterThan(125);
    expect(canStand(x,z,'rideable').ok).toBe(false);
    expect(canEnterSea(x,z,'rideable').ok).toBe(true);
    expect(canDragonDive(x,z,'rideable').ok).toBe(true);
    expect(riderCanSwim(x,z)).toBe(true);
    expect(dragonBottomY(x,z,'rideable')).toBeLessThan(surfaceY-100);
    expect(riderSurfaceY(x,z)).toBeCloseTo(surfaceY-0.72,5);
  });
  it('permits actual splashdown, underwater travel and surfacing at lake elevation', () => {
    const s=newFlightState();
    s.x=GRAND_LAKE.x;s.z=GRAND_LAKE.z;
    s.y=GRAND_LAKE.surfaceY+19;s.speed=0;
    expect(toggleLanding(s).ok).toBe(true);
    expect(s.transition?.phase).toBe('splashdown');
    for(let i=0;i<90;i++)stepFlight(s,idle,1/60);
    expect(s.mode).toBe('surface');
    expect(s.y).toBeCloseTo(dragonSurfaceY(s.form,s.x,s.z),3);
    expect(s.y).toBeGreaterThan(waterSurfaceAt(s.x,s.z));
    expect(safeFlightY(s.x,s.z,s.form)).toBeGreaterThan(GRAND_LAKE.surfaceY);
  });
});
