import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createWingRig } from '../src/actors/dragon/wingRig';
import { makeWingMembraneTextures } from '../src/actors/dragon/wingMembrane';

describe('painterly deformable dragon wing membrane', () => {
  it('rejects impractical allocations and nonintegral texture dimensions', () => {
    for (const size of [0, 32, 513, 64.5, Number.NaN, Infinity]) {
      expect(() => makeWingMembraneTextures(size)).toThrow();
    }
  });

  it('produces reproducible, non-flat pigment, relief normals and roughness', () => {
    const first = makeWingMembraneTextures(64);
    const second = makeWingMembraneTextures(64);
    try {
      for (const key of ['color', 'normal', 'roughness'] as const) {
        const a = first[key], b = second[key];
        expect(a).toBeInstanceOf(THREE.DataTexture);
        expect(a.image.width).toBe(64);
        expect(a.image.height).toBe(64);
        expect(a.generateMipmaps).toBe(true);
        expect(a.minFilter).toBe(THREE.LinearMipmapLinearFilter);
        expect(a.wrapS).toBe(THREE.ClampToEdgeWrapping);
        const pixels = a.image.data as Uint8Array;
        expect(pixels).toEqual(b.image.data);
        expect(new Set(Array.from(pixels.filter((_, i) => i % 4 === 0))).size)
          .toBeGreaterThan(12);
        for (let i = 3; i < pixels.length; i += 4) {
          expect(pixels[i]).toBe(255);
        }
      }
      expect(first.color.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(first.normal.colorSpace).toBe(THREE.NoColorSpace);
      expect(first.roughness.colorSpace).toBe(THREE.NoColorSpace);
      const normals = first.normal.image.data as Uint8Array;
      for (let i = 0; i < normals.length; i += 4) {
        expect(normals[i + 2]!).toBeGreaterThan(127);
      }
    } finally {
      for (const set of [first, second]) {
        set.color.dispose(); set.normal.dispose(); set.roughness.dispose();
      }
    }
  });

  it('binds wing material to skinning-compatible span/chord UVs on both wings', () => {
    for (const side of [-1, 1] as const) {
      const wing = createWingRig(side);
      const material = wing.mesh.material as THREE.MeshStandardMaterial;
      expect(wing.mesh.isSkinnedMesh).toBe(true);
      expect(material.vertexColors).toBe(true);
      expect(material.side).toBe(THREE.DoubleSide);
      expect(material.map).toBeInstanceOf(THREE.DataTexture);
      expect(material.normalMap).toBeInstanceOf(THREE.DataTexture);
      expect(material.roughnessMap).toBeInstanceOf(THREE.DataTexture);
      const uv = wing.mesh.geometry.getAttribute('uv');
      const skin = wing.mesh.geometry.getAttribute('skinWeight');
      expect(uv.count).toBe(skin.count);
      for (let i = 0; i < uv.count; i++) {
        expect(uv.getX(i)).toBeGreaterThanOrEqual(0);
        expect(uv.getX(i)).toBeLessThanOrEqual(1);
        expect(uv.getY(i)).toBeGreaterThanOrEqual(0);
        expect(uv.getY(i)).toBeLessThanOrEqual(1);
        expect(skin.getX(i) + skin.getY(i)).toBeCloseTo(1, 5);
      }
      wing.mesh.geometry.dispose();
    }
  });
});
