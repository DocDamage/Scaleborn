import * as THREE from 'three';
import type { DragonPose } from './animationPose';

/**
 * Original code-built deforming dragon wing.
 * Each wing has three actual skin bones and vertex weights, allowing a future
 * model swap to retain the logical leftWing/rightWing sockets.
 */
const membraneMaterial = new THREE.MeshStandardMaterial({
  side: THREE.DoubleSide, vertexColors: true, roughness: 0.81, metalness: 0.05,
});
const sparMaterial = new THREE.MeshStandardMaterial({
  color: 0x3c6972, roughness: 0.63, metalness: 0.07,
});

export interface WingRig {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  shoulder: THREE.Bone;
  elbow: THREE.Bone;
  tip: THREE.Bone;
}

function spar(parent: THREE.Bone, length: number, angleZ = 0): void {
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.11, length, 7), sparMaterial,
  );
  rod.position.x = length / 2;
  rod.rotation.z = -Math.PI / 2 + angleZ;
  parent.add(rod);
}

export function createWingRig(side: -1 | 1): WingRig {
  const root = new THREE.Group();
  root.name = side < 0 ? 'leftWing' : 'rightWing';
  root.position.set(side * 0.56, 0.40, -0.20);
  const outline: ReadonlyArray<readonly [number, number, number]> = [
    [0, 0, 0], [1.05, 0.14, -0.84], [2.45, 0.16, -1.53],
    [3.97, 0.07, -0.71], [3.72, -0.1, 0.17],
    [3.94, -0.13, 0.64], [3.21, -0.14, 0.60],
    [2.77, -0.08, 1.25], [2.16, -0.07, 0.89],
    [1.38, -0.05, 1.23], [0.63, 0, 0.75],
  ];
  const vertices: number[] = [];
  const colors: number[] = [];
  const weights: number[] = [];
  const joints: number[] = [];
  const triangles: number[] = [];
  for (let i = 0; i < outline.length; i++) {
    const point = outline[i]!;
    const dist = point[0];
    vertices.push(side * dist, point[1], point[2]);
    const gradient = Math.min(1, dist / 4);
    colors.push(0.12 + gradient * 0.05, 0.28 + gradient * 0.07, 0.33 + gradient * 0.1);
    // Three.skinWeight attributes use four influences even when two are active.
    if (dist < 1.7) {
      const t = dist / 1.7;
      joints.push(0, 1, 0, 0);
      weights.push(1 - t, t, 0, 0);
    } else {
      const t = Math.min(1, (dist - 1.7) / 2.3);
      joints.push(1, 2, 0, 0);
      weights.push(1 - t, t, 0, 0);
    }
  }
  for (let i = 1; i < outline.length - 1; i++) triangles.push(0, i, i + 1);
  const geo = new THREE.BufferGeometry();
  geo.setIndex(triangles);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(joints, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  geo.computeVertexNormals();

  const shoulder = new THREE.Bone();
  shoulder.name = side < 0 ? 'leftWing.shoulder' : 'rightWing.shoulder';
  const elbow = new THREE.Bone();
  elbow.position.set(side * 1.72, 0, -0.07);
  elbow.name = side < 0 ? 'leftWing.elbow' : 'rightWing.elbow';
  const tip = new THREE.Bone();
  tip.position.set(side * 1.55, 0, -0.02);
  tip.name = side < 0 ? 'leftWing.tip' : 'rightWing.tip';
  shoulder.add(elbow);
  elbow.add(tip);
  const mesh = new THREE.SkinnedMesh(geo, membraneMaterial);
  mesh.name = side < 0 ? 'wing.left.membrane' : 'wing.right.membrane';
  mesh.add(shoulder);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([shoulder, elbow, tip]));
  root.add(mesh);
  // The spars are thin animated bones, not detached decorative wing props.
  spar(shoulder, 1.6);
  spar(elbow, 1.5);
  spar(tip, 0.65);
  return { root, mesh, shoulder, elbow, tip };
}

/** Blend continuously between folded, launch, landing and cruise wing poses. */
export function poseWing(rig: WingRig, side: -1 | 1, pose: DragonPose): void {
  const phase = pose.flapPhase;
  const fold = Math.max(0, Math.min(1, pose.wingFold));
  const openShoulder = side * (0.11 + Math.sin(phase) * pose.flapAmount);
  const openElbow = side * (0.15 + Math.sin(phase - 0.55) * pose.flapAmount * 0.85);
  const openTip = side * (0.08 + Math.sin(phase - 1.0) * pose.flapAmount * 0.50);
  rig.shoulder.rotation.z = openShoulder * (1 - fold) - side * 0.76 * fold;
  rig.elbow.rotation.z = openElbow * (1 - fold) - side * 0.46 * fold;
  rig.tip.rotation.z = openTip * (1 - fold) - side * 0.22 * fold;
  rig.shoulder.rotation.x = Math.sin(phase + 0.3) * 0.065 * (1 - fold)
    + Math.sin(phase * 0.6) * 0.025 * fold;
}
