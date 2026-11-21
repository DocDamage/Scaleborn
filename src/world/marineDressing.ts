import * as THREE from 'three';
import { rng } from '../core/random';
import { AZURE_SEED, heightAt, LANDMARKS } from './terrain';

const stone = new THREE.MeshStandardMaterial({ color: 0x63878a, roughness: 0.94, flatShading: true });
const deepStone = new THREE.MeshStandardMaterial({ color: 0x3f6870, roughness: 0.94, flatShading: true });
const kelp = new THREE.MeshStandardMaterial({ color: 0x477d70, roughness: 0.98, flatShading: true });
const coral = new THREE.MeshStandardMaterial({ color: 0xd28f7c, roughness: 0.98, flatShading: true });
const crystal = new THREE.MeshStandardMaterial({
  color: 0x78f4d3, emissive: 0x339d9a, emissiveIntensity: 1.3, roughness: 0.39,
});

function sunkenShrine(): THREE.Group {
  const anchor = LANDMARKS.find((site) => site.id === 'azure.sunken-shrine');
  if (!anchor) throw new Error('The submerged shrine is missing its anchor');
  const group = new THREE.Group();
  group.name = 'structure.azure.sunken-shrine';
  const foundation = new THREE.Mesh(new THREE.CylinderGeometry(16, 20, 3, 12), deepStone);
  foundation.position.y = 1.1;
  group.add(foundation);
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    const x = Math.cos(angle) * 11;
    const z = Math.sin(angle) * 11;
    const height = i % 3 === 0 ? 7 : 11;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.85, height, 8), stone);
    column.position.set(x, 2 + height / 2, z);
    column.rotation.z = i % 3 === 0 ? 0.15 : 0;
    group.add(column);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 4), deepStone);
    cap.position.set(x, 2.4 + height, z);
    group.add(cap);
  }
  const altar = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6.5, 4, 10), stone);
  altar.position.y = 4.6;
  group.add(altar);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(3.4), crystal);
  gem.position.y = 10.3;
  gem.name = 'structure.azure.sunken-shrine.heart';
  group.add(gem);
  group.position.set(anchor.x, heightAt(anchor.x, anchor.z), anchor.z);
  return group;
}

/** Instanced hand-built kelp/coral clusters, only where the world is submerged. */
export function addMarineDressing(scene: THREE.Scene): void {
  const random = rng(AZURE_SEED + 1549);
  const forest: Array<{ x: number; y: number; z: number; h: number; angle: number }> = [];
  const reef: Array<{ x: number; y: number; z: number; size: number; angle: number }> = [];
  for (let i = 0; i < 1700; i++) {
    const x = -1880 + random() * 3760;
    const z = -1880 + random() * 3760;
    const y = heightAt(x, z);
    if (y < -5 && y > -57) {
      if (random() > 0.33) forest.push({ x, y, z, h: 3 + random() * 8, angle: random() * 6.28 });
      if (random() > 0.58) reef.push({ x, y, z, size: 1.4 + random() * 3.2, angle: random() * 6.28 });
    }
  }
  const stalks = new THREE.InstancedMesh(new THREE.ConeGeometry(0.26, 1, 6), kelp, forest.length);
  const branches = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), coral, reef.length);
  const transform = new THREE.Object3D();
  forest.forEach((entry, i) => {
    transform.position.set(entry.x, entry.y + entry.h / 2, entry.z);
    transform.rotation.set(0.12 * Math.sin(entry.angle), entry.angle, 0.13 * Math.cos(entry.angle));
    transform.scale.set(0.65 + entry.h * 0.035, entry.h, 0.65 + entry.h * 0.04);
    transform.updateMatrix();
    stalks.setMatrixAt(i, transform.matrix);
  });
  reef.forEach((entry, i) => {
    transform.position.set(entry.x, entry.y + entry.size * 0.45, entry.z);
    transform.rotation.set(0, entry.angle, 0);
    transform.scale.set(entry.size * 0.7, entry.size * 0.65, entry.size);
    transform.updateMatrix();
    branches.setMatrixAt(i, transform.matrix);
  });
  stalks.name = 'vegetation.azure.kelp';
  branches.name = 'vegetation.azure.coral';
  scene.add(stalks, branches, sunkenShrine());
}
