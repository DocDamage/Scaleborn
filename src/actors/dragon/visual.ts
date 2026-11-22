import * as THREE from 'three';
import type { FlightState } from './flight';
import { FORMS } from './forms';
import { createWingRig, poseWing } from './wingRig';
import { dragonPose } from './animationPose';
import { riderPose } from '../rider/pose';
import { applyDragonScales, makeDragonScaleTextures } from './skinSurface';
import { CHARACTER_MODEL_SOURCES, loadCharacterModel } from './characterSources';
import { ImportedCharacterRig, type CharacterKind, type CharacterModelFile } from '../rider/importedCharacterRig';
import { loftDragon, ONYX_TORSO, ONYX_HEAD, taperedSpine, sculptFin } from './organicSculpt';
import { makeScalebornRider } from '../rider/heroSculpt';

const scaleTextures=makeDragonScaleTextures();
const skin = applyDragonScales(
  new THREE.MeshStandardMaterial({ color: 0x263f4a, roughness: 0.65, metalness: 0.05 }),
  scaleTextures,
);
const bodySkin = skin.clone();
bodySkin.vertexColors = true;
const highlight = applyDragonScales(
  new THREE.MeshStandardMaterial({ color: 0x426b74, roughness: 0.62, metalness: 0.06 }),
  scaleTextures,
);
const ridges = applyDragonScales(
  new THREE.MeshStandardMaterial({ color: 0x1c313b, roughness: 0.80 }),
  scaleTextures,
);
const iris = new THREE.MeshStandardMaterial({
  color: 0x8fe3c0, emissive: 0x2e5a50, emissiveIntensity: 0.62, roughness: 0.39,
});
const pupil = new THREE.MeshStandardMaterial({ color: 0x102329, roughness: 0.35 });
const glimmer = new THREE.MeshStandardMaterial({
  color: 0xe3f8e3, emissive: 0x648b84, emissiveIntensity: 0.20,
});

function ellipsoid(parent: THREE.Group, material: THREE.Material,
  pos: [number, number, number], scale: [number, number, number], detail = 14): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, Math.max(26,detail), Math.max(18,Math.round(detail*.7))), material);
  mesh.position.set(...pos);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

function tailFin(parent: THREE.Group): void {
  parent.add(sculptFin([0,0,2.15],[0,.32,2.85],.42,
    highlight,'creature.dragon.tail-fin.central',28));
  for(const side of [-1,1] as const) {
    parent.add(sculptFin([0,-.08,2.05],
      [side*.63,-.07,2.68],.38,skin,
      side<0?'creature.dragon.tail-fin.left':'creature.dragon.tail-fin.right',24));
  }
}

/**
 * Code-generated original dragon and rider.
 * Dragon body scales independently; the 13-year-old rider never scales up.
 * Each wing is a real three-bone skinned mesh with animated deformation.
 */
export class DragonVisual {
  readonly root = new THREE.Group();
  readonly rider = makeScalebornRider();
  readonly body = new THREE.Group();
  private scene: THREE.Scene | null = null;
  private readonly wingL = createWingRig(-1);
  private readonly wingR = createWingRig(1);
  private readonly tail = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly eyes: THREE.Mesh[] = [];
  private readonly riderTail = this.rider.getObjectByName('rider.tail') as THREE.Group;
  private readonly riderLimbs = {
    leftArm: this.rider.getObjectByName('rider.leftArm') as THREE.Group,
    rightArm: this.rider.getObjectByName('rider.rightArm') as THREE.Group,
    leftLeg: this.rider.getObjectByName('rider.leftLeg') as THREE.Group,
    rightLeg: this.rider.getObjectByName('rider.rightLeg') as THREE.Group,
  };
  private readonly legs: Array<{ group: THREE.Group; diagonal: boolean }> = [];
  private displayedScale = FORMS.rideable.visualScale;
  private previousTime = 0;
  private importedDragon: ImportedCharacterRig | null = null;
  private importedRider: ImportedCharacterRig | null = null;
  private readonly legacyDragonNodes: THREE.Object3D[] = [];
  private readonly legacyRiderNodes: THREE.Object3D[] = [];
  private disposed = false;
  readonly modelStatus: Record<CharacterKind, 'pending' | 'ready' | 'fallback'> = {
    dragon: 'pending', rider: 'pending',
  };

  constructor() {
    this.root.name = 'creature.dragon.onyx';
    this.root.userData.assetId = 'creature.dragon.onyx';
    this.body.name = 'creature.dragon.body';
    // One organic longitudinal torso/neck/tail silhouette; no stacked
    // stretched sphere- or cube-shaped body parts remain.
    const core = new THREE.Mesh(loftDragon(ONYX_TORSO,124,40),bodySkin);
    core.name='creature.dragon.onyx.anatomical-torso';
    core.castShadow=true;core.receiveShadow=true;
    this.body.add(core);
    this.head.name = 'head';
    this.head.position.set(0, 0.32, -1.54);
    const skull=new THREE.Mesh(loftDragon(ONYX_HEAD,76,36),bodySkin);
    skull.name='creature.dragon.onyx.sculpted-skull';
    skull.castShadow=true;
    this.head.add(skull);
    const lowerJaw=new THREE.Mesh(loftDragon([
      [-1.10,-.26,.08,.05],[-.85,-.29,.30,.115],
      [-.56,-.24,.43,.14],[-.21,-.20,.39,.15],[.08,-.16,.18,.10],
    ],42,26),highlight);
    lowerJaw.name='creature.dragon.lower-jaw';
    this.head.add(lowerJaw);
    for (const side of [-1, 1]) {
      ellipsoid(this.head, iris, [side * 0.51, 0.20, -0.35], [0.165, 0.22, 0.10], 16);
      const eye = ellipsoid(this.head, pupil, [side * 0.57, 0.21, -0.41], [0.065, 0.16, 0.05], 12);
      this.eyes.push(eye);
      ellipsoid(this.head, glimmer, [side * 0.60, 0.31, -0.45], [0.04, 0.047, 0.025], 8);
      // Distinctive backward-swept paired horn and cartilage fin-crests.
      const horn=new THREE.Mesh(taperedSpine([
        [side*.37,.41,.33],[side*.46,.65,.44],
        [side*.54,.88,.66],[side*.64,.93,.91],
      ],.175,14),ridges);
      horn.name=side<0?'creature.dragon.horn.left':'creature.dragon.horn.right';
      this.head.add(horn);
      this.head.add(sculptFin([side*.49,.23,.14],
        [side*1.02,.44,.83],.60,highlight,
        side<0?'creature.dragon.crest.left':'creature.dragon.crest.right',30));
      // The broad eye-brow ridge reads when the creature banks at speed.
      this.head.add(new THREE.Mesh(taperedSpine([
        [side*.30,.30,-.78],[side*.51,.37,-.44],
        [side*.62,.34,-.14],
      ],.11,12),ridges));
    }
    this.body.add(this.head);
    // Original tapered ridge scales break up the smooth back silhouette
    // without adding a low-resolution box-like plate mesh.
    for (let i=0;i<9;i++) {
      const z=-1.13+i*.37;
      const height=.55-.05*(i/9);
      this.body.add(sculptFin([0,height,z-.11],
        [0,height+.29+Math.sin(i*.47)*.12,z+.22],
        .20,ridges,'creature.dragon.dorsal-ridge.'+i,16));
    }
    // Hinged procedural legs: diagonal pairs step in opposition on land.
    for (const side of [-1, 1]) {
      for (const front of [true, false]) {
        const leg = new THREE.Group();
        const z = front ? -1.05 : 1.03;
        leg.name = 'leg.' + (front ? 'front' : 'hind') + (side < 0 ? 'Left' : 'Right');
        leg.position.set(side * 0.55, -0.45, z);
        leg.add(new THREE.Mesh(taperedSpine([
          [0,.12,0],[side*.08,-.18,.03],
          [side*.11,-.45,-.17],[side*.08,-.67,-.23],
        ],front?.26:.32,18,36),skin));
        const paw=new THREE.Mesh(loftDragon([
          [-.52,-.66,.08,.055],[-.38,-.68,.29,.135],
          [-.09,-.65,.30,.12],[.13,-.65,.18,.09],
        ],24,20),ridges);
        leg.add(paw);
        for(const toe of [-.17,0,.17]){
          const claw=new THREE.Mesh(taperedSpine([
            [toe,-.65,-.38],[toe,-.67,-.52],
            [toe*.9,-.71,-.63],
          ],.073,9,18),highlight);
          leg.add(claw);
        }
        this.body.add(leg);
        this.legs.push({ group: leg, diagonal: (side < 0) === front });
      }
    }
    this.body.add(this.wingL.root, this.wingR.root);
    this.tail.name = 'tailTip';
    this.tail.position.set(0, 0, 1.38);
    this.tail.add(new THREE.Mesh(loftDragon([
      [-.05,-.08,.31,.29],[.38,-.08,.34,.27],
      [.78,-.10,.27,.21],[1.19,-.10,.19,.16],
      [1.67,-.13,.12,.11],[2.23,-.16,.055,.052],
      [2.49,-.16,.014,.014],
    ],76,26),skin));
    tailFin(this.tail);
    this.body.add(this.tail);
    this.root.add(this.body, this.rider);
    this.legacyDragonNodes.push(...this.body.children);
    this.legacyRiderNodes.push(...this.rider.children);
    this.body.scale.setScalar(this.displayedScale);
  }

  attach(scene: THREE.Scene): void {
    this.scene = scene;
    scene.add(this.root);
    // GLBLoader uses browser fetch/image APIs, not Node's unit-test runtime.
    // Deterministic tests inject in-memory rigs with replaceCharacter().
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    // Model loading is independent of the deterministic fixed-step game.
    // Keep collision and existing animation usable if either asset fails.
    for (const kind of ['dragon', 'rider'] as const) {
      // Until approved, authored GLBs are installed, the new original
      // in-engine sculpts remain visible. No 404s and no donor skins.
      if (!CHARACTER_MODEL_SOURCES[kind].installed) {
        this.modelStatus[kind] = 'fallback';
        continue;
      }
      void loadCharacterModel(kind)
        .then((model) => {
          if (this.disposed) {
            // Avoid adding a stale async result after the game is torn down.
            const unused = new ImportedCharacterRig(kind, model);
            unused.dispose();
          } else this.replaceCharacter(kind, model);
        })
        .catch((error: unknown) => {
          this.modelStatus[kind] = 'fallback';
          console.warn('Scaleborn character asset unavailable: ' + kind, error);
        });
    }
  }

  /**
   * Replace rendered geometry without replacing actor/root objects, sockets,
   * collision, form scale, rider control or scene ownership. Also exercised
   * directly by deterministic tests without a network/WebGL context.
   */
  replaceCharacter(kind: CharacterKind, model: CharacterModelFile): void {
    if (this.disposed) throw new Error('DragonVisual has been disposed');
    const imported = new ImportedCharacterRig(kind, model);
    if (kind === 'dragon') {
      this.importedDragon?.dispose();
      this.importedDragon = imported;
      this.body.add(imported.root);
      for (const child of this.legacyDragonNodes) child.visible = false;
    } else {
      this.importedRider?.dispose();
      this.importedRider = imported;
      this.rider.add(imported.root);
      for (const child of this.legacyRiderNodes) child.visible = false;
    }
    this.modelStatus[kind] = 'ready';
  }

  update(state: FlightState): void {
    const dt = Math.min(0.1, Math.max(0, state.time - this.previousTime));
    this.previousTime = state.time;
    const targetScale = FORMS[state.form].visualScale;
    this.displayedScale += (targetScale - this.displayedScale) * Math.min(1, dt * 4.8);
    if (Math.abs(targetScale - this.displayedScale) < 0.0003) this.displayedScale = targetScale;
    this.body.scale.setScalar(this.displayedScale);
    const pose = dragonPose(state);
    // Physics already owns the ground height. Never snap the render root on F.
    this.root.position.set(state.x, state.y, state.z);
    this.root.rotation.order = 'YXZ';
    this.root.rotation.set(state.pitch, -state.yaw, state.roll);
    this.body.position.y = pose.bodyBob * this.displayedScale;

    poseWing(this.wingL, -1, pose);
    poseWing(this.wingR, 1, pose);
    for (const leg of this.legs) {
      const phase = pose.gaitPhase + (leg.diagonal ? 0 : Math.PI);
      const stride = Math.sin(phase) * pose.gaitAmount;
      leg.group.rotation.x = pose.name === 'walk' ? stride * 0.43
        : state.mode === 'underwater' || state.mode === 'surface'
          ? Math.sin(state.time * 4.4 + (leg.diagonal ? 0 : Math.PI)) * 0.13
          : state.mode === 'air' ? -0.19 : 0;
      leg.group.position.y = -0.45 + (pose.name === 'walk'
        ? Math.max(0, Math.sin(phase)) * pose.gaitAmount * 0.08 : 0);
    }
    this.tail.rotation.y = pose.tailAngle;
    this.tail.rotation.x = Math.sin(state.time * 1.65) * 0.07;
    this.head.rotation.x = pose.neckAngle;
    this.head.rotation.y = -state.roll * 0.15 + Math.sin(state.time * 0.7) * 0.028;
    const blinking = (state.time % 7.3) > 7.08;
    for (const eye of this.eyes) eye.scale.y = blinking ? 0.025 : 0.16;

    this.importedDragon?.animateDragon(pose, dt);
    const riderMotion = riderPose(state);
    this.importedRider?.animateRider(riderMotion, Math.abs(state.riderSpeed), dt);
    this.riderLimbs.leftArm.rotation.x = riderMotion.leftArm;
    this.riderLimbs.rightArm.rotation.x = riderMotion.rightArm;
    this.riderLimbs.leftLeg.rotation.x = riderMotion.leftLeg;
    this.riderLimbs.rightLeg.rotation.x = riderMotion.rightLeg;
    this.riderTail.rotation.y=Math.sin(state.time*2.15)*.12
      +(state.form==='small' ? Math.sin(state.time*.66)*.08 : state.roll*.16);
    this.riderTail.rotation.x=state.riderMode==='underwater'
      ? Math.sin(state.time*4.1)*.22 : -.04;
    if (state.form === 'small') {
      if (this.scene && this.rider.parent !== this.scene) this.scene.add(this.rider);
      this.rider.position.set(
        state.riderX, state.riderY, state.riderZ,
      );
      this.rider.rotation.set(
        riderMotion.torsoLean,
        -state.riderYaw,
        state.riderMode === 'ground' ? 0 : Math.sin(state.time * 4.2) * 0.08,
      );
      this.rider.visible = true;
    } else {
      if (this.rider.parent !== this.root) this.root.add(this.rider);
      this.rider.position.set(0, this.displayedScale * 0.72, -this.displayedScale * 0.40);
      this.rider.rotation.set(-state.pitch * 0.13, 0, pose.riderLean);
      this.rider.visible = true;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.importedDragon?.dispose();
    this.importedRider?.dispose();
    // Each original sculpt/wing is a per-instance geometry, not a singleton.
    // Deduplicate shared geometry in case two sockets reference one mesh.
    const geometry=new Set<THREE.BufferGeometry>();
    const disposeGeometry=(node:THREE.Object3D):void=>{
      node.traverse(child=>{
        if(child instanceof THREE.Mesh)geometry.add(child.geometry);
      });
    };
    disposeGeometry(this.root);
    disposeGeometry(this.rider); // Independent rider may be parented to Scene.
    geometry.forEach(g=>g.dispose());
    this.rider.removeFromParent();
    this.root.removeFromParent();
    this.scene = null;
  }
}
