import * as THREE from 'three';
import type { DragonPose } from '../dragon/animationPose';
import type { RiderPose } from './pose';

export interface CharacterModelFile {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export type CharacterKind = 'dragon' | 'rider';

const DRAGON_ACTIONS: Readonly<Record<DragonPose['name'], readonly string[]>> = {
  rest: ['Idle', 'Sleep Curled', 'Perch'],
  walk: ['Walk', 'Idle'],
  fly: ['Fly Glide', 'Fly Flap', 'Fly Hover'],
  surge: ['Fly Flap', 'Fly Glide'],
  land: ['Land', 'Fly Glide'],
  launch: ['Take Off', 'Fly Flap'],
  splash: ['Land', 'Fly Glide'],
  breach: ['Take Off', 'Fly Flap'],
  swim: ['Fly Glide', 'Fly Hover'],
  dive: ['Dive Attack', 'Fly Glide'],
};
const RIDER_ACTIONS: Readonly<Record<RiderPose['motion'] | 'run', readonly string[]>> = {
  mounted: ['Mounted', 'Sit'],
  idle: ['Idle', 'Breathing'],
  walk: ['Walk'],
  run: ['Run', 'Walk'],
  swim: ['Swim', 'Swim Forward'],
  dive: ['Dive', 'Swim'],
};

function normalizedName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Match explicit animation role aliases, not ambiguous first-clip ordering.
 * Some glTF exporters prefix clip names with an armature or take name.
 */
export function findCharacterClip(
  clips: readonly THREE.AnimationClip[], aliases: readonly string[],
): THREE.AnimationClip | undefined {
  for (const alias of aliases) {
    const target = normalizedName(alias);
    const exact = clips.find((clip) => normalizedName(clip.name) === target);
    if (exact) return exact;
    const suffix = clips.find((clip) => {
      const name = normalizedName(clip.name);
      return name.endsWith(target) && name.length <= target.length + 18;
    });
    if (suffix) return suffix;
  }
  return undefined;
}

/**
 * Owns imported GLB mesh/rig lifetime separately from the game's simulation.
 * Animated model transforms never move the gameplay actor; animation is
 * evaluated inside a normalized, character-local visual socket.
 */
export class ImportedCharacterRig {
  readonly root = new THREE.Group();
  readonly kind: CharacterKind;
  readonly model: THREE.Group;
  readonly mixer: THREE.AnimationMixer;
  readonly hasSkeleton: boolean;
  readonly sizeMeters: THREE.Vector3;
  readonly clips: readonly THREE.AnimationClip[];
  private current: THREE.AnimationAction | null = null;
  private activeName = '';
  private readonly ownedMeshes: THREE.Mesh[] = [];
  private readonly restRotations = new Map<THREE.Bone, THREE.Quaternion>();
  private readonly bones = new Map<string, THREE.Bone>();
  private disposed = false;

  constructor(kind: CharacterKind, source: CharacterModelFile) {
    this.kind = kind;
    this.model = source.scene;
    this.clips = source.animations;
    if (this.model.parent) throw new Error('Character GLB must not be attached to another scene');
    if (!this.clips.length) throw new Error('Character GLB has no animation clips');
    let hasSkeleton = false;
    this.model.traverse((node) => {
      if (node instanceof THREE.Bone) {
        this.bones.set(normalizedName(node.name), node);
        this.restRotations.set(node, node.quaternion.clone());
      }
      if (node instanceof THREE.Mesh) {
        this.ownedMeshes.push(node);
        node.castShadow = true;
        node.receiveShadow = true;
        // Skinned wing/cloth bounds can move well outside the bind pose.
        if (node instanceof THREE.SkinnedMesh) {
          hasSkeleton = true;
          node.frustumCulled = false;
        }
      }
    });
    if (!hasSkeleton) throw new Error('Character model must contain a skinned rig');
    this.hasSkeleton = hasSkeleton;

    const facing = new THREE.Group();
    facing.rotation.y = Math.PI; // Imported source forward (+Z) to Scaleborn forward (-Z).
    facing.add(this.model);
    this.root.add(facing);
    this.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.root);
    const native = bounds.getSize(new THREE.Vector3());
    if (![native.x, native.y, native.z].every(Number.isFinite)
      || native.y < .02 || native.z < .02) {
      throw new Error('Character model bounds are invalid');
    }
    const targetSize = kind === 'dragon' ? 7 : 1.52;
    // Dragon length remains seven metres at a visual scale of 1.0.
    // Rider height remains 1.52m for every dragon transformation.
    const factor = targetSize / (kind === 'dragon' ? native.z : native.y);
    facing.scale.setScalar(factor);
    this.root.updateMatrixWorld(true);
    const scaled = new THREE.Box3().setFromObject(this.root);
    const center = scaled.getCenter(new THREE.Vector3());
    facing.position.set(-center.x, (kind === 'dragon' ? -1.12 : 0) - scaled.min.y, -center.z);
    this.root.updateMatrixWorld(true);
    this.sizeMeters = new THREE.Box3().setFromObject(this.root).getSize(new THREE.Vector3());
    this.root.name = kind === 'dragon' ? 'creature.dragon.onyx.imported' : 'character.rider.hero.imported';
    this.root.userData.assetId = kind === 'dragon'
      ? 'creature.dragon.onyx' : 'character.rider.hero';
    this.mixer = new THREE.AnimationMixer(this.model);
  }

  get animationName(): string { return this.activeName; }

  private play(aliases: readonly string[], dt: number, oneShot = false): boolean {
    if (this.disposed) return false;
    const clip = findCharacterClip(this.clips, aliases);
    if (!clip) {
      if (this.current) {
        this.current.fadeOut(.2);
        this.current = null;
        this.activeName = '';
      }
      this.mixer.update(dt);
      return false;
    }
    if (this.activeName !== clip.name) {
      const previous = this.current;
      const next = this.mixer.clipAction(clip);
      next.reset();
      next.enabled = true;
      next.setEffectiveTimeScale(1);
      next.setEffectiveWeight(1);
      next.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
      next.clampWhenFinished = oneShot;
      next.fadeIn(.2).play();
      previous?.fadeOut(.2);
      this.current = next;
      this.activeName = clip.name;
    }
    this.mixer.update(Math.max(0, Math.min(.1, dt)));
    return true;
  }

  animateDragon(pose: DragonPose, dt: number): void {
    const oneShot = ['land', 'launch', 'splash', 'breach'].includes(pose.name);
    this.play(DRAGON_ACTIONS[pose.name], dt, oneShot);
  }

  animateRider(pose: RiderPose, speed: number, dt: number): void {
    const motion = pose.motion === 'walk' && speed > 4.5 ? 'run' : pose.motion;
    const hasClip = this.play(RIDER_ACTIONS[motion], dt);
    if (!hasClip) this.poseRiderBones(pose);
  }

  private findBone(aliases: readonly string[]): THREE.Bone | undefined {
    for (const alias of aliases) {
      const target = normalizedName(alias);
      const exact = this.bones.get(target);
      if (exact) return exact;
      for (const [name, bone] of this.bones) if (name.endsWith(target)) return bone;
    }
    return undefined;
  }

  private poseRiderBones(pose: RiderPose): void {
    // A mounted/swimming rider must not keep cycling the walking clip.
    // Apply real limb channels where the source humanoid rig exposes them.
    const channels: ReadonlyArray<readonly [readonly string[], number]> = [
      [['LeftArm', 'UpperArm_L', 'LeftUpperArm'], pose.leftArm],
      [['RightArm', 'UpperArm_R', 'RightUpperArm'], pose.rightArm],
      [['LeftUpLeg', 'Thigh_L', 'LeftUpperLeg'], pose.leftLeg],
      [['RightUpLeg', 'Thigh_R', 'RightUpperLeg'], pose.rightLeg],
      [['LeftForeArm', 'LeftLowerArm', 'Forearm_L'], pose.leftElbow],
      [['RightForeArm', 'RightLowerArm', 'Forearm_R'], pose.rightElbow],
      [['LeftLeg', 'LeftCalf', 'Shin_L'], pose.leftKnee],
      [['RightLeg', 'RightCalf', 'Shin_R'], pose.rightKnee],
      [['LeftFoot', 'Foot_L'], pose.leftAnkle],
      [['RightFoot', 'Foot_R'], pose.rightAnkle],
    ];
    for (const [names, angle] of channels) {
      const bone = this.findBone(names);
      const rest = bone && this.restRotations.get(bone);
      if (bone && rest) {
        bone.quaternion.copy(rest);
        bone.rotateX(angle);
      }
    }
    // Maintain fallback GLB parity with the original procedural rider.
    // Apply thigh/knee abduction after restoring named bones' rest-space
    // quaternions. Clips intentionally remain authoritative where supplied.
    const spread: ReadonlyArray<readonly [readonly string[], number]> = [
      [['LeftUpLeg', 'Thigh_L', 'LeftUpperLeg'], -pose.legSpread],
      [['RightUpLeg', 'Thigh_R', 'RightUpperLeg'], pose.legSpread],
      [['LeftLeg', 'LeftCalf', 'Shin_L'], -pose.kneeSpread],
      [['RightLeg', 'RightCalf', 'Shin_R'], pose.kneeSpread],
    ];
    for(const [names, angle] of spread) {
      const bone=this.findBone(names);
      if(bone && this.restRotations.has(bone)) bone.rotateZ(angle);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    for (const mesh of this.ownedMeshes) {
      geometries.add(mesh.geometry);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        materials.add(mat);
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap',
          'aoMap', 'emissiveMap', 'alphaMap'] as const) {
          const texture = (mat as THREE.MeshStandardMaterial)[key];
          if (texture instanceof THREE.Texture) textures.add(texture);
        }
      }
    }
    this.root.removeFromParent();
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
  }
}
