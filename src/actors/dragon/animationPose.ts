import type { FlightState } from './flight';
import { FORMS } from './forms';
import { traversalProgress } from './traversalTransition';

export type DragonAnimationName =
  'rest' | 'walk' | 'fly' | 'surge' | 'land' | 'launch'
  | 'splash' | 'breach' | 'swim' | 'dive';

export interface DragonPose {
  name: DragonAnimationName;
  flapPhase: number;
  flapAmount: number;
  /** 0: fully spread; 1: wings folded along body */
  wingFold: number;
  gaitPhase: number;
  gaitAmount: number;
  neckAngle: number;
  tailAngle: number;
  bodyBob: number;
  riderLean: number;
}

const ease = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Portable pose channels, no knowledge of Three.js, water shaders or assets. */
export function dragonPose(state: FlightState): DragonPose {
  const phase = state.transition?.phase;
  const progress = traversalProgress(state);
  const landing = phase === 'landing';
  const takingOff = phase === 'takingOff';
  const splashdown = phase === 'splashdown';
  const breaching = phase === 'waterLaunch';
  const swimmer = state.mode === 'surface' || state.mode === 'underwater';
  const submerged = state.mode === 'underwater';
  const walking = state.mode === 'ground' && Math.abs(state.speed) > 0.3;
  const fast = state.speed > FORMS[state.form].cruise * 1.25;

  const name: DragonAnimationName = landing ? 'land' : takingOff ? 'launch'
    : splashdown ? 'splash' : breaching ? 'breach'
      : submerged ? 'dive' : swimmer ? 'swim'
        : walking ? 'walk' : state.mode === 'ground' ? 'rest'
          : fast ? 'surge' : 'fly';
  const wingFold = landing ? ease(progress) :
    takingOff ? 1 - ease(progress) :
      splashdown ? 0.85 * ease(progress) :
        breaching ? 0.85 * (1 - ease(progress)) :
          swimmer ? (submerged ? 0.88 : 0.72) : state.mode === 'ground' ? 1 : 0;

  const flapPhase = state.time * (takingOff || breaching ? 10.4 : fast ? 9 : swimmer ? 3.9 : 5.7);
  const gaitPhase = state.time * (4.5 + Math.min(5, Math.abs(state.speed) * 0.52));
  const gaitAmount = walking ? clamp01(Math.abs(state.speed) / FORMS[state.form].groundSpeed) : 0;
  const flapAmount = landing ? 0.5 * (1 - ease(progress)) :
    takingOff ? 0.28 + 0.42 * ease(progress) :
      splashdown ? 0.22 * (1 - ease(progress)) :
        breaching ? 0.25 + 0.37 * ease(progress) :
          swimmer ? (submerged ? 0.13 : 0.16) :
            state.mode === 'air' ? (fast ? 0.49 : 0.31) : 0;
  return {
    name,
    flapPhase,
    flapAmount,
    wingFold,
    gaitPhase,
    gaitAmount,
    neckAngle: (walking ? -0.07 : submerged ? -0.14 : swimmer ? -0.03 :
      state.mode === 'air' ? 0.04 : -0.01) + Math.sin(state.time * 0.9) * 0.018,
    tailAngle: Math.sin(state.time * (swimmer ? 5.4 : walking ? 3.1 : 2.1))
      * (swimmer ? 0.23 : 0.11) - state.roll * 0.18,
    bodyBob: walking ? Math.abs(Math.sin(gaitPhase)) * 0.065 * gaitAmount
      : state.mode === 'ground' ? Math.sin(state.time * 1.45) * 0.014
        : swimmer ? Math.sin(state.time * 2.8) * 0.03 : 0,
    riderLean: -state.roll * 0.24 + ((takingOff || breaching) ? -0.16 * (1 - progress) : 0),
  };
}
