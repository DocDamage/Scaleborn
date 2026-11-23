import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createMirrorfallCliffGeometry } from '../src/world/cliffFaceSculpt';
import { MirrorfallCliffs } from '../src/world/mirrorfallCliffs';
import { GRAND_LAKE } from '../src/world/highlandLake';
import { waterfallCenterXAt } from '../src/world/waterfallTrajectory';

describe('sculpted Mirrorfall waterfall cliff wings', () => {
  for (const quality of ['low', 'high'] as const) {
    it(`keeps the ${quality} fall open with geological relief and safe clearance`, () => {
      const geo = createMirrorfallCliffGeometry(quality);
      try {
        const rows = geo.userData.rows as number;
        const columns = geo.userData.columns as number;
        const position = geo.getAttribute('position');
        const color = geo.getAttribute('color');
        const uv = geo.getAttribute('uv');
        const normal = geo.getAttribute('normal');
        const index = geo.index!;
        expect(position.count).toBe((rows + 1) * (columns + 1));
        expect(index.count).toBeGreaterThan(3000);
        expect(index.count).toBeLessThan(columns * rows * 6);
        expect(color.count).toBe(position.count);
        expect(uv.count).toBe(position.count);
        let maxRelief = -Infinity, minRelief = Infinity;
        const midRow = Math.floor(rows / 2);
        for (let i = 0; i < position.count; i++) {
          expect([
            position.getX(i), position.getY(i), position.getZ(i),
            color.getX(i), color.getY(i), color.getZ(i),
            uv.getX(i), uv.getY(i),
          ].every(Number.isFinite)).toBe(true);
          const row = Math.floor(i / (columns + 1));
          expect(position.getX(i) -
            waterfallCenterXAt(1 - row / rows)).toBeGreaterThan(6.70);
        }
        for (let i = 0; i < index.count; i++) {
          const vertex = index.getX(i);
          expect(vertex).toBeLessThan(position.count);
          const u = (position.getZ(vertex) - GRAND_LAKE.z) / 211;
          expect(Math.abs(u)).toBeGreaterThanOrEqual(.23 - .000001);
          expect([
            normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex),
          ].every(Number.isFinite)).toBe(true);
        }
        for (let col = 0; col <= columns; col++) {
          const u = col / columns * 2 - 1;
          if (Math.abs(u) < .43 || Math.abs(u) > .92) continue;
          const x = position.getX(midRow * (columns + 1) + col);
          maxRelief = Math.max(maxRelief, x);
          minRelief = Math.min(minRelief, x);
        }
        expect(maxRelief - minRelief).toBeGreaterThan(3.5);
      } finally { geo.dispose(); }
    });
  }

  it('is deterministic and reuses the original shared wet-rock geometry', () => {
    const a = createMirrorfallCliffGeometry('low');
    const b = createMirrorfallCliffGeometry('low');
    const cliffs = new MirrorfallCliffs('low');
    try {
      expect(a.getAttribute('position').array)
        .toEqual(b.getAttribute('position').array);
      expect(a.getAttribute('color').array)
        .toEqual(b.getAttribute('color').array);
      const wall = cliffs.group.getObjectByName('terrain.azure.mirrorfall-eroded-strata');
      const film = cliffs.group.getObjectByName('terrain.azure.mirrorfall-wet-runnels');
      expect(wall).toBeInstanceOf(THREE.Mesh);
      expect(film).toBeInstanceOf(THREE.Mesh);
      expect((wall as THREE.Mesh).geometry).toBe((film as THREE.Mesh).geometry);
      expect(cliffs.group.children).toHaveLength(2);
      cliffs.update(4.5);
      expect(((film as THREE.Mesh).material as THREE.ShaderMaterial)
        .uniforms.uTime!.value).toBe(4.5);
    } finally { a.dispose(); b.dispose(); cliffs.dispose(); }
  });
});
