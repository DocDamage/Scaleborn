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
  x: GRAND_LAKE.x + GRAND_LAKE.radiusX * 1.08,
  z: GRAND_LAKE.z,
  topY: 166,
  bottomY: GRAND_LAKE.surfaceY,
  width: 46,
});

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
  return lakeContains(x, z) ? GRAND_LAKE.surfaceY : 0;
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
  const highBank = shore + crest;
  if (r < 1.43) return highBank;
  const transition = smoothstep(1.43, 1.72, r);
  return highBank * (1 - transition) + originalHeight * transition;
}
