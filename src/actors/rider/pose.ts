import type { FlightState } from '../dragon/flight';

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
    return { motion: 'mounted', leftArm: -0.28, rightArm: -0.28,
      // Rotate the thighs toward the snout instead of standing straight.
      leftLeg: 0.42, rightLeg: 0.42,
      torsoLean: -state.pitch * 0.12, breathing: 0 };
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
