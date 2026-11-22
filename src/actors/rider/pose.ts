import type { FlightState } from '../dragon/flight';
import { FORMS } from '../dragon/forms';

export type RiderMotion = 'mounted' | 'idle' | 'walk' | 'swim' | 'dive';
export interface RiderPose {
  motion: RiderMotion;
  leftArm: number;
  rightArm: number;
  leftLeg: number;
  rightLeg: number;
  torsoLean: number;
  breathing: number;
}

/** Deterministic rider pose channels for procedural bones and future GLB rigs. */
export function riderPose(state: FlightState): RiderPose {
  if (state.form !== 'small') {
    // Animation only: the seat, collision and flight controls remain owned
    // by their existing systems. Opposing reins/leg corrections help the
    // child rider brace with Onyx's banking and grounded diagonal gait.
    const t = Number.isFinite(state.time) ? state.time : 0;
    const speed = Number.isFinite(state.speed) ? Math.abs(state.speed) : 0;
    const bank = Math.max(-.8, Math.min(.8,
      Number.isFinite(state.roll) ? state.roll : 0));
    const pitch = Math.max(-.8, Math.min(.8,
      Number.isFinite(state.pitch) ? state.pitch : 0));
    const form = FORMS[state.form];
    const air = state.mode === 'air'
      ? Math.min(1, speed / form.cruise) : 0;
    const ground = state.mode === 'ground'
      ? Math.min(1, speed / form.groundSpeed) : 0;
    const phase = t * (4.5 + Math.min(5, speed * .52));
    const stride = Math.sin(phase) * ground;
    return {
      motion: 'mounted',
      leftArm: -.28 - .06 * air + .09 * bank + .045 * stride,
      rightArm: -.28 - .06 * air - .09 * bank - .045 * stride,
      // Thighs stay in a seated forward pose, not the standing walk cycle.
      leftLeg: .42 + .07 * air - .045 * bank + .035 * stride,
      rightLeg: .42 + .07 * air + .045 * bank - .035 * stride,
      torsoLean: Math.max(-.24, Math.min(.24,
        -pitch * .12 - .045 * air + .025 * ground)),
      breathing: Math.sin(t * 1.45) * .006,
    };
  }
  const swimming = state.riderMode !== 'ground';
  const diving = state.riderMode === 'underwater';
  const walking = !swimming && Math.abs(state.riderSpeed) > 0.20;
  const phase = state.time * (swimming ? 4.8 : 7.2);
  const swing = walking ? Math.min(0.65, Math.abs(state.riderSpeed) * 0.14) : 0;
  const swimStroke = Math.sin(phase) * 0.62;
  const kick = Math.sin(phase * 1.4) * 0.30;
  return {
    motion: diving ? 'dive' : swimming ? 'swim' : walking ? 'walk' : 'idle',
    leftArm: swimming ? -0.88 + swimStroke : Math.sin(phase) * swing,
    rightArm: swimming ? -0.88 - swimStroke : -Math.sin(phase) * swing,
    leftLeg: swimming ? -0.18 + kick : -Math.sin(phase) * swing * 0.72,
    rightLeg: swimming ? -0.18 - kick : Math.sin(phase) * swing * 0.72,
    torsoLean: diving ? -0.31 : swimming ? -0.13 : walking ? 0.035 : 0,
    breathing: Math.sin(state.time * 1.45) * (swimming ? 0.018 : 0.009),
  };
}
