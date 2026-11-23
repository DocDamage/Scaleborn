import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeBarkMaterial, makeRockMaterial } from '../src/world/materials';

type Shader = Parameters<THREE.MeshStandardMaterial['onBeforeCompile']>[0];

function compile(mat: THREE.MeshStandardMaterial): Shader {
  const shader={
    uniforms:{},
    vertexShader:'#include <common>\n#include <worldpos_vertex>',
    fragmentShader:'#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>',
  } as Shader;
  mat.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
  return shader;
}

describe('instanced PBR detail respects actual world placement', () => {
  it.each(['rock','bark'] as const)(
    'high-quality %s samples per-instance world position and corrected normals',
    (kind) => {
      const mat=kind==='rock'?makeRockMaterial('high'):makeBarkMaterial('high');
      try {
        const shader=compile(mat);
        expect(shader.vertexShader).toContain(
          'scInstancePosition = instanceMatrix * scInstancePosition');
        expect(shader.vertexShader).toContain(
          'vScPosition = (modelMatrix * scInstancePosition).xyz');
        expect(shader.vertexShader).toContain(
          'scInstanceNormal /= max(scScaleSq, vec3(0.00001))');
        expect(shader.vertexShader).toContain(
          'scInstanceNormal = scInstanceMat * scInstanceNormal');
        expect(shader.vertexShader).toContain('#ifdef USE_INSTANCING');
        expect(shader.fragmentShader).toContain('scFbm(vScPosition');
        expect(shader.fragmentShader).toContain('scLakeMask(vScPosition.xz)');
        expect(mat.customProgramCacheKey()).toContain('v3');
      } finally {mat.dispose();}
    },
  );

  it('keeps low-budget materials unmodified by expensive FBM detail', () => {
    const mat=makeRockMaterial('low');
    try {
      const shader=compile(mat);
      expect(shader.vertexShader).not.toContain('scInstancePosition');
      expect(shader.fragmentShader).not.toContain('scFbm');
      expect(mat.map).toBeInstanceOf(THREE.DataTexture);
    } finally {mat.dispose();}
  });
});
