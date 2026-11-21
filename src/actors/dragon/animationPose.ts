import type { FlightState } from './flight';
import { FORMS } from './forms';
import { traversalProgress } from './traversalTransition';

export type DragonAnimationName =
  'rest' | 'walk' | 'fly' | 'surge' | 'land' | 'launch';

/** Pose channels are normalized parameters, independent of Three.js or any rig. */
export interface DragonPose {
  name: DragonAnimationName;
  flapPhase: number;
  flapAmount: number;
  /** 0 fully spread / 1 wings folded */
  wingFold: number;
  gaitPhase: number;
  gaitAmount: number;
  neckAngle: number;
  tailAngle: number;
  bodyBob: number;
  riderLean: number;
}

const ease = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function dragonPose(state: FlightState): DragonPose {
  const walking = state.mode === 'ground' && Math.abs(state.speed) > 0.3;
  const fast = state.speed > FORMS[state.form].cruise * 1.25;
  const transition = state.transition;
  const progress = traversalProgress(state);
  const takeoff = transition?.phase === 'takingOff';
  const landing = transition?.phase === 'landing';
  const fold = takeoff ? 1 - ease(progress) : landing ? ease(progress)
    : state.mode === 'ground' ? 1 : 0;
  const name: DragonAnimationName = takeoff ? 'launch' : landing ? 'land'
    : walking ? 'walk' : state.mode === 'ground' ? 'rest' : fast ? 'surge' : 'fly';
  const flapPhase = state.time * (takeoff ? 10.4 : fast ? 9 : 5.7);
  const gaitPhase = state.time * (4.5 + Math.min(5, Math.abs(state.speed) * 0.52));
  const gaitAmount = walking ? clamp01(Math.abs(state.speed) / FORMS[state.form].groundSpeed) : 0;
  const flapAmount = transition ? (takeoff ? 0.28 + 0.42 * ease(progress)
    : 0.50 * (1 - ease(progress))) : state.mode === 'air' ? (fast ? 0.49 : 0.31) : 0;
  return {
    name,
    flapPhase,
    flapAmount,
    wingFold: fold,
    gaitPhase,
    gaitAmount,
    neckAngle: (walking ? -0.07 : state.mode === 'air' ? 0.04 : -0.01)
      + Math.sin(state.time * 0.9) * 0.018,
    tailAngle: Math.sin(state.time * (walking ? 3.1 : 2.1)) * 0.11 - state.roll * 0.18,
    bodyBob: walking ? Math.abs(Math.sin(gaitPhase)) * 0.065 * gaitAmount :
      state.mode === 'ground' ? Math.sin(state.time * 1.45) * 0.014 : 0,
    riderLean: -state.roll * 0.24 + (takeoff ? -0.16 * (1 - progress) : 0),
  };
}
