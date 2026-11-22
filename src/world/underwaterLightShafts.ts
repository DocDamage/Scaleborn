import * as THREE from 'three';
import { rng } from '../core/random';
import { AZURE_SEED } from './terrain';
import { GRAND_LAKE, lakeBoundaryScale } from './highlandLake';

const vertexShader = `
  attribute float aBeamSeed;
  varying vec3 vWorld;
  varying vec2 vBeamUv;
  varying float vSeed;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vBeamUv = uv;
    vSeed = aBeamSeed;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = `
  precision highp float;
  uniform float uTime;
  uniform float uStrength;
  varying vec3 vWorld;
  varying vec2 vBeamUv;
  varying float vSeed;
  void main() {
    // Volumetric-looking translucent curtains, not light-emitting solid cones.
    float feather = pow(max(0.0, 1.0 - abs(vBeamUv.x * 2.0 - 1.0)), 2.7);
    float entrance = smoothstep(0.0, .11, vBeamUv.y);
    float exitFade = 1.0 - smoothstep(.69, 1.0, vBeamUv.y);
    float drift = .79 + .21 * sin(
      vSeed * 7.31 + uTime * .42 + vWorld.x * .061 - vWorld.z * .036
    );
    float grain = .87 + .13 * sin(vBeamUv.y * 13.0 + vSeed * 4.7 - uTime * .31);
    float distanceFade = 1.0 - smoothstep(
      22.0, 96.0, length(cameraPosition - vWorld)
    );
    float alpha = .18 * uStrength * feather * entrance
      * exitFade * drift * grain * distanceFade;
    gl_FragColor = vec4(.49, .84, .89, clamp(alpha, 0.0, .19));
  }
`;

/**
 * Deterministically scattered, crossed transparency sheets within Mirrorfall
 * Lake. All columns share one GPU draw call; low quality creates fewer quads.
 * Their alpha is driven by actual camera submersion, not actor animation.
 */
export class UnderwaterLightShafts {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor(quality: 'high' | 'low' = 'high') {
    const random = rng(AZURE_SEED + 23117);
    const beams = quality === 'high' ? 320 : 96;
    const positions: number[] = [];
    const uvs: number[] = [];
    const seeds: number[] = [];

    const point = (
      x: number, y: number, z: number,
      u: number, v: number, seed: number,
    ): void => {
      positions.push(x, y, z);
      uvs.push(u, v);
      seeds.push(seed);
    };

    for (let i = 0; i < beams; i++) {
      const theta = random() * Math.PI * 2;
      // Keep column corners inward from the irregular bank. They must not
      // hang visibly over dry land or continue through the whole lake depth.
      const radius = Math.sqrt(random()) * .90 * lakeBoundaryScale(theta);
      const x = GRAND_LAKE.x + Math.cos(theta) * GRAND_LAKE.radiusX * radius;
      const z = GRAND_LAKE.z + Math.sin(theta) * GRAND_LAKE.radiusZ * radius;
      const seed = random() * 73;
      const angle = random() * Math.PI * 2;
      const halfTop = 1.9 + random() * 2.3;
      const halfBottom = halfTop * (1.32 + random() * .45);
      const yTop = GRAND_LAKE.surfaceY - .65;
      const yBottom = yTop - (27 + random() * 25);
      // Two intersecting crossed cards avoid beams disappearing edge-on when
      // exploring in third person. Winding is double-sided.
      for (let cross = 0; cross < 2; cross++) {
        const a = angle + cross * Math.PI / 2;
        const dx = Math.cos(a), dz = Math.sin(a);
        const tl: [number, number, number] = [
          x - dx * halfTop, yTop, z - dz * halfTop,
        ];
        const tr: [number, number, number] = [
          x + dx * halfTop, yTop, z + dz * halfTop,
        ];
        const bl: [number, number, number] = [
          x - dx * halfBottom, yBottom, z - dz * halfBottom,
        ];
        const br: [number, number, number] = [
          x + dx * halfBottom, yBottom, z + dz * halfBottom,
        ];
        point(...tl, 0, 0, seed);
        point(...bl, 0, 1, seed);
        point(...tr, 1, 0, seed);
        point(...bl, 0, 1, seed);
        point(...br, 1, 1, seed);
        point(...tr, 1, 0, seed);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('aBeamSeed', new THREE.Float32BufferAttribute(seeds, 1));
    geometry.computeBoundingSphere();
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uStrength: { value: 0 } },
      vertexShader, fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'water.azure.mirrorfall-underwater-shafts';
    this.mesh.renderOrder = 1;
    this.mesh.visible = false;
  }

  update(time: number, strength: number): void {
    const opacity = Number.isFinite(strength)
      ? Math.max(0, Math.min(1, strength)) : 0;
    this.mesh.visible = opacity > .005;
    this.mesh.material.uniforms.uTime!.value = time;
    this.mesh.material.uniforms.uStrength!.value = opacity;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
