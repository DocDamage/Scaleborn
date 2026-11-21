import * as THREE from 'three';

/** Procedural watercolor-inspired sky with a warm sun disc and violet horizons. */
const vertexShader = `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  varying vec3 vDirection;
  void main() {
    vec3 dir = normalize(vDirection);
    float height = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    float horizon = 1.0 - smoothstep(0.48, 0.72, height);
    float daylight = smoothstep(0.40, 0.95, height);
    vec3 lavender = vec3(0.49, 0.55, 0.67);
    vec3 peach = vec3(0.96, 0.72, 0.57);
    vec3 azure = vec3(0.48, 0.68, 0.76);
    vec3 upper = vec3(0.28, 0.46, 0.63);
    vec3 sky = mix(mix(lavender, peach, horizon * 0.52), azure, daylight * 0.80);
    sky = mix(sky, upper, smoothstep(0.72, 1.0, height) * 0.60);
    vec3 sunDir = normalize(vec3(-0.56, 0.55, -0.58));
    float solarDot = max(0.0, dot(dir, sunDir));
    float glow = pow(solarDot, 19.0);
    float disc = smoothstep(0.9992, 0.99975, solarDot);
    sky = mix(sky, vec3(1.0, 0.80, 0.55), glow * 0.43);
    sky = mix(sky, vec3(1.0, 0.96, 0.76), disc);
    // Subtle broad-brush modulation; avoid high-frequency horizon banding.
    sky += sin(dir.x * 11.0 + dir.z * 7.0) * sin(dir.y * 9.0 - dir.z * 8.0) * 0.002;
    gl_FragColor = vec4(sky, 1.0);
  }
`;

export class PainterlySky {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader,
      side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(3200, 32, 20), this.material);
    this.mesh.name = 'sky.azure.paint-dome';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  moveWithCamera(x: number, y: number, z: number): void {
    this.mesh.position.set(x, y, z);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
