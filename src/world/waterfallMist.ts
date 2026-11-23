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

const mistVertex = [
  '#include <fog_pars_vertex>',
  'attribute float instanceOpacity;',
  'varying vec2 vMistUv;',
  'varying float vMistOpacity;',
  'void main() {',
  '  vMistUv = uv;',
  '  vMistOpacity = instanceOpacity;',
  '  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);',
  '  vec4 mvPosition = viewMatrix * world;',
  '  gl_Position = projectionMatrix * mvPosition;',
  '  #include <fog_vertex>',
  '}',
].join('\n');

const mistFragment = [
  'precision highp float;',
  '#include <fog_pars_fragment>',
  'uniform sampler2D uMistMap;',
  'varying vec2 vMistUv;',
  'varying float vMistOpacity;',
  'void main() {',
  '  vec4 mist = texture2D(uMistMap, vMistUv);',
  '  float alpha = mist.a * vMistOpacity;',
  '  if (alpha < 0.001) discard;',
  '  gl_FragColor = vec4(mist.rgb * vec3(0.89, 0.95, 0.92), alpha);',
  '  #include <tonemapping_fragment>',
  '  #include <colorspace_fragment>',
  '  #include <fog_fragment>',
  '}',
].join('\n');

/**
 * One instanced, camera-facing plume draw instead of 16/36 separately
 * sorted sprite draw calls. All particle transforms and opacity values are
 * updated in preallocated typed buffers; neither scene graph nor materials
 * grow during rendering. The diffuse texture and deterministic advection
 * remain the same physically inspired visual approximation.
 */
export class WaterfallMist {
  readonly group = new THREE.Group();
  readonly mesh: THREE.InstancedMesh;
  private readonly texture = makeWaterfallMistTexture();
  private readonly material: THREE.ShaderMaterial;
  private readonly seeds: MistSeed[] = [];
  private readonly opacities: Float32Array;
  private readonly opacityAttribute: THREE.InstancedBufferAttribute;
  private readonly position = new THREE.Vector3();
  private readonly facing = new THREE.Quaternion();
  private readonly size = new THREE.Vector3();
  private readonly matrix = new THREE.Matrix4();

  constructor(quality: Quality = 'high') {
    this.group.name = 'water.azure.mirrorfall-buoyant-mist';
    const random = rng(AZURE_SEED + 19073);
    const count = quality === 'high' ? 36 : 16;
    const geometry = new THREE.PlaneGeometry(1, 1);
    this.opacities = new Float32Array(count);
    this.opacityAttribute = new THREE.InstancedBufferAttribute(this.opacities, 1);
    this.opacityAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('instanceOpacity', this.opacityAttribute);
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog, { uMistMap: { value: this.texture } },
      ]),
      vertexShader: mistVertex,
      fragmentShader: mistFragment,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      fog: true,
    });
    this.mesh = new THREE.InstancedMesh(geometry, this.material, count);
    this.mesh.name = 'water.azure.mirrorfall-mist-batch';
    this.mesh.renderOrder = 3.5;
    // The cloud expands and drifts; a static construction-time bounding sphere
    // could otherwise incorrectly cull the entire batch.
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < count; i++) {
      this.seeds.push({
        phase: random(),
        period: 7 + 4.5 * random(),
        azimuth: Math.PI + (random() - .5) * 2.55,
        radius: 1.5 + 7 * random(),
        travel: 17 + 30 * random(),
        height: 14 + 21 * random(),
        wind: .4 + random() * .7,
        size: 14 + 15 * random(),
        opacity: .17 + .10 * random(),
        wobble: random() * Math.PI * 2,
      });
    }
    this.group.add(this.mesh);
    this.update(0);
  }

  /** Camera rotation, not camera position, faces the cards without translation. */
  update(time: number, camera?: THREE.Camera): void {
    if (!Number.isFinite(time)) return;
    if (camera) camera.getWorldQuaternion(this.facing);
    const waterY = GRAND_LAKE.surfaceY + waterWaveOffsetAt(
      MIRRORFALL_IMPACT.x, MIRRORFALL_IMPACT.z, time);
    for (let i = 0; i < this.seeds.length; i++) {
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
      this.position.set(x, waterY + rise, z);
      const width = seed.size * (.58 + age * 1.10);
      this.size.set(width * 1.17, width * .72, 1);
      this.matrix.compose(this.position, this.facing, this.size);
      this.mesh.setMatrixAt(i, this.matrix);
      const appear = smooth01(age / .16);
      const dissipate = 1 - smooth01((age - .65) / .35);
      this.opacities[i] = seed.opacity * appear * dissipate;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.opacityAttribute.needsUpdate = true;
  }

  get count(): number {
    return this.seeds.length;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.group.clear();
  }
}
