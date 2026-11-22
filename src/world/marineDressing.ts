import * as THREE from 'three';
import { rng } from '../core/random';
import { AZURE_SEED, heightAt, LANDMARKS } from './terrain';
import { lakeContains } from './highlandLake';
import { InstanceVisibility } from './instanceVisibility';
import { makeCoralBranches, makeKelpFronds } from './marineBotany';

type Quality = 'high' | 'low';
interface KelpSite { x: number; y: number; z: number; h: number; angle: number }
interface CoralSite { x: number; y: number; z: number; size: number; angle: number }

function sunkenShrine(): THREE.Group {
  const anchor = LANDMARKS.find(site => site.id === 'azure.sunken-shrine');
  if (!anchor) throw new Error('The submerged shrine is missing its anchor');
  const stone = new THREE.MeshStandardMaterial({ color: 0x63878a, roughness: .94 });
  const deepStone = new THREE.MeshStandardMaterial({ color: 0x3f6870, roughness: .94 });
  const crystal = new THREE.MeshStandardMaterial({
    color: 0x78f4d3, emissive: 0x339d9a, emissiveIntensity: 1.3, roughness: .39,
  });
  const group = new THREE.Group();
  group.name = 'structure.azure.sunken-shrine';
  const foundation = new THREE.Mesh(new THREE.CylinderGeometry(16, 20, 3, 12), deepStone);
  foundation.position.y = 1.1;
  group.add(foundation);
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2;
    const x = Math.cos(angle) * 11, z = Math.sin(angle) * 11;
    const height = i % 3 === 0 ? 7 : 11;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.85, height, 10), stone);
    column.position.set(x, 2 + height / 2, z);
    column.rotation.z = i % 3 === 0 ? .15 : 0;
    group.add(column);
    // Worn stone capitals, not giant cube silhouettes.
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 3, .92, 8), deepStone);
    cap.position.set(x, 2.4 + height, z);
    group.add(cap);
  }
  const altar = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6.5, 4, 10), stone);
  altar.position.y = 4.6;
  group.add(altar);
  const gem = new THREE.Mesh(new THREE.DodecahedronGeometry(3.4), crystal);
  gem.position.y = 10.3;
  gem.name = 'structure.azure.sunken-shrine.heart';
  group.add(gem);
  group.position.set(anchor.x, heightAt(anchor.x, anchor.z), anchor.z);
  return group;
}

/**
 * Persistent offshore botany with real leaf and branching-tube silhouettes.
 * Geometry is shared per plant type, instance populations are deterministic,
 * and camera-distance submission prevents shading the whole 4km seabed.
 */
export class MarineDressing {
  readonly group = new THREE.Group();
  readonly kelp: THREE.InstancedMesh;
  readonly coral: THREE.InstancedMesh;
  private readonly visibility = new InstanceVisibility();
  private readonly waterTime = { value: 0 };

  constructor(scene: THREE.Scene, quality: Quality = 'high') {
    this.group.name = 'habitat.azure.ocean-botany';
    const random = rng(AZURE_SEED + 1549);
    const forest: KelpSite[] = [], reef: CoralSite[] = [];
    const candidates = quality === 'high' ? 2400 : 1050;
    for (let i = 0; i < candidates; i++) {
      const x = -1880 + random() * 3760;
      const z = -1880 + random() * 3760;
      // The lake has its own freshwater species; don't plant ocean kelp
      // under Mirrorfall or allow shallow/airborne specimens.
      if (lakeContains(x, z)) continue;
      const y = heightAt(x, z);
      if (y >= -5 || y <= -57) continue;
      if (random() > .30) forest.push({
        x, y, z, h: 3 + random() * 8, angle: random() * Math.PI * 2,
      });
      if (random() > .55) reef.push({
        x, y, z, size: 1.4 + random() * 3.2,
        angle: random() * Math.PI * 2,
      });
    }

    const foliage = new THREE.MeshStandardMaterial({
      color: 0x9bc6af, vertexColors: true, roughness: .89,
      metalness: 0, side: THREE.DoubleSide,
    });
    const time = this.waterTime;
    foliage.customProgramCacheKey = () => 'scaleborn-ocean-kelp-current-v1';
    foliage.onBeforeCompile = shader => {
      shader.uniforms.uSeaKelpTime = time;
      shader.vertexShader = shader.vertexShader.replace('#include <common>',
        '#include <common>\nuniform float uSeaKelpTime;');
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          '#ifdef USE_INSTANCING',
          'float kelpPhase=instanceMatrix[3].x*.027+instanceMatrix[3].z*.051;',
          '#else',
          'float kelpPhase=0.0;',
          '#endif',
          'float kelpBend=position.y*position.y;',
          'transformed.x+=sin(uSeaKelpTime*.55+kelpPhase+position.y*2.1)*kelpBend*.055;',
          'transformed.z+=cos(uSeaKelpTime*.43+kelpPhase+position.y*1.7)*kelpBend*.065;',
        ].join('\n'));
    };
    const coralMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1bcb2, vertexColors: true, roughness: .92,
      metalness: 0, side: THREE.DoubleSide,
    });
    this.kelp = new THREE.InstancedMesh(makeKelpFronds(quality), foliage, forest.length);
    this.kelp.name = 'vegetation.azure.kelp';
    this.coral = new THREE.InstancedMesh(makeCoralBranches(quality), coralMaterial, reef.length);
    this.coral.name = 'vegetation.azure.coral';

    const dummy = new THREE.Object3D(), tint = new THREE.Color();
    forest.forEach((entry, i) => {
      dummy.position.set(entry.x, entry.y + .02, entry.z);
      dummy.rotation.set(0, entry.angle, 0);
      dummy.scale.set(entry.h * .90, entry.h, entry.h * .90);
      dummy.updateMatrix();
      this.kelp.setMatrixAt(i, dummy.matrix);
      tint.setHSL(.39 + (i % 7) * .012, .26, .57 + (i % 5) * .018);
      this.kelp.setColorAt(i, tint);
    });
    reef.forEach((entry, i) => {
      dummy.position.set(entry.x, entry.y + .015, entry.z);
      dummy.rotation.set(0, entry.angle, 0);
      dummy.scale.setScalar(entry.size);
      dummy.updateMatrix();
      this.coral.setMatrixAt(i, dummy.matrix);
      tint.setHSL(.025 + (i % 6) * .011, .41, .64 + (i % 5) * .02);
      this.coral.setColorAt(i, tint);
    });
    this.group.add(this.kelp, this.coral, sunkenShrine());
    scene.add(this.group);
    this.visibility.register(this.kelp, forest, quality === 'high' ? 480 : 305);
    this.visibility.register(this.coral, reef, quality === 'high' ? 380 : 240);
  }

  update(time: number, x: number, z: number, camera?: THREE.Camera): void {
    if (Number.isFinite(time)) this.waterTime.value = time;
    if (Number.isFinite(x) && Number.isFinite(z)) this.visibility.update(x, z, camera);
  }

  dispose(): void {
    this.group.removeFromParent();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.group.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      geometries.add(node.geometry);
      if (Array.isArray(node.material)) node.material.forEach(m => materials.add(m));
      else materials.add(node.material);
    });
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
    this.group.clear();
  }
}

/** Retained as a factory for world-scene callers. */
export function addMarineDressing(scene: THREE.Scene, quality: Quality = 'high'): MarineDressing {
  return new MarineDressing(scene, quality);
}
