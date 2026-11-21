import { FORMS, type DragonForm } from '../actors/dragon/forms';
import { highestTerrainUnder } from './collision';
import { SEA_LEVEL, heightAt } from './terrain';

/** Ocean volumes are renderer-independent. Y up, meters, water at sea level. */
export const WATER_ENTRY_HEIGHT = 29;
export const RIDER_SURFACE_Y = SEA_LEVEL - 0.72;
export const RIDER_DIVE_Y = SEA_LEVEL - 3.2;
export const WATER_EPSILON = 1e-6;

export interface WaterClearance { ok: boolean; reason: string }

export function dragonSurfaceY(form: DragonForm): number {
  return SEA_LEVEL + FORMS[form].standHeight * 0.55;
}
export function dragonBottomY(x: number, z: number, form: DragonForm): number {
  return highestTerrainUnder(x, z, FORMS[form].radius) + Math.max(1.25, FORMS[form].radius * 0.7);
}
export function dragonDiveY(form: DragonForm): number {
  return SEA_LEVEL - Math.max(2.6, FORMS[form].radius * 1.2);
}

export function canEnterSea(x: number, z: number, form: DragonForm): WaterClearance {
  const bottom = dragonBottomY(x, z, form);
  const surface = dragonSurfaceY(form);
  if (heightAt(x, z) >= -3 || bottom >= surface - 1.25) {
    return { ok: false, reason: 'The water is too shallow for this dragon form.' };
  }
  return { ok: true, reason: '' };
}
export function canDragonDive(x: number, z: number, form: DragonForm): WaterClearance {
  const entry = canEnterSea(x, z, form);
  if (!entry.ok) return entry;
  if (dragonBottomY(x, z, form) > dragonDiveY(form) + 0.5) {
    return { ok: false, reason: 'Find deeper water before diving.' };
  }
  return { ok: true, reason: '' };
}

/** Never place a swimmer inside the sea floor; works in any ocean region. */
export function riderFloorY(x: number, z: number): number {
  return heightAt(x, z) + 0.20;
}
export function riderCanSwim(x: number, z: number): boolean {
  return heightAt(x, z) < SEA_LEVEL - 1.1;
}
export function approach(current: number, target: number, maxDistance: number): number {
  // A rate limit, not a tolerance clamp: moving from the depths must take time.
  const step = Math.max(0, maxDistance);
  if (current < target) return Math.min(current + step, target);
  return Math.max(current - step, target);
}
