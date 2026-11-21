import { fbm } from '../core/random';

export const AZURE_SEED = 0x5ca1e0;
export const WORLD_WIDTH_METERS = 4000;
export const SEA_LEVEL = 0;
export const SPAWN = { x: -1230, y: 105, z: 90, yaw: 1.12 } as const;

export type WorldAnchor = { id: string; x: number; z: number };
export const LANDMARKS: readonly WorldAnchor[] = [
  { id: 'azure.harbor', x: -1220, z: 105 },
  { id: 'azure.lighthouse', x: -475, z: -610 },
  { id: 'azure.temple', x: 850, z: -500 },
  { id: 'azure.sea-arch', x: 565, z: 775 },
];

/** Meter-based X/Z geography. Y is up. Fixed islands, deterministic erosion-like detail. */
export function heightAt(x: number, z: number, seed = AZURE_SEED): number {
  const hills = [
    { x: -555, z: 100, a: 146, rx: 805, rz: 630 },
    { x: 830, z: -500, a: 164, rx: 540, rz: 530 },
    { x: 570, z: 780, a: 113, rx: 480, rz: 450 },
    { x: -470, z: -620, a: 82, rx: 220, rz: 250 },
  ];
  let mass = 0;
  for (const hill of hills) {
    const dx = (x - hill.x) / hill.rx;
    const dz = (z - hill.z) / hill.rz;
    mass = Math.max(mass, hill.a * Math.exp(-(dx * dx + dz * dz)));
  }
  const weight = Math.min(1, Math.max(0, mass / 75));
  const ridge = Math.abs(fbm(x * 0.0038, z * 0.0038, seed + 17, 4));
  const fine = fbm(x * 0.018, z * 0.018, seed + 71, 3);
  return mass - 52 + (ridge * 21 + fine * 10) * weight;
}

/** Ground plus near-water margin for safe flight (underwater is a later milestone). */
export function minimumFlightY(x: number, z: number): number {
  return Math.max(11, heightAt(x, z) + 10);
}

export function biomeAt(x: number, z: number): 'seabed' | 'beach' | 'grass' | 'forest' | 'cliff' {
  const h = heightAt(x, z);
  if (h < -3) return 'seabed';
  if (h < 8) return 'beach';
  const rough = Math.abs(heightAt(x + 12, z) - heightAt(x - 12, z))
    + Math.abs(heightAt(x, z + 12) - heightAt(x, z - 12));
  if (rough > 17 || h > 110) return 'cliff';
  return h > 42 ? 'forest' : 'grass';
}
