import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeCoralBranches, makeKelpFronds } from '../src/world/marineBotany';
import { MarineDressing } from '../src/world/marineDressing';
import { heightAt } from '../src/world/terrain';
import { lakeContains } from '../src/world/highlandLake';

describe('original high-fidelity ocean vegetation', () => {
  it('builds indexed, colored tapered kelp leaves and branched coral instead of primitives', () => {
    for (const factory of [makeKelpFronds, makeCoralBranches]) {
      const high = factory('high'), low = factory('low');
      try {
        expect(high.index!.count).toBeGreaterThan(low.index!.count);
        expect(high.index!.count).toBeGreaterThan(100);
        for (const geometry of [high, low]) {
          const p = geometry.getAttribute('position');
          expect(p.count).toBeGreaterThan(50);
          expect(geometry.getAttribute('normal').count).toBe(p.count);
          expect(geometry.getAttribute('color').count).toBe(p.count);
          for (let i = 0; i < p.count; i++) {
            expect([p.getX(i), p.getY(i), p.getZ(i)]
              .every(Number.isFinite)).toBe(true);
            expect(p.getY(i)).toBeGreaterThanOrEqual(0);
            expect(p.getY(i)).toBeLessThan(1.1);
          }
        }
      } finally { high.dispose(); low.dispose(); }
    }
  });

  it('seeds ocean plants on collision terrain, excludes freshwater and batches by species', () => {
    const scene = new THREE.Scene();
    const marine = new MarineDressing(scene, 'high');
    try {
      expect(scene.children).toContain(marine.group);
      expect(marine.group.children).toHaveLength(3);
      expect(marine.kelp).toBeInstanceOf(THREE.InstancedMesh);
      expect(marine.coral).toBeInstanceOf(THREE.InstancedMesh);
      expect(marine.kelp.count).toBeGreaterThan(25);
      expect(marine.coral.count).toBeGreaterThan(10);
      const matrix = new THREE.Matrix4(), point = new THREE.Vector3();
      for (const mesh of [marine.kelp, marine.coral]) {
        expect(mesh.instanceColor).not.toBeNull();
        expect(mesh.frustumCulled).toBe(false);
        for (let i = 0; i < mesh.count; i += 13) {
          mesh.getMatrixAt(i, matrix);
          point.setFromMatrixPosition(matrix);
          expect(lakeContains(point.x, point.z)).toBe(false);
          expect(point.y).toBeCloseTo(heightAt(point.x, point.z), 1);
          expect(point.y).toBeLessThan(-4.8);
        }
      }
      const shade = marine.kelp.material as THREE.MeshStandardMaterial;
      expect(shade.customProgramCacheKey()).toContain('ocean-kelp-current');
      expect(shade.vertexColors).toBe(true);
    } finally { marine.dispose(); }
    expect(scene.children).toHaveLength(0);
  });

  it('streams nearby sea vegetation and reproduces original transforms on return', () => {
    const scene = new THREE.Scene(), marine = new MarineDressing(scene, 'low');
    try {
      const full = marine.kelp.count;
      const mat = new THREE.Matrix4(), p = new THREE.Vector3();
      marine.kelp.getMatrixAt(0, mat);
      p.setFromMatrixPosition(mat);
      marine.update(1, p.x, p.z);
      expect(marine.kelp.count).toBeGreaterThan(0);
      expect(marine.kelp.count).toBeLessThan(full);
      marine.kelp.getMatrixAt(0, mat);
      const recorded = mat.toArray();
      marine.update(2, 3500, 3500);
      expect(marine.kelp.count).toBe(0);
      marine.update(3, p.x, p.z);
      marine.kelp.getMatrixAt(0, mat);
      expect(mat.toArray()).toEqual(recorded);
      marine.update(Number.NaN, p.x, p.z);
      expect(marine.kelp.count).toBeGreaterThan(0);
    } finally { marine.dispose(); }
  });
});
