import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GRAND_LAKE, lakeContains } from '../src/world/highlandLake';
import { heightAt } from '../src/world/terrain';
import { LakeCaustics } from '../src/world/lakeCaustics';
import { LakeShoreFoam, makeFoamShader } from '../src/world/waterSurface';

describe('Mirrorfall shallow-water light and breaking shoreline', () => {
  it('projects dynamic caustics onto actual lakebed terrain without crossing the bank', () => {
    const low = new LakeCaustics('low');
    const high = new LakeCaustics('high');
    try {
      const geometry = low.mesh.geometry;
      const p = geometry.getAttribute('position');
      const depth = geometry.getAttribute('aWaterDepth');
      expect(p.count).toBeGreaterThan(1_000);
      expect(high.mesh.geometry.getAttribute('position').count).toBeGreaterThan(p.count);
      expect(geometry.index?.count).toBeGreaterThan(5_000);
      expect(depth.count).toBe(p.count);
      for (let i = 0; i < p.count; i += 67) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        expect(lakeContains(x, z)).toBe(true);
        expect(y).toBeCloseTo(heightAt(x, z) + .33, 4);
        expect(depth.getX(i)).toBeCloseTo(
          Math.max(0, GRAND_LAKE.surfaceY - heightAt(x, z)), 4);
      }
      expect(low.mesh.name).toContain('lakebed-caustics');
      expect(low.mesh.material.transparent).toBe(true);
      expect(low.mesh.material.depthWrite).toBe(false);
      expect(low.mesh.material.fragmentShader).toContain('absorption');
      low.update(17.25);
      expect(low.mesh.material.uniforms.uTime?.value).toBe(17.25);
    } finally {
      high.dispose();
      low.dispose();
    }
  });

  it('moves shoreline foam with the same four wave bands and waterfall impact', () => {
    const shore = new LakeShoreFoam();
    const oceanFoam = makeFoamShader();
    try {
      const shader = shore.mesh.material as THREE.ShaderMaterial;
      expect(shader.uniforms.uLakeStrip?.value).toBe(1);
      expect(shader.uniforms.uImpactWorld?.value).toBeInstanceOf(THREE.Vector2);
      expect(shader.vertexShader).toContain('uImpactWorld');
      expect(shader.vertexShader).toContain('uLakeStrip > 0.5');
      expect(shader.vertexShader).toContain('plungeD');
      const p = shore.mesh.geometry.getAttribute('position');
      expect(p.getY(0)).toBeCloseTo(GRAND_LAKE.surfaceY + .10, 5);
      expect(oceanFoam.uniforms.uLakeStrip?.value).toBe(0);
      shore.update(19.5);
      expect(shader.uniforms.uTime?.value).toBe(19.5);
    } finally {
      shore.dispose();
      oceanFoam.dispose();
    }
  });
});
