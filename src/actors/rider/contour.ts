import * as THREE from 'three';

export interface RiderContour {
  y: number;
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
}

/** UV-unwrapped, capped garment/limb volume, continuously interpolated across
 * vertical anatomy stations. Local coordinates make every piece rig-portable. */
export function makeRiderContour(
  sections: readonly RiderContour[], sides = 24, steps = 5,
): THREE.BufferGeometry {
  if (sections.length < 2 || sides < 8 || steps < 1 ||
      !Number.isInteger(sides) || !Number.isInteger(steps) ||
      sections.some((s, i) => ![s.y, s.x, s.z, s.radiusX, s.radiusZ].every(Number.isFinite) ||
        s.radiusX <= 0 || s.radiusZ <= 0 ||
        (i > 0 && s.y <= sections[i - 1]!.y))) {
    throw new Error('Rider contour requires ascending finite stations and positive radii');
  }
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const ring = sides + 1;
  const segments = (sections.length - 1) * steps;
  const span = sections[sections.length - 1]!.y - sections[0]!.y;
  const interpolate = (i: number, t: number, key: keyof RiderContour): number => {
    const before = sections[Math.max(0, i - 1)]!;
    const a = sections[i]!;
    const b = sections[i + 1]!;
    const after = sections[Math.min(sections.length - 1, i + 2)]!;
    const slopeA = (b[key] - before[key]) / (b.y - before.y);
    const slopeB = (after[key] - a[key]) / (after.y - a.y);
    const t2 = t * t, t3 = t2 * t, width = b.y - a.y;
    return (2 * t3 - 3 * t2 + 1) * a[key] +
      (t3 - 2 * t2 + t) * slopeA * width +
      (-2 * t3 + 3 * t2) * b[key] +
      (t3 - t2) * slopeB * width;
  };
  for (let row = 0; row <= segments; row++) {
    const i = Math.min(sections.length - 2, Math.floor(row / steps));
    const t = row === segments ? 1 : (row - i * steps) / steps;
    const y = sections[i]!.y + (sections[i + 1]!.y - sections[i]!.y) * t;
    const x = interpolate(i, t, 'x');
    const z = interpolate(i, t, 'z');
    const rx = Math.max(.004, interpolate(i, t, 'radiusX'));
    const rz = Math.max(.004, interpolate(i, t, 'radiusZ'));
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      positions.push(x + Math.cos(angle) * rx, y, z + Math.sin(angle) * rz);
      uvs.push(j / sides, (y - sections[0]!.y) / span);
    }
  }
  // Correct outward winding for vertical Y-axis lofts.
  for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
    const a = i * ring + j, b = a + 1, c = a + ring, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const bottom = positions.length / 3;
  const first = sections[0]!;
  positions.push(first.x, first.y, first.z);
  uvs.push(.5, 0);
  const top = positions.length / 3;
  const last = sections[sections.length - 1]!;
  positions.push(last.x, last.y, last.z);
  uvs.push(.5, 1);
  const end = segments * ring;
  for (let j = 0; j < sides; j++) {
    indices.push(bottom, j, j + 1);
    indices.push(top, end + j + 1, end + j);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
