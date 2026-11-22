import { GRAND_LAKE, MIRRORFALL } from './highlandLake';

/**
 * One deterministic centerline for the rendered waterfall curtains, their
 * smaller filaments, and dragon/contact forces. The old quadratic traveled
 * almost no distance at the lip and then accelerated sideways as it fell,
 * putting water behind/inside the steep cliff. Water leaving the feeder
 * stream already has horizontal momentum, so its horizontal displacement
 * grows approximately with fall time (sqrt of vertical fall distance).
 *
 * The tiny initial-time smoothing keeps the first mesh rows well-spaced
 * without changing either endpoint or adding a costly fluid solver.
 */
const EJECTION_SMOOTHING = 0.001;
const ROOT_START = Math.sqrt(EJECTION_SMOOTHING);
const ROOT_DISTANCE = Math.sqrt(1 + EJECTION_SMOOTHING) - ROOT_START;

export function waterfallFallFraction(dropFraction:number):number {
  if (!Number.isFinite(dropFraction)) return 0;
  const t=Math.max(0,Math.min(1,dropFraction));
  return (Math.sqrt(t+EJECTION_SMOOTHING)-ROOT_START)/ROOT_DISTANCE;
}

export const WATERFALL_LIP_X = MIRRORFALL.x-1;
export const WATERFALL_POOL_X = MIRRORFALL.x-82;
export const WATERFALL_DROP = MIRRORFALL.topY-GRAND_LAKE.surfaceY;

export function waterfallCenterXAt(dropFraction:number):number {
  return WATERFALL_LIP_X+(WATERFALL_POOL_X-WATERFALL_LIP_X)
    *waterfallFallFraction(dropFraction);
}

export function waterfallCenterAt(dropFraction:number):{
  x:number; y:number; z:number;
} {
  const t=Math.max(0,Math.min(1,Number.isFinite(dropFraction)?dropFraction:0));
  return {
    x:waterfallCenterXAt(t),
    y:MIRRORFALL.topY-WATERFALL_DROP*t,
    z:MIRRORFALL.z,
  };
}
