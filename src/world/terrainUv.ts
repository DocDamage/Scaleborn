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
 * terrain tile. Cliff masks remain available for future triplanar shader
 * blending, but texture coordinates DO NOT interpolate between horizontal
 * and vertical projections: doing so stretched normal maps into moiré bands
 * in actual rider-height gameplay captures.
 *
 * Depends only on real world coordinates, not per-tile normals; edge vertices
 * use identical UVs even across different terrain LODs.
 */
export function terrainUvAt(x: number, _y: number, z: number): TerrainUvSample {
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
    // No mixed UV coordinates across bank slope. This preserves smooth,
    // seam-stable mipmapped texturing on all quality presets.
    u: x / metersPerRepeat,
    v: z / metersPerRepeat,
    cliffBlend,
  };
}
