import { GRAND_LAKE, MIRRORFALL, headwaterProfileAt,
  headwaterContains, lakeContains, waterSurfaceAt } from './highlandLake';
import { WATERFALL_POOL_X, waterfallCenterXAt } from './waterfallTrajectory';

/**
 * Deterministic localized plunge-pool response. Reused by both simulation
 * and renderer, measured in world meters and seconds.
 *
 * The current is divergence-approximate radial transport, with dispersion
 * and friction (NOT volumetric CFD/Navier-Stokes).
 */
export const MIRRORFALL_IMPACT = Object.freeze({
  x: WATERFALL_POOL_X,
  z: MIRRORFALL.z,
  radius: 112,
  turbulenceRadius: 43,
  maxCurrent: 5.4,
  waveAmplitude: 0.72,
  waveLength: 28,
  waveSpeed: 7.2,
});

export interface WaterCurrent { x: number; z: number; magnitude: number }
export interface WaterVelocity3D extends WaterCurrent { y: number }

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

/**
 * Unmasked plunge ripple for the immediate dry bank. This matches the lake
 * vertex shader at the waterline; masking it at the lake boundary would
 * abruptly freeze the adjoining shore's wetness when the wave passes.
 * Never use this by itself to apply a current outside the lake.
 */
export function plungeWaveUnmaskedAt(x:number,z:number,time:number):number {
  if(![x,z,time].every(Number.isFinite))return 0;
  const d=Math.hypot(x-MIRRORFALL_IMPACT.x,z-MIRRORFALL_IMPACT.z);
  const decay=Math.exp(-d*.038);
  // Keep the CPU phase identical to the water/foam GLSL shaders.
  // Earlier wavelength-based rounding drifted at long gameplay times.
  const phase=d*.225-time*1.63;
  return Math.sin(phase)*MIRRORFALL_IMPACT.waveAmplitude*decay;
}

export function plungeWaveAt(x:number,z:number,time:number):number {
  return lakeContains(x,z) ? plungeWaveUnmaskedAt(x,z,time) : 0;
}

export function plungeFoamAt(x:number,z:number):number {
  if(!lakeContains(x,z))return 0;
  const d=Math.hypot(x-MIRRORFALL_IMPACT.x,z-MIRRORFALL_IMPACT.z);
  return smooth(clamp01(1-d/MIRRORFALL_IMPACT.turbulenceRadius));
}

/**
 * Bounded 3D recirculation in the Mirrorfall plunge pool. Near the falling
 * water, a small downwelling jet entrains swimmers; just outside the impact
 * ring an even weaker upwelling returns water toward the surface. Horizontal
 * outflow is preserved at the surface but decreases with depth.
 *
 * This velocity approximation is deliberately limited in reach and power:
 * it is not a Navier–Stokes pressure solve, must not pull characters through
 * collision terrain, and cannot overwhelm the rider's ascent controls.
 */
export function plungeVelocityAt(x: number, y: number, z: number): WaterVelocity3D {
  const still = { x: 0, y: 0, z: 0, magnitude: 0 };
  if (![x, y, z].every(Number.isFinite) || !lakeContains(x, z)) return still;
  const waterY = waterSurfaceAt(x, z);
  if (y > waterY + 4 || y < waterY - 88) return still;
  const depth = Math.max(0, waterY - y);
  const horizontal = plungeCurrentAt(x, z);
  const attenuation = Math.exp(-depth / 39);
  const dx = x - MIRRORFALL_IMPACT.x;
  const dz = z - MIRRORFALL_IMPACT.z;
  const radius = Math.hypot(dx, dz);
  // Bound the whole 3D field, including the Gaussian downdraft tail.
  // Returning an exact still-water vector beyond the authored impact
  // radius prevents tiny currents from leaking across Mirrorfall Lake.
  if (radius >= MIRRORFALL_IMPACT.radius) return still;
  const downwelling = -2.65
    * Math.exp(-Math.pow(radius / 21, 2))
    * smooth(clamp01((depth - .5) / 3.0))
    * (1 - smooth(clamp01((depth - 18) / 33)));
  const riseBand = smooth(clamp01((radius - 17) / 14))
    * (1 - smooth(clamp01((radius - 47) / 21)));
  const upwelling = .48 * riseBand
    * smooth(clamp01((depth - 2) / 5))
    * (1 - smooth(clamp01((depth - 26) / 31)));
  const vx = horizontal.x * attenuation;
  const vz = horizontal.z * attenuation;
  const vy = downwelling + upwelling;
  return { x: vx, y: vy, z: vz, magnitude: Math.hypot(vx, vy, vz) };
}

/**
 * Water travels downstream from the feeder's elevated catchment toward its
 * western waterfall lip. The vector follows the curved terrain-carved
 * channel centerline, with still water at the margins and above the bank.
 * This uses the same deterministic geography as rendering and swimming.
 */
export function headwaterCurrentAt(x:number,y:number,z:number):WaterVelocity3D {
  const still={x:0,y:0,z:0,magnitude:0};
  if (![x,y,z].every(Number.isFinite) || !headwaterContains(x,z))return still;
  const p=headwaterProfileAt(x,z);
  if(!p || y>p.surfaceY+.8 || y<p.bedY-2)return still;
  const shoreline=1-smooth(clamp01((Math.abs(p.relativeWidth)-.58)/.28));
  const submerged=smooth(clamp01((p.surfaceY-y+.12)/.68));
  const speed=(2.2+(1-clamp01(p.along))*1.7)*shoreline*submerged;
  const gradient=7*Math.PI/132*Math.cos(Math.PI*clamp01(p.along));
  const vx=-speed/Math.sqrt(1+gradient*gradient);
  const vz=vx*gradient;
  return {x:vx,y:0,z:vz,magnitude:speed};
}

/** CFL-like cap to keep browser fixed-step current stable near shorelines. */
export function plungeCurrentStep(
  x:number,z:number,dt:number,
  canMove:(nx:number,nz:number)=>boolean,
  y=waterSurfaceAt(x,z),
):{x:number;z:number} {
  if(!Number.isFinite(dt)||dt<=0||dt>0.1)return {x,z};
  const current=lakeContains(x,z)
    ? plungeVelocityAt(x,y,z) : headwaterCurrentAt(x,y,z);
  const nx=x+current.x*dt,nz=z+current.z*dt;
  return canMove(nx,nz)?{x:nx,z:nz}:{x,z};
}

export interface WaterfallCurtainDrag { x:number; y:number; z:number; strength:number }

/**
 * A bounded contact force near the actual curved waterfall ribbon. Flying
 * through the falling sheet deflects the dragon toward the lake and pushes it
 * gently downward. No arbitrary force at a distance or near the lakebed.
 *
 * This is a lightweight arcade approximation, not collision with a 3D
 * Navier–Stokes waterfall volume. It shares the rendered ribbon trajectory.
 */
export function waterfallCurtainDragAt(
  x:number,y:number,z:number,radius=0,
):WaterfallCurtainDrag {
  const still={x:0,y:0,z:0,strength:0};
  if(![x,y,z,radius].every(Number.isFinite)||radius<0)return still;
  const drop=MIRRORFALL.topY-GRAND_LAKE.surfaceY;
  if(y>MIRRORFALL.topY+3||y<GRAND_LAKE.surfaceY+4)return still;
  const t=Math.max(0,Math.min(1,(MIRRORFALL.topY-y)/drop));
  const fallX=waterfallCenterXAt(t);
  const depthX=Math.abs(x-fallX);
  const depthZ=Math.abs(z-MIRRORFALL.z);
  const xBand=3.6+radius*.45;
  const halfWidth=MIRRORFALL.width*.5*(.74+t*.49)+radius*.45;
  if(depthX>=xBand||depthZ>=halfWidth)return still;
  const fadeX=1-smooth(clamp01(depthX/xBand));
  const fadeZ=1-smooth(clamp01(depthZ/halfWidth));
  const feather=smooth(clamp01((y-GRAND_LAKE.surfaceY-4)/8))
    *smooth(clamp01((MIRRORFALL.topY-y+3)/13));
  const strength=fadeX*fadeZ*feather;
  // X points away from the cliff, into the freshwater basin. Z is a
  // much smaller lateral bias, preventing a rigid single-axis push.
  const lateral=(z-MIRRORFALL.z)/Math.max(1,halfWidth);
  return {x:-8.5*strength,y:-11*strength,z:lateral*1.9*strength,strength};
}

export function lakeVolumeEstimateCubicMeters():number {
  // Elliptical first-order basin approximation, used only for debugging
  // and never as a hydrology / simulation conservation invariant.
  return Math.PI*GRAND_LAKE.radiusX*GRAND_LAKE.radiusZ*
    GRAND_LAKE.maxDepth*.48;
}
