import * as THREE from 'three';
import { SEA_LEVEL, WORLD_WIDTH_METERS } from './terrain';

/**
 * Self-contained stylized ocean shader: no textures, external effects or APIs.
 * World positions in meters; color and line-work deliberately approximate
 * hand-painted water rather than physically based reflections.
 */
const vertexShader = `
  uniform float uTime;
  varying vec3 vWorld;
  varying float vCrest;

  void main() {
    vec3 local = position;
    float longWave = sin(local.x * 0.009 + local.z * 0.007 + uTime * 0.65);
    float crossWave = sin(local.x * -0.012 + local.z * 0.013 + uTime * 0.83);
    local.y += 0.26 * longWave + 0.17 * crossWave;
    vCrest = longWave * 0.5 + crossWave * 0.5;
    vec4 world = modelMatrix * vec4(local, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = `
  precision highp float;
  uniform float uTime;
  uniform vec3 uHorizon;
  varying vec3 vWorld;
  varying float vCrest;

  float brushNoise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
    float b = fract(sin(dot(cell + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
    float c = fract(sin(dot(cell + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
    float d = fract(sin(dot(cell + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    vec2 uv = vWorld.xz;
    float strokes = sin(uv.x * 0.062 + uv.y * 0.017 - uTime * 1.21
      + sin(uv.y * 0.024 + uTime * 0.28) * 1.4);
    float longStrokes = sin(uv.x * 0.019 - uv.y * 0.026 + uTime * 0.9);
    float flecks = brushNoise(uv * 0.045 + vec2(uTime * 0.014, 0.0));
    float shimmer = smoothstep(0.75, 0.98, strokes * 0.6 + longStrokes * 0.32 + flecks * 0.23);
    float d = clamp(length(cameraPosition - vWorld) / 2700.0, 0.0, 1.0);
    float view = clamp(dot(normalize(cameraPosition - vWorld), vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
    float fresnel = pow(1.0 - view, 2.1);
    vec3 deep = vec3(0.075, 0.29, 0.35);
    vec3 aqua = vec3(0.20, 0.47, 0.49);
    vec3 base = mix(deep, aqua, 0.30 + 0.22 * longStrokes + 0.12 * vCrest);
    base = mix(base, vec3(0.67, 0.78, 0.74), shimmer * 0.38);
    base += vec3(0.075, 0.063, 0.043) * fresnel;
    base += vec3(0.03) * (flecks - 0.5);
    base = mix(base, uHorizon, smoothstep(0.3, 1.0, d) * 0.85);
    gl_FragColor = vec4(base, 0.95);
  }
`;

export class PainterlyOcean {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uHorizon: { value: new THREE.Color(0xb6cbd4) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const geometry = new THREE.PlaneGeometry(
      WORLD_WIDTH_METERS + 2600,
      WORLD_WIDTH_METERS + 2600,
      120, 120,
    );
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.y = SEA_LEVEL + 0.13;
    this.mesh.name = 'water.azure.ocean';
    this.mesh.renderOrder = 1;
  }

  update(time: number): void {
    this.material.uniforms.uTime!.value = time;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
