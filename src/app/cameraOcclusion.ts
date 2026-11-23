import * as THREE from 'three';

export interface CameraBlocker {
  x: number; z: number; radius: number; top: number;
}

/**
 * Find the earliest line-of-sight intersection with a structure's cylindrical
 * collision proxy. Testing only a handful of points along a chase-camera ray
 * misses narrow pillars and building corners between samples.
 *
 * These are renderer-independent collision proxies, not mesh raycasts.
 */
function firstStructureHit(
  focus: THREE.Vector3, delta: THREE.Vector3,
  blockers: readonly CameraBlocker[],
): number {
  let first = 1;
  const a = delta.x * delta.x + delta.z * delta.z;
  for (const blocker of blockers) {
    if (![blocker.x, blocker.z, blocker.radius, blocker.top].every(Number.isFinite)
      || blocker.radius < 0) continue;
    const dx = focus.x - blocker.x;
    const dz = focus.z - blocker.z;
    const radius = blocker.radius + .65;
    const b = 2 * (dx * delta.x + dz * delta.z);
    const c = dx * dx + dz * dz - radius * radius;
    let entry = 0;
    let exit = 1;
    if (a < 1e-9) {
      if (c > 0) continue;
    } else {
      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0) continue;
      const root = Math.sqrt(discriminant);
      entry = Math.max(0, (-b - root) / (2 * a));
      exit = Math.min(1, (-b + root) / (2 * a));
      if (entry > exit) continue;
    }

    // The camera can pass over an obstacle, but must not descend through
    // its top while horizontally inside the structure's footprint.
    const top = blocker.top + .65;
    let hit = entry;
    if (focus.y + delta.y * entry >= top) {
      if (delta.y >= 0) continue;
      hit = (top - focus.y) / delta.y;
      if (hit > exit) continue;
    }
    first = Math.min(first, hit);
  }
  return first;
}

/**
 * Keep the chase camera in sight of the tracked character. Terrain is sampled
 * with a bounded step and refined by bisection; structures use an exact
 * segment/cylinder intersection so narrow obstacles cannot slip between rays.
 */
export function resolveCameraOcclusion(
  focus: THREE.Vector3,
  desired: THREE.Vector3,
  terrain: (x: number, z: number) => number,
  blockers: readonly CameraBlocker[],
  clearance = 1.15,
): THREE.Vector3 {
  const valid = (v: THREE.Vector3): boolean =>
    [v.x, v.y, v.z].every(Number.isFinite);
  if (!valid(focus) || !valid(desired) || !Number.isFinite(clearance)
      || clearance < 0) return desired.clone();

  const delta = desired.clone().sub(focus);
  const distance = delta.length();
  if (distance < .01) return desired.clone();

  const terrainBlocked = (t: number): boolean => {
    const x = focus.x + delta.x * t;
    const z = focus.z + delta.z * t;
    const y = focus.y + delta.y * t;
    return y < terrain(x, z) + clearance;
  };
  const along = (t: number): THREE.Vector3 => {
    const result = focus.clone().addScaledVector(delta, t);
    result.y = Math.max(result.y, terrain(result.x, result.z) + clearance);
    return result;
  };

  if (terrainBlocked(0)) return along(0);

  const structureHit = firstStructureHit(focus, delta, blockers);
  const samples = Math.min(64, Math.max(8, Math.ceil(distance / 1.25)));
  let safe = 0;
  for (let i = 1; i <= samples; i++) {
    const t = structureHit * i / samples;
    if (!terrainBlocked(t)) { safe = t; continue; }
    let lo = safe, hi = t;
    for (let j = 0; j < 7; j++) {
      const mid = (lo + hi) * .5;
      if (terrainBlocked(mid)) hi = mid;
      else lo = mid;
    }
    return along(Math.max(0, lo - .25 / distance));
  }
  if (structureHit < 1) return along(Math.max(0, structureHit - .25 / distance));
  return desired.clone();
}
