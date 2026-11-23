import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WaterfallMist, makeWaterfallMistTexture } from '../src/world/waterfallMist';
import { GRAND_LAKE } from '../src/world/highlandLake';
import { MIRRORFALL_IMPACT } from '../src/world/waterDynamics';
import { MirrorfallCascade } from '../src/world/mirrorfallCascade';

describe('batched Mirrorfall waterfall plume', () => {
  it('retains its irregular, alpha-feathered painted mist atlas', () => {
    const texture = makeWaterfallMistTexture();
    try {
      expect(texture.image.width).toBe(96);
      const bytes = texture.image.data as Uint8Array;
      const alpha = (x: number, y: number): number =>
        bytes[(y * 96 + x) * 4 + 3]!;
      expect(alpha(48, 48)).toBeGreaterThan(130);
      expect(alpha(0, 0)).toBe(0);
      expect(alpha(85, 48)).toBeLessThan(alpha(60, 48));
      expect(alpha(80, 48)).not.toBe(alpha(48, 80));
    } finally { texture.dispose(); }
  });

  it('draws all quality-budgeted wisps in a single fog-safe instanced mesh', () => {
    const low = new WaterfallMist('low');
    const high = new WaterfallMist('high');
    try {
      expect(low.count).toBe(16);
      expect(high.count).toBe(36);
      for (const mist of [low, high]) {
        expect(mist.group.children).toHaveLength(1);
        expect(mist.mesh).toBeInstanceOf(THREE.InstancedMesh);
        expect(mist.mesh.count).toBe(mist.count);
        expect(mist.mesh.frustumCulled).toBe(false);
        expect(mist.mesh.instanceMatrix.usage).toBe(THREE.DynamicDrawUsage);
        const geometry = mist.mesh.geometry;
        const opacity = geometry.getAttribute('instanceOpacity');
        expect(opacity).toBeInstanceOf(THREE.InstancedBufferAttribute);
        expect(opacity.count).toBe(mist.count);
        expect((opacity as THREE.InstancedBufferAttribute).usage)
          .toBe(THREE.DynamicDrawUsage);
        const material = mist.mesh.material as THREE.ShaderMaterial;
        expect(material.depthWrite).toBe(false);
        expect(material.fog).toBe(true);
        expect(material.uniforms.fogColor?.value).toBeInstanceOf(THREE.Color);
        expect(material.uniforms.fogDensity?.value).toBeDefined();
        expect(material.vertexShader).toContain('instanceMatrix');
        expect(material.vertexShader).toContain('#include <fog_vertex>');
        expect(material.fragmentShader).toContain('#include <fog_fragment>');
      }
    } finally { low.dispose(); high.dispose(); }
  });

  it('preserves deterministic, outward buoyant drift and staggered fading', () => {
    const first = new WaterfallMist('low');
    const second = new WaterfallMist('low');
    const positions = (): number[][] => Array.from({length:first.count},(_,i) => {
      const matrix = new THREE.Matrix4();
      first.mesh.getMatrixAt(i,matrix);
      return new THREE.Vector3().setFromMatrixPosition(matrix).toArray();
    });
    try {
      first.update(9.25);
      second.update(9.25);
      const snapshot = positions();
      const opacities = Array.from(
        first.mesh.geometry.getAttribute('instanceOpacity').array);
      expect(opacities.some(a => a > .03)).toBe(true);
      expect(opacities.some(a => a < .02)).toBe(true);
      for(let i=0;i<first.count;i++) {
        const matrix = new THREE.Matrix4();
        first.mesh.getMatrixAt(i,matrix);
        const at = new THREE.Vector3(), scale = new THREE.Vector3();
        const orientation = new THREE.Quaternion();
        matrix.decompose(at,orientation,scale);
        expect([at.x,at.y,at.z,scale.x,scale.y].every(Number.isFinite)).toBe(true);
        expect(at.x).toBeLessThan(MIRRORFALL_IMPACT.x+2);
        expect(at.y).toBeGreaterThan(GRAND_LAKE.surfaceY-2);
        expect(Math.hypot(at.x-MIRRORFALL_IMPACT.x,
          at.z-MIRRORFALL_IMPACT.z)).toBeLessThan(70);
        expect(scale.x).toBeGreaterThan(scale.y);
        const other = new THREE.Matrix4();
        second.mesh.getMatrixAt(i,other);
        expect(other.elements).toEqual(matrix.elements);
      }
      first.update(4);
      first.update(9.25);
      expect(positions()).toEqual(snapshot);
      expect(Array.from(first.mesh.geometry.getAttribute('instanceOpacity').array))
        .toEqual(opacities);
      first.update(Number.NaN);
      expect(positions()).toEqual(snapshot);
    } finally { first.dispose(); second.dispose(); }
  });

  it('faces the live camera without changing world-space cloud positions', () => {
    const mist = new WaterfallMist('low');
    try {
      mist.update(4.5);
      const before = new THREE.Matrix4();
      mist.mesh.getMatrixAt(0,before);
      const beforePos = new THREE.Vector3().setFromMatrixPosition(before);
      const camera = new THREE.PerspectiveCamera();
      camera.rotation.set(.24,-.57,.12);
      mist.update(4.5,camera);
      const after = new THREE.Matrix4();
      mist.mesh.getMatrixAt(0,after);
      const afterPos = new THREE.Vector3(), afterRot = new THREE.Quaternion();
      after.decompose(afterPos,afterRot,new THREE.Vector3());
      expect(afterPos.distanceTo(beforePos)).toBeLessThan(.0001);
      expect(afterRot.angleTo(camera.quaternion)).toBeLessThan(.0001);
      const updated = after.elements.slice();
      mist.update(4.5,camera);
      mist.mesh.getMatrixAt(0,after);
      expect(after.elements).toEqual(updated);
    } finally { mist.dispose(); }
  });

  it('wires the one-draw-call batch into the real cascade and disposes it', () => {
    const cascade = new MirrorfallCascade('low');
    const plume = cascade.group.getObjectByName(
      'water.azure.mirrorfall-buoyant-mist')!;
    const mesh = plume.getObjectByName(
      'water.azure.mirrorfall-mist-batch') as THREE.InstancedMesh;
    expect(plume.children).toHaveLength(1);
    expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(mesh.count).toBe(16);
    cascade.update(6,new THREE.PerspectiveCamera());
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(0,m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).y)
      .toBeGreaterThan(GRAND_LAKE.surfaceY);
    const material = mesh.material as THREE.Material;
    const geometry = mesh.geometry;
    cascade.dispose();
    expect(material).toBeDefined();
    expect(geometry).toBeDefined();
    expect(plume.parent).toBe(null);
  });
});
