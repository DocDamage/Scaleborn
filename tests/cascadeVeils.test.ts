import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createCascadeVeilGeometry } from '../src/world/cascadeVeils';
import { MirrorfallCascade } from '../src/world/mirrorfallCascade';
import { GRAND_LAKE, MIRRORFALL, lakeContains } from '../src/world/highlandLake';
import { waterfallCenterXAt } from '../src/world/waterfallTrajectory';

function limits(
  geometry: THREE.BufferGeometry, channel: number, row: number,
): { minZ: number; maxZ: number; centerX: number; centerY: number } {
  const { rowsPerChannel, slicesPerChannel } = geometry.userData as {
    rowsPerChannel: number; slicesPerChannel: number;
  };
  const p = geometry.getAttribute('position');
  const stride = slicesPerChannel + 1;
  const start = (channel * (rowsPerChannel + 1) + row) * stride;
  const zs = Array.from({ length: stride }, (_, i) => p.getZ(start + i));
  return {
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
    centerX: p.getX(start + Math.floor(stride / 2)),
    centerY: p.getY(start + Math.floor(stride / 2)),
  };
}

describe('braided Mirrorfall cascade geometry', () => {
  it('keeps all narrow channels in a single indexed mesh per curtain and quality', () => {
    const low = createCascadeVeilGeometry(78, 0, 0, 'low');
    const high = createCascadeVeilGeometry(78, 0, 0, 'high');
    try {
      expect(low.userData.channelCount).toBe(6);
      expect(high.userData.channelCount).toBe(10);
      expect(low.index!.count).toBe(6 * 64 * 4 * 6);
      expect(high.index!.count).toBe(10 * 96 * 6 * 6);
      for (const geo of [low, high]) {
        const p = geo.getAttribute('position');
        const uv = geo.getAttribute('uv');
        expect(p.count).toBe(uv.count);
        expect(geo.getAttribute('normal').count).toBe(p.count);
        for (let i = 0; i < p.count; i++) {
          expect([p.getX(i), p.getY(i), p.getZ(i),
            uv.getX(i), uv.getY(i)].every(Number.isFinite)).toBe(true);
          expect(p.getY(i)).toBeGreaterThan(GRAND_LAKE.surfaceY - .001);
          expect(p.getY(i)).toBeLessThan(MIRRORFALL.topY + .35);
        }
        for (let i = 0; i < geo.index!.count; i++)
          expect(geo.index!.getX(i)).toBeLessThan(p.count);
      }
    } finally { low.dispose(); high.dispose(); }
  });

  it('opens actual visible gaps downstream without detaching from the shared fall', () => {
    const geo = createCascadeVeilGeometry(78, 0, 0, 'high');
    try {
      const count = geo.userData.channelCount as number;
      const rows = geo.userData.rowsPerChannel as number;
      let openGaps = 0;
      let crownGap = 0;
      let lowerGap = 0;
      for (let i = 0; i < count; i++) {
        const lip = limits(geo, i, 0);
        const pool = limits(geo, i, rows);
        const middle = limits(geo, i, Math.floor(rows / 2));
        expect(Math.abs(middle.centerX - waterfallCenterXAt(.5))).toBeLessThan(3);
        expect(Math.abs(pool.centerX - waterfallCenterXAt(1))).toBeLessThan(3);
        expect(pool.centerY).toBeCloseTo(GRAND_LAKE.surfaceY, 4);
        expect(lakeContains(pool.centerX, (pool.minZ + pool.maxZ) / 2)).toBe(true);
        expect(Math.abs(lip.centerY - MIRRORFALL.topY)).toBeLessThan(.35);
        if (i < count - 1) {
          const nextLip = limits(geo, i + 1, 0);
          const nextPool = limits(geo, i + 1, rows);
          crownGap += Math.max(0, nextLip.minZ - lip.maxZ);
          const gap = nextPool.minZ - pool.maxZ;
          lowerGap += Math.max(0, gap);
          if (gap > 1) openGaps++;
        }
      }
      expect(openGaps).toBeGreaterThanOrEqual(5);
      expect(lowerGap).toBeGreaterThan(crownGap * 2);
    } finally { geo.dispose(); }
  });

  it('is seed-stable, preserves shared fog and does not add material draw calls', () => {
    const first = createCascadeVeilGeometry(42, -21, 2.3, 'low');
    const second = createCascadeVeilGeometry(42, -21, 2.3, 'low');
    const fall = new MirrorfallCascade('low');
    try {
      expect(first.getAttribute('position').array)
        .toEqual(second.getAttribute('position').array);
      const curtains = fall.group.children.filter(o =>
        o.name === 'water.azure.mirrorfall-curtain') as THREE.Mesh[];
      expect(curtains).toHaveLength(3);
      expect(curtains[0]!.geometry.userData.channelCount).toBe(6);
      expect(curtains.every(c => c.material === curtains[0]!.material)).toBe(true);
      const ropes = fall.group.getObjectByName('water.azure.mirrorfall-filament-ropes')
        as THREE.Mesh;
      expect(ropes.material).toBe(curtains[0]!.material);
      const shader = curtains[0]!.material as THREE.ShaderMaterial;
      expect(shader.uniforms.fogDensity?.value).toBeDefined();
      expect(shader.fragmentShader).toContain('streakX');
      fall.update(7.5);
      expect(shader.uniforms.uTime!.value).toBe(7.5);
    } finally { first.dispose(); second.dispose(); fall.dispose(); }
  });

  it('rejects invalid curtain dimensions', () => {
    expect(() => createCascadeVeilGeometry(0, 0, 0)).toThrow(RangeError);
    expect(() => createCascadeVeilGeometry(78, Infinity, 0)).toThrow(RangeError);
    expect(() => createCascadeVeilGeometry(78, 0, NaN)).toThrow(RangeError);
  });
});
