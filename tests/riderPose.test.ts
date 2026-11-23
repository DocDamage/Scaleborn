import { describe, expect, it } from 'vitest';
import { newFlightState } from '../src/actors/dragon/flight';
import { riderPose } from '../src/actors/rider/pose';

describe('portable rider pose channels', () => {
  it('keeps mounted arms in a stable reins pose', () => {
    const s = newFlightState();
    expect(riderPose(s).motion).toBe('mounted');
    expect(riderPose(s).leftArm).toBe(riderPose(s).rightArm);
  });
  it('braces an unscaled mounted rider during banking and ground locomotion', () => {
    const s = newFlightState();
    s.roll = .4; s.pitch = .3; s.time = 1.75;
    const inFlight = riderPose(s);
    expect(inFlight.motion).toBe('mounted');
    expect(inFlight.leftArm).not.toBe(inFlight.rightArm);
    expect(inFlight.leftLeg).toBeGreaterThan(0);
    expect(inFlight.rightLeg).toBeGreaterThan(0);
    expect(inFlight.torsoLean).toBeLessThan(0);
    expect(riderPose(s)).toEqual(inFlight);
    s.roll = 0; s.pitch = 0; s.mode = 'ground'; s.speed = 4;
    s.time = .25;
    const onGround = riderPose(s);
    expect(onGround.leftArm).not.toBe(onGround.rightArm);
    expect(onGround.leftLeg).not.toBe(onGround.rightLeg);
    s.speed = 0;
    const atRest = riderPose(s);
    expect(atRest.leftArm).toBeCloseTo(atRest.rightArm);
    expect(atRest.leftLeg).toBeCloseTo(atRest.rightLeg);
    expect(atRest.breathing).toBeGreaterThan(0);
  });

  it('keeps mounted channels bounded for invalid renderer input', () => {
    const s = newFlightState();
    s.roll = Number.POSITIVE_INFINITY;
    s.pitch = Number.NaN;
    s.speed = Number.POSITIVE_INFINITY;
    s.time = Number.NaN;
    const p = riderPose(s);
    expect(Object.values(p).filter((value) => typeof value === 'number')
      .every(Number.isFinite)).toBe(true);
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
