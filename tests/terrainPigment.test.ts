import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeTerrainMaterial } from '../src/world/materials';
import { installTerrainPigment } from '../src/world/terrainPigment';

function compile(material:THREE.MeshStandardMaterial):string {
  const shader={
    uniforms:{} as Record<string,unknown>,
    vertexShader:'#include <common>\n#include <worldpos_vertex>',
    fragmentShader:[
      '#include <common>',
      '#include <color_fragment>',
      '#include <map_fragment>',
      '#include <normal_fragment_maps>',
      '#include <roughnessmap_fragment>',
    ].join('\n'),
  };
  material.onBeforeCompile(shader as never,{} as never);
  return shader.fragmentShader;
}

describe('world-space soil, mineral and wet-bank pigment',()=>{
  it('keeps both quality presets on the existing triplanar PBR material',()=>{
    for(const quality of ['low','high'] as const){
      const mat=makeTerrainMaterial(quality);
      try{
        const fragment=compile(mat);
        expect(fragment).toContain('scPigNoise');
        expect(fragment).toContain('scGrassPigment');
        expect(fragment).toContain('scStonePigment');
        expect(fragment).toContain('bankDistance');
        expect(fragment).toContain('scPigShoreDistance');
        expect(fragment).toContain('scPigCreekWet');
        expect(fragment).toContain('creekWet*.51');
        expect(fragment).toContain('scTriSample');
        expect(fragment).toContain('roughnessFactor');
        expect(mat.customProgramCacheKey()).toContain('terrain-pigment');
        expect(mat.normalMap).toBeInstanceOf(THREE.DataTexture);
      }finally{mat.dispose();}
    }
  });
  it('rejects material pipelines that omit triplanar world coordinates',()=>{
    const mat=new THREE.MeshStandardMaterial();
    try{
      installTerrainPigment(mat);
      expect(()=>compile(mat)).toThrow('requires installed world triplanar');
    }finally{mat.dispose();}
  });
});
