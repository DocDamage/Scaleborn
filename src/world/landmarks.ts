import * as THREE from 'three';
import { AZURE_SEED, heightAt, LANDMARKS } from './terrain';
import { rng } from '../core/random';

const stone = new THREE.MeshStandardMaterial({ color: 0xc8c4a5, roughness: 0.95, flatShading: true });
const weathered = new THREE.MeshStandardMaterial({ color: 0x7e9895, roughness: 0.91, flatShading: true });
const bronze = new THREE.MeshStandardMaterial({ color: 0xb98c61, metalness: 0.16, roughness: 0.75 });
const glow = new THREE.MeshStandardMaterial({ color: 0x66d2c9, emissive: 0x2ca9ac, emissiveIntensity: 1.4 });

function cube(parent: THREE.Group, x: number, y: number, z: number,
  sx: number, sy: number, sz: number, material: THREE.Material): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
}

function column(parent: THREE.Group, x: number, z: number, radius: number, tall: number): void {
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.85, radius, tall, 9), stone);
  shaft.position.set(x, tall / 2 + 2.0, z);
  parent.add(shaft);
  for (const y of [2, 2 + tall]) {
    cube(parent, x, y, z, radius * 2.6, 1.5, radius * 2.6, bronze);
  }
}

function seaTemple(): THREE.Group {
  const anchor = LANDMARKS.find((item) => item.id === 'azure.temple');
  if (!anchor) throw new Error('Temple anchor missing');
  const group = new THREE.Group();
  group.name = 'structure.azure.temple';
  const random = rng(AZURE_SEED + 288);
  cube(group, 0, 1, 0, 75, 2, 65, weathered);
  cube(group, 0, 3, 0, 57, 2, 46, stone);
  cube(group, 0, 5, 0, 43, 2, 35, weathered);
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2;
    const x = Math.cos(angle) * 28;
    const z = Math.sin(angle) * 23;
    column(group, x, z, 2.3, 15 + random() * 3);
  }
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(7, 10, 10, 8), weathered);
  pedestal.position.y = 11;
  group.add(pedestal);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(6.5), glow);
  crystal.position.y = 23;
  crystal.rotation.z = 0.23;
  crystal.name = 'structure.azure.temple.crystal';
  group.add(crystal);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(13, 0.85, 8, 36), bronze);
  ring.position.y = 20;
  ring.rotation.x = Math.PI / 2.5;
  group.add(ring);
  for (let i = 0; i < 5; i++) {
    cube(group, 0, 0.3 + i * 0.4, 40 - i * 6, 19 + 3 * i, 0.8, 7, stone);
  }
  group.position.set(anchor.x, heightAt(anchor.x, anchor.z) - 1, anchor.z);
  return group;
}

function seaArch(): THREE.Group {
  const anchor = LANDMARKS.find((item) => item.id === 'azure.sea-arch');
  if (!anchor) throw new Error('Sea arch anchor missing');
  const group = new THREE.Group();
  group.name = 'terrain.azure.sea-arch';
  const r = rng(AZURE_SEED + 367);
  const span = 33;
  const crown = 49;
  const blocks = 17;
  // Chain of rugged tapered, offset rock segments approximating an arch,
  // without imported meshes; both legs are actually connected at the crown.
  for (let i = 0; i <= blocks; i++) {
    const angle = Math.PI - i / blocks * Math.PI;
    const x = Math.cos(angle) * span;
    const y = Math.sin(angle) * crown + 7;
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(7.7 + r() * 2.0, 0),
      i % 3 === 0 ? weathered : stone,
    );
    mesh.position.set(x, y, (r() - 0.5) * 3);
    mesh.rotation.set(r(), r() * Math.PI, r());
    mesh.scale.set(1.3, 1.14, 1.3);
    group.add(mesh);
  }
  for (const sign of [-1, 1]) {
    for (let j = 0; j < 4; j++) {
      const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(6 + r() * 3, 0), weathered);
      mesh.position.set(sign * (span + (r() - 0.5) * 5), j * 5 - 2, 0);
      mesh.scale.y = 0.8;
      group.add(mesh);
    }
  }
  group.position.set(anchor.x, heightAt(anchor.x, anchor.z) - 3.5, anchor.z);
  return group;
}

export function addAncientLandmarks(scene: THREE.Scene): void {
  scene.add(seaTemple(), seaArch());
}
