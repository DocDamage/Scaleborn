import * as THREE from 'three';

/** A smoothly tapered, curved keratin growth instead of an upright cone. */
export function makeSweptHorn(
  stations: readonly THREE.Vector3[], baseRadius: number, sides = 16, steps = 30,
): THREE.BufferGeometry {
  if (stations.length < 3 || !Number.isFinite(baseRadius) || baseRadius <= 0 ||
      !Number.isInteger(sides) || sides < 8 || !Number.isInteger(steps) ||
      steps < 3 || stations.some(p => ![p.x, p.y, p.z].every(Number.isFinite))) {
    throw new Error('Horn requires finite curved stations, positive radius and subdivisions');
  }
  const path = new THREE.CatmullRomCurve3([...stations], false, 'centripetal');
  const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
  const tangent = new THREE.Vector3();
  const lateral = new THREE.Vector3();
  const depth = new THREE.Vector3();
  const reference = new THREE.Vector3(0, 0, 1);
  const ring = sides + 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = path.getPoint(t);
    path.getTangent(t, tangent).normalize();
    // The forward axis is intentionally not parallel to the swept horn.
    lateral.crossVectors(tangent, reference).normalize();
    depth.crossVectors(tangent, lateral).normalize();
    const radius = baseRadius * Math.pow(1 - t, 1.3) + .003;
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius * .83;
      vertices.push(p.x + lateral.x * x + depth.x * y,
        p.y + lateral.y * x + depth.y * y,
        p.z + lateral.z * x + depth.z * y);
      uv.push(j / sides, t);
    }
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < sides; j++) {
    const a = i * ring + j, b = a + 1, c = a + ring, d = c + 1;
    indices.push(a, b, c, b, d, c);
  }
  const base = vertices.length / 3;
  const p = stations[0]!;
  vertices.push(p.x, p.y, p.z);
  uv.push(.5, 0);
  for (let j = 0; j < sides; j++) indices.push(base, j + 1, j);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
