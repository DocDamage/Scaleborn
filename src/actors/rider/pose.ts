import type { FlightState } from '../dragon/flight';
import { FORMS } from '../dragon/forms';

export type RiderMotion = 'mounted' | 'idle' | 'walk' | 'swim' | 'dive';
export interface RiderPose {
  motion: RiderMotion;
  leftArm: number;
  rightArm: number;
  leftLeg: number;
  rightLeg: number;
  leftElbow: number;
  rightElbow: number;
  leftWrist: number;
  rightWrist: number;
  leftKnee: number;
  rightKnee: number;
  leftAnkle: number;
  rightAnkle: number;
  /** Abduction of each thigh away from the dragon centerline (radians). */
  legSpread: number;
  /** Counter-rotation at the knees, opposing thigh abduction. */
  kneeSpread: number;
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
    const transition = state.transition?.phase;
    const landingBrace = transition === 'landing' || transition === 'splashdown'
      ? .13 : 0;
    const launchBrace = transition === 'takingOff' || transition === 'waterLaunch'
      ? .10 : 0;
    // Onyx's giant back is broader than this 1.52 m child. There is no
    // anatomically possible full straddle: fold the shins forward onto his
    // back in giant form; rideable form drapes the shins outside the flank.
    const giant = state.form === 'giant';
    return {
      motion: 'mounted',
      // Shoulders reach toward Onyx's shoulder/mane; elbows bend the
      // forearms forward instead of swinging two straight sleeves backward.
      leftArm: .49 + .06 * air + .08 * bank + .035 * stride + landingBrace,
      rightArm: .49 + .06 * air - .08 * bank - .035 * stride + landingBrace,
      leftElbow: .31 + .06 * air - .09 * bank + launchBrace,
      rightElbow: .31 + .06 * air + .09 * bank + launchBrace,
      leftWrist: -.19 - .05 * air + .025 * bank,
      rightWrist: -.19 - .05 * air - .025 * bank,
      // True knees turn the lower legs down the flank, retaining a planted
      // pelvis and avoiding a straight-legged 'standing on dragon' silhouette.
      leftLeg: (giant ? 1.35 : .78) + .035 * air - .028 * bank + .02 * stride,
      rightLeg: (giant ? 1.35 : .78) + .035 * air + .028 * bank - .02 * stride,
      leftKnee: (giant ? .36 : -1.02) + .045 * bank - .03 * stride,
      rightKnee: (giant ? .36 : -1.02) - .045 * bank + .03 * stride,
      leftAnkle: (giant ? -.28 : .27) + .025 * stride - .02 * bank,
      rightAnkle: (giant ? -.28 : .27) - .025 * stride + .02 * bank,
      legSpread: giant ? .20 : .90,
      kneeSpread: giant ? -.04 : -.13,
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
  const leftStep = Math.sin(phase) * swing;
  const rightStep = -leftStep;
  return {
    motion: diving ? 'dive' : swimming ? 'swim' : walking ? 'walk' : 'idle',
    leftArm: swimming ? -0.88 + swimStroke : leftStep,
    rightArm: swimming ? -0.88 - swimStroke : rightStep,
    leftElbow: swimming ? .19 + .13 * swimStroke : .06 * swing,
    rightElbow: swimming ? .19 - .13 * swimStroke : .06 * swing,
    leftWrist: swimming ? .10 : 0,
    rightWrist: swimming ? .10 : 0,
    leftLeg: swimming ? -0.18 + kick : -leftStep * 0.72,
    rightLeg: swimming ? -0.18 - kick : -rightStep * 0.72,
    leftKnee: swimming ? .12 : Math.max(0, leftStep) * .54,
    rightKnee: swimming ? .12 : Math.max(0, rightStep) * .54,
    leftAnkle: swimming ? -.12 : -Math.max(0, leftStep) * .20,
    rightAnkle: swimming ? -.12 : -Math.max(0, rightStep) * .20,
    legSpread: 0,
    kneeSpread: 0,
    torsoLean: diving ? -0.31 : swimming ? -0.13 : walking ? 0.035 : 0,
    breathing: Math.sin(state.time * 1.45) * (swimming ? 0.018 : 0.009),
  };
}
