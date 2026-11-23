import { GRAND_LAKE, lakeShoreDistance } from './highlandLake';
import { lakeShoreWaveOffsetAt } from './waterWaves';

const clamp01 = (n:number):number => Math.max(0,Math.min(1,n));
const smoothstep = (a:number,b:number,x:number):number => {
  const t=clamp01((x-a)/(b-a));
  return t*t*(3-2*t);
};

/**
 * Renderer-neutral reference for animated wet sand/rock just above Mirrorfall
 * Lake's shoreline. The material shader uses these same bounds, wave phases,
 * and irregular lake shoreline. This does not alter the water or terrain
 * geometry, swimmer physics, or lake footprint.
 *
 * The ground remains darker for a short retreat above a wave crest, instead
 * of a permanently bright, static shore stripe.
 */
export function lakeSwashAt(x:number,y:number,z:number,time:number):number {
  if(![x,y,z,time].every(Number.isFinite))return 0;
  const distance=lakeShoreDistance(x,z);
  // Never paint waves across open water or far up dry cliffs.
  if(distance<=0 || distance>=26)return 0;
  const bankMask=(1-smoothstep(3,26,distance))
    *smoothstep(-1.5,2.5,distance);
  const lowBank=1-smoothstep(
    GRAND_LAKE.surfaceY+1,GRAND_LAKE.surfaceY+23,y);
  if(bankMask<=0 || lowBank<=0)return 0;
  const movingWaterline=GRAND_LAKE.surfaceY+lakeShoreWaveOffsetAt(x,z,time);
  const contact=1-smoothstep(movingWaterline+.10,movingWaterline+2.10,y);
  const aboveWater=smoothstep(
    GRAND_LAKE.surfaceY-1,GRAND_LAKE.surfaceY+.30,y);
  return clamp01(bankMask*lowBank*contact*aboveWater);
}
