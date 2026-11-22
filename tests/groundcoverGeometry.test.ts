import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LocalGroundcover, makeGrassPatch } from '../src/world/localGroundcover';

type Shader = Parameters<THREE.MeshStandardMaterial['onBeforeCompile']>[0];

describe('rider-height meadow blade rendering', () => {
  it('builds curved, smoothly indexed blades with root-to-tip color variation', () => {
    const high = makeGrassPatch('high'), low = makeGrassPatch('low');
    try {
      const pos = high.getAttribute('position');
      const color = high.getAttribute('color');
      const normal = high.getAttribute('normal');
      expect(high.index).not.toBeNull();
      expect(high.index!.count).toBeGreaterThan(low.index!.count);
      expect(pos.count).toBe(color.count);
      expect(pos.count).toBe(normal.count);
      expect(color.getY(0)).toBeLessThan(color.getY(8));
      expect(pos.getY(0)).toBe(0);
      expect(pos.getY(8)).toBeGreaterThan(pos.getY(2));
      for (const attr of [pos, color, normal]) {
        for (let i = 0; i < attr.count; i++) {
          expect(Number.isFinite(attr.getX(i))).toBe(true);
          expect(Number.isFinite(attr.getY(i))).toBe(true);
          expect(Number.isFinite(attr.getZ(i))).toBe(true);
        }
      }
    } finally {
      high.dispose(); low.dispose();
    }
  });

  it('enables painted vertex color and fades grass near the observer budget edge', () => {
    const meadow = new LocalGroundcover(new THREE.Scene(), 'high');
    try {
      const material = meadow.mesh.material as THREE.MeshStandardMaterial;
      expect(material.vertexColors).toBe(true);
      const shader = {
        uniforms: {},
        vertexShader: '#include <common>\n#include <begin_vertex>',
        fragmentShader: '',
      } as Shader;
      material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
      expect(shader.uniforms.uScGrassDetailRadius?.value).toBe(94);
      expect(shader.vertexShader).toContain('uScGrassDetailRadius-17.0');
      expect(shader.vertexShader).toContain('transformed*=scDetailFade');
      expect(shader.vertexShader).toContain('uScGrassDetailTime');
      expect(material.customProgramCacheKey()).toContain('fade-v2');
    } finally {
      meadow.dispose();
    }
  });
});
