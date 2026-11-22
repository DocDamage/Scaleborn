import * as THREE from 'three';
import type { CombatState, FireCast, GloamHound, SigilCast, BondCast } from './combat';
import { heightAt } from '../world/terrain';

interface HoundRig {
  root: THREE.Group;
  legs: THREE.Group[];
  skin: THREE.MeshStandardMaterial;
  eyes: THREE.MeshStandardMaterial;
  lifeBar: THREE.Group;
  lifeFill: THREE.Sprite;
}
const FLAME_COUNT = 54;
const SIGIL_COUNT = 21;
const BOND_COUNT = 36;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Original, code-sculpted Gloam hounds and a pooled iridescent flame plume.
 * Gameplay owns every hit and collision; these meshes are disposable adapters.
 */
export class CombatVisual {
  private readonly root = new THREE.Group();
  private readonly rigs = new Map<string, HoundRig>();
  private readonly plume: THREE.InstancedMesh;
  private readonly flameMaterial: THREE.MeshBasicMaterial;
  private readonly flameLight: THREE.PointLight;
  private readonly sigil: THREE.InstancedMesh;
  private readonly sigilMaterial: THREE.MeshBasicMaterial;
  private readonly bond: THREE.InstancedMesh;
  private readonly bondMaterial: THREE.MeshBasicMaterial;
  private readonly bondLight: THREE.PointLight;
  private magic: SigilCast | null = null;
  private magicAge = 1;
  private seenMagic = 0;
  private bondCast: BondCast | null = null;
  private bondAge = 1;
  private seenBond = 0;
  private fire: FireCast | null = null;
  private fireAge = 1;
  private seenFire = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly orientation = new THREE.Quaternion();
  private readonly forward = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly vertical = new THREE.Vector3();
  private readonly tint = new THREE.Color();

  constructor(scene: THREE.Scene, combat: CombatState) {
    this.root.name = 'encounter.azure.gloam-den';
    for (const enemy of combat.hounds) this.buildHound(enemy);
    const geometry = new THREE.ConeGeometry(0.54, 1.65, 10, 1, true);
    geometry.translate(0, 0.8, 0); // Plume trails behind its visible tip.
    this.flameMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.75,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    });
    this.plume = new THREE.InstancedMesh(geometry, this.flameMaterial, FLAME_COUNT);
    this.plume.name = 'fx.dragon.fire-breath';
    this.plume.frustumCulled = false; // Entire cone changes location on every cast.
    this.plume.visible = false;
    for (let i = 0; i < FLAME_COUNT; i++) {
      const t = i / Math.max(1, FLAME_COUNT - 1);
      this.tint.setRGB(1, 0.25 + t * 0.45, 0.08 + t * 0.12);
      this.plume.setColorAt(i, this.tint);
    }
    if (this.plume.instanceColor) this.plume.instanceColor.needsUpdate = true;
    this.flameLight = new THREE.PointLight(0xff9b53, 0, 29, 2);
    this.flameLight.name = 'fx.dragon.fire-light';
    this.sigilMaterial = new THREE.MeshBasicMaterial({
      color: 0x8ddcdd, transparent: true, opacity: 0.8,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    });
    this.sigil = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 12, 10), this.sigilMaterial, SIGIL_COUNT,
    );
    this.sigil.name = 'fx.rider.tidal-sigil';
    this.sigil.visible = false;
    this.sigil.frustumCulled = false;

    this.bondMaterial = new THREE.MeshBasicMaterial({
      color: 0xa5e9e1, transparent: true, opacity: 0.75,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true,
    });
    this.bond = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.2, 1.5, 9), this.bondMaterial, BOND_COUNT,
    );
    this.bond.name = 'fx.bond.surge';
    this.bond.visible = false;
    this.bond.frustumCulled = false;
    this.bondLight = new THREE.PointLight(0x7fe5dc, 0, 22, 2);
    this.root.add(this.plume, this.flameLight, this.sigil, this.bond, this.bondLight);
    scene.add(this.root);
  }

  private mesh(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material,
    x: number, y: number, z: number,
    sx = 1, sy = 1, sz = 1): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private buildHound(enemy: GloamHound): void {
    const root = new THREE.Group();
    root.name = enemy.id;
    const skin = new THREE.MeshStandardMaterial({
      color: 0x302939, roughness: 0.69, metalness: 0.18,
      emissive: 0x67382e, emissiveIntensity: 0.06,
    });
    const ridge = new THREE.MeshStandardMaterial({
      color: 0x191e2d, roughness: 0.58, metalness: 0.29,
    });
    const eyes = new THREE.MeshStandardMaterial({
      color: 0xffb476, emissive: 0xff6a2f, emissiveIntensity: 2.2,
      roughness: 0.28,
    });
    // Long, smooth animal silhouette with raised shoulders and narrowed muzzle.
    this.mesh(root, new THREE.SphereGeometry(1, 28, 18), skin, 0, 1.23, 0.1, 0.68, 0.56, 1.22);
    this.mesh(root, new THREE.SphereGeometry(1, 26, 18), skin, 0, 1.45, -0.61, 0.69, 0.65, 0.59);
    this.mesh(root, new THREE.SphereGeometry(1, 28, 18), skin, 0, 1.54, -1.2, 0.48, 0.4, 0.64);
    this.mesh(root, new THREE.SphereGeometry(1, 22, 14), ridge, 0, 1.29, -1.55, 0.3, 0.20, 0.44);
    // Curved tail flows behind rather than a rigid straight cylinder.
    const tail = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.40, 0.98),
      new THREE.Vector3(0.05, 1.40, 1.47),
      new THREE.Vector3(0.20, 1.70, 1.87),
      new THREE.Vector3(0.35, 2.18, 2.08),
    ]);
    this.mesh(root, new THREE.TubeGeometry(tail, 16, 0.135, 9), ridge, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const spike = this.mesh(root, new THREE.ConeGeometry(0.22 - i * 0.014, 0.57, 11),
        ridge, 0, 1.83 + Math.sin(i * 0.5) * 0.13, -0.54 + i * 0.32);
      spike.rotation.x = -0.36;
    }
    for (const side of [-1, 1]) {
      const ear = this.mesh(root, new THREE.ConeGeometry(0.19, 0.64, 12), ridge,
        side * 0.39, 1.98, -1.43);
      ear.rotation.z = side * -0.25;
      this.mesh(root, new THREE.SphereGeometry(0.105, 14, 10), eyes,
        side * 0.36, 1.65, -1.61);
      // Tooth silhouettes read during a forward lunge.
      const tooth = this.mesh(root, new THREE.ConeGeometry(0.075, 0.24, 10), ridge,
        side * 0.20, 1.12, -1.84);
      tooth.rotation.x = Math.PI;
    }
    const legs: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      for (const rear of [false, true]) {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.44, 1.04, rear ? 0.83 : -0.73);
        this.mesh(pivot, new THREE.SphereGeometry(1, 18, 14), skin,
          0, -0.35, 0, 0.22, 0.63, 0.25);
        this.mesh(pivot, new THREE.SphereGeometry(1, 16, 12), ridge,
          0, -0.87, -0.16, 0.25, 0.16, 0.35);
        root.add(pivot);
        legs.push(pivot);
      }
    }
    // World-space billboards show enemy vitality only when fighting.
    // They are attached to the real enemy and disappear with its death.
    const lifeBar = new THREE.Group();
    lifeBar.name = enemy.id + '.vitality';
    lifeBar.position.y = 2.65;
    const backdrop = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0x1a1824, opacity: 0.87, transparent: true, depthTest: true,
    }));
    backdrop.scale.set(2.40, 0.16, 1);
    const lifeFill = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0xc46d58, opacity: 0.98, transparent: true, depthTest: true,
    }));
    lifeFill.scale.set(2.28, 0.10, 1);
    lifeBar.add(backdrop, lifeFill);
    lifeBar.visible = false;
    root.add(lifeBar);
    root.position.set(enemy.x, enemy.y, enemy.z);
    root.rotation.y = -enemy.yaw;
    this.root.add(root);
    this.rigs.set(enemy.id, { root, legs, skin, eyes, lifeBar, lifeFill });
  }

  /** Called after each fixed simulation frame; never computes gameplay damage. */
  update(combat: CombatState, time: number, dt: number): void {
    for (const hound of combat.hounds) {
      const rig = this.rigs.get(hound.id);
      if (!rig) continue;
      const life = hound.hp <= 0 ? Math.max(0, 1 - hound.deathAge / 0.7) : 1;
      rig.root.visible = life > 0;
      rig.root.scale.setScalar(life);
      rig.root.position.set(hound.x, hound.y - (1 - life) * 0.55, hound.z);
      rig.root.rotation.y = -hound.yaw;
      rig.skin.emissiveIntensity = hound.flash > 0 ? 1.1 : hound.windup > 0 ? 0.38 : 0.06;
      rig.eyes.emissiveIntensity = hound.alert ? 3.6 : 1.6;
      // Health readouts appear only when engaged or after taking damage.
      rig.lifeBar.visible = hound.hp > 0 && (hound.alert || hound.hp < hound.maxHp);
      const percent = Math.max(0, Math.min(1, hound.hp / hound.maxHp));
      rig.lifeFill.scale.x = 2.28 * percent;
      rig.lifeFill.position.x = -(2.28 - rig.lifeFill.scale.x) * 0.5;
      rig.root.rotation.x = hound.windup > 0 ? -0.12 : 0;
      for (let i = 0; i < rig.legs.length; i++) {
        const gait = hound.alert && hound.stagger <= 0 && hound.windup <= 0
          ? Math.sin(time * 9 + ((i % 3) === 0 ? Math.PI : 0)) * 0.30 : 0;
        rig.legs[i]!.rotation.x = gait;
      }
      rig.root.position.y += hound.windup > 0 ? Math.sin(time * 16) * 0.07 : 0;
    }
    const cast = combat.lastFire;
    if (cast && cast.id !== this.seenFire) {
      this.seenFire = cast.id;
      this.fire = cast;
      this.fireAge = 0;
    } else if (this.fire) this.fireAge += Math.max(0, dt);
    this.updateFlame();
    const sigil = combat.lastSigil;
    if (sigil && sigil.id !== this.seenMagic) {
      this.seenMagic = sigil.id;
      this.magic = sigil;
      this.magicAge = 0;
    } else if (this.magic) this.magicAge += Math.max(0, dt);
    const bond = combat.lastBond;
    if (bond && bond.id !== this.seenBond) {
      this.seenBond = bond.id;
      this.bondCast = bond;
      this.bondAge = 0;
    } else if (this.bondCast) this.bondAge += Math.max(0, dt);
    this.updateMagic();
    this.updateBond();
  }

  private updateFlame(): void {
    const cast = this.fire;
    const duration = 0.42;
    this.plume.visible = cast !== null && this.fireAge < duration;
    this.flameLight.intensity = 0;
    if (!cast || !this.plume.visible) return;
    this.forward.set(cast.direction.x, cast.direction.y, cast.direction.z).normalize();
    this.side.set(this.forward.z, 0, -this.forward.x).normalize();
    this.vertical.crossVectors(this.side, this.forward).normalize();
    this.orientation.setFromUnitVectors(UP, this.forward);
    const progress = Math.min(1, (this.fireAge + 0.02) / 0.24);
    const fade = Math.max(0, 1 - this.fireAge / duration);
    this.flameMaterial.opacity = 0.69 * fade;
    for (let i = 0; i < FLAME_COUNT; i++) {
      const t = (i + 0.5) / FLAME_COUNT;
      const distance = (1.3 + t * cast.range) * progress;
      const phase = i * 2.39996 + cast.id * 0.38;
      const spread = (0.18 + distance * 0.11) * Math.sqrt(t);
      this.position.set(
        cast.origin.x + this.forward.x * distance,
        cast.origin.y + this.forward.y * distance
          + cast.arcHeight * Math.sin(Math.PI * t) * progress,
        cast.origin.z + this.forward.z * distance,
      ).addScaledVector(this.side, Math.cos(phase) * spread)
        .addScaledVector(this.vertical, Math.sin(phase) * spread);
      if (cast.groundFollowing) {
        this.position.y = Math.max(this.position.y,
          heightAt(this.position.x, this.position.z) + 1.0);
      }
      const width = (0.24 + t * 0.85) * fade;
      this.scale.set(width, (1.1 + t * 2.4) * fade, width);
      this.matrix.compose(this.position, this.orientation, this.scale);
      this.plume.setMatrixAt(i, this.matrix);
    }
    this.plume.instanceMatrix.needsUpdate = true;
    this.flameLight.position.set(
      cast.origin.x + this.forward.x * Math.min(14, cast.range * 0.34) * progress,
      cast.origin.y + this.forward.y * Math.min(14, cast.range * 0.34) * progress,
      cast.origin.z + this.forward.z * Math.min(14, cast.range * 0.34) * progress,
    );
    this.flameLight.intensity = 2.9 * fade;
  }

  private updateMagic(): void {
    const cast = this.magic;
    const duration = 0.48;
    this.sigil.visible = cast !== null && this.magicAge < duration;
    if (!cast || !this.sigil.visible) return;
    this.forward.set(cast.direction.x, cast.direction.y, cast.direction.z).normalize();
    this.side.set(this.forward.z, 0, -this.forward.x).normalize();
    this.vertical.crossVectors(this.side, this.forward).normalize();
    this.orientation.setFromUnitVectors(UP, this.forward);
    const progress = Math.min(1, (this.magicAge + 0.02) / 0.3);
    const distance = cast.range * progress;
    const fade = Math.max(0, 1 - this.magicAge / duration);
    this.sigilMaterial.opacity = 0.80 * fade;
    for (let i = 0; i < SIGIL_COUNT; i++) {
      const t = i / SIGIL_COUNT;
      const trail = Math.max(0, distance - t * 6.8);
      const spiral = i * 2.39996 + cast.id * 0.45;
      const spread = (0.13 + t * 0.35) * fade;
      this.position.set(
        cast.origin.x + this.forward.x * trail,
        cast.origin.y + this.forward.y * trail
          + cast.arcHeight * Math.sin(Math.PI * trail / cast.range),
        cast.origin.z + this.forward.z * trail,
      ).addScaledVector(this.side, Math.cos(spiral) * spread)
        .addScaledVector(this.vertical, Math.sin(spiral) * spread);
      if (cast.groundFollowing) {
        this.position.y = Math.max(this.position.y,
          heightAt(this.position.x, this.position.z) + 1.2);
      }
      const radius = (0.16 + (1 - t) * 0.23) * fade;
      this.scale.set(radius, (0.63 + (1 - t) * 1.9) * fade, radius);
      this.matrix.compose(this.position, this.orientation, this.scale);
      this.sigil.setMatrixAt(i, this.matrix);
    }
    this.sigil.instanceMatrix.needsUpdate = true;
  }

  private updateBond(): void {
    const cast = this.bondCast;
    const duration = 0.64;
    this.bond.visible = cast !== null && this.bondAge < duration;
    this.bondLight.intensity = 0;
    if (!cast || !this.bond.visible) return;
    const progress = Math.min(1, (this.bondAge + 0.01) / 0.35);
    const fade = Math.max(0, 1 - this.bondAge / duration);
    this.bondMaterial.opacity = 0.75 * fade;
    this.bondLight.position.set(cast.x, cast.y, cast.z);
    this.bondLight.intensity = 3.4 * fade;
    for (let i = 0; i < BOND_COUNT; i++) {
      // Uneven radial spokes instead of the perfect white torus rings used
      // in the original waterfall prototype.
      const angle = i * 2.39996 + cast.id * 0.13;
      const r = (0.35 + i / BOND_COUNT * 0.65) * cast.radius * progress;
      const rx = Math.cos(angle), rz = Math.sin(angle);
      this.position.set(cast.x + rx * r, cast.y - 0.5 + Math.sin(i * 1.9) * 0.6, cast.z + rz * r);
      this.forward.set(rx, 0.1 + Math.sin(angle * 3) * 0.23, rz).normalize();
      this.orientation.setFromUnitVectors(UP, this.forward);
      const width = (0.25 + i % 3 * 0.11) * fade;
      this.scale.set(width, (2.0 + i % 5 * 0.6) * fade, width);
      this.matrix.compose(this.position, this.orientation, this.scale);
      this.bond.setMatrixAt(i, this.matrix);
    }
    this.bond.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    const geometry = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.root.traverse((node) => {
      if (!(node instanceof THREE.Mesh || node instanceof THREE.Sprite)) return;
      geometry.add(node.geometry);
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach((mat) => materials.add(mat));
    });
    geometry.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.root.removeFromParent();
    this.rigs.clear();
  }
}
