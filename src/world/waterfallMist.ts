import * as THREE from 'three';
import { rng } from '../core/random';
import { AZURE_SEED } from './terrain';
import { GRAND_LAKE } from './highlandLake';
import { MIRRORFALL_IMPACT } from './waterDynamics';
import { waterWaveOffsetAt } from './waterWaves';

type Quality = 'high' | 'low';

interface MistSeed {
  phase: number;
  period: number;
  azimuth: number;
  radius: number;
  travel: number;
  height: number;
  wind: number;
  size: number;
  opacity: number;
  wobble: number;
}

const smooth01 = (x: number): number => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

/**
 * A single shared alpha atlas, not a set of opaque circular sprite cards.
 * Scalloped lobes and high-frequency variation keep the silhouette soft,
 * irregular and seed-stable while avoiding external texture dependencies.
 */
export function makeWaterfallMistTexture(): THREE.DataTexture {
  const side = 96;
  const rgba = new Uint8Array(side * side * 4);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const dx = (x + .5 - side * .5) / (side * .5);
      const dy = (y + .5 - side * .5) / (side * .5);
      const radius = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const lobes = .86 + .10 * Math.sin(angle * 5 + radius * 8)
        + .04 * Math.cos(angle * 9 - radius * 11);
      const soft = Math.exp(-radius * radius * 3.6);
      const rim = 1 - smooth01((radius / lobes - .64) / .34);
      const grain = .77 + .13 * Math.sin(dx * 17 + dy * 11)
        * Math.cos(dy * 23 - dx * 7);
      const index = (y * side + x) * 4;
      rgba[index] = 226;
      rgba[index + 1] = 243;
      rgba[index + 2] = 235;
      rgba[index + 3] = Math.round(
        255 * Math.max(0, soft * rim * grain));
    }
  }
  const texture = new THREE.DataTexture(rgba, side, side, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Advection-inspired buoyant plume released from the actual waterfall
 * impact point. Each particle fades into and out of its life cycle, grows
 * as mist disperses and drifts primarily offshore rather than repeatedly
 * oscillating like a fixed row of white billboards. No particle objects,
 * geometry or textures are allocated during update().
 */
export class WaterfallMist {
  readonly group = new THREE.Group();
  private readonly texture = makeWaterfallMistTexture();
  private readonly sprites: THREE.Sprite[] = [];
  private readonly seeds: MistSeed[] = [];

  constructor(quality: Quality = 'high') {
    this.group.name = 'water.azure.mirrorfall-buoyant-mist';
    const random = rng(AZURE_SEED + 19073);
    const count = quality === 'high' ? 36 : 16;
    for (let i = 0; i < count; i++) {
      const seed: MistSeed = {
        phase: random(),
        period: 7 + 4.5 * random(),
        // All azimuths point away from the rock wall into the lake.
        azimuth: Math.PI + (random() - .5) * 2.55,
        radius: 1.5 + 7 * random(),
        travel: 17 + 30 * random(),
        height: 14 + 21 * random(),
        wind: .4 + random() * .7,
        size: 14 + 15 * random(),
        opacity: .17 + .10 * random(),
        wobble: random() * Math.PI * 2,
      };
      const material = new THREE.SpriteMaterial({
        map: this.texture,
        color: 0xe1f2eb,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        fog: true,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(material);
      sprite.name = 'water.azure.mirrorfall-mist-wisp';
      sprite.renderOrder = 3.5;
      this.seeds.push(seed);
      this.sprites.push(sprite);
      this.group.add(sprite);
    }
    this.update(0);
  }

  update(time: number): void {
    if (!Number.isFinite(time)) return;
    // One wave sample for the entire shared source rather than one for
    // every sprite; the splash origin follows the actual lake wave motion.
    const waterY = GRAND_LAKE.surfaceY + waterWaveOffsetAt(
      MIRRORFALL_IMPACT.x, MIRRORFALL_IMPACT.z, time);
    for (let i = 0; i < this.sprites.length; i++) {
      const sprite = this.sprites[i]!;
      const seed = this.seeds[i]!;
      const age = ((time / seed.period + seed.phase) % 1 + 1) % 1;
      const spread = seed.radius + age * seed.travel;
      const crosswind = Math.sin(time * .31 + seed.wobble) * age * 2.3;
      const x = MIRRORFALL_IMPACT.x + Math.cos(seed.azimuth) * spread
        - age * age * seed.wind * 11;
      const z = MIRRORFALL_IMPACT.z + Math.sin(seed.azimuth) * spread
        + crosswind;
      const rise = 1.1 + age * seed.height
        + Math.sin(age * 9 + seed.wobble) * age * .55;
      sprite.position.set(x, waterY + rise, z);
      const size = seed.size * (.58 + age * 1.10);
      sprite.scale.set(size * 1.17, size * .72, 1);
      const appear = smooth01(age / .16);
      const dissipate = 1 - smooth01((age - .65) / .35);
      (sprite.material as THREE.SpriteMaterial).opacity =
        seed.opacity * appear * dissipate;
    }
  }

  get count(): number {
    return this.sprites.length;
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const sprite of this.sprites) sprite.material.dispose();
    this.texture.dispose();
    this.group.clear();
  }
}
