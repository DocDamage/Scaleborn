import { describe, expect, it } from 'vitest';
import { newFlightState } from '../src/actors/dragon/flight';
import { riderPose } from '../src/actors/rider/pose';

describe('portable rider pose channels', () => {
  it('keeps mounted arms in a stable reins pose', () => {
    const s = newFlightState();
    expect(riderPose(s).motion).toBe('mounted');
    expect(riderPose(s).leftArm).toBe(riderPose(s).rightArm);
  });
  it('moves opposing limbs on foot without animating the grounded idle', () => {
    const s = newFlightState();
    s.form = 'small'; s.riderMode = 'ground'; s.time = 0.35;
    s.riderSpeed = 3;
    const walk = riderPose(s);
    expect(walk.motion).toBe('walk');
    expect(walk.leftArm).toBeCloseTo(-walk.rightArm, 6);
    s.riderSpeed = 0;
    expect(riderPose(s).motion).toBe('idle');
    expect(riderPose(s).leftArm).toBe(0);
  });
  it('strokes and kicks in water, with a deeper dive posture', () => {
    const s = newFlightState();
    s.form = 'small'; s.riderMode = 'surface'; s.time = 0.4;
    const surface = riderPose(s);
    expect(surface.motion).toBe('swim');
    expect(surface.leftArm).not.toBe(surface.rightArm);
    s.riderMode = 'underwater';
    const dive = riderPose(s);
    expect(dive.motion).toBe('dive');
    expect(dive.torsoLean).toBeLessThan(surface.torsoLean);
    expect(dive.leftLeg).not.toBe(dive.rightLeg);
  });
});
