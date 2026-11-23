import * as THREE from 'three';

type Quality = 'high' | 'low';

/**
 * Original tapered kelp blades, with curved spines and varied twist. Geometry
 * is in normalized plant coordinates so large and small specimens can share
 * one draw call. Every blade is an actual curved leaf, not a stretched cone.
 */
export function makeKelpFronds(quality: Quality): THREE.BufferGeometry {
  const blades = quality === 'high' ? 8 : 5;
  const steps = quality === 'high' ? 14 : 9;
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const bladeColor = new THREE.Color();
  for (let blade = 0; blade < blades; blade++) {
    const phase = blade * 2.399963229728653;
    const height = .72 + .28 * (.5 + .5 * Math.sin(blade * 3.14 + .8));
    const base = positions.length / 3;
    for (let row = 0; row <= steps; row++) {
      const t = row / steps;
      const sweep = .045 + .33 * t * t + .045 * Math.sin(t * 5 + phase) * t;
      const bendAngle = phase + .40 * t + .11 * Math.sin(t * 4 + phase);
      const rootX = Math.cos(bendAngle) * sweep;
      const rootZ = Math.sin(bendAngle) * sweep;
      const tangentX = -Math.sin(bendAngle + t * .34);
      const tangentZ = Math.cos(bendAngle + t * .34);
      const width = (.012 + .105 * Math.pow(Math.sin(Math.PI * t), .7))
        * (1 + .20 * Math.sin(phase * 2.1));
      for (let edge = 0; edge < 2; edge++) {
        const sign = edge === 0 ? -1 : 1;
        const twist = .020 * sign * Math.sin(t * 7 + phase) * t;
        positions.push(
          rootX + tangentX * width * sign,
          .012 + height * t + twist,
          rootZ + tangentZ * width * sign,
        );
        bladeColor.setRGB(.32 + t * .27, .51 + t * .29, .31 + t * .20);
        colors.push(bladeColor.r, bladeColor.g, bladeColor.b);
      }
      if (row < steps) {
        const a = base + row * 2, b = a + 2;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Short irregular branching coral tubes, replacing faceted floating rocks.
 * Each branch has an actual tapered cross section and warmer growth tips.
 * It is static original geometry, not photogrammetry or animated coral.
 */
export function makeCoralBranches(quality: Quality): THREE.BufferGeometry {
  const sides = quality === 'high' ? 9 : 6;
  const branches = quality === 'high' ? 10 : 6;
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const vertical = new THREE.Vector3(0, 1, 0);
  const axis = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const bitangent = new THREE.Vector3();
  const color = new THREE.Color();
  const addSegment = (
    from: THREE.Vector3, to: THREE.Vector3,
    baseRadius: number, tipRadius: number, tint: number,
  ): void => {
    axis.subVectors(to, from).normalize();
    tangent.crossVectors(axis, vertical);
    if (tangent.lengthSq() < .01) tangent.set(1, 0, 0);
    tangent.normalize();
    bitangent.crossVectors(axis, tangent).normalize();
    const start = positions.length / 3;
    for (let ring = 0; ring <= 1; ring++) {
      const origin = ring === 0 ? from : to;
      const radius = ring === 0 ? baseRadius : tipRadius;
      for (let side = 0; side <= sides; side++) {
        const angle = side / sides * Math.PI * 2;
        const dx = tangent.x * Math.cos(angle) + bitangent.x * Math.sin(angle);
        const dy = tangent.y * Math.cos(angle) + bitangent.y * Math.sin(angle);
        const dz = tangent.z * Math.cos(angle) + bitangent.z * Math.sin(angle);
        const irregular = 1 + .11 * Math.sin(side * 2.5 + tint * 13);
        positions.push(origin.x + dx * radius * irregular,
          origin.y + dy * radius * irregular,
          origin.z + dz * radius * irregular);
        color.setRGB(.66 + tint * .16 + ring * .12,
          .36 + tint * .14 + ring * .10, .30 + tint * .12 + ring * .10);
        colors.push(color.r, color.g, color.b);
      }
    }
    for (let side = 0; side < sides; side++) {
      const a = start + side, b = start + sides + 1 + side;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  };
  const center = new THREE.Vector3(0, .54, 0);
  addSegment(new THREE.Vector3(0, 0, 0), center, .15, .085, .15);
  for (let branch = 0; branch < branches; branch++) {
    const angle = 2.399963229728653 * branch;
    const origin = new THREE.Vector3(
      .025 * Math.cos(angle), .17 + (branch % 4) * .10, .025 * Math.sin(angle));
    const elbow = new THREE.Vector3(
      Math.cos(angle) * (.17 + branch % 3 * .045),
      .54 + (branch % 4) * .040,
      Math.sin(angle) * (.17 + branch % 3 * .045));
    const tip = new THREE.Vector3(
      elbow.x * (1.46 + .15 * Math.sin(branch * 2.1)),
      .79 + (branch % 5) * .047,
      elbow.z * (1.46 + .15 * Math.cos(branch * 2.1)));
    addSegment(origin, elbow, .075, .051, branch / branches);
    addSegment(elbow, tip, .051, .008, branch / branches);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
