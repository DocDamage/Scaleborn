import * as THREE from 'three';
import { GRAND_LAKE } from './highlandLake';
import type { UnderwaterOpticsSample } from './underwaterOptics';

type Quality = 'high' | 'low';

// A camera-local, world-locked cell field. Index reassignment on camera
// movement preserves particles in the overlap: jitter hashes WORLD cells.
const CELL_SIZE = 3.2;

const vertexShader = `
  precision highp float;
  uniform vec3 uCameraCell;
  uniform float uCellSize;
  uniform float uTime;
  uniform float uSurfaceY;
  uniform float uLake;
  uniform float uImmersion;
  varying float vFade;
  varying float vSeed;
  varying float vDistance;

  vec3 hash3(vec3 cell) {
    return fract(sin(vec3(
      dot(cell, vec3(127.1, 311.7, 74.7)),
      dot(cell, vec3(269.5, 183.3, 246.1)),
      dot(cell, vec3(113.5, 271.9, 124.6))
    )) * 43758.5453);
  }

  float lakeRadius(vec2 p) {
    vec2 uv = (p - vec2(${GRAND_LAKE.x.toFixed(1)}, ${GRAND_LAKE.z.toFixed(1)})) /
      vec2(${GRAND_LAKE.radiusX.toFixed(1)}, ${GRAND_LAKE.radiusZ.toFixed(1)});
    float theta = atan(uv.y, uv.x);
    float shoreShape = 1.0 + .067*sin(3.0*theta + 1.10)
      + .042*sin(7.0*theta - .72) + .023*sin(13.0*theta + 2.0);
    return length(uv) / shoreShape;
  }

  void main() {
    vec3 cell = position + uCameraCell;
    vec3 seed = hash3(cell);
    vec3 world = (cell + seed) * uCellSize;
    world.x += .19*sin(uTime*.23 + seed.x*6.28 + world.y*.09);
    world.y += .14*sin(uTime*.17 + seed.y*6.28);
    world.z += .17*cos(uTime*.19 + seed.z*6.28 + world.y*.06);

    float r = lakeRadius(world.xz);
    bool inLake = r < .982;
    if ((uLake > .5 && !inLake) || (uLake < .5 && inLake)
      || world.y >= uSurfaceY-.20 || uImmersion < .01) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vFade = 0.0; vSeed = 0.0; vDistance = 1000.0;
      return;
    }

    vec4 mv = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    vDistance = length(mv.xyz);
    vFade = 1.0 - smoothstep(uSurfaceY-1.45, uSurfaceY-.20, world.y);
    vSeed = seed.z;
    gl_PointSize = clamp((.8 + seed.x*1.5) * 20.0 /
      max(2.0, -mv.z), .55, 3.2);
  }
`;

const fragmentShader = `
  precision highp float;
  uniform float uImmersion;
  uniform float uTransmission;
  uniform float uLake;
  varying float vFade;
  varying float vSeed;
  varying float vDistance;

  void main() {
    float radius = length(gl_PointCoord * 2.0 - 1.0);
    float softEdge = 1.0 - smoothstep(.16, 1.0, radius);
    float distanceFade = smoothstep(1.0, 4.0, vDistance)
      * (1.0 - smoothstep(18.0, 37.0, vDistance));
    float alpha = softEdge * vFade * distanceFade * uImmersion
      * (.17 + .12*vSeed) * mix(.42, 1.0, uTransmission);
    if (alpha < .004) discard;
    vec3 freshwater = mix(vec3(.44, .71, .61), vec3(.75, .85, .73), vSeed);
    vec3 seawater = mix(vec3(.38, .62, .69), vec3(.65, .80, .82), vSeed);
    gl_FragColor = vec4(mix(seawater, freshwater, uLake), alpha);
  }
`;

/**
 * Subtle drifting freshwater silt / seawater suspended particles. One
 * GPU points batch with stable world-cell scatter as the camera travels.
 * This is NOT volumetric scattering or a full fluid simulation.
 */
export class UnderwaterParticulates {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor(scene: THREE.Scene, quality: Quality = 'high') {
    const horizontalRadius = quality === 'high' ? 10 : 6;
    const verticalRadius = quality === 'high' ? 6 : 4;
    const cells: number[] = [];
    for (let x = -horizontalRadius; x <= horizontalRadius; x++) {
      for (let y = -verticalRadius; y <= verticalRadius; y++) {
        for (let z = -horizontalRadius; z <= horizontalRadius; z++) {
          cells.push(x, y, z);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(cells, 3));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uCameraCell: { value: new THREE.Vector3() },
        uCellSize: { value: CELL_SIZE },
        uTime: { value: 0 },
        uSurfaceY: { value: 0 },
        uLake: { value: 0 },
        uImmersion: { value: 0 },
        uTransmission: { value: 1 },
      },
      vertexShader, fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.name = 'water.azure.camera-local-suspended-silt';
    this.points.visible = false;
    // Vertex positions are cell INDEXES; the shader owns world placement.
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);
  }

  update(time: number, camera: THREE.Vector3, optics: UnderwaterOpticsSample): void {
    const valid = Number.isFinite(time) && [camera.x, camera.y, camera.z]
      .every(Number.isFinite);
    const immersed = valid && optics.medium !== 'air' && optics.immersion > .04;
    this.points.visible = immersed;
    if (!immersed) return;
    const uniforms = this.points.material.uniforms;
    (uniforms.uCameraCell!.value as THREE.Vector3).set(
      Math.floor(camera.x / CELL_SIZE),
      Math.floor(camera.y / CELL_SIZE),
      Math.floor(camera.z / CELL_SIZE),
    );
    uniforms.uTime!.value = time;
    uniforms.uLake!.value = optics.medium === 'lake' ? 1 : 0;
    uniforms.uSurfaceY!.value = optics.medium === 'lake' ? GRAND_LAKE.surfaceY : 0;
    uniforms.uImmersion!.value = Math.max(0, Math.min(1, optics.immersion));
    uniforms.uTransmission!.value = Math.max(0, Math.min(1, optics.lightTransmission));
  }

  dispose(): void {
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
