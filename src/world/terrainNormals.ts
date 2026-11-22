import { heightAt } from './terrain';

/** One consistent heightfield derivative for tile boundaries at any LOD. */
export function heightfieldNormalAt(
  x: number, z: number, spacing = 3.5,
): readonly [number, number, number] {
  if (!Number.isFinite(x) || !Number.isFinite(z) ||
      !Number.isFinite(spacing) || spacing <= 0) {
    throw new Error('Terrain normal samples require finite coordinates and positive spacing');
  }
  const gx = (heightAt(x + spacing, z) - heightAt(x - spacing, z)) / (2 * spacing);
  const gz = (heightAt(x, z + spacing) - heightAt(x, z - spacing)) / (2 * spacing);
  const inverseLength = 1 / Math.hypot(gx, 1, gz);
  return [-gx * inverseLength, inverseLength, -gz * inverseLength];
}

/** Blend just the outer two interior rings to avoid a boundary shading step. */
export function seamNormalWeight(col: number, row: number, segments: number): number {
  if (!Number.isInteger(segments) || segments < 4 ||
      !Number.isInteger(col) || !Number.isInteger(row) ||
      col < 0 || row < 0 || col > segments || row > segments) {
    throw new Error('Invalid terrain normal grid index');
  }
  const distance = Math.min(col, row, segments - col, segments - row);
  return distance === 0 ? 1 : distance === 1 ? 0.58 : distance === 2 ? 0.20 : 0;
}
