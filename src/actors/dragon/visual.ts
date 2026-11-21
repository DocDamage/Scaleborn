import * as THREE from 'three';
import type { FlightState } from './flight';

const skin = new THREE.MeshStandardMaterial({ color: 0x273b47, roughness: 0.64, metalness: 0.14 });
const highlight = new THREE.MeshStandardMaterial({ color: 0x3a6670, roughness: 0.54, metalness: 0.18 });
const ridges = new THREE.MeshStandardMaterial({ color: 0x192b36, roughness: 0.78 });
const wingMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true, side: THREE.DoubleSide, roughness: 0.77, metalness: 0.08,
});
const amber = new THREE.MeshStandardMaterial({
  color: 0x8fe3c0, emissive: 0x26544c, emissiveIntensity: 0.55, roughness: 0.32,
});
const pupil = new THREE.MeshStandardMaterial({ color: 0x152429, roughness: 0.5 });

function ellipsoid(parent: THREE.Group, material: THREE.Material,
  pos: [number, number, number], scale: [number, number, number], detail = 12): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, detail, 9), material);
  mesh.position.set(...pos);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

function rod(parent: THREE.Group, material: THREE.Material,
  from: THREE.Vector3, to: THREE.Vector3, r1: number, r2 = r1 * 0.55): void {
  const direction = to.clone().sub(from);
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(r2, r1, direction.length(), 7), material,
  );
  cylinder.position.copy(from).addScaledVector(direction, 0.5);
  cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  parent.add(cylinder);
}

function wing(side: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(side * 0.56, 0.4, -0.20);
  const boundary = [
    [0, 0, 0], [1.0, 0.12, -0.85], [2.50, 0.18, -1.5],
    [3.95, 0.13, -0.55], [3.55, -0.13, 0.12],
    [3.75, -0.10, 0.62], [3.05, -0.14, 0.62],
    [2.62, -0.10, 1.22], [2.07, -0.08, 0.89],
    [1.38, -0.06, 1.20], [0.72, 0.0, 0.76],
  ];
  const vertices: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < boundary.length; i++) {
    const point = boundary[i];
    if (!point) continue;
    vertices.push(side * point[0]!, point[1]!, point[2]!);
    const edge = i / (boundary.length - 1);
    colors.push(0.12 + edge * 0.10, 0.29 + edge * 0.11, 0.32 + edge * 0.08);
  }
  for (let i = 1; i < boundary.length - 1; i++) indices.push(0, i, i + 1);
  const meshGeometry = new THREE.BufferGeometry();
  meshGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  meshGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  meshGeometry.setIndex(indices);
  meshGeometry.computeVertexNormals();
  const membrane = new THREE.Mesh(meshGeometry, wingMaterial);
  membrane.name = side < 0 ? 'wing.left.membrane' : 'wing.right.membrane';
  group.add(membrane);
  const base = new THREE.Vector3(0, 0, 0);
  for (const index of [2, 3, 5, 7, 9]) {
    const point = boundary[index];
    if (!point) continue;
    rod(group, highlight, base,
      new THREE.Vector3(side * point[0]!, point[1]!, point[2]!), 0.095, 0.023);
  }
  return group;
}

function makeRider(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'character.rider.hero';
  group.position.set(0, 0.7, -0.38);
  const coat = new THREE.MeshStandardMaterial({ color: 0xa97453, roughness: 0.91 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x3c6674, roughness: 0.9 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xcca586, roughness: 0.93 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x332d2b, roughness: 0.95 });
  ellipsoid(group, cloth, [0, 0.78, 0.10], [0.28, 0.43, 0.20]);
  ellipsoid(group, skinMaterial, [0, 1.38, -0.03], [0.23, 0.29, 0.22]);
  ellipsoid(group, hair, [0, 1.55, 0.02], [0.245, 0.16, 0.23]);
  for (const side of [-1, 1]) {
    ellipsoid(group, coat, [side * 0.29, 0.76, -0.17], [0.105, 0.41, 0.12]);
    ellipsoid(group, skinMaterial, [side * 0.25, 0.41, -0.38], [0.12, 0.12, 0.12]);
    ellipsoid(group, cloth, [side * 0.22, 0.28, 0.26], [0.16, 0.30, 0.17]);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.082, 0.28, 6), skinMaterial);
    horn.position.set(side * 0.155, 1.77, -0.07);
    horn.rotation.z = side * -0.35;
    group.add(horn);
  }
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.37, 0.85, 5, 1, true), coat);
  cloak.rotation.x = -0.13;
  cloak.position.set(0, 0.58, 0.23);
  group.add(cloak);
  return group;
}

/** Runtime-authored prototype model; future GLB replacement uses the same named sockets. */
export class DragonVisual {
  readonly root = new THREE.Group();
  private readonly wingL: THREE.Group;
  private readonly wingR: THREE.Group;
  private readonly tail = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly rider: THREE.Group;

  constructor() {
    this.root.name = 'creature.dragon.onyx';
    ellipsoid(this.root, skin, [0, 0, 0], [0.79, 0.66, 1.72], 20);
    ellipsoid(this.root, highlight, [0, 0.39, -0.40], [0.54, 0.31, 1.20]);
    ellipsoid(this.root, skin, [0, 0.32, -1.28], [0.50, 0.55, 0.78]);
    this.head.position.set(0, 0.42, -1.83);
    ellipsoid(this.head, skin, [0, 0.1, -0.18], [0.62, 0.45, 0.72], 18);
    ellipsoid(this.head, highlight, [0, -0.11, -0.62], [0.49, 0.26, 0.65], 16);
    for (const side of [-1, 1]) {
      ellipsoid(this.head, amber, [side * 0.50, 0.21, -0.39], [0.17, 0.21, 0.09], 14);
      ellipsoid(this.head, pupil, [side * 0.56, 0.22, -0.45], [0.06, 0.16, 0.05], 10);
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.76, 6), ridges);
      crest.position.set(side * 0.42, 0.68, 0.24);
      crest.rotation.x = 0.42;
      crest.rotation.z = side * -0.18;
      this.head.add(crest);
      const ear = ellipsoid(this.head, highlight, [side * 0.68, 0.4, 0.08], [0.19, 0.30, 0.16]);
      ear.rotation.z = side * -0.65;
    }
    this.root.add(this.head);
    for (const px of [-0.53, 0.53]) {
      for (const pz of [-1.05, 1.06]) {
        ellipsoid(this.root, skin, [px, -0.61, pz], [0.29, 0.65, 0.28]);
        ellipsoid(this.root, ridges, [px, -1.15, pz - 0.10], [0.33, 0.15, 0.45]);
        for (const toe of [-0.14, 0.14]) {
          const claw = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.30, 6), highlight);
          claw.rotation.x = -Math.PI / 2;
          claw.position.set(px + toe, -1.17, pz - 0.42);
          this.root.add(claw);
        }
      }
    }
    this.wingL = wing(-1);
    this.wingR = wing(1);
    this.root.add(this.wingL, this.wingR);
    this.tail.position.set(0, 0, 1.38);
    for (let i = 0; i < 6; i++) {
      ellipsoid(this.tail, i % 2 ? skin : highlight,
        [0, -i * 0.045, i * 0.44],
        [0.37 - i * 0.045, 0.33 - i * 0.043, 0.44]);
    }
    const fluke = wing(1);
    fluke.scale.set(0.46, 0.70, 0.55);
    fluke.position.set(-0.08, -0.15, 2.70);
    fluke.rotation.y = Math.PI / 2;
    this.tail.add(fluke);
    this.root.add(this.tail);
    this.rider = makeRider();
    this.root.add(this.rider);
    this.root.userData.assetId = 'creature.dragon.onyx';
  }

  update(state: FlightState): void {
    this.root.position.set(state.x, state.y, state.z);
    this.root.rotation.order = 'YXZ';
    this.root.rotation.set(state.pitch, -state.yaw, state.roll);
    const flapPhase = state.time * (state.speed > 87 ? 8.5 : 5.8);
    const wingsUp = 0.20 + Math.sin(flapPhase) * (state.speed > 87 ? 0.45 : 0.31);
    this.wingL.rotation.z = -wingsUp;
    this.wingR.rotation.z = wingsUp;
    this.wingL.rotation.x = Math.sin(flapPhase + 0.8) * 0.08;
    this.wingR.rotation.x = Math.sin(flapPhase + 0.8) * 0.08;
    this.tail.rotation.y = Math.sin(state.time * 2.3) * 0.08 - state.roll * 0.22;
    this.tail.rotation.x = Math.sin(state.time * 1.6) * 0.05;
    this.head.rotation.y = -state.roll * 0.13;
    this.rider.rotation.z = -state.roll * 0.24;
  }
}
