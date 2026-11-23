import * as THREE from 'three';
import { headwaterContains, lakeContains, waterSurfaceAt } from './highlandLake';

export type WaterMedium = 'air' | 'lake' | 'ocean';

export interface UnderwaterOpticsSample {
  medium: WaterMedium;
  depth: number;
  immersion: number;
  fogDensity: number;
  tint: THREE.Color;
  lightTransmission: number;
  shaftStrength: number;
}

export const AIR_FOG_DENSITY = 0.00038;
const AIR_TINT = new THREE.Color(0xb6cbd4);
const LAKE_SHALLOW = new THREE.Color(0x3c8390);
const LAKE_DEEP = new THREE.Color(0x0b2c43);
const OCEAN_SHALLOW = new THREE.Color(0x346b7d);
const OCEAN_DEEP = new THREE.Color(0x0a243a);

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const smoothstep = (low: number, high: number, x: number): number => {
  const t = clamp01((x - low) / (high - low));
  return t * t * (3 - 2 * t);
};

/**
 * Camera-space freshwater/ocean optical state. Samples the same water level
 * that governs collisions; depth changes light absorption and fog, not player
 * movement or lake geometry. This is a bounded real-time approximation to
 * turbidity, NOT path-traced scattering or volumetric fluid simulation.
 */
export function underwaterOpticsAt(
  x: number, y: number, z: number, swimming: boolean,
): UnderwaterOpticsSample {
  if (!swimming || ![x, y, z].every(Number.isFinite)) {
    return {
      medium: 'air', depth: 0, immersion: 0,
      fogDensity: AIR_FOG_DENSITY, tint: AIR_TINT.clone(),
      lightTransmission: 1, shaftStrength: 0,
    };
  }

  // The shallow mountain creek is freshwater, not an ocean volume.
  const lake = lakeContains(x, z) || headwaterContains(x, z);
  const depth = Math.max(0, waterSurfaceAt(x, z) - y);
  // Smoothly cross the lens through the waterline; the player animation's
  // swim mode alone does not guarantee the *camera* is submerged.
  const immersion = smoothstep(0.12, 1.7, depth);
  if (immersion === 0) {
    return {
      medium: 'air', depth, immersion,
      fogDensity: AIR_FOG_DENSITY, tint: AIR_TINT.clone(),
      lightTransmission: 1, shaftStrength: 0,
    };
  }

  const shallow = lake ? LAKE_SHALLOW : OCEAN_SHALLOW;
  const deep = lake ? LAKE_DEEP : OCEAN_DEEP;
  const tint = shallow.clone().lerp(deep, smoothstep(8, lake ? 135 : 95, depth));
  const waterFog = lake
    ? Math.min(.052, .011 + depth * .00026)
    : Math.min(.065, .016 + depth * .00032);
  const fogDensity = AIR_FOG_DENSITY * (1 - immersion) + waterFog * immersion;
  const absorption = lake ? .023 : .035;
  // Preserve navigation at 140+ meters without pretending sunshine reaches
  // the bottom as strongly as the shallows.
  const underwaterLight = .38 + .62 * Math.exp(-depth * absorption);
  const lightTransmission = 1 - immersion * (1 - underwaterLight);
  const shaftStrength = lake
    ? immersion * (1 - smoothstep(18, 62, depth))
    : 0;

  return {
    medium: lake ? 'lake' : 'ocean',
    depth, immersion, fogDensity, tint,
    lightTransmission, shaftStrength,
  };
}
