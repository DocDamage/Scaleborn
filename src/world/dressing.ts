import * as THREE from 'three';
import { addAncientLandmarks } from './landmarks';
import { rng, hash2, fbm } from '../core/random';
import { AZURE_SEED, heightAt, LANDMARKS } from './terrain';

const mat = (color: number): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true });

const bark = mat(0x574638);
const leaves = mat(0x739270);
const masonry = mat(0xd3b69a);
const timbers = mat(0x493c34);
const roofMat = mat(0x775e64);
const windowMat = new THREE.MeshStandardMaterial({
  color: 0xe7be86, emissive: 0x664322, emissiveIntensity: 0.35, roughness: 0.5,
});

function block(parent: THREE.Object3D, size: [number, number, number],
  position: [number, number, number], material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

/** Simple painted gables, recessed openings, wooden beams and chimneys, not a cube proxy. */
function cottage(x: number, z: number, angle: number, index: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'structure.azure.cottage.' + index;
  const rand = rng(AZURE_SEED + index * 4127);
  const width = 12 + rand() * 5;
  const depth = 11 + rand() * 4;
  const wallHeight = 7 + rand() * 2;
  const rise = 5 + rand() * 2;
  const localPlaster = mat([0xdcc0a4, 0xcbb29f, 0xc6c4b1, 0xe0c6a0][index % 4] ?? 0xdcc0a4);
  block(group, [width, wallHeight, depth], [0, wallHeight / 2, 0], localPlaster);
  // Extruded gabled roof: an actual triangular prism with sloping roof surfaces.
  const profile = new THREE.Shape();
  profile.moveTo(-width / 2 - 1.6, wallHeight - 0.25);
  profile.lineTo(0, wallHeight + rise);
  profile.lineTo(width / 2 + 1.6, wallHeight - 0.25);
  profile.closePath();
  const roof = new THREE.Mesh(
    new THREE.ExtrudeGeometry(profile, { depth: depth + 2.5, bevelEnabled: false }),
    roofMat,
  );
  roof.position.z = -depth / 2 - 1.25;
  group.add(roof);
  for (const side of [-1, 1]) {
    block(group, [0.6, wallHeight, 0.65], [side * (width / 2 - 0.4), wallHeight / 2, -depth / 2 - 0.4], timbers);
    block(group, [2.7, 3.6, 0.28], [side * (width / 3), 3.7, -depth / 2 - 0.25], timbers);
    block(group, [1.8, 2.6, 0.18], [side * (width / 3), 3.8, -depth / 2 - 0.48], windowMat);
  }
  block(group, [2.7, 4.7, 0.3], [0, 2.35, -depth / 2 - 0.3], timbers);
  block(group, [0.35, 0.35, 0.4], [0.8, 2.5, -depth / 2 - 0.55], windowMat);
  block(group, [1.8, 5.5, 1.8], [width * 0.28, wallHeight + 3.2, depth * 0.20], masonry);
  group.position.set(x, heightAt(x, z) - 0.3, z);
  group.rotation.y = angle;
  return group;
}

function lighthouse(x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'structure.azure.lighthouse';
  const stone = mat(0xe8d9be);
  const teal = mat(0x426a70);
  const lantern = new THREE.MeshStandardMaterial({
    color: 0xffe0a1, emissive: 0xffc16e, emissiveIntensity: 2.2,
  });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 7, 35, 12, 4), stone);
  tower.position.y = 18;
  group.add(tower);
  for (const y of [9, 18, 27]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(6.15, 6.45, 1.4, 12), teal);
    band.position.y = y;
    group.add(band);
  }
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(8.3, 7.2, 1.6, 12), teal);
  deck.position.y = 36;
  group.add(deck);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 6, 12), lantern);
  glass.position.y = 39.6;
  group.add(glass);
  const cupola = new THREE.Mesh(new THREE.ConeGeometry(6.8, 6, 12), teal);
  cupola.position.y = 45.8;
  group.add(cupola);
  group.position.set(x, heightAt(x, z), z);
  return group;
}

/** Deterministic foliage/stone instances: low draw calls, original generated silhouettes. */
function makeFoliage(scene: THREE.Scene): void {
  const random = rng(AZURE_SEED + 517);
  const trees: Array<{x: number; y: number; z: number; s: number; hue: number}> = [];
  const rocks: Array<{x: number; y: number; z: number; s: number}> = [];
  for (let i = 0; i < 5400; i++) {
    const x = -1750 + random() * 3500;
    const z = -1750 + random() * 3500;
    const y = heightAt(x, z);
    const hasRoom = Math.hypot(x + 1220, z - 105) > 140;
    const woodland = fbm(x * 0.002, z * 0.002, AZURE_SEED + 911, 3);
    if (y > 9 && y < 117 && hasRoom && woodland > -0.24 && random() > 0.14) {
      trees.push({ x, y, z, s: 3.6 + random() * 5.5, hue: random() });
    } else if (y > -1 && random() > 0.48) {
      rocks.push({ x, y, z, s: 2 + random() * 7 });
    }
  }
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.28, 1, 7), bark, trees.length);
  const crown1 = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), leaves, trees.length);
  const crown2 = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), leaves, trees.length);
  const object = new THREE.Object3D();
  const tint = new THREE.Color();
  trees.forEach((t, i) => {
    object.position.set(t.x, t.y + t.s * 0.54, t.z);
    object.rotation.set(0, t.hue * Math.PI * 2, 0);
    object.scale.set(t.s * 0.12, t.s * 1.08, t.s * 0.12);
    object.updateMatrix();
    trunk.setMatrixAt(i, object.matrix);
    object.position.y = t.y + t.s * 1.28;
    object.scale.set(t.s * 0.46, t.s * 0.67, t.s * 0.44);
    object.updateMatrix();
    crown1.setMatrixAt(i, object.matrix);
    object.position.set(t.x + t.s * 0.19, t.y + t.s * 1.78, t.z - t.s * 0.14);
    object.scale.set(t.s * 0.34, t.s * 0.43, t.s * 0.36);
    object.updateMatrix();
    crown2.setMatrixAt(i, object.matrix);
    if (t.hue < 0.11) tint.setHSL(0.10, 0.38, 0.46);
    else if (t.hue < 0.22) tint.setHSL(0.045, 0.30, 0.40);
    else tint.setHSL(0.27 + t.hue * 0.10, 0.27 + t.hue * 0.12, 0.33 + t.hue * 0.15);
    crown1.setColorAt(i, tint);
    crown2.setColorAt(i, tint.clone().multiplyScalar(1.17));
  });
  trunk.name = 'vegetation.azure.tree.trunks';
  scene.add(trunk, crown1, crown2);
  const rockMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0), mat(0x8d8882), rocks.length,
  );
  rocks.forEach((r, i) => {
    object.position.set(r.x, r.y + r.s * 0.15, r.z);
    object.rotation.set(random(), random() * 6.28, random() * 0.3);
    object.scale.set(r.s, r.s * 0.42, r.s * (0.5 + random() * 0.5));
    object.updateMatrix();
    rockMesh.setMatrixAt(i, object.matrix);
  });
  rockMesh.name = 'terrain.azure.coastal-stone';
  scene.add(rockMesh);
}

/** Layered, irregular cloud clusters instead of flat single ellipsoids. */
function clouds(scene: THREE.Scene): void {
  const r = rng(AZURE_SEED + 81);
  const material = new THREE.MeshLambertMaterial({
    color: 0xffe5d4, transparent: true, opacity: 0.78, depthWrite: false,
  });
  const clusters = 54, puffs = 5;
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), material, clusters * puffs);
  const object = new THREE.Object3D();
  let index = 0;
  for (let i = 0; i < clusters; i++) {
    const cx = (r() - 0.5) * 4900, cz = (r() - 0.5) * 4900;
    const cy = 260 + r() * 350, width = 40 + r() * 68;
    for (let p = 0; p < puffs; p++) {
      const middle = p === 0;
      object.position.set(cx + (r() - 0.5) * width * 2.2,
        cy + (r() - 0.5) * 13 + (middle ? 8 : 0),
        cz + (r() - 0.5) * width * 1.3);
      object.scale.set((middle ? 1.2 : 0.65 + r() * 0.4) * width,
        (middle ? 1.0 : 0.7 + r() * 0.4) * (14 + r() * 12),
        (middle ? 1.1 : 0.65 + r() * 0.55) * width * 0.68);
      object.rotation.set(0, r() * Math.PI, 0);
      object.updateMatrix();
      mesh.setMatrixAt(index++, object.matrix);
    }
  }
  mesh.name = 'sky.azure.cloud-bank';
  scene.add(mesh);
}

export function addCoastalDressing(scene: THREE.Scene): void {
  makeFoliage(scene);
  clouds(scene);
  addAncientLandmarks(scene);
  const harbor = LANDMARKS.find((l) => l.id === 'azure.harbor');
  const beacon = LANDMARKS.find((l) => l.id === 'azure.lighthouse');
  if (!harbor || !beacon) throw new Error('Missing required Azure Coast landmarks');
  for (let i = 0; i < 12; i++) {
    const row = Math.floor(i / 4), column = i % 4;
    const x = harbor.x + column * 33 - 53 + (hash2(i, 5, AZURE_SEED) - 0.5) * 10;
    const z = harbor.z + row * 36 - 35;
    scene.add(cottage(x, z, Math.PI * (0.08 + hash2(i, 11, AZURE_SEED) * 0.06), i));
  }
  scene.add(lighthouse(beacon.x, beacon.z));
  // Harbor piers with repeated tapered pilings, intentionally anchored at sea level.
  for (let pier = 0; pier < 3; pier++) {
    const z = harbor.z + pier * 42 - 41;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(95, 1.7, 7), timbers);
    deck.position.set(-1375, 2.2, z);
    scene.add(deck);
    for (let k = 0; k < 5; k++) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 14, 7), bark);
      beam.position.set(-1410 + k * 20, -3.5, z + (k % 2 ? 2.5 : -2.5));
      scene.add(beam);
    }
  }
}
