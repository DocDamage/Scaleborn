import * as THREE from 'three';
import { makeRockMaterial } from './materials';
import { makeCliffRunoffMaterial } from './cliffRunoff';
import { createMirrorfallCliffGeometry } from './cliffFaceSculpt';

/** Single eroded, open-cleft cliff face with a shared wet-rock overlay.
 * Collision remains on the existing gameplay terrain heightfield. */
export class MirrorfallCliffs {
  readonly group = new THREE.Group();
  private readonly material: THREE.MeshStandardMaterial;
  private readonly wall: THREE.Mesh;
  private readonly runoff: THREE.Mesh;
  private readonly runoffMaterial: THREE.ShaderMaterial;
  constructor(quality: 'high' | 'low' = 'high') {
    this.group.name = 'terrain.azure.mirrorfall-cliff';
    this.material = makeRockMaterial(quality);
    this.material.side = THREE.DoubleSide;
    this.material.vertexColors = true;
    const geometry = createMirrorfallCliffGeometry(quality);
    this.wall = new THREE.Mesh(geometry, this.material);
    this.wall.name = 'terrain.azure.mirrorfall-eroded-strata';
    this.wall.receiveShadow = true;
    this.wall.castShadow = quality === 'high';
    this.group.add(this.wall);
    // Exactly the existing geometry: no extra cliff tessellation or draw.
    this.runoffMaterial = makeCliffRunoffMaterial();
    this.runoff = new THREE.Mesh(geometry, this.runoffMaterial);
    this.runoff.name = 'terrain.azure.mirrorfall-wet-runnels';
    this.runoff.renderOrder = 1;
    this.group.add(this.runoff);
  }
  update(time: number): void {
    this.runoffMaterial.uniforms.uTime!.value = time;
  }
  dispose(): void {
    this.wall.geometry.dispose();
    this.material.dispose();
    this.runoffMaterial.dispose();
    this.group.removeFromParent();
  }
}
