import * as THREE from 'three';
import { GRAND_LAKE, lakeBoundaryScale } from './highlandLake';
import { heightAt } from './terrain';

/**
 * Lakebed-following shallow-water caustics. A sparse, static polar mesh samples
 * the exact gameplay heightfield. The moving light pattern is an inexpensive
 * interference approximation, not ray-traced refraction or simulated photons.
 */
const vertex = `
  attribute float aWaterDepth;
  varying vec3 vWorld;
  varying float vDepth;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vDepth = aWaterDepth;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragment = `
  precision highp float;
  uniform float uTime;
  varying vec3 vWorld;
  varying float vDepth;
  void main() {
    // Two slanted, moving wave fronts focus into irregular thin light veins.
    // World coordinates prevent texture seams as terrain LOD tiles change.
    vec2 p = vWorld.xz;
    vec2 warp = vec2(
      sin(p.y * .105 + uTime * .53),
      cos(p.x * .093 - uTime * .47)
    ) * 2.1;
    vec2 a = (p + warp) * .23;
    vec2 b = (p - warp.yx * .71) * .30;
    float veinA = 1.0 - abs(sin(a.x + sin(a.y * 1.18 + uTime * .64)));
    float veinB = 1.0 - abs(sin(b.y - cos(b.x * .86 - uTime * .51)));
    float crossing = pow(max(0.0, veinA), 15.0) * .58
      + pow(max(0.0, veinB), 19.0) * .36;
    float focus = pow(max(0.0, veinA * veinB), 8.0) * .27;
    // No sudden painted ring: light fades near shore, with water depth,
    // and with camera distance. Deep lake remains dark and explorable.
    float submerged = smoothstep(1.0, 4.5, vDepth);
    float absorption = 1.0 - smoothstep(10.0, 43.0, vDepth);
    float viewFade = exp(-length(cameraPosition - vWorld) * .0034);
    float alpha = clamp((crossing + focus) * .32 * submerged
      * absorption * viewFade, 0.0, .35);
    gl_FragColor = vec4(.55, .82, .73, alpha);
  }
`;

export class LakeCaustics {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor(quality: 'high' | 'low' = 'high') {
    const sectors = quality === 'high' ? 240 : 96;
    const rings = quality === 'high' ? 28 : 16;
    const positions: number[] = [];
    const depths: number[] = [];
    const indices: number[] = [];
    const inner = .64;
    const outer = .978; // Always inside the lakeContains boundary (0.982).

    for (let row = 0; row <= rings; row++) {
      const radius = inner + (outer - inner) * row / rings;
      for (let col = 0; col <= sectors; col++) {
        const angle = col / sectors * Math.PI * 2;
        const outline = lakeBoundaryScale(angle) * radius;
        const x = GRAND_LAKE.x + Math.cos(angle) * GRAND_LAKE.radiusX * outline;
        const z = GRAND_LAKE.z + Math.sin(angle) * GRAND_LAKE.radiusZ * outline;
        const floor = heightAt(x, z);
        positions.push(x, floor + .33, z);
        depths.push(Math.max(0, GRAND_LAKE.surfaceY - floor));
        if (row < rings && col < sectors) {
          const a = row * (sectors + 1) + col;
          const b = a + sectors + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aWaterDepth', new THREE.Float32BufferAttribute(depths, 1));
    geometry.setIndex(indices);
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: vertex,
      fragmentShader: fragment,
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'water.azure.mirrorfall-lakebed-caustics';
    // Render before transparent lake surface; both use the same terrain.
    this.mesh.renderOrder = 1;
  }

  update(time: number): void {
    this.mesh.material.uniforms.uTime!.value = time;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
