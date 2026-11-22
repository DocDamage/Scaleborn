import { fbm } from '../core/random';

/**
 * One authored, seed-stable, genuinely traversable freshwater body.
 * All values are in meters. The basin is ~750 m across and over 140 m deep,
 * not a flat image; terrain, graphics and collision share these coordinates.
 */
export const GRAND_LAKE = Object.freeze({
  id: 'azure.grand-lake',
  name: 'Mirrorfall Lake',
  x: -185,
  z: 560,
  radiusX: 382,
  radiusZ: 294,
  surfaceY: 62,
  maxDepth: 148,
});

export const MIRRORFALL = Object.freeze({
  id: 'azure.mirrorfall',
  name: 'Mirrorfall Cascade',
  // Align the water lip with the actual eastern escarpment's 170–180m
  // summit rather than spawning a curtain in open air above lakebank terrain.
  x: GRAND_LAKE.x + GRAND_LAKE.radiusX * 1.17,
  z: GRAND_LAKE.z,
  topY: 176,
  bottomY: GRAND_LAKE.surfaceY,
  width: 78,
});

export interface HeadwaterProfile {
  along: number; centerZ: number; halfWidth: number;
  relativeWidth: number; surfaceY: number; bedY: number; influence: number;
}

/** The same curved, narrow headwater profile drives the terrain, shallow
 * water volume, and rendering. Nothing is imported from the renderer. */
export function headwaterProfileAt(x: number, z: number): HeadwaterProfile | null {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  const along=(x-(MIRRORFALL.x-1))/132;
  if(along<-.14 || along>1.13) return null;
  const t=Math.max(0,Math.min(1,along));
  const centerZ=GRAND_LAKE.z+7*Math.sin(t*Math.PI);
  const halfWidth=37-21*t;
  const relativeWidth=(z-centerZ)/halfWidth;
  const edge=Math.abs(relativeWidth);
  if(edge>1.90)return null;
  const longitudinal=smoothstep(-.14,0,along)
    *(1-smoothstep(.92,1.13,along));
  const influence=longitudinal*(1-smoothstep(1.10,1.90,edge));
  const surfaceY=MIRRORFALL.topY+1.75*t;
  const channel=1-smoothstep(.16,.89,edge);
  const raisedBank=smoothstep(.81,1.25,edge);
  const bedY=surfaceY-2.25*channel+1.60*raisedBank;
  return {along,centerZ,halfWidth,relativeWidth,
    surfaceY,bedY,influence};
}

export function headwaterContains(x:number,z:number):boolean {
  const p=headwaterProfileAt(x,z);
  // The GPU stream mesh uses float32 world coordinates. Tolerate its
  // sub-millimetre roundoff at the exact upstream endpoint.
  return p!==null && p.along>=-.00001 && p.along<=1.00001
    && Math.abs(p.relativeWidth)<.86;
}

/** Small surface ripples on shallow headwaters; no ocean-sized surf here. */
export function headwaterWaveAt(x:number,z:number,time:number):number {
  if(!Number.isFinite(time) || !headwaterContains(x,z)) return 0;
  return .065*Math.sin(x*.32+z*.11+time*2.35)
    +.035*Math.sin(x*.57-z*.28+time*3.4);
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Low-frequency coves and headlands, shared by shore foam and water masks. */
export function lakeBoundaryScale(theta: number): number {
  return 1 + 0.067 * Math.sin(3 * theta + 1.10)
    + 0.042 * Math.sin(7 * theta - 0.72)
    + 0.023 * Math.sin(13 * theta + 2.0);
}

export function lakeRadius(x: number, z: number): number {
  const dx = (x - GRAND_LAKE.x) / GRAND_LAKE.radiusX;
  const dz = (z - GRAND_LAKE.z) / GRAND_LAKE.radiusZ;
  const angle = Math.atan2(dz, dx);
  return Math.hypot(dx, dz) / lakeBoundaryScale(angle);
}

/** The shore is intentionally stable; deterministic terrain and foam agree. */
export function lakeContains(x: number, z: number): boolean {
  return lakeRadius(x, z) < 0.982;
}

export function waterSurfaceAt(x: number, z: number): number {
  if(lakeContains(x,z))return GRAND_LAKE.surfaceY;
  const headwater=headwaterProfileAt(x,z);
  return headwater && headwaterContains(x,z)
    ? headwater.surfaceY : 0;
}

/** SDF-like return value: negative inside the freshwater ellipse, positive outside. */
export function lakeShoreDistance(x: number, z: number): number {
  return (lakeRadius(x, z) - 0.982) * Math.min(GRAND_LAKE.radiusX, GRAND_LAKE.radiusZ);
}

/**
 * Replaces the local heightfield with a smooth bowl, rocky high banks and
 * horseshoe summit; blends into the existing world without a rectangular cut.
 */
export function sculptMirrorfallTerrain(
  x: number, z: number, originalHeight: number, seed: number,
): number {
  const r = lakeRadius(x, z);
  if (r >= 1.72) return originalHeight;
  const lap = fbm(x * 0.005, z * 0.005, seed + 1903, 3);
  const shallow = Math.max(0, 1 - r * r);
  const floor = GRAND_LAKE.surfaceY
    - GRAND_LAKE.maxDepth * Math.pow(shallow, 1.35)
    + lap * Math.min(1, shallow * 7) * 2.3;
  const ridgeShape = Math.exp(-Math.pow((r - 1.20) / 0.27, 2));
  const shore = GRAND_LAKE.surfaceY
    + smoothstep(1.0, 1.24, r) * ridgeShape * (28 + lap * 6);
  // Raise a cliff on the waterfall side without creating a rectangular wall.
  const crestX = GRAND_LAKE.x + GRAND_LAKE.radiusX * 1.22;
  const dx = (x - crestX) / 190;
  const dz = (z - GRAND_LAKE.z) / 180;
  const crest = 84 * Math.exp(-dx * dx - dz * dz)
    * smoothstep(1.02, 1.16, r);
  if (r <= 1) return floor;
  // A genuine lake-facing escarpment, not a rounded hill. A narrow
  // 20-25m shoreline gradient rises over 110m on the waterfall-facing bank.
  // Terrain collision, streamed mesh and rock shading all use this face.
  const easternFace = smoothstep(0.36, 0.88, (x - GRAND_LAKE.x) / GRAND_LAKE.radiusX);
  const canyonBand = Math.exp(-Math.pow((z - GRAND_LAKE.z) / 205, 4));
  // The previous 20 m cliff step produced a single giant vertical polygon
  // wall in actual browser screenshots. Preserve the waterfall's steep core
  // while spreading the side banks into layered, eroded rock slopes.
  const core = Math.exp(-Math.pow((z - GRAND_LAKE.z) / 92, 4));
  const cliffStep = smoothstep(1.006, 1.177 - core * 0.099, r);
  const erosion = fbm(x * 0.031, z * 0.037, seed + 2401, 4);
  const rockFolds = Math.sin((z - GRAND_LAKE.z) * .069
    + r * 21.0 + erosion * 3.3) * 4.8;
  const gullyRelief = (erosion * 8.8 + rockFolds)
    * Math.sin(Math.PI * cliffStep) * easternFace * canyonBand;
  const escarpment = GRAND_LAKE.surfaceY
    + (111 + lap * 14) * cliffStep * easternFace * canyonBand
    + gullyRelief;
  const highBank = Math.max(shore + crest, escarpment);
  const transition = smoothstep(1.43, 1.72, r);
  const bankHeight=r<1.43?highBank
    :highBank*(1-transition)+originalHeight*transition;
  const stream=headwaterProfileAt(x,z);
  // The river is an actual shallow carved bed with small raised banks.
  // The same deterministic heightfield is used for rendering and collision.
  return stream ? bankHeight*(1-stream.influence)
    +stream.bedY*stream.influence : bankHeight;
}
