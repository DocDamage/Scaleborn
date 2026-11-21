import { hash2 } from '../core/random';
import type { DragonForm } from '../actors/dragon/forms';
import { FORMS } from '../actors/dragon/forms';
import { AZURE_SEED, heightAt, LANDMARKS } from './terrain';

export interface WorldObstacle {
  id: string;
  x: number;
  z: number;
  radius: number;
  /** World-space top of structure/solid landmark, in meters. */
  top: number;
}

function obstacle(id: string, x: number, z: number, radius: number, height: number): WorldObstacle {
  return { id, x, z, radius, top: heightAt(x, z) + height };
}

/**
 * Gameplay colliders match the authored procedural placement recipes.
 * Future assets will define their physical proxies in manifests.
 * No mesh-triangle collision or third-party physics dependency in G2.
 */
export function coastalObstacles(): readonly WorldObstacle[] {
  const out: WorldObstacle[] = [];
  const harbor = LANDMARKS.find((item) => item.id === 'azure.harbor');
  const lighthouse = LANDMARKS.find((item) => item.id === 'azure.lighthouse');
  const temple = LANDMARKS.find((item) => item.id === 'azure.temple');
  const arch = LANDMARKS.find((item) => item.id === 'azure.sea-arch');
  if (!harbor || !lighthouse || !temple || !arch) throw new Error('Missing coastal anchors');
  for (let i = 0; i < 12; i++) {
    const row = Math.floor(i / 4), col = i % 4;
    const x = harbor.x + col * 33 - 53 + (hash2(i, 5, AZURE_SEED) - 0.5) * 10;
    const z = harbor.z + row * 36 - 35;
    out.push(obstacle('cottage.' + i, x, z, 10.2, 18));
  }
  out.push(obstacle('lighthouse', lighthouse.x, lighthouse.z, 8.5, 50));
  out.push(obstacle('temple', temple.x, temple.z, 32, 33));
  for (const side of [-1, 1]) {
    out.push(obstacle('sea-arch.' + side, arch.x + side * 33, arch.z, 13, 61));
  }
  return out;
}

export const OBSTACLES = coastalObstacles();

function nearbyObstacle(x: number, z: number, radius: number): WorldObstacle[] {
  return OBSTACLES.filter((o) => Math.hypot(o.x - x, o.z - z) < o.radius + radius);
}

/** Sample center and rim so a wide-winged giant cannot scrape against a hill. */
export function highestTerrainUnder(x: number, z: number, radius: number): number {
  let high = heightAt(x, z);
  for (let i = 0; i < 12; i++) {
    const theta = (i / 12) * Math.PI * 2;
    high = Math.max(high, heightAt(x + Math.cos(theta) * radius, z + Math.sin(theta) * radius));
  }
  return high;
}

/** Automatic clearance is intentionally forgiving for arcade flight. */
export function safeFlightY(x: number, z: number, form: DragonForm): number {
  const config = FORMS[form];
  let floor = Math.max(11, highestTerrainUnder(x, z, config.radius) + Math.max(10, config.standHeight + 6));
  for (const o of nearbyObstacle(x, z, config.radius)) {
    floor = Math.max(floor, o.top + config.standHeight + 3);
  }
  return floor;
}

export interface ClearanceResult {
  ok: boolean;
  reason: string;
}

export function canStand(x: number, z: number, form: DragonForm): ClearanceResult {
  const config = FORMS[form];
  const ground = heightAt(x, z);
  if (ground < 2) return { ok: false, reason: 'Land traversal requires solid ground; swimming comes later.' };
  const high = highestTerrainUnder(x, z, config.radius);
  if (high - ground > Math.max(1.9, config.radius * 0.85)) {
    return { ok: false, reason: 'Ground is too uneven for this dragon form.' };
  }
  for (const o of nearbyObstacle(x, z, config.radius)) {
    if (o.top > ground + config.standHeight) {
      return { ok: false, reason: 'Not enough room near ' + o.id + '.' };
    }
  }
  return { ok: true, reason: '' };
}

/** A conservative pre-transform clearance query, preserving current position. */
export function canExpandInAir(
  x: number, y: number, z: number, target: DragonForm,
): ClearanceResult {
  const floor = safeFlightY(x, z, target);
  if (y < floor) return { ok: false, reason: 'Climb higher before growing into giant form.' };
  return { ok: true, reason: '' };
}
