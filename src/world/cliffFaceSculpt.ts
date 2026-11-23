import * as THREE from 'three';
import { fbm } from '../core/random';
import { AZURE_SEED } from './terrain';
import { GRAND_LAKE, MIRRORFALL } from './highlandLake';
import { waterfallCenterXAt } from './waterfallTrajectory';

type Quality = 'high' | 'low';
const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Sculpt the supplementary waterfall cliff wings, preserving an actual open
 * cleft rather than covering the waterfall with painted rock. Buttresses,
 * wandering erosion gullies and bedding shelves are physical mesh relief.
 * Rock stays behind the shared ballistic fall trajectory; this does not
 * alter the actual heightfield used for collision, water and traversal.
 */
export function createMirrorfallCliffGeometry(
  quality: Quality = 'high',
): THREE.BufferGeometry {
  const columns = quality === 'high' ? 160 : 76;
  const rows = quality === 'high' ? 112 : 58;
  const positions: number[] = [], colors: number[] = [];
  const uvs: number[] = [], indices: number[] = [];
  const slate = new THREE.Color(0x526575);
  const sandstone = new THREE.Color(0xb3aa99);
  const moss = new THREE.Color(0x465b4e);
  const rock = new THREE.Color();

  for (let row = 0; row <= rows; row++) {
    const t = row / rows; // zero at lake, one at waterfall crown
    const fallX = waterfallCenterXAt(1 - t);
    for (let col = 0; col <= columns; col++) {
      const u = col / columns * 2 - 1;
      const z = GRAND_LAKE.z + u * 211;
      const noise = fbm(u * 4.2 + t * .6,
        u * 2.4 + t * 3.2, AZURE_SEED + 781, 4);
      const top = MIRRORFALL.topY + 12
        - Math.pow(Math.abs(u), 1.25) * 38
        + fbm(u * 3.8, 0, AZURE_SEED + 379, 3) * 13;
      const y = GRAND_LAKE.surfaceY - 1
        + (top - (GRAND_LAKE.surfaceY - 1)) * t;

      // Geometry at the waterfall opening must remain almost planar.
      const wing = smoothstep(.235, .43, Math.abs(u));
      const meander = u * 21.4 + t * 2.4
        + .46 * Math.sin(t * 13.2 + u * 4.7);
      const gully = Math.pow(
        Math.max(0, 1 - Math.abs(Math.sin(meander)) * 3.3), 2);
      const buttress = 3.8 * (.5 + .5 * Math.sin(u * 13.5 + t * 2.9))
        * (.66 + .34 * Math.cos(t * 10.5 - u * 9.4));
      const weathering = 2.45 * (1 + fbm(
        u * 28 + t * 2.5, t * 15.8 - u * 1.9, AZURE_SEED + 1715, 4,
      ));
      const bedding = Math.pow(
        Math.max(0, Math.sin(y * .29 + u * 12.6 + noise)), 6);
      const relief = wing * (buttress + weathering + 5.5 * gully - 1.65 * bedding);
      // Clearance is at least 6.75 m behind the *curved* centerline,
      // including shelves that protrude toward the plunging water.
      const x = fallX + 8.4 + relief;
      positions.push(x, y, z);
      uvs.push(col / columns * 12, t * 6);

      const mineral = THREE.MathUtils.clamp(
        .42 + noise * .33 + .15 * Math.sin(y * .20 + u * 18.3)
          + .10 * Math.sin(y * .065 + u * 4.6), .06, .89,
      );
      rock.copy(slate).lerp(sandstone, mineral);
      rock.multiplyScalar(1 - (.06 + .13 * gully * wing + .07 * (1 - t)));
      const crestMoss = smoothstep(.76, 1, t)
        * (.10 + .18 * Math.max(0, noise + .35));
      rock.lerp(moss, crestMoss);
      colors.push(rock.r, rock.g, rock.b);
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const u0 = col / columns * 2 - 1;
      const u1 = (col + 1) / columns * 2 - 1;
      // Reject any cell overlapping the 0.46-wide waterfall channel.
      if (u0 < .23 && u1 > -.23) continue;
      const a = row * (columns + 1) + col, b = a + columns + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }


  // Give both sides of the open waterfall cleft actual rock thickness.
  // The previous face stopped in two razor-thin vertical edges, exposing
  // a flat sheet from oblique lake/flight cameras. These shaded return
  // walls are welded at the exact existing seam positions, and retreat
  // AWAY from the falling water; they never narrow the playable opening.
  // They share the main indexed mesh/material: zero extra draw calls.
  const cleftDepthSteps = quality === 'high' ? 8 : 5;
  const frontVertexCount = positions.length / 3;
  for (const side of [-1, 1] as const) {
    const border = side < 0
      ? Math.floor(columns * (1 - .23) * .5)
      : Math.ceil(columns * (1 + .23) * .5);
    const start = positions.length / 3;
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      const original = (row * (columns + 1) + border) * 3;
      const frontX = positions[original]!;
      const frontY = positions[original + 1]!;
      const frontZ = positions[original + 2]!;
      const frontR = colors[original]!;
      const frontG = colors[original + 1]!;
      const frontB = colors[original + 2]!;
      for (let step = 0; step <= cleftDepthSteps; step++) {
        const s = step / cleftDepthSteps;
        const incised = Math.sin(t * 18.7 + side * 1.8)
          + .40 * Math.sin(t * 43.1 - side * 3.4);
        const depth = (17.5 + 3.5 * Math.sin(t * 7.3 + side)) * s;
        // Bedding and erosion form overhanging silhouettes without
        // detaching the seam or projecting into the waterfall corridor.
        const recess = 2.6 * Math.sin(Math.PI * s) * incised;
        positions.push(
          frontX + depth + recess,
          frontY + s * (1.15 * Math.sin(t * 13.2 + side) - .7),
          frontZ + side * (3.8 * s + 1.7 * s * Math.sin(t * 9.6 + side)),
        );
        uvs.push(s * 2.4, t * 6);
        const shade = 1 - s * (.37 + .075 * Math.sin(t * 12.1 + side));
        colors.push(frontR * shade, frontG * shade, frontB * shade);
      }
    }
    for (let row = 0; row < rows; row++) {
      for (let step = 0; step < cleftDepthSteps; step++) {
        const a = start + row * (cleftDepthSteps + 1) + step;
        const b = a + cleftDepthSteps + 1;
        // Inner-facing normals point into the open chasm; never rely on
        // DoubleSide alone to hide inside-out lighting at the cleft.
        if (side < 0) indices.push(a, a + 1, b, b, a + 1, b + 1);
        else indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',
    new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.columns = columns;
  geometry.userData.rows = rows;
  geometry.userData.cleftHalfWidth = .23;
  geometry.userData.frontVertexCount = frontVertexCount;
  geometry.userData.cleftDepthSteps = cleftDepthSteps;
  return geometry;
}
