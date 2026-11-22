import * as THREE from 'three';
import { makeOrganicLoft } from './organicLoft';

/** Sculpted anatomy is local to the existing hip socket: no collision or form-scale changes. */
type Radius = readonly [number, number];

function sweptSurface(
  controls: readonly THREE.Vector3[], radii: readonly Radius[],
  steps: number, sides: number,
): THREE.BufferGeometry {
  if (controls.length < 2 || controls.length !== radii.length ||
      controls.some(p => ![p.x, p.y, p.z].every(Number.isFinite)) ||
      radii.some(r => r.some(v => !Number.isFinite(v) || v <= 0)) ||
      steps < 2 || sides < 8) {
    throw new Error('Sculpted limb needs matched finite curves and positive radii');
  }
  const path = new THREE.CatmullRomCurve3([...controls], false, 'centripetal');
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const right = new THREE.Vector3(1, 0, 0);
  const depth = new THREE.Vector3();
  const lateral = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const point = path.getPoint(t);
    const direction = path.getTangent(t).normalize();
    // Each centerline lies in YZ. The stable X axis prevents frame twisting.
    depth.crossVectors(direction, right).normalize();
    lateral.crossVectors(depth, direction).normalize();
    const scaled = t * (radii.length - 1);
    const segment = Math.min(radii.length - 2, Math.floor(scaled));
    const local = scaled - segment;
    const blend = local * local * (3 - 2 * local);
    const a = radii[segment]!, b = radii[segment + 1]!;
    const width = a[0] + (b[0] - a[0]) * blend;
    const thickness = a[1] + (b[1] - a[1]) * blend;
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const cx = Math.cos(angle) * width, cz = Math.sin(angle) * thickness;
      positions.push(point.x + lateral.x * cx + depth.x * cz,
        point.y + lateral.y * cx + depth.y * cz,
        point.z + lateral.z * cx + depth.z * cz);
      uv.push(j / sides, t);
    }
  }
  const ring = sides + 1;
  for (let i = 0; i < steps; i++) for (let j = 0; j < sides; j++) {
    const a = i * ring + j, b = a + 1, c = a + ring, d = c + 1;
    indices.push(a, b, c, b, d, c);
  }
  const first = positions.length / 3;
  const start = controls[0]!;
  positions.push(start.x, start.y, start.z);
  uv.push(.5, 0);
  const last = positions.length / 3;
  const end = controls[controls.length - 1]!;
  positions.push(end.x, end.y, end.z);
  uv.push(.5, 1);
  for (let j = 0; j < sides; j++) {
    indices.push(first, j + 1, j);
    indices.push(last, steps * ring + j, steps * ring + j + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export interface DragonLegSculpt {
  group: THREE.Group;
  foot: THREE.Group;
}

/**
 * One continuous muscular leg, articulated paw and three curved keratin claws.
 * Foreleg and hindleg use different hock outlines, preserving the existing
 * four hip sockets and animation names for subsequent authored model swaps.
 */
export function createDragonLegSculpt(
  front: boolean, hide: THREE.Material, scute: THREE.Material, keratin: THREE.Material,
): DragonLegSculpt {
  const group = new THREE.Group();
  const hip = [
    new THREE.Vector3(0, .15, .005),
    new THREE.Vector3(0, -.08, front ? .08 : .16),
    new THREE.Vector3(0, -.27, front ? .14 : .26),
    new THREE.Vector3(0, -.47, front ? -.07 : .09),
    new THREE.Vector3(0, -.68, -.12),
  ];
  const flesh = new THREE.Mesh(sweptSurface(hip, [
    [.19, .22], [.275, .30], [.23, .24], [.165, .18], [.115, .125],
  ], 32, 22), hide);
  flesh.name = 'creature.dragon.leg-surface';
  flesh.castShadow = true;
  flesh.receiveShadow = true;
  group.add(flesh);

  const foot = new THREE.Group();
  foot.name = 'creature.dragon.ankle';
  foot.position.set(0, -.63, -.13);
  const paw = new THREE.Mesh(makeOrganicLoft([
    { z: -.35, y: -.025, width: .13, height: .065 },
    { z: -.28, y: -.035, width: .23, height: .115 },
    { z: -.13, y: -.015, width: .265, height: .15 },
    { z: .08, y: .007, width: .22, height: .14 },
    { z: .21, y: .03, width: .115, height: .085 },
  ], 24, 6), scute);
  paw.name = 'creature.dragon.paw-surface';
  paw.castShadow = true;
  foot.add(paw);
  for (const [index, offset] of [-.165, 0, .165].entries()) {
    const claw = new THREE.Mesh(sweptSurface([
      new THREE.Vector3(offset, -.045, -.31),
      new THREE.Vector3(offset, -.057, -.40),
      new THREE.Vector3(offset, -.103, -.48),
      new THREE.Vector3(offset, -.15, -.57),
    ], [
      [.065, .064], [.055, .051], [.027, .025], [.004, .004],
    ], 14, 10), keratin);
    claw.name = 'creature.dragon.claw.' + index;
    claw.castShadow = true;
    foot.add(claw);
  }
  group.add(foot);
  return { group, foot };
}
