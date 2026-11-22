import * as THREE from 'three';
import { ECHO_SHRINE, type EchoPhase } from './tidalEcho';

const inactive = new THREE.MeshStandardMaterial({
  color: 0x397f7c, emissive: 0x144955, emissiveIntensity: 0.3,
  roughness: 0.55, metalness: 0.11, transparent: true, opacity: 0.76,
});
const bright = new THREE.MeshStandardMaterial({
  color: 0xc4f3cf, emissive: 0x62bcb0, emissiveIntensity: 1.7,
  roughness: 0.22, metalness: 0.14, transparent: true, opacity: 0.87,
});
const gold = new THREE.MeshStandardMaterial({
  color: 0xdcc89a, emissive: 0x926e42, emissiveIntensity: 0.4,
  roughness: 0.50, metalness: 0.25,
});

/** Original procedural geometry overlay around the Sunken Shrine crystal. */
export class TidalEchoVisual {
  readonly root = new THREE.Group();
  private readonly heart = new THREE.Group();
  private readonly rings: THREE.Mesh[] = [];
  private readonly motes: THREE.Mesh[] = [];
  private readonly radiance: THREE.PointLight;

  constructor() {
    this.root.name = 'structure.azure.sunken-shrine.echo';
    this.root.position.set(ECHO_SHRINE.x, ECHO_SHRINE.heartY, ECHO_SHRINE.z);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(4.4 + i * 1.5, 0.17, 7, 42),
        inactive.clone(),
      );
      ring.name = 'echo.ring.' + i;
      ring.rotation.set(i * 0.28, i * 0.55, i * 0.16);
      this.heart.add(ring);
      this.rings.push(ring);
    }
    for (let i = 0; i < 7; i++) {
      const mote = new THREE.Mesh(new THREE.OctahedronGeometry(0.29 + (i % 3) * 0.1), bright);
      mote.name = 'echo.mote.' + i;
      this.heart.add(mote);
      this.motes.push(mote);
    }
    const base = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.23, 6, 28), gold);
    base.rotation.x = Math.PI / 2;
    base.position.y = -6;
    this.root.add(base);
    this.radiance = new THREE.PointLight(0x75cabe, 0, 27);
    this.radiance.position.y = 0;
    this.root.add(this.heart, this.radiance);
  }

  update(phase: EchoPhase, time: number): void {
    const unlocked = phase !== 'locked';
    const collected = phase === 'return-to-gate' || phase === 'complete';
    this.heart.rotation.set(Math.sin(time * 0.42) * 0.08, time * 0.11, 0);
    this.heart.position.y = Math.sin(time * 1.0) * 0.45;
    this.rings.forEach((ring, i) => {
      const material = ring.material as THREE.MeshStandardMaterial;
      material.color.setHex(unlocked ? 0x8cdec5 : 0x397f7c);
      material.emissiveIntensity = unlocked ? 0.95 : 0.14;
      material.opacity = collected ? 0.19 : unlocked ? 0.78 : 0.30;
      ring.rotation.y = time * (0.18 + i * 0.12) * (i % 2 ? -1 : 1);
      ring.rotation.z = Math.sin(time * 0.35 + i) * (0.16 + i * 0.07);
    });
    this.motes.forEach((mote, i) => {
      const angle = time * (0.58 + i * 0.08) + i * (Math.PI * 2 / this.motes.length);
      const radius = 3.4 + (i % 3) * 1.2;
      mote.position.set(Math.cos(angle) * radius, Math.sin(time * 1.2 + i) * 2, Math.sin(angle) * radius);
      mote.visible = unlocked && !collected;
    });
    this.radiance.intensity = collected ? 0.28 : unlocked ? 2.0 : 0.15;
  }

  dispose(): void {
    this.root.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
        else node.material.dispose();
      }
    });
  }
}
