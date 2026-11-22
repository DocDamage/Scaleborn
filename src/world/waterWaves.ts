import { lakeContains, waterSurfaceAt } from './highlandLake';
import { plungeWaveAt } from './waterDynamics';

/**
 * CPU counterpart to the GPU Gerstner-like surface. Wind direction,
 * frequencies and phases must match waterSurface.ts exactly so swimming
 * characters ride the same waves the player sees.
 *
 * This is a bounded deterministic height approximation, not CFD.
 */
export interface WaterWaveSample {
  surfaceY: number;
  offsetY: number;
  slopeX: number;
  slopeZ: number;
}

const waveDirections = [
  { x: 0.87, z: 0.49, k: .16, speed: .95, amplitude: .53 },
  { x: -.23, z: .97, k: .37, speed: 1.47, amplitude: .24 },
  { x: .64, z: -.76, k: .76, speed: 2.15, amplitude: .10 },
  { x: .18, z: .98, k: .08, speed: .62, amplitude: .64 },
] as const;

export function waterWaveOffsetAt(x: number, z: number, time: number): number {
  if (![x,z,time].every(Number.isFinite)) return 0;
  let y=0;
  for(const w of waveDirections){
    const length=Math.hypot(w.x,w.z);
    const phase=((x*w.x+z*w.z)/length)*w.k-time*w.speed;
    y+=w.amplitude*Math.sin(phase);
  }
  if(lakeContains(x,z)) y+=plungeWaveAt(x,z,time);
  return y;
}

export function sampleWaterWaves(x:number,z:number,time:number):WaterWaveSample {
  const offsetY=waterWaveOffsetAt(x,z,time);
  const epsilon=.15;
  const dx=(waterWaveOffsetAt(x+epsilon,z,time)
    -waterWaveOffsetAt(x-epsilon,z,time))/(2*epsilon);
  const dz=(waterWaveOffsetAt(x,z+epsilon,time)
    -waterWaveOffsetAt(x,z-epsilon,time))/(2*epsilon);
  return {
    surfaceY:waterSurfaceAt(x,z)+offsetY,
    offsetY,
    slopeX:dx,slopeZ:dz,
  };
}
