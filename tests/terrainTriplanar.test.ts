import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeTerrainMaterial, makeRockMaterial } from '../src/world/materials';
import { installTerrainTriplanar } from '../src/world/terrainTriplanar';

type Shader = Parameters<THREE.MeshStandardMaterial['onBeforeCompile']>[0];

function compileSource(mat: THREE.MeshStandardMaterial): Shader {
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\n#include <worldpos_vertex>',
    fragmentShader: [
      '#include <common>', '#include <map_fragment>',
      '#include <color_fragment>', '#include <normal_fragment_maps>',
      '#include <roughnessmap_fragment>',
    ].join('\n'),
  } as Shader;
  mat.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

describe('terrain cliff triplanar PBR projection', () => {
  it.each(['high', 'low'] as const)(
    'projects all terrain maps in matching world metres on %s quality',
    (quality) => {
      const mat = makeTerrainMaterial(quality);
      try {
        const shader = compileSource(mat);
        expect(shader.vertexShader).toContain('vScTriPosition');
        expect(shader.vertexShader).toContain('modelMatrix * vec4(transformed');
        expect(shader.fragmentShader).toContain('scTriWeights');
        expect(shader.fragmentShader).toContain('texture2D(tex, q.zy)');
        expect(shader.fragmentShader).toContain('texture2D(tex, q.xz)');
        expect(shader.fragmentShader).toContain('texture2D(tex, q.xy)');
        expect(shader.fragmentShader).toContain('scTriSample(map)');
        expect(shader.fragmentShader).toContain('scTriSample(roughnessMap)');
        expect(shader.fragmentShader).toContain('float roughnessFactor = roughness;');
        expect(shader.fragmentShader).toContain('scWorldNormal');
        expect(shader.fragmentShader).toContain('scRockWeight()');
        expect(shader.fragmentShader).toContain('scTriSample(uScRockColor)');
        expect(shader.fragmentShader).toContain('scTriSample(uScRockRoughness)');
        expect(shader.fragmentShader).toContain('texture2D(uScRockNormal, scQ.zy)');
        expect(shader.fragmentShader).toContain('vec2 scNormalStrength = mix(normalScale');
        expect(shader.uniforms.uScRockColor?.value).toBeInstanceOf(THREE.DataTexture);
        expect(shader.uniforms.uScRockNormal?.value).toBeInstanceOf(THREE.DataTexture);
        expect(shader.uniforms.uScRockRoughness?.value).toBeInstanceOf(THREE.DataTexture);
        // With a flat normal map, perturbation is zero and the original
        // geometry normal must survive the triplanar blend.
        expect(shader.fragmentShader).toContain('normalize(scFace + scPerturb)');
        expect(shader.fragmentShader).not.toContain('#include <map_fragment>');
        expect(mat.customProgramCacheKey()).toContain('terrain-triplanar-v2');
        if (quality === 'high') {
          expect(shader.fragmentShader).toContain('scFbm');
          expect(shader.fragmentShader).toContain('roughnessFactor=mix');
        } else {
          expect(shader.fragmentShader).not.toContain('scFbm');
        }
        expect(mat.map).toBeInstanceOf(THREE.DataTexture);
        expect(mat.normalMap).toBeInstanceOf(THREE.DataTexture);
        expect(mat.roughnessMap).toBeInstanceOf(THREE.DataTexture);
      } finally { mat.dispose(); }
    },
  );

  it('supports a soil-only triplanar material without extra textures', () => {
    const mat = new THREE.MeshStandardMaterial();
    try {
      installTerrainTriplanar(mat, 8);
      const shader = compileSource(mat);
      expect(shader.fragmentShader).not.toContain('uniform sampler2D uScRockColor');
      expect(shader.fragmentShader).toContain('diffuseColor *= scTriSample(map)');
      expect(mat.customProgramCacheKey()).toContain('soil-only');
    } finally { mat.dispose(); }
  });

  it('preserves rock and bark materials while rejecting invalid tile scales', () => {
    const rock = makeRockMaterial('high');
    try {
      expect(rock.customProgramCacheKey()).not.toContain('terrain-triplanar');
      expect(() => installTerrainTriplanar(rock, 0)).toThrow();
      expect(() => installTerrainTriplanar(rock, Infinity)).toThrow();
    } finally { rock.dispose(); }
  });
});
