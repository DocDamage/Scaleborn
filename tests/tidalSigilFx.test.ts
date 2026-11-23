import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeTidalSigilRibbonGeometry, makeTidalSigilRibbonTexture } from '../src/combat/tidalSigilFx';
import { CombatVisual } from '../src/combat/visuals';
import { newCombatState } from '../src/combat/combat';

describe('painterly Tidal Sigil trail', () => {
  it('uses UV-mapped crossed water ribbons instead of opaque sphere beads', () => {
    const geometry = makeTidalSigilRibbonGeometry();
    try {
      expect(geometry.index?.count).toBe(18);
      expect(geometry.getAttribute('position').count).toBe(12);
      expect(geometry.getAttribute('uv').count).toBe(12);
      const normals = geometry.getAttribute('normal');
      for (let i = 0; i < normals.count; i++) {
        expect([normals.getX(i), normals.getY(i), normals.getZ(i)]
          .every(Number.isFinite)).toBe(true);
      }
    } finally { geometry.dispose(); }
  });

  it('feathers both ends and lateral edges of the painted atlas', () => {
    expect(() => makeTidalSigilRibbonTexture(0)).toThrow();
    const map = makeTidalSigilRibbonTexture();
    try {
      const data = map.image.data as Uint8Array;
      const a = (x: number, y: number): number => data[(y * 96 + x) * 4 + 3]!;
      expect(a(48, 48)).toBeGreaterThan(80);
      expect(a(0, 48)).toBe(0);
      expect(a(95, 48)).toBe(0);
      expect(a(48, 0)).toBeLessThan(a(48, 48) / 5);
      expect(a(48, 95)).toBeLessThan(a(48, 48) / 5);
      expect(map.colorSpace).toBe(THREE.SRGBColorSpace);
    } finally { map.dispose(); }
  });

  it('uses a single transparent, fog-aware pooled trail in the actual encounter', () => {
    const scene = new THREE.Scene();
    const visual = new CombatVisual(scene, newCombatState());
    try {
      const trail = scene.getObjectByName('fx.rider.tidal-sigil') as THREE.InstancedMesh;
      expect(trail.count).toBe(21);
      expect(trail.geometry.index?.count).toBe(18);
      const mat = trail.material as THREE.MeshBasicMaterial;
      expect(mat.map).toBeInstanceOf(THREE.DataTexture);
      expect(mat.blending).toBe(THREE.NormalBlending);
      expect(mat.transparent).toBe(true);
      expect(mat.depthWrite).toBe(false);
      expect(mat.fog).toBe(true);
    } finally { visual.dispose(); }
  });
});
