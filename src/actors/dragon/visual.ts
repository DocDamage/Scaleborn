import * as THREE from 'three';
import type { FlightState } from './flight';
import type { ClawCast } from '../../combat/combat';
import { FORMS } from './forms';
import { createWingRig, poseWing } from './wingRig';
import { dragonPose } from './animationPose';
import { riderPose } from '../rider/pose';
import { riderFacialPose } from '../rider/riderExpression';
import { applyDragonScales, makeDragonScaleTextures } from './skinSurface';
import { makeOnyxPaintedScaleMap } from './onyxPaintedScales';
import { CHARACTER_MODEL_SOURCES, loadCharacterModel } from './characterSources';
import { ImportedCharacterRig, type CharacterKind, type CharacterModelFile } from '../rider/importedCharacterRig';
import { loftDragon, ONYX_TORSO, ONYX_HEAD, onyxDorsalY, taperedSpine, sculptFin } from './organicSculpt';
import { makeScalebornRider } from '../rider/heroSculpt';
import { poseRiderTail } from '../rider/riderTailRig';
import { poseSleeveCrease } from '../rider/riderSleeveCloth';
import { riderUpperBodyPose } from '../rider/riderUpperBodyRig';
import { poseRiderFaceMorphs } from '../rider/riderFaceMorph';
import { poseRiderHairLocks } from '../rider/riderHairSculpt';
import { poseRiderKneeCloth } from '../rider/riderKneeCloth';
import { createDragonTailRig, poseDragonTail } from './dragonTailRig';
import { dragonExpression } from './dragonExpression';
import { createDragonLegSculpt } from './limbSculpt';
import { poseOnyxLegFlex } from './onyxLegFlex';
import { makeOnyxEyeLens } from './eyeLens';
import { sculptOnyxLowerJaw } from './onyxJawSculpt';
import { RiderCloakMotion } from '../rider/cloakMotion';
import { mountedRiderSeat } from '../rider/mountSeat';

const scaleTextures=makeDragonScaleTextures();
const skin = applyDragonScales(
  new THREE.MeshStandardMaterial({ color: 0x38425d, roughness: 0.79, metalness: 0.035 }),
  scaleTextures,
);
const bodySkin = skin.clone();
bodySkin.vertexColors = true;
// Lighter original navy paint keeps cheeks/scapulae visible in muted daylight.
bodySkin.color.setHex(0x56627f);
// Preserve the original shader's normals/roughness while applying actual
// AI-assisted source-painting pigment to the torso and skull.
bodySkin.map = makeOnyxPaintedScaleMap();
const highlight = applyDragonScales(
  new THREE.MeshStandardMaterial({ color: 0x494265, roughness: 0.56, metalness: 0.11 }),
  scaleTextures,
);
const ridges = applyDragonScales(
  new THREE.MeshStandardMaterial({ color: 0x171f32, roughness: 0.74 }),
  scaleTextures,
);
const enamel=new THREE.MeshStandardMaterial({
  color:0xaeb3ae,roughness:.78,metalness:0.01,
});
const iris = new THREE.MeshStandardMaterial({
  color: 0x76b1a2, emissive: 0x1c433d, emissiveIntensity: 0.12, roughness: 0.64,
});
const pupil = new THREE.MeshStandardMaterial({ color: 0x102329, roughness: 0.35 });
const glimmer = new THREE.MeshStandardMaterial({
  color: 0xe3f8e3, emissive: 0x648b84, emissiveIntensity: 0.10,
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
  // The skinned tail at z≈2.15 has center y=-.16 and dorsal radius≈.05.
  // Old fin roots were ~11cm above the skin and rendered as loose petals.
  parent.add(sculptFin([0,-.125,2.11],[0,.17,2.67],.31,
    highlight,'creature.dragon.tail-fin.central',28));
  for(const side of [-1,1] as const) {
    parent.add(sculptFin([0,-.165,2.09],
      [side*.48,-.13,2.62],.29,skin,
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
  private readonly tailRig = createDragonTailRig(skin);
  private readonly tail = this.tailRig.root;
  private readonly head = new THREE.Group();
  private readonly torso: THREE.Mesh;
  private readonly eyes: Array<{
    iris:THREE.Mesh; pupil:THREE.Mesh; glint:THREE.Mesh;
    lid:THREE.Mesh; brow:THREE.Group; side:number;
  }> = [];
  private readonly crests:THREE.Group[] = [];
  private readonly jawPivot=new THREE.Group();
  private readonly riderTail = {
    root:this.rider.getObjectByName('rider.tail') as THREE.Group,
    mid:this.rider.getObjectByName('rider.tail.mid') as THREE.Bone,
    tip:this.rider.getObjectByName('rider.tail.end') as THREE.Bone,
  };
  private readonly riderMouth = this.rider.getObjectByName('rider.mouth') as THREE.Mesh;
  private readonly riderHead = this.rider.getObjectByName('rider.head') as THREE.Group;
  private readonly riderFaceSurface = this.rider.getObjectByName('rider.face') as THREE.Mesh;
  private readonly riderHairLeft = this.rider.getObjectByName('rider.hair-lock.left') as THREE.Group;
  private readonly riderHairRight = this.rider.getObjectByName('rider.hair-lock.right') as THREE.Group;
  private readonly riderSpine = this.rider.getObjectByName('rider.spine') as THREE.Group;
  private readonly riderEyes = ([-1,1] as const).map(side => {
    const suffix=side<0?'left':'right';
    return {
      white:this.rider.getObjectByName('rider.eye.'+suffix) as THREE.Mesh,
      iris:this.rider.getObjectByName('rider.iris.'+suffix) as THREE.Mesh,
      upperLid:this.rider.getObjectByName('rider.eyelid.upper.'+suffix) as THREE.Mesh,
      brow:this.rider.getObjectByName('rider.brow.'+suffix) as THREE.Mesh,
    };
  });
  private readonly cloakMotion = new RiderCloakMotion(
    this.rider.getObjectByName('rider.travel-cloak') as THREE.Mesh);
  private readonly riderLimbs = {
    leftArm: this.rider.getObjectByName('rider.leftArm') as THREE.Group,
    rightArm: this.rider.getObjectByName('rider.rightArm') as THREE.Group,
    leftLeg: this.rider.getObjectByName('rider.leftLeg') as THREE.Group,
    rightLeg: this.rider.getObjectByName('rider.rightLeg') as THREE.Group,
    leftElbow: this.rider.getObjectByName('rider.leftElbow') as THREE.Group,
    rightElbow: this.rider.getObjectByName('rider.rightElbow') as THREE.Group,
    leftWrist: this.rider.getObjectByName('rider.leftWrist') as THREE.Group,
    rightWrist: this.rider.getObjectByName('rider.rightWrist') as THREE.Group,
    leftKnee: this.rider.getObjectByName('rider.leftKnee') as THREE.Group,
    rightKnee: this.rider.getObjectByName('rider.rightKnee') as THREE.Group,
    leftAnkle: this.rider.getObjectByName('rider.leftAnkle') as THREE.Group,
    rightAnkle: this.rider.getObjectByName('rider.rightAnkle') as THREE.Group,
  };
  private readonly riderTrousers = {
    left:this.riderLimbs.leftLeg.getObjectByName('rider.trousers') as THREE.Mesh,
    right:this.riderLimbs.rightLeg.getObjectByName('rider.trousers') as THREE.Mesh,
  };
  private readonly riderSleeves = {
    left:this.riderLimbs.leftArm.getObjectByName('rider.sleeve') as THREE.Mesh,
    right:this.riderLimbs.rightArm.getObjectByName('rider.sleeve') as THREE.Mesh,
  };
  private readonly legs: Array<{
    group: THREE.Group; foot: THREE.Group; flesh:THREE.Mesh; diagonal: boolean;
    front: boolean; side: -1 | 1;
  }> = [];
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
    const core = new THREE.Mesh(loftDragon(ONYX_TORSO,124,40,'torso'),bodySkin);
    this.torso = core;
    core.name='creature.dragon.onyx.anatomical-torso';
    core.castShadow=true;core.receiveShadow=true;
    this.body.add(core);
    this.head.name = 'head';
    this.head.position.set(0, 0.32, -1.54);
    const skull=new THREE.Mesh(loftDragon(ONYX_HEAD,76,36,'skull'),bodySkin);
    skull.name='creature.dragon.onyx.sculpted-skull';
    skull.castShadow=true;
    this.head.add(skull);
    this.jawPivot.name='creature.dragon.onyx.jaw-hinge';
    this.jawPivot.position.set(0,-.17,-.06);
    this.jawPivot.add(sculptOnyxLowerJaw(highlight,skin,enamel));
    this.head.add(this.jawPivot);
    for (const side of [-1, 1]) {
      const irisMesh=makeOnyxEyeLens(this.head,side as -1|1,iris,
        [side*.59,.20,-.35],[.110,.158,.16]);
      irisMesh.name='creature.dragon.eye.iris.'+(side<0?'left':'right');
      // The vertical slit remains a separately animated named part.
      const pupilMesh=ellipsoid(this.head,pupil,
        [side*.595,.21,-.398],[.032,.103,.025],14);
      pupilMesh.name='creature.dragon.eye.pupil.'+(side<0?'left':'right');
      const glint=ellipsoid(this.head,glimmer,
        [side*.623,.273,-.423],[.014,.020,.013],10);
      glint.name='creature.dragon.eye.glint.'+(side<0?'left':'right');
      // Painted brow and upper lid are independent, moveable anatomical
      // surfaces. A blink no longer makes just the dark pupil disappear.
      const brow=new THREE.Group();
      brow.name='creature.dragon.brow.'+(side<0?'left':'right');
      brow.add(new THREE.Mesh(taperedSpine([
        [side*.35,.335,-.47],[side*.52,.375,-.43],
        [side*.65,.305,-.31],
      ],.090,12,26),ridges));
      this.head.add(brow);
      const lid=new THREE.Mesh(taperedSpine([
        [side*.39,.385,-.41],[side*.52,.413,-.41],
        [side*.65,.370,-.32],
      ],.053,12,23),skin);
      lid.name='creature.dragon.upper-lid.'+(side<0?'left':'right');
      this.head.add(lid);
      this.eyes.push({iris:irisMesh,pupil:pupilMesh,glint,lid,brow,side});
      // The original Onyx muzzle needs readable nostrils and a continuous
      // upper-lip contour at close range. Curved lofted forms sit against the
      // head's existing anatomical section, not on floating sphere beads.
      const nostril=new THREE.Mesh(taperedSpine([
        [side*.110,.031,-1.138],[side*.176,.051,-1.080],
        [side*.236,.062,-.994],
      ],.033,12,26),ridges);
      nostril.name='creature.dragon.nostril.'+(side<0?'left':'right');
      nostril.castShadow=true;
      this.head.add(nostril);
      const upperLip=new THREE.Mesh(taperedSpine([
        [side*.155,-.255,-1.116],[side*.303,-.248,-.934],
        [side*.410,-.191,-.731],[side*.452,-.174,-.502],
      ],.044,12,32),highlight);
      upperLip.name='creature.dragon.upper-lip.'+(side<0?'left':'right');
      upperLip.castShadow=true;
      this.head.add(upperLip);
      // Distinctive backward-swept paired horn and cartilage fin-crests.
      const horn=new THREE.Mesh(taperedSpine([
        [side*.36,.40,.27],[side*.445,.58,.40],
        [side*.51,.72,.64],[side*.575,.785,.91],
        [side*.61,.775,1.12],
      ],.138,14),ridges);
      horn.name=side<0?'creature.dragon.horn.left':'creature.dragon.horn.right';
      this.head.add(horn);
      const crestPivot=new THREE.Group();
      crestPivot.name='creature.dragon.mobile-crest.'+(side<0?'left':'right');
      crestPivot.position.set(side*.49,.23,.14);
      const crestMesh=sculptFin([side*.49,.23,.14],
        [side*1.02,.44,.83],.60,highlight,
        side<0?'creature.dragon.crest.left':'creature.dragon.crest.right',30);
      crestMesh.position.set(-side*.49,-.23,-.14);
      crestPivot.add(crestMesh);
      this.head.add(crestPivot);
      this.crests.push(crestPivot);
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
      const rootZ=z-.11;
      const height=onyxDorsalY(rootZ)-.045;
      // Low-profile cartilage in the rider's saddle corridor: the old
      // fixed-height plates speared the rider and hovered above the hips.
      const saddleGap=Math.exp(-Math.pow((z+.20)/.42,2)*2);
      const length=(.23-.09*i/9)*(1-.67*saddleGap);
      const ridgeMesh=sculptFin([0,height,rootZ],
        [0,height+length,z+.18],
        .16,ridges,'creature.dragon.dorsal-ridge.'+i,18);
      ridgeMesh.castShadow=true;
      ridgeMesh.receiveShadow=true;
      this.body.add(ridgeMesh);
    }
    // Hinged procedural legs: diagonal pairs step in opposition on land.
    for (const side of [-1, 1] as const) {
      for (const front of [true, false]) {
        const sculpt = createDragonLegSculpt(front, skin, ridges, highlight,side);
        const leg = sculpt.group;
        const z = front ? -1.05 : 1.03;
        leg.name = 'leg.' + (front ? 'front' : 'hind') + (side < 0 ? 'Left' : 'Right');
        leg.position.set(side * 0.55, -0.45, z);
        this.body.add(leg);
        this.legs.push({
          group: leg, foot: sculpt.foot, flesh:sculpt.flesh,
          diagonal: (side < 0) === front,
          front, side,
        });
      }
    }
    this.body.add(this.wingL.root, this.wingR.root);
    // A continuous skinned tail replaces the formerly rigid loft. Tail fins
    // inherit the end-bone motion while retaining original authoring coords.
    tailFin(this.tailRig.finSocket);
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

  update(state: FlightState, lastClaw?: ClawCast | null): void {
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
    // Local morph breathes the chest under the neck/wing roots; the root
    // transform, seat attachment and collision dimensions are untouched.
    if (this.torso.morphTargetInfluences) {
      this.torso.morphTargetInfluences[0] =
        .42 + .32 * Math.sin(state.time * 1.45);
    }

    poseWing(this.wingL, -1, pose);
    poseWing(this.wingR, 1, pose);
    // Cast metadata animates the original foreleg sockets; it never
    // determines hits or modifies the fixed-step gameplay state.
    const clawAge = lastClaw && lastClaw.form === state.form
      ? state.time - lastClaw.time : -1;
    const clawSwing = clawAge >= 0 && clawAge < .43
      ? Math.sin(Math.PI * clawAge / .43) : 0;
    for (const leg of this.legs) {
      const phase = pose.gaitPhase + (leg.diagonal ? 0 : Math.PI);
      const stride = Math.sin(phase) * pose.gaitAmount;
      const aquatic=state.mode==='underwater'||state.mode==='surface';
      // Keep muscle compression aligned to the existing diagonal footstep
      // and swimming animation, without altering collision or leg sockets.
      const compression=pose.name==='walk' ? stride
        : aquatic ? Math.sin(state.time*4.4+(leg.diagonal?0:Math.PI))*.45
          : state.mode==='air' ? -.16 : 0;
      poseOnyxLegFlex(leg.flesh,compression);
      leg.group.rotation.x = (pose.name === 'walk' ? stride * 0.43
        : state.mode === 'underwater' || state.mode === 'surface'
          ? Math.sin(state.time * 4.4 + (leg.diagonal ? 0 : Math.PI)) * 0.13
          : state.mode === 'air' ? -0.19 : 0)
        - (leg.front ? clawSwing * (leg.side < 0 ? .66 : .44) : 0);
      leg.group.rotation.z = leg.front ? leg.side * clawSwing * .15 : 0;
      leg.group.position.y = -0.45 + (pose.name === 'walk'
        ? Math.max(0, Math.sin(phase)) * pose.gaitAmount * 0.08 : 0);
      // Keep the articulated toes grounded while the hock lifts.
      leg.foot.rotation.x = (pose.name === 'walk'
        ? -Math.max(0, Math.sin(phase)) * pose.gaitAmount * 0.22
        : state.mode === 'underwater' || state.mode === 'surface'
          ? Math.sin(state.time * 4.4 + (leg.diagonal ? 0 : Math.PI)) * 0.09 : 0)
        + (leg.front ? clawSwing * .23 : 0);
    }
    poseDragonTail(this.tailRig,pose,state.time);
    this.head.rotation.x = pose.neckAngle - clawSwing * .07;
    this.head.rotation.y = -state.roll * 0.15 + Math.sin(state.time * 0.7) * 0.028;
    const face=dragonExpression(state,pose);
    this.jawPivot.rotation.x=-face.jawAngle;
    for(const eye of this.eyes){
      eye.iris.scale.y=.158*face.eyeOpen;
      eye.pupil.scale.y=.103*face.eyeOpen;
      eye.glint.scale.y=.020*face.eyeOpen;
      eye.pupil.position.z=-.398+face.pupilShift*.045;
      eye.glint.position.y=.273-(1-face.eyeOpen)*.020;
      eye.lid.position.y=-(1-face.eyeOpen)*.10;
      eye.brow.position.y=face.browLift;
      eye.brow.rotation.z=eye.side*face.browLift*.48;
    }
    for(let i=0;i<this.crests.length;i++){
      const crest=this.crests[i]!;
      crest.rotation.x=-face.crestAngle;
      crest.rotation.y=(i===0?-1:1)*face.crestAngle*.40;
    }

    this.importedDragon?.animateDragon(pose, dt);
    const riderMotion = riderPose(state);
    const upperPose = riderUpperBodyPose(state,riderMotion,pose.riderLean);
    this.riderSpine.rotation.set(
      upperPose.spinePitch,upperPose.spineYaw,upperPose.spineBank);
    const riderFace = riderFacialPose(state,riderMotion);
    poseRiderFaceMorphs(this.riderFaceSurface,
      riderFace.cheekLift,riderFace.faceFocus);
    for(const feature of this.riderEyes){
      feature.white.scale.y=.018*riderFace.eyeOpen;
      feature.iris.scale.y=.014*riderFace.eyeOpen;
      feature.upperLid.position.y=-(1-riderFace.eyeOpen)*.016;
      feature.brow.position.y=riderFace.browLift;
    }
    this.riderMouth.position.y=riderFace.mouthShift;
    this.riderMouth.scale.x=1+riderFace.cheekLift*.08;
    this.riderHead.rotation.set(
      riderFace.headPitch,riderFace.headYaw,riderFace.headBank);
    poseRiderHairLocks(this.riderHairLeft,this.riderHairRight,
      state,riderMotion.motion);
    this.cloakMotion.update(state.time,
      state.form === 'small' ? state.riderSpeed : state.speed,
      state.form === 'small' ? 0 : state.roll);
    this.importedRider?.animateRider(riderMotion, Math.abs(state.riderSpeed), dt);
    this.riderLimbs.leftArm.rotation.x = riderMotion.leftArm;
    this.riderLimbs.rightArm.rotation.x = riderMotion.rightArm;
    this.riderLimbs.leftLeg.rotation.x = riderMotion.leftLeg;
    this.riderLimbs.rightLeg.rotation.x = riderMotion.rightLeg;
    // Onyx's rider must drape around his rideable flanks, but kneel on
    // the giant dorsal shelf. Leave these rotations zero on foot/swimming.
    this.riderLimbs.leftLeg.rotation.z = -riderMotion.legSpread;
    this.riderLimbs.rightLeg.rotation.z = riderMotion.legSpread;
    this.riderLimbs.leftElbow.rotation.x = riderMotion.leftElbow;
    this.riderLimbs.rightElbow.rotation.x = riderMotion.rightElbow;
    poseSleeveCrease(this.riderSleeves.left,riderMotion.leftElbow);
    poseSleeveCrease(this.riderSleeves.right,riderMotion.rightElbow);
    this.riderLimbs.leftWrist.rotation.x = riderMotion.leftWrist;
    this.riderLimbs.rightWrist.rotation.x = riderMotion.rightWrist;
    this.riderLimbs.leftKnee.rotation.x = riderMotion.leftKnee;
    this.riderLimbs.rightKnee.rotation.x = riderMotion.rightKnee;
    poseRiderKneeCloth(this.riderTrousers.left,riderMotion.leftKnee);
    poseRiderKneeCloth(this.riderTrousers.right,riderMotion.rightKnee);
    this.riderLimbs.leftKnee.rotation.z = -riderMotion.kneeSpread;
    this.riderLimbs.rightKnee.rotation.z = riderMotion.kneeSpread;
    this.riderLimbs.leftAnkle.rotation.x = riderMotion.leftAnkle;
    this.riderLimbs.rightAnkle.rotation.x = riderMotion.rightAnkle;
    poseRiderTail(this.riderTail,state,riderMotion);
    if (state.form === 'small') {
      if (this.scene && this.rider.parent !== this.scene) this.scene.add(this.rider);
      this.rider.position.set(
        state.riderX, state.riderY, state.riderZ,
      );
      this.rider.rotation.set(
        upperPose.pelvisPitch,
        -state.riderYaw,
        upperPose.pelvisBank,
      );
      this.rider.visible = true;
    } else {
      if (this.rider.parent !== this.root) this.root.add(this.rider);
      const seat=mountedRiderSeat(this.displayedScale);
      // Both torso and saddle occupy the same world-space bobbing frame.
      // Previously the dragon walked through the fixed rider pelvis.
      this.rider.position.set(0,seat.y + this.body.position.y,seat.z);
      this.rider.rotation.set(upperPose.pelvisPitch, 0, upperPose.pelvisBank);
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
