import type { FlightState } from './flight';

/** A renderer-neutral and save-friendly physical motion phase. */
export type TraversalPhase = 'landing' | 'takingOff';

export interface TraversalTransition {
  phase: TraversalPhase;
  elapsed: number;
  duration: number;
  startY: number;
  targetY: number;
  startSpeed: number;
  targetSpeed: number;
  startPitch: number;
  targetPitch: number;
  startRoll: number;
}

export const LANDING_DURATION = 1.45;
export const TAKEOFF_DURATION = 1.15;

const ease = (t: number): number => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Start the action without teleporting the physics body. */
export function beginTraversal(
  state: FlightState,
  phase: TraversalPhase,
  targetY: number,
  targetSpeed: number,
): void {
  state.transition = {
    phase,
    elapsed: 0,
    duration: phase === 'landing' ? LANDING_DURATION : TAKEOFF_DURATION,
    startY: state.y,
    targetY,
    startSpeed: state.speed,
    targetSpeed,
    startPitch: state.pitch,
    targetPitch: phase === 'landing' ? 0 : 0.12,
    startRoll: state.roll,
  };
  state.mode = phase === 'landing' ? 'ground' : 'air';
}

/** Return true if a transition was in progress during this simulation step. */
export function advanceTraversal(state: FlightState, dt: number): boolean {
  const motion = state.transition;
  if (!motion) return false;
  if (!Number.isFinite(dt) || dt <= 0) return true;
  motion.elapsed = Math.min(motion.duration, motion.elapsed + dt);
  const progress = motion.elapsed / motion.duration;
  const amount = ease(progress);
  state.y = lerp(motion.startY, motion.targetY, amount);
  state.speed = lerp(motion.startSpeed, motion.targetSpeed, amount);
  state.pitch = lerp(motion.startPitch, motion.targetPitch, amount);
  state.roll = lerp(motion.startRoll, 0, amount);
  if (motion.elapsed >= motion.duration) {
    state.y = motion.targetY;
    state.speed = motion.targetSpeed;
    state.pitch = motion.targetPitch;
    state.roll = 0;
    state.transition = null;
  }
  return true;
}

export function traversalProgress(state: FlightState): number {
  const motion = state.transition;
  return motion ? Math.min(1, Math.max(0, motion.elapsed / motion.duration)) : 1;
}
