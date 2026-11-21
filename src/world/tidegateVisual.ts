import * as THREE from 'three';
import { heightAt } from './terrain';
import { TIDEGATE, type TidegateState } from './tidegate';

const stone = new THREE.MeshStandardMaterial({ color: 0x9ea6a4, roughness: 0.87, flatShading: true });
const gilding = new THREE.MeshStandardMaterial({ color: 0xa98b62, roughness: 0.7, metalness: 0.22 });
const dormant = new THREE.MeshStandardMaterial({ color: 0x4e777a, roughness: 0.52, emissive: 0x215056 });
const active = new THREE.MeshStandardMaterial({ color: 0x9ae8d4, roughness: 0.32, emissive: 0x50b8ad, emissiveIntensity: 0.8 });
const beaconMaterial = new THREE.MeshStandardMaterial({
  color: 0xe6d4ad, emissive: 0x8cb6a6, emissiveIntensity: 1.1, transparent: true, opacity: 0.74,
});

function addStone(parent: THREE.Group, x: number, y: number, z: number, width: number, height: number): void {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.88, width, height, 10), stone);
  mesh.position.set(x, y, z);
  parent.add(mesh);
}

function rune(parent: THREE.Group, x: number, z: number, y: number, label: string): THREE.Mesh {
  addStone(parent, x, y, z, 1.6, 0.9);
  const line = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.14, 7, 24), gilding);
  line.rotation.x = -Math.PI / 2;
  line.position.set(x, y + 0.53, z);
  parent.add(line);
  const glyph = new THREE.Mesh(new THREE.OctahedronGeometry(0.54), dormant.clone());
  glyph.position.set(x, y + 1.13, z);
  glyph.name = label;
  parent.add(glyph);
  return glyph;
}

/** Generated stone architecture, no downloaded art or third-party assets. */
export class TidegateVisual {
  readonly root = new THREE.Group();
  private readonly dragonGlyph: THREE.Mesh;
  private readonly riderGlyph: THREE.Mesh;
  private readonly beacon: THREE.Group;
  private readonly halo: THREE.Mesh;
  private readonly centerX = (TIDEGATE.dragon.x + TIDEGATE.rider.x) / 2;
  private readonly centerZ = TIDEGATE.dragon.z;

  constructor() {
    this.root.name = 'structure.azure.tidegate';
    const baseY = heightAt(this.centerX, this.centerZ);
    this.root.position.set(this.centerX, baseY, this.centerZ);
    this.dragonGlyph = rune(this.root,
      TIDEGATE.dragon.x - this.centerX, 0,
      heightAt(TIDEGATE.dragon.x, TIDEGATE.dragon.z) - baseY + 0.45,
      'tidegate.dragon-glyph');
    this.riderGlyph = rune(this.root,
      TIDEGATE.rider.x - this.centerX, 0,
      heightAt(TIDEGATE.rider.x, TIDEGATE.rider.z) - baseY + 0.45,
      'tidegate.rider-glyph');

    this.beacon = new THREE.Group();
    this.beacon.name = 'structure.azure.tidegate.beacon';
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.29, 9, 36), gilding);
    arch.position.set(0, 4.4, -3.0);
    this.beacon.add(arch);
    const pedestal = new THREE.Mesh(new THREE.DodecahedronGeometry(1.55, 0), stone);
    pedestal.position.set(0, 1.7, -3.0);
    this.beacon.add(pedestal);
    this.halo = new THREE.Mesh(new THREE.OctahedronGeometry(1.35), beaconMaterial);
    this.halo.position.set(0, 4.4, -3.0);
    this.beacon.add(this.halo);
    this.root.add(this.beacon);
  }

  update(puzzle: TidegateState, time: number): void {
    const dMat = this.dragonGlyph.material as THREE.MeshStandardMaterial;
    const rMat = this.riderGlyph.material as THREE.MeshStandardMaterial;
    for (const m of [dMat, rMat]) m.emissiveIntensity = 0.13;
    dMat.color.copy(puzzle.dragonAnchored || puzzle.solved ? active.color : dormant.color);
    dMat.emissive.copy(puzzle.dragonAnchored || puzzle.solved ? active.emissive : dormant.emissive);
    dMat.emissiveIntensity = puzzle.dragonAnchored || puzzle.solved ? 1.25 : 0.13;
    rMat.color.copy(puzzle.solved ? active.color : dormant.color);
    rMat.emissive.copy(puzzle.solved ? active.emissive : dormant.emissive);
    rMat.emissiveIntensity = puzzle.solved ? 1.25 : 0.13;
    this.halo.visible = puzzle.solved;
    if (puzzle.solved) {
      this.halo.rotation.y = time * 0.55;
      this.halo.position.y = 4.4 + Math.sin(time * 2.4) * 0.19;
    }
  }
}
