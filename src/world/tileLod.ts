import { AZURE_SEED, heightAt } from './terrain';

/** Tiles are 250 meters wide; 32:8 is a deliberate 4:1 supported seam ratio. */
export const TILE_METERS = 250;
export const TILE_RADIUS = 4;
export const NEAR_RADIUS = 2;
export const NEAR_SEGMENTS = 32;
export const FAR_SEGMENTS = 8;

export interface TileSpec {
  segments: number;
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Chebyshev-distance LOD remains deterministic for a given observer tile. */
export function lodSegments(viewX: number, viewZ: number, tx: number, tz: number): number {
  const distance = Math.max(Math.abs(tx - viewX), Math.abs(tz - viewZ));
  return distance <= NEAR_RADIUS ? NEAR_SEGMENTS : FAR_SEGMENTS;
}

export function tileSpec(viewX: number, viewZ: number, tx: number, tz: number): TileSpec {
  return {
    segments: lodSegments(viewX, viewZ, tx, tz),
    north: lodSegments(viewX, viewZ, tx, tz - 1),
    south: lodSegments(viewX, viewZ, tx, tz + 1),
    east: lodSegments(viewX, viewZ, tx + 1, tz),
    west: lodSegments(viewX, viewZ, tx - 1, tz),
  };
}

export function specKey(spec: TileSpec): string {
  return [spec.segments, spec.north, spec.south, spec.east, spec.west].join(':');
}

/**
 * Fine-edge heights are projected onto the coarse neighbor's straight edges.
 * Coarse vertices are never moved. This eliminates actual gaps at 32:8
 * boundaries, including when a tile's LOD changes during streaming.
 * Note: appearance/normal transitions can remain visible (future geomorphing).
 */
export function stitchedHeight(
  tx: number, tz: number, col: number, row: number, spec: TileSpec,
  seed = AZURE_SEED,
): number {
  const n = spec.segments;
  if (n < 1 || !Number.isInteger(n) ||
      col < 0 || row < 0 || col > n || row > n) {
    throw new Error('Invalid grid vertex');
  }
  const wx = (tx + col / n) * TILE_METERS;
  const wz = (tz + row / n) * TILE_METERS;

  const alongX = row === 0 ? spec.north : row === n ? spec.south : 0;
  const alongZ = col === 0 ? spec.west : col === n ? spec.east : 0;
  if (alongX > 0 && alongX < n) {
    const factor = (col / n) * alongX;
    const index = Math.min(alongX - 1, Math.floor(factor));
    const frac = factor - index;
    const ax = (tx + index / alongX) * TILE_METERS;
    const bx = (tx + (index + 1) / alongX) * TILE_METERS;
    return heightAt(ax, wz, seed) * (1 - frac) + heightAt(bx, wz, seed) * frac;
  }
  if (alongZ > 0 && alongZ < n) {
    const factor = (row / n) * alongZ;
    const index = Math.min(alongZ - 1, Math.floor(factor));
    const frac = factor - index;
    const az = (tz + index / alongZ) * TILE_METERS;
    const bz = (tz + (index + 1) / alongZ) * TILE_METERS;
    return heightAt(wx, az, seed) * (1 - frac) + heightAt(wx, bz, seed) * frac;
  }
  return heightAt(wx, wz, seed);
}
