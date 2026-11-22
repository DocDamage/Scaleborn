import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ShorelineReeds, makeReedPatch } from '../src/world/shorelineReeds';
import { GRAND_LAKE, lakeContains, waterSurfaceAt } from '../src/world/highlandLake';
import { heightAt } from '../src/world/terrain';

describe('freshwater shoreline reed habitat', () => {
  it('creates curved leaves, tapered stems and seed spikes with finite vertex data', () => {
    const high = makeReedPatch('high'), low = makeReedPatch('low');
    try {
      const positions = high.getAttribute('position');
      const colors = high.getAttribute('color');
      const normals = high.getAttribute('normal');
      expect(positions.count).toBeGreaterThan(low.getAttribute('position').count);
      expect(positions.count).toBe(colors.count);
      expect(positions.count).toBe(normals.count);
      for (const attr of [positions, colors, normals]) {
        for (let i = 0; i < attr.count; i++) {
          expect(Number.isFinite(attr.getX(i))).toBe(true);
          expect(Number.isFinite(attr.getY(i))).toBe(true);
          expect(Number.isFinite(attr.getZ(i))).toBe(true);
        }
      }
      for (let i = 0; i < positions.count; i++) {
        expect(positions.getY(i)).toBeGreaterThanOrEqual(0);
        expect(positions.getY(i)).toBeLessThan(4.2);
      }
    } finally {
      high.dispose(); low.dispose();
    }
  });

  it('roots visible reeds in shared freshwater collision bathymetry', () => {
    const scene = new THREE.Scene();
    const reeds = new ShorelineReeds(scene, 'low');
    const x = GRAND_LAKE.x - GRAND_LAKE.radiusX, z = GRAND_LAKE.z;
    try {
      reeds.update(x, z, 2.25);
      expect(reeds.mesh.count).toBeGreaterThan(10);
      expect(reeds.mesh.count).toBeLessThan(reeds.mesh.instanceMatrix.count);
      expect(reeds.windTime.value).toBe(2.25);
      expect(reeds.mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const matrix = new THREE.Matrix4(), root = new THREE.Vector3();
      for (let i = 0; i < reeds.mesh.count; i++) {
        reeds.mesh.getMatrixAt(i, matrix);
        root.setFromMatrixPosition(matrix);
        expect(lakeContains(root.x, root.z)).toBe(true);
        expect(root.y).toBeCloseTo(heightAt(root.x, root.z) + .035, 3);
        expect(waterSurfaceAt(root.x, root.z) - root.y).toBeLessThan(3);
      }
    } finally {
      reeds.dispose();
    }
    expect(scene.children.length).toBe(0);
  });

  it('reuses the same seeded plants and limits high/low draw populations', () => {
    const low = new ShorelineReeds(new THREE.Scene(), 'low');
    const high = new ShorelineReeds(new THREE.Scene(), 'high');
    const x = GRAND_LAKE.x - GRAND_LAKE.radiusX, z = GRAND_LAKE.z;
    const matrix = new THREE.Matrix4();
    try {
      expect(high.mesh.instanceMatrix.count).toBeGreaterThan(
        low.mesh.instanceMatrix.count);
      expect(high.mesh.geometry.getAttribute('position').count).toBeGreaterThan(
        low.mesh.geometry.getAttribute('position').count);
      expect((high.mesh.material as THREE.MeshStandardMaterial)
        .customProgramCacheKey()).toContain('shore-reeds');
      low.update(x, z, 1);
      const initial: number[][] = [];
      for (let i = 0; i < Math.min(20, low.mesh.count); i++) {
        low.mesh.getMatrixAt(i, matrix);
        initial.push(matrix.toArray());
      }
      low.update(x + 1000, z + 1000, 2);
      expect(low.mesh.count).toBe(0);
      low.update(x, z, 3);
      expect(low.mesh.count).toBeGreaterThan(10);
      initial.forEach((values, i) => {
        low.mesh.getMatrixAt(i, matrix);
        expect(matrix.toArray()).toEqual(values);
      });
    } finally {
      low.dispose(); high.dispose();
    }
  });
});
