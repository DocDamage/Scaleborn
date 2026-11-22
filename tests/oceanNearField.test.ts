import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PainterlyWaterSurface } from '../src/world/waterSurface';
import { GRAND_LAKE } from '../src/world/highlandLake';

describe('near-field wave tessellation and ocean patch masking', () => {
  it('resolves visible wind waves instead of using the 60m far sea grid near the player', () => {
    const high=new PainterlyWaterSurface('ocean','high');
    const low=new PainterlyWaterSurface('ocean','low');
    try {
      expect(high.nearMesh).toBeInstanceOf(THREE.Mesh);
      expect(low.nearMesh).toBeInstanceOf(THREE.Mesh);
      const hi=high.nearMesh!;
      const lo=low.nearMesh!;
      expect(hi.name).toBe('water.azure.ocean-nearfield');
      expect(hi.renderOrder).toBeGreaterThan(high.mesh.renderOrder);
      expect(hi.geometry.getAttribute('position').count).toBe(161*161);
      expect(lo.geometry.getAttribute('position').count).toBe(105*105);
      expect(hi.geometry.getAttribute('position').count)
        .toBeGreaterThan(low.mesh.geometry.getAttribute('position').count);
      const far=high.mesh.material as THREE.ShaderMaterial;
      const near=hi.material as THREE.ShaderMaterial;
      expect(far.fragmentShader).toContain('nearDist<uNearHole) discard');
      expect(near.fragmentShader).toContain('alpha*patchFade');
      expect(far.uniforms.uNearRole!.value).toBe(1);
      expect(near.uniforms.uNearRole!.value).toBe(2);
      expect(near.uniforms.uNearHole!.value).toBeLessThan(near.uniforms.uNearHalf!.value);
      expect(near.transparent).toBe(true);
      expect(near.depthWrite).toBe(false);
    } finally {high.dispose();low.dispose();}
  });

  it('follows world-snapped camera position while preserving world-space wave phase', () => {
    const ocean=new PainterlyWaterSurface('ocean','low');
    try {
      ocean.follow(154.4,-89);
      const mesh=ocean.nearMesh!;
      const near=mesh.material as THREE.ShaderMaterial;
      const far=ocean.mesh.material as THREE.ShaderMaterial;
      expect(mesh.position.x).toBe(160);
      expect(mesh.position.z).toBe(-96);
      expect(near.uniforms.uWaveOrigin!.value).toEqual(new THREE.Vector2(160,-96));
      expect(far.uniforms.uNearCenter!.value).toEqual(new THREE.Vector2(160,-96));
      ocean.follow(153.9,-90);
      expect(mesh.position.x).toBe(160);
      ocean.follow(-180,500);
      expect(mesh.position.x).toBe(-176);
      expect(mesh.position.z).toBe(496);
      expect(near.uniforms.uWaveOrigin!.value).toEqual(new THREE.Vector2(-176,496));
      ocean.update(7.25);
      expect(near.uniforms.uTime!.value).toBe(7.25);
      expect(far.uniforms.uTime!.value).toBe(7.25);
      ocean.follow(Infinity,NaN);
      expect(mesh.position.x).toBe(-176);
    } finally {ocean.dispose();}
  });

  it('increases freshwater wave resolution on High without changing its physical basin', () => {
    const high=new PainterlyWaterSurface('lake','high');
    const low=new PainterlyWaterSurface('lake','low');
    try {
      expect(high.nearMesh).toBeNull();
      expect(low.nearMesh).toBeNull();
      expect(high.mesh.position.y).toBe(GRAND_LAKE.surfaceY);
      expect(low.mesh.position.y).toBe(GRAND_LAKE.surfaceY);
      expect(high.mesh.geometry.getAttribute('position').count).toBe(321*265);
      expect(low.mesh.geometry.getAttribute('position').count).toBe(193*157);
      const mat=high.mesh.material as THREE.ShaderMaterial;
      expect(mat.uniforms.uNearRole!.value).toBe(0);
      expect(mat.uniforms.uLake!.value).toBe(1);
    } finally {high.dispose();low.dispose();}
  });
});
