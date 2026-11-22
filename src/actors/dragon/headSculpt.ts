import * as THREE from 'three';
import { makeOrganicLoft } from './organicLoft';

interface HeadMaterials {
  skin: THREE.Material;
  highlight: THREE.Material;
  ridges: THREE.Material;
  iris: THREE.Material;
  pupil: THREE.Material;
  glimmer: THREE.Material;
}

export interface DragonHeadSculpt {
  eyes: THREE.Group[];
}

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

function addSurface(parent: THREE.Object3D, name: string,
  geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/**
 * Dragon face assembled from continuous lofted cranium and jaw surfaces,
 * recessed eyes, sculpted brow contours and backward-swept horns. Geometry
 * remains in the original head pivot; creature collision and animation rig
 * do not change. All materials are supplied by the existing PBR skin system.
 */
export function sculptDragonHead(
  head: THREE.Group, materials: HeadMaterials,
): DragonHeadSculpt {
  addSurface(head, 'creature.dragon.skull', makeOrganicLoft([
    { z: -1.24, y: -.17, width: .245, height: .125 },
    { z: -1.08, y: -.12, width: .33, height: .18 },
    { z: -.85, y: -.07, width: .40, height: .23 },
    { z: -.57, y: .065, width: .55, height: .35 },
    { z: -.22, y: .14, width: .63, height: .43 },
    { z: .20, y: .13, width: .54, height: .39 },
    { z: .49, y: .09, width: .34, height: .26 },
    { z: .66, y: .08, width: .15, height: .13 },
  ], 36, 8), materials.skin);
  addSurface(head, 'creature.dragon.lower-jaw', makeOrganicLoft([
    { z: -1.23, y: -.288, width: .19, height: .052 },
    { z: -1.06, y: -.319, width: .295, height: .075 },
    { z: -.79, y: -.326, width: .365, height: .095 },
    { z: -.47, y: -.308, width: .43, height: .12 },
    { z: -.22, y: -.255, width: .39, height: .10 },
  ], 28, 7), materials.highlight);

  const eyes: THREE.Group[] = [];
  for (const side of [-1, 1] as const) {
    const label = side < 0 ? 'left' : 'right';
    // Eyes are held in one local blink socket, not animated as detached beads.
    const socket = new THREE.Group();
    socket.name = 'creature.dragon.eye.' + label;
    socket.position.set(side * .465, .27, -.49);
    socket.rotation.y = side * .30;
    const sclera = addSurface(socket, 'creature.dragon.iris.' + label,
      new THREE.SphereGeometry(1, 22, 16), materials.iris);
    sclera.position.z = -.01;
    sclera.scale.set(.117, .107, .055);
    const pupil = addSurface(socket, 'creature.dragon.pupil.' + label,
      new THREE.SphereGeometry(1, 18, 12), materials.pupil);
    pupil.position.set(side * .005, .002, -.060);
    pupil.scale.set(.044, .081, .022);
    const glint = addSurface(socket, 'creature.dragon.glint.' + label,
      new THREE.SphereGeometry(1, 12, 8), materials.glimmer);
    glint.position.set(-.031, .040, -.078);
    glint.scale.set(.018, .021, .01);
    head.add(socket);
    eyes.push(socket);

    addSurface(head, 'creature.dragon.brow.' + label, makeSweptHorn([
      new THREE.Vector3(side * .235, .376, -.70),
      new THREE.Vector3(side * .39, .408, -.63),
      new THREE.Vector3(side * .54, .399, -.48),
      new THREE.Vector3(side * .58, .345, -.32),
    ], .069, 12, 20), materials.ridges);

    // Swept, asymmetrically tapered horn grows backward from the skull.
    addSurface(head, 'creature.dragon.horn.' + label, makeSweptHorn([
      new THREE.Vector3(side * .40, .48, .12),
      new THREE.Vector3(side * .47, .66, .24),
      new THREE.Vector3(side * .56, .83, .40),
      new THREE.Vector3(side * .69, .95, .62),
      new THREE.Vector3(side * .79, 1.02, .83),
    ], .16, 18, 36), materials.ridges);
    addSurface(head, 'creature.dragon.cheek-spur.' + label, makeSweptHorn([
      new THREE.Vector3(side * .51, -.035, -.11),
      new THREE.Vector3(side * .64, .01, .06),
      new THREE.Vector3(side * .74, .03, .20),
    ], .095, 12, 18), materials.highlight);

    // Carved mouth seam and two narrow nostrils avoid circular muzzle blobs.
    const lipCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * .23, -.285, -1.17),
      new THREE.Vector3(side * .33, -.312, -.89),
      new THREE.Vector3(side * .405, -.29, -.57),
      new THREE.Vector3(side * .44, -.225, -.35),
    ]);
    addSurface(head, 'creature.dragon.mouth-seam.' + label,
      new THREE.TubeGeometry(lipCurve, 20, .012, 6, false), materials.ridges);
    const nostril = addSurface(head, 'creature.dragon.nostril.' + label,
      new THREE.SphereGeometry(1, 12, 8), materials.ridges);
    nostril.position.set(side * .20, -.035, -1.105);
    nostril.scale.set(.044, .012, .062);
    nostril.rotation.x = -.14;
  }
  return { eyes };
}
