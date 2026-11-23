import * as THREE from 'three';
import { fbm, hash2 } from '../core/random';
import { AZURE_SEED, heightAt } from './terrain';
import {
  GRAND_LAKE, MIRRORFALL, lakeBoundaryScale, lakeContains, waterSurfaceAt,
} from './highlandLake';
import { InstanceVisibility } from './instanceVisibility';

type Quality = 'high' | 'low';
type Point = readonly [number, number, number];
type Paint = readonly [number, number, number];
interface ReedSite { x: number; z: number; y: number; scale: number; tint: number }
const GREEN: Paint = [.30, .42, .23];
const OLIVE: Paint = [.43, .45, .24];
const STRAW: Paint = [.61, .55, .32];
const SEED: Paint = [.28, .18, .13];

/**
 * One authored patch prototype: rounded tapering stalks, curved strap leaves
 * and slender seed spikes, with no transparency sorting or collision changes.
 */
export function makeReedPatch(quality: Quality): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [];
  const emit = (a: Point, b: Point, c: Point, color: Paint): void => {
    positions.push(...a, ...b, ...c);
    colors.push(...color, ...color, ...color);
  };
  const stalkCount = quality === 'high' ? 11 : 6;
  const sides = quality === 'high' ? 6 : 4;
  for (let i = 0; i < stalkCount; i++) {
    const yaw = i * 2.399963229728653;
    const rootX = Math.cos(yaw) * (.15 + (i % 4) * .095);
    const rootZ = Math.sin(yaw) * (.15 + (i % 3) * .12);
    const height = 2.95 + .25 * (i % 4) + .12 * Math.sin(i * 2.7);
    const leanX = Math.cos(yaw) * (.16 + .05 * (i % 3));
    const leanZ = Math.sin(yaw) * (.16 + .05 * (i % 3));
    const center = (t: number): Point => [
      rootX + leanX * t * t, height * t,
      rootZ + leanZ * t * t,
    ];
    const ring = (t: number, radius: number): Point[] => {
      const p = center(t);
      return Array.from({ length: sides }, (_, k): Point => {
        const a = k * 2 * Math.PI / sides + yaw;
        return [p[0] + Math.cos(a) * radius, p[1],
          p[2] + Math.sin(a) * radius];
      });
    };
    const rings = [
      ring(0, .022), ring(.43, .019), ring(.81, .012), ring(1, .003),
    ];
    for (let level = 0; level < rings.length - 1; level++) {
      const lower = rings[level]!, upper = rings[level + 1]!;
      const shade = level === 0 ? GREEN : level === 1 ? OLIVE : STRAW;
      for (let side = 0; side < sides; side++) {
        const next = (side + 1) % sides;
        emit(lower[side]!, upper[side]!, lower[next]!, shade);
        emit(lower[next]!, upper[side]!, upper[next]!, shade);
      }
    }
    // Curved, narrowed leaves are actual lit triangles, not alpha quads.
    for (let leaf = 0; leaf < (quality === 'high' ? 3 : 2); leaf++) {
      const direction = yaw + leaf * 2.24 + .38;
      const dx = Math.cos(direction), dz = Math.sin(direction);
      const baseY = height * (.08 + leaf * .13);
      const reach = 1.02 + .23 * ((i + leaf) % 4);
      const rise = .96 + .27 * ((i + leaf * 2) % 3);
      const width = .082 + .018 * (leaf % 2);
      const blade = (t: number, sign: number): Point => {
        const sweep = reach * (t * .37 + .63 * t * t);
        const half = width * (1 - t * t) + .001;
        return [
          rootX + dx * sweep - dz * half * sign,
          baseY + rise * Math.sin(t * Math.PI * .74),
          rootZ + dz * sweep + dx * half * sign,
        ];
      };
      for (let section = 0; section < 3; section++) {
        const t0 = section / 3, t1 = (section + 1) / 3;
        const l0 = blade(t0, -1), r0 = blade(t0, 1);
        const l1 = blade(t1, -1), r1 = blade(t1, 1);
        emit(l0, l1, r0, section === 2 ? STRAW : GREEN);
        emit(r0, l1, r1, section === 2 ? STRAW : OLIVE);
      }
    }
    // A compact cattail-like seed spike on some stalks.
    if (i % 3 === 0) {
      const bottom = center(.75), top = center(.90);
      for (let side = 0; side < sides; side++) {
        const a = side / sides * 2 * Math.PI;
        const b = (side + 1) / sides * 2 * Math.PI;
        const radius = quality === 'high' ? .051 : .046;
        const p: Point = [bottom[0] + Math.cos(a) * radius,
          bottom[1], bottom[2] + Math.sin(a) * radius];
        const q: Point = [bottom[0] + Math.cos(b) * radius,
          bottom[1], bottom[2] + Math.sin(b) * radius];
        const r: Point = [top[0] + Math.cos(a) * radius * .73,
          top[1], top[2] + Math.sin(a) * radius * .73];
        const s: Point = [top[0] + Math.cos(b) * radius * .73,
          top[1], top[2] + Math.sin(b) * radius * .73];
        emit(p, r, q, SEED);
        emit(q, r, s, SEED);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Seed-stable, genuinely rooted bank habitat. One draw batch is repacked at
 * 48-meter intervals; world coordinates, wind, and shore clearance agree.
 */
export class ShorelineReeds {
  readonly mesh: THREE.InstancedMesh;
  readonly windTime = { value: 0 };
  private readonly visibility = new InstanceVisibility();
  private readonly material: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, quality: Quality = 'high') {
    const sites: ReedSite[] = [];
    const candidates = quality === 'high' ? 2600 : 920;
    for (let i = 0; i < candidates; i++) {
      const theta = (i + hash2(i, 17, AZURE_SEED + 438) * .84)
        / candidates * Math.PI * 2;
      const radius = .974 + hash2(i, 31, AZURE_SEED + 71) * .007;
      const shoreScale = lakeBoundaryScale(theta) * radius;
      const x = GRAND_LAKE.x + Math.cos(theta) * GRAND_LAKE.radiusX * shoreScale;
      const z = GRAND_LAKE.z + Math.sin(theta) * GRAND_LAKE.radiusZ * shoreScale;
      if (!lakeContains(x, z)) continue;
      const y = heightAt(x, z), depth = waterSurfaceAt(x, z) - y;
      if (depth < .20 || depth > 3.0) continue;
      if (Math.hypot(x - MIRRORFALL.x, z - MIRRORFALL.z) < 82) continue;
      if (hash2(i, 29, AZURE_SEED + 940) < .19 ||
        fbm(x * .016, z * .016, AZURE_SEED + 821, 3) < -.20) continue;
      const step = 1.8;
      const slope = Math.hypot(
        heightAt(x + step, z) - heightAt(x - step, z),
        heightAt(x, z + step) - heightAt(x, z - step),
      ) / (2 * step);
      if (slope > 1.08) continue;
      const tint = hash2(i, 53, AZURE_SEED + 121);
      sites.push({ x, z, y: y + .035,
        scale: .86 + tint * .17 + depth * .10, tint });
    }

    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, side: THREE.DoubleSide,
      roughness: .91, metalness: 0,
    });
    const wind = this.windTime;
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uScReedTime = wind;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>', '#include <common>\nuniform float uScReedTime;',
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>', [
          '#include <begin_vertex>',
          '#ifdef USE_INSTANCING',
          '  float reedPhase = instanceMatrix[3].x * .019 + instanceMatrix[3].z * .014;',
          '#else',
          '  float reedPhase = 0.0;',
          '#endif',
          'float bend = pow(clamp(position.y / 4.4, 0.0, 1.0), 2.0);',
          'transformed.x += sin(uScReedTime * .78 + reedPhase + position.y * .34) * bend * .20;',
          'transformed.z += cos(uScReedTime * .63 + reedPhase + position.y * .41) * bend * .13;',
        ].join('\n'),
      );
    };
    this.material.customProgramCacheKey = () => 'scaleborn-animated-shore-reeds-v1';
    this.mesh = new THREE.InstancedMesh(
      makeReedPatch(quality), this.material, sites.length,
    );
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    sites.forEach((site, i) => {
      dummy.position.set(site.x, site.y, site.z);
      dummy.rotation.set(0, site.tint * Math.PI * 2, 0);
      dummy.scale.setScalar(site.scale);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      color.setRGB(.83 + .17 * site.tint, .91 + .09 * site.tint,
        .77 + .23 * site.tint);
      this.mesh.setColorAt(i, color);
    });
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.mesh.instanceColor)
      this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.name = 'vegetation.azure.shoreline-reeds';
    this.mesh.receiveShadow = quality === 'high';
    scene.add(this.mesh);
    this.visibility.register(this.mesh, sites, quality === 'high' ? 255 : 175);
  }

  update(x: number, z: number, time: number): void {
    if (Number.isFinite(time)) this.windTime.value = time;
    this.visibility.update(x, z);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
