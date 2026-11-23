import * as THREE from 'three';
import { GRAND_LAKE, MIRRORFALL } from './highlandLake';
import { waterfallCenterXAt } from './waterfallTrajectory';

type Quality = 'high' | 'low';

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Independent, braided channels replace the three formerly solid, broad
 * rectangular waterfall sheets. At the headwater lip their gaps are small;
 * as gravity stretches the falling water, channels separate and widen before
 * reaching the plunge pool. Each channel has its own 3D folds, irregular
 * scalloped rim and width, with a feathered cross-stream UV.
 *
 * The whole veil remains ONE indexed BufferGeometry / draw per curtain, and
 * its centerline matches the shared trajectory used by collision and spray.
 * This is surface geometry, not a mass-conserving fluid solver.
 */
export function createCascadeVeilGeometry(
  width: number, zOffset: number, phase: number,
  quality: Quality = 'high',
): THREE.BufferGeometry {
  if (![width, zOffset, phase].every(Number.isFinite) || width <= 0)
    throw new RangeError('Cascade veil dimensions must be finite and positive');

  const channels = quality === 'high' ? 10 : 6;
  const rows = quality === 'high' ? 96 : 64;
  const slices = quality === 'high' ? 6 : 4;
  const drop = MIRRORFALL.topY - GRAND_LAKE.surfaceY;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];

  for (let channel = 0; channel < channels; channel++) {
    const first = positions.length / 3;
    const relative = (channel + .5) / channels - .5;
    const channelPhase = phase + channel * 2.399963229728653;
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      const split = smoothstep(.06, .87, t);
      // Wider overall footprint at the base, but increasingly separated
      // channels. Their silhouette no longer ends in a single flat bar.
      const spread = .80 + .35 * t;
      const coverage = (.95 - .40 * split)
        * (.93 + .07 * Math.sin(channelPhase) ** 2);
      const halfWidth = .5 * width / channels * spread * coverage;
      const drift = t * (1.20 * Math.sin(t * 11.1 + channelPhase)
        + .44 * Math.sin(t * 29.0 - channelPhase * 1.3));
      const centerZ = GRAND_LAKE.z + zOffset
        + relative * width * spread + drift;
      const centerX = waterfallCenterXAt(t)
        + t * (.91 * Math.sin(t * 8.9 + channelPhase)
          + .29 * Math.sin(t * 23.0 - channelPhase));
      const scallop = (1 - t) * (1 - t);

      for (let col = 0; col <= slices; col++) {
        const u = col / slices;
        const edgeFold = t * (.24 * Math.sin(u * 17.0 + t * 19.0 + channelPhase)
          + .12 * Math.sin(u * 33.0 - t * 27.0 + channelPhase));
        const z = centerZ + (u - .5) * halfWidth * 2 + edgeFold;
        const x = centerX
          + (.12 + .35 * t) * Math.sin(u * 10.0 + t * 14.0 + channelPhase);
        const lip = scallop
          * (.23 * Math.sin(u * 19.0 + channelPhase)
            + .11 * Math.sin(u * 43.0 - channelPhase));
        positions.push(x, MIRRORFALL.topY - drop * t + lip, z);
        // Local UVs feather *every* separate channel in the existing water
        // shader. The world-Z term in that shader decorrelates their detail.
        uvs.push(u, t);
      }

      if (row < rows) {
        const base = first + row * (slices + 1);
        for (let col = 0; col < slices; col++) {
          const a = base + col, b = a + slices + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',
    new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.channelCount = channels;
  geometry.userData.rowsPerChannel = rows;
  geometry.userData.slicesPerChannel = slices;
  return geometry;
}
