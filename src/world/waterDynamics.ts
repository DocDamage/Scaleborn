import { GRAND_LAKE, MIRRORFALL, lakeContains } from './highlandLake';

/**
 * Deterministic localized plunge-pool response. Reused by both simulation
 * and renderer, measured in world meters and seconds.
 *
 * The current is divergence-approximate radial transport, with dispersion
 * and friction (NOT volumetric CFD/Navier-Stokes).
 */
export const MIRRORFALL_IMPACT = Object.freeze({
  x: MIRRORFALL.x - 82,
  z: MIRRORFALL.z,
  radius: 112,
  turbulenceRadius: 43,
  maxCurrent: 5.4,
  waveAmplitude: 0.82,
  waveLength: 28,
  waveSpeed: 7.2,
});

export interface WaterCurrent { x: number; z: number; magnitude: number }

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => value * value * (3 - 2 * value);

/** Outward velocity field; no artificial current beyond the impact zone. */
export function plungeCurrentAt(x: number, z: number): WaterCurrent {
  if (!lakeContains(x,z)) return { x: 0, z: 0, magnitude: 0 };
  const dx=x-MIRRORFALL_IMPACT.x, dz=z-MIRRORFALL_IMPACT.z;
  const d=Math.hypot(dx,dz);
  if (d>=MIRRORFALL_IMPACT.radius) return { x:0,z:0,magnitude:0 };
  const strength=1-smooth(clamp01(d/MIRRORFALL_IMPACT.radius));
  const magnitude=MIRRORFALL_IMPACT.maxCurrent*strength;
  const angle=d<0.001?0:Math.atan2(dz,dx);
  // Some tangential motion near impact makes swirls rather than a rigid
  // perfectly radial push. Direction remains normalized.
  const swirl=0.16*Math.sin(d*.07)*strength;
  const direction=angle+swirl;
  return { x: Math.cos(direction)*magnitude,
    z:Math.sin(direction)*magnitude, magnitude };
}

export function plungeWaveAt(x:number,z:number,time:number):number {
  if(!Number.isFinite(time)||!lakeContains(x,z))return 0;
  const d=Math.hypot(x-MIRRORFALL_IMPACT.x,z-MIRRORFALL_IMPACT.z);
  const decay=Math.exp(-d/.48/MIRRORFALL_IMPACT.radius);
  const phase=(d/MIRRORFALL_IMPACT.waveLength-time*
    MIRRORFALL_IMPACT.waveSpeed/MIRRORFALL_IMPACT.waveLength)*Math.PI*2;
  return Math.sin(phase)*MIRRORFALL_IMPACT.waveAmplitude*decay;
}

export function plungeFoamAt(x:number,z:number):number {
  if(!lakeContains(x,z))return 0;
  const d=Math.hypot(x-MIRRORFALL_IMPACT.x,z-MIRRORFALL_IMPACT.z);
  return smooth(clamp01(1-d/MIRRORFALL_IMPACT.turbulenceRadius));
}

/** CFL-like cap to keep browser fixed-step current stable near shorelines. */
export function plungeCurrentStep(
  x:number,z:number,dt:number,
  canMove:(nx:number,nz:number)=>boolean,
):{x:number;z:number} {
  if(!Number.isFinite(dt)||dt<=0||dt>0.1)return {x,z};
  const current=plungeCurrentAt(x,z);
  const nx=x+current.x*dt,nz=z+current.z*dt;
  return canMove(nx,nz)?{x:nx,z:nz}:{x,z};
}

export function lakeVolumeEstimateCubicMeters():number {
  // Elliptical first-order basin approximation, used only for debugging
  // and never as a hydrology / simulation conservation invariant.
  return Math.PI*GRAND_LAKE.radiusX*GRAND_LAKE.radiusZ*
    GRAND_LAKE.maxDepth*.48;
}
