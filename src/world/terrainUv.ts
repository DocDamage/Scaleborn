import { GRAND_LAKE, lakeRadius } from './highlandLake';

export interface TerrainUvSample {
  u: number;
  v: number;
  cliffBlend: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Continuous world-space UVs remove a 250-meter stretched texture from every
 * terrain tile. Around the Mirrorfall escarpment, gradually tilt mapping into
 * vertical geological coordinates so the cliff face retains rock grain.
 *
 * Depends only on real world coordinates, not per-tile normals; edge vertices
 * use identical UVs even across different terrain LODs.
 */
export function terrainUvAt(x: number, y: number, z: number): TerrainUvSample {
  const metersPerRepeat = 13;
  let cliffBlend = 0;
  if (Math.abs(x - GRAND_LAKE.x) < GRAND_LAKE.radiusX * 1.65 &&
      Math.abs(z - GRAND_LAKE.z) < GRAND_LAKE.radiusZ * 1.7) {
    const r = lakeRadius(x, z);
    const east = (x - GRAND_LAKE.x) / GRAND_LAKE.radiusX;
    const elevation = smoothstep(.98, 1.095, r);
    const bankFade = 1 - smoothstep(1.31, 1.49, r);
    const face = smoothstep(.35, .78, east);
    const canyon = 1 - smoothstep(250, 420, Math.abs(z - GRAND_LAKE.z));
    cliffBlend = elevation * bankFade * face * canyon;
  }
  return {
    u: (x * (1 - cliffBlend) + z * cliffBlend) / metersPerRepeat,
    v: (z * (1 - cliffBlend) + y * cliffBlend) / metersPerRepeat,
    cliffBlend,
  };
}
