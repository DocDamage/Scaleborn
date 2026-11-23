import * as THREE from 'three';
import { rng } from '../core/random';
import { AZURE_SEED } from './terrain';
import { GRAND_LAKE, MIRRORFALL, lakeContains } from './highlandLake';
import { WATERFALL_DROP, waterfallCenterXAt } from './waterfallTrajectory';
import { waterWaveOffsetAt } from './waterWaves';
import { makeSprayStreakGeometry } from './sprayStreak';

type Quality = 'high' | 'low';

interface FallSeed {
  phase: number;
  period: number;
  lateral: number;
  wind: number;
  radius: number;
  length: number;
}

const GRAVITY = 9.81;
export const WATERFALL_FALL_SECONDS = Math.sqrt(2 * WATERFALL_DROP / GRAVITY);
const UP = new THREE.Vector3(0, 1, 0);

/**
 * A single instanced draw of detached water threads following the very same
 * ballistic centerline as the Mirrorfall curtains and contact current. A
 * particle's normalized fall distance grows as elapsed time squared, rather
 * than moving linearly down a flat billboard. Spawn times, widths and lateral
 * trajectories are seeded, so capture frames do not depend on frame rate.
 *
 * This is visual breakup of the curtain, not a fluid-volume simulation.
 * The material and translucent streak atlas belong to MirrorfallCascade;
 * only this mesh geometry is owned and disposed here.
 */
export class WaterfallFallSpray {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly seeds: FallSeed[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly direction = new THREE.Vector3();

  constructor(material: THREE.MeshBasicMaterial, quality: Quality = 'high') {
    const count = quality === 'high' ? 540 : 240;
    const random = rng(AZURE_SEED + 60471);
    this.mesh = new THREE.InstancedMesh(makeSprayStreakGeometry(), material, count);
    this.mesh.name = 'water.azure.mirrorfall-falling-droplet-threads';
    this.mesh.renderOrder = 3.2;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const shimmer = .70 + random() * .30;
      this.seeds.push({
        phase: random(),
        period: WATERFALL_FALL_SECONDS * (1.03 + random() * .17),
        lateral: (random() - .5) * .98,
        wind: (random() - .5) * 3.2,
        radius: .09 + random() * .12,
        length: .55 + random() * 1.20,
      });
      // Individual pigment differences without another shader or draw call.
      this.mesh.setColorAt(i, color.setRGB(
        shimmer * .83, shimmer * .94, shimmer * .91));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.update(0);
  }

  get count(): number { return this.seeds.length; }

  update(time: number): void {
    if (!Number.isFinite(time)) return;
    for (let i = 0; i < this.seeds.length; i++) {
      const seed = this.seeds[i]!;
      const cycle = ((time / seed.period + seed.phase) % 1 + 1) % 1;
      const age = cycle * seed.period;
      const active = age < WATERFALL_FALL_SECONDS;
      const drop = Math.min(1, Math.pow(age / WATERFALL_FALL_SECONDS, 2));
      const x = waterfallCenterXAt(drop) - seed.wind * drop * drop
        + Math.sin(time * 1.7 + seed.phase * Math.PI * 2) * drop * 1.35;
      const z = MIRRORFALL.z + seed.lateral * MIRRORFALL.width * (.70 + .30 * drop)
        + Math.sin(time * 1.2 + seed.phase * 5) * drop * 1.8;
      const y = MIRRORFALL.topY - WATERFALL_DROP * drop;
      // The crest is not necessarily at the static lake elevation; droplets
      // disappear at the same displaced surface used by swimming and foam.
      const waterY = GRAND_LAKE.surfaceY + waterWaveOffsetAt(x, z, time);
      // The lip is outside the lake boundary. Only demand freshwater
      // containment close to the pool, where an escaping particle would
      // otherwise punch through shore rocks.
      const inWater = drop < .82 || lakeContains(x, z);
      const visible = active && inWater && y > waterY + .25;
      this.dummy.position.set(x, Math.max(y, waterY + .25), z);
      if (visible && inWater) {
        const forward = Math.min(.07, WATERFALL_FALL_SECONDS - age);
        const nextT = Math.pow((age + forward) / WATERFALL_FALL_SECONDS, 2);
        const vx = (waterfallCenterXAt(nextT) - waterfallCenterXAt(drop))
          / Math.max(.001, forward);
        // Physically accelerating fall, with minor cross-stream diffusion.
        this.direction.set(vx, -GRAVITY * Math.max(.09, age),
          seed.lateral * .5).normalize();
        this.dummy.quaternion.setFromUnitVectors(UP, this.direction);
        const fade = Math.min(1, age / .35,
          (WATERFALL_FALL_SECONDS - age) / .24);
        const taper = .45 + .55 * Math.max(0, fade);
        this.dummy.scale.set(
          seed.radius * (.67 + .44 * drop) * taper,
          seed.length * (.70 + 1.14 * drop) * taper,
          seed.radius * (.67 + .44 * drop) * taper,
        );
      } else {
        this.dummy.quaternion.identity();
        this.dummy.scale.setScalar(0);
      }
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    // Shared material and texture are disposed by the parent cascade.
  }
}
