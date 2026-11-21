import * as THREE from 'three';
import type { FlightState } from './flight';
import { FORMS } from './forms';
import { heightAt } from '../../world/terrain';
import { createWingRig, poseWing } from './wingRig';

const skin = new THREE.MeshStandardMaterial({ color: 0x263f4a, roughness: 0.65, metalness: 0.11 });
const highlight = new THREE.MeshStandardMaterial({ color: 0x426b74, roughness: 0.62, metalness: 0.09 });
const ridges = new THREE.MeshStandardMaterial({ color: 0x1c313b, roughness: 0.80 });
const iris = new THREE.MeshStandardMaterial({
  color: 0x8fe3c0, emissive: 0x2e5a50, emissiveIntensity: 0.62, roughness: 0.39,
});
const pupil = new THREE.MeshStandardMaterial({ color: 0x102329, roughness: 0.35 });
const glimmer = new THREE.MeshStandardMaterial({
  color: 0xe3f8e3, emissive: 0x648b84, emissiveIntensity: 0.20,
});

function ellipsoid(parent: THREE.Group, material: THREE.Material,
  pos: [number, number, number], scale: [number, number, number], detail = 14): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, detail, 10), material);
  mesh.position.set(...pos);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

function makeRider(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'character.rider.hero';
  const coat = new THREE.MeshStandardMaterial({ color: 0x9c705a, roughness: 0.93 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x4c7f89, roughness: 0.9 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xcba68b, roughness: 0.94 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x322d32, roughness: 0.93 });
  ellipsoid(group, cloth, [0, 0.80, 0.1], [0.25, 0.40, 0.20]);
  ellipsoid(group, skinMaterial, [0, 1.38, -0.02], [0.23, 0.27, 0.22]);
  ellipsoid(group, hair, [0, 1.56, 0.01], [0.23, 0.14, 0.24]);
  for (const side of [-1, 1]) {
    ellipsoid(group, coat, [side * 0.29, 0.77, -0.18], [0.11, 0.38, 0.12]);
    ellipsoid(group, skinMaterial, [side * 0.25, 0.41, -0.38], [0.12, 0.12, 0.12]);
    ellipsoid(group, cloth, [side * 0.22, 0.27, 0.26], [0.15, 0.3, 0.16]);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.29, 7), skinMaterial);
    horn.position.set(side * 0.14, 1.77, -0.05);
    horn.rotation.z = side * -0.3;
    group.add(horn);
  }
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.84, 6, 1, true), coat);
  cloak.rotation.x = -0.12;
  cloak.position.set(0, 0.58, 0.23);
  group.add(cloak);
  return group;
}

function tailFin(parent: THREE.Group): void {
  const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.4, 6), highlight);
  leaf.rotation.x = Math.PI / 2;
  leaf.position.set(0, -0.10, 2.9);
  parent.add(leaf);
  for (const sign of [-1, 1]) {
    const sideFin = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.13, 6), skin);
    sideFin.position.set(sign * 0.31, -0.08, 2.82);
    sideFin.rotation.z = sign * 0.72;
    sideFin.rotation.x = 0.6;
    parent.add(sideFin);
  }
}

/**
 * Code-generated original dragon and rider.
 * Dragon body scales independently; the 13-year-old rider never scales up.
 * Each wing is a real three-bone skinned mesh with animated deformation.
 */
export class DragonVisual {
  readonly root = new THREE.Group();
  readonly rider = makeRider();
  readonly body = new THREE.Group();
  private scene: THREE.Scene | null = null;
  private readonly wingL = createWingRig(-1);
  private readonly wingR = createWingRig(1);
  private readonly tail = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly eyes: THREE.Mesh[] = [];
  private displayedScale = FORMS.rideable.visualScale;
  private previousTime = 0;

  constructor() {
    this.root.name = 'creature.dragon.onyx';
    this.root.userData.assetId = 'creature.dragon.onyx';
    this.body.name = 'creature.dragon.body';
    ellipsoid(this.body, skin, [0, 0, 0], [0.79, 0.66, 1.72], 20);
    ellipsoid(this.body, highlight, [0, 0.38, -0.32], [0.55, 0.28, 1.22], 18);
    ellipsoid(this.body, skin, [0, 0.30, -1.28], [0.49, 0.52, 0.78]);
    this.head.name = 'head';
    this.head.position.set(0, 0.42, -1.83);
    ellipsoid(this.head, skin, [0, 0.10, -0.19], [0.62, 0.44, 0.73], 20);
    ellipsoid(this.head, highlight, [0, -0.12, -0.60], [0.48, 0.26, 0.65], 18);
    for (const side of [-1, 1]) {
      ellipsoid(this.head, iris, [side * 0.51, 0.20, -0.35], [0.165, 0.22, 0.10], 16);
      const eye = ellipsoid(this.head, pupil, [side * 0.57, 0.21, -0.41], [0.065, 0.16, 0.05], 12);
      this.eyes.push(eye);
      ellipsoid(this.head, glimmer, [side * 0.60, 0.31, -0.45], [0.04, 0.047, 0.025], 8);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.79, 7), ridges);
      horn.position.set(side * 0.40, 0.66, 0.28);
      horn.rotation.set(0.43, 0, side * -0.24);
      this.head.add(horn);
      const ear = ellipsoid(this.head, highlight, [side * 0.68, 0.38, 0.07], [0.17, 0.31, 0.17]);
      ear.rotation.z = side * -0.55;
    }
    this.body.add(this.head);
    for (const side of [-0.55, 0.55]) {
      for (const longitudinal of [-1.05, 1.03]) {
        ellipsoid(this.body, skin, [side, -0.62, longitudinal], [0.27, 0.65, 0.30]);
        ellipsoid(this.body, ridges, [side, -1.13, longitudinal - 0.12], [0.32, 0.15, 0.40]);
        for (const toe of [-0.13, 0.13]) {
          const claw = new THREE.Mesh(new THREE.ConeGeometry(0.078, 0.30, 6), highlight);
          claw.rotation.x = -Math.PI / 2;
          claw.position.set(side + toe, -1.15, longitudinal - 0.42);
          this.body.add(claw);
        }
      }
    }
    this.body.add(this.wingL.root, this.wingR.root);
    this.tail.name = 'tailTip';
    this.tail.position.set(0, 0, 1.38);
    for (let i = 0; i < 6; i++) {
      ellipsoid(this.tail, i % 2 ? skin : highlight,
        [0, -i * 0.04, i * 0.44],
        [0.38 - i * 0.05, 0.34 - i * 0.045, 0.45]);
    }
    tailFin(this.tail);
    this.body.add(this.tail);
    this.root.add(this.body, this.rider);
    this.body.scale.setScalar(this.displayedScale);
  }

  attach(scene: THREE.Scene): void {
    this.scene = scene;
    scene.add(this.root);
  }

  update(state: FlightState): void {
    const dt = Math.min(0.1, Math.max(0, state.time - this.previousTime));
    this.previousTime = state.time;
    const targetScale = FORMS[state.form].visualScale;
    this.displayedScale += (targetScale - this.displayedScale) * Math.min(1, dt * 4.8);
    if (Math.abs(targetScale - this.displayedScale) < 0.0003) this.displayedScale = targetScale;
    this.body.scale.setScalar(this.displayedScale);
    this.root.position.set(state.x,
      state.mode === 'ground'
        ? heightAt(state.x, state.z) + this.displayedScale * 1.31
        : state.y,
      state.z);
    this.root.rotation.order = 'YXZ';
    this.root.rotation.set(state.mode === 'air' ? state.pitch : 0, -state.yaw, state.roll);

    const fast = state.speed > FORMS[state.form].cruise * 1.38;
    const phase = state.time * (fast ? 8.8 : 5.5);
    poseWing(this.wingL, -1, phase, state.mode, fast);
    poseWing(this.wingR, 1, phase, state.mode, fast);
    this.tail.rotation.y = Math.sin(state.time * 2.2) * 0.10 - state.roll * 0.21;
    this.tail.rotation.x = Math.sin(state.time * 1.65) * 0.07;
    this.head.rotation.y = -state.roll * 0.15 + Math.sin(state.time * 0.7) * 0.028;
    const blinking = (state.time % 7.3) > 7.08;
    for (const eye of this.eyes) eye.scale.y = blinking ? 0.025 : 0.16;

    if (state.form === 'small') {
      if (this.scene && this.rider.parent !== this.scene) this.scene.add(this.rider);
      this.rider.position.set(
        state.riderX, heightAt(state.riderX, state.riderZ) + 0.05, state.riderZ,
      );
      this.rider.rotation.set(0, -state.yaw + 0.12, 0);
      this.rider.visible = true;
    } else {
      if (this.rider.parent !== this.root) this.root.add(this.rider);
      this.rider.position.set(0, this.displayedScale * 0.72, -this.displayedScale * 0.40);
      this.rider.rotation.set(-state.pitch * 0.13, 0, -state.roll * 0.23);
      this.rider.visible = true;
    }
  }
}
