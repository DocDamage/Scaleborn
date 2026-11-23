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
        const frontCount = geo.userData.frontVertexCount as number;
        const depthSteps = geo.userData.cleftDepthSteps as number;
        expect(frontCount).toBe((rows + 1) * (columns + 1));
        expect(depthSteps).toBe(quality === 'high' ? 8 : 5);
        expect(position.count).toBe(frontCount +
          2 * (rows + 1) * (depthSteps + 1));
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
          const sideRow = Math.floor(((i - frontCount) %
            ((rows + 1) * (depthSteps + 1))) / (depthSteps + 1));
          const row = i < frontCount
            ? Math.floor(i / (columns + 1)) : sideRow;
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
        // The exact original border meets the new return wall, with
        // deep geometry pointing away from the falling-water corridor.
        const oneSideCount = (rows + 1) * (depthSteps + 1);
        for (const [sideIndex, side] of [-1, 1].entries()) {
          const border = side < 0
            ? Math.floor(columns * (1 - .23) * .5)
            : Math.ceil(columns * (1 + .23) * .5);
          const start = frontCount + sideIndex * oneSideCount;
          for (const row of [0, Math.floor(rows / 2), rows]) {
            const front = row * (columns + 1) + border;
            const seam = start + row * (depthSteps + 1);
            const back = seam + depthSteps;
            expect(position.getX(seam)).toBeCloseTo(position.getX(front), 5);
            expect(position.getY(seam)).toBeCloseTo(position.getY(front), 5);
            expect(position.getZ(seam)).toBeCloseTo(position.getZ(front), 5);
            expect(position.getX(back) - position.getX(seam))
              .toBeGreaterThan(13);
            expect(side * (position.getZ(back) - position.getZ(seam)))
              .toBeGreaterThan(2);
            expect(color.getX(back)).toBeLessThan(color.getX(seam));
          }
        }
      } finally { geo.dispose(); }
    });
  }

  it.each(['low', 'high'] as const)('reuses deterministic wet-rock geometry and the %s shader', quality => {
    const a = createMirrorfallCliffGeometry(quality);
    const b = createMirrorfallCliffGeometry(quality);
    const cliffs = new MirrorfallCliffs(quality);
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
      const wallMaterial = (wall as THREE.Mesh).material as THREE.MeshStandardMaterial;
      expect(wallMaterial.customProgramCacheKey())
        .toContain('terrain-triplanar-v2-0.133333333');
      const shader = {
        uniforms: {},
        vertexShader: '#include <common>\n#include <worldpos_vertex>',
        fragmentShader: [
          '#include <common>', '#include <map_fragment>',
          '#include <color_fragment>', '#include <roughnessmap_fragment>',
          '#include <normal_fragment_maps>',
        ].join('\n'),
      } as Parameters<THREE.MeshStandardMaterial['onBeforeCompile']>[0];
      wallMaterial.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
      expect(shader.fragmentShader).toContain('scTriSample(map)');
      expect(shader.fragmentShader).toContain('scTriSample(roughnessMap)');
      expect(shader.fragmentShader).toContain('scWorldNormal');
      expect(shader.fragmentShader.includes('scFbm(vScPosition')).toBe(quality === 'high');
      cliffs.update(4.5);
      expect(((film as THREE.Mesh).material as THREE.ShaderMaterial)
        .uniforms.uTime!.value).toBe(4.5);
    } finally { a.dispose(); b.dispose(); cliffs.dispose(); }
  });
});
