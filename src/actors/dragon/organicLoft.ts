import * as THREE from 'three';

/**
 * Smooth, closed elliptical loft through measured cross-sections. End caps,
 * coherent UVs and a shared indexed surface replace stacks of intersecting
 * spheres while retaining a renderer-neutral creature silhouette profile.
 */
export interface LoftSection {
  z: number;
  y: number;
  width: number;
  height: number;
}

function hermite(sections: readonly LoftSection[], index: number,
  t: number, key: 'y' | 'width' | 'height'): number {
  const a = sections[Math.max(0, index - 1)]!;
  const b = sections[index]!;
  const c = sections[index + 1]!;
  const d = sections[Math.min(sections.length - 1, index + 2)]!;
  const span = c.z - b.z;
  const tangentB = (c[key] - a[key]) / (c.z - a.z);
  const tangentC = (d[key] - b[key]) / (d.z - b.z);
  const t2 = t * t, t3 = t2 * t;
  return (2*t3-3*t2+1)*b[key] + (t3-2*t2+t)*span*tangentB
    + (-2*t3+3*t2)*c[key] + (t3-t2)*span*tangentC;
}

export function makeOrganicLoft(
  sections: readonly LoftSection[],
  radialSegments = 28,
  stepsPerSection = 7,
): THREE.BufferGeometry {
  if (sections.length < 2 || radialSegments < 8 || stepsPerSection < 1 ||
      !Number.isInteger(radialSegments) || !Number.isInteger(stepsPerSection) ||
      sections.some((s, i) => ![s.z, s.y, s.width, s.height].every(Number.isFinite)
        || s.width <= 0 || s.height <= 0 || (i > 0 && s.z <= sections[i-1]!.z))) {
    throw new Error('Organic loft requires ordered finite sections and valid subdivisions');
  }
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const slices = (sections.length - 1) * stepsPerSection;
  const ring = radialSegments + 1;
  const firstZ = sections[0]!.z;
  const spanZ = sections[sections.length-1]!.z - firstZ;
  for (let i=0; i<=slices; i++) {
    const interval = Math.min(sections.length-2, Math.floor(i/stepsPerSection));
    const t = i===slices ? 1 : (i-interval*stepsPerSection)/stepsPerSection;
    const a = sections[interval]!, b = sections[interval+1]!;
    const z = a.z + (b.z-a.z)*t;
    const centerY = hermite(sections, interval, t, 'y');
    const width = Math.max(.008, hermite(sections, interval, t, 'width'));
    const height = Math.max(.008, hermite(sections, interval, t, 'height'));
    for (let j=0; j<=radialSegments; j++) {
      const theta = j/radialSegments*Math.PI*2;
      positions.push(Math.cos(theta)*width, centerY+Math.sin(theta)*height, z);
      uvs.push(j/radialSegments, (z-firstZ)/spanZ);
    }
  }
  // The triangle winding is outward on both sides of the loft.
  for (let i=0; i<slices; i++) for (let j=0; j<radialSegments; j++) {
    const a=i*ring+j, b=a+1, c=a+ring, d=c+1;
    indices.push(a,b,c,b,d,c);
  }
  // Close both ends; narrow caps prevent silhouettes from appearing hollow.
  const front = positions.length/3;
  positions.push(0, sections[0]!.y, firstZ);
  uvs.push(.5,0);
  const rear = positions.length/3;
  positions.push(0, sections[sections.length-1]!.y, sections[sections.length-1]!.z);
  uvs.push(.5,1);
  for (let j=0; j<radialSegments; j++) {
    indices.push(front,j+1,j);
    const end=slices*ring;
    indices.push(rear,end+j,end+j+1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
