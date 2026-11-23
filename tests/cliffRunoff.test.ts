import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MirrorfallCliffs } from '../src/world/mirrorfallCliffs';
import { makeCliffRunoffMaterial } from '../src/world/cliffRunoff';
import { GRAND_LAKE } from '../src/world/highlandLake';

describe('waterfall cliff wet-rock film',()=>{
  it('runs animated dampness on the existing shared cliff face buffer',()=>{
    const cliffs=new MirrorfallCliffs('low');
    try{
      const wall=cliffs.group.getObjectByName('terrain.azure.mirrorfall-eroded-strata');
      const wet=cliffs.group.getObjectByName('terrain.azure.mirrorfall-wet-runnels');
      expect(wall).toBeInstanceOf(THREE.Mesh);
      expect(wet).toBeInstanceOf(THREE.Mesh);
      const film=wet as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
      expect(film.geometry).toBe((wall as THREE.Mesh).geometry);
      expect(film.material.depthWrite).toBe(false);
      expect(film.material.transparent).toBe(true);
      expect(film.material.fog).toBe(true);
      expect(film.material.uniforms.fogColor?.value).toBeInstanceOf(THREE.Color);
      expect(film.material.uniforms.uCascadeZ?.value).toBe(GRAND_LAKE.z);
      expect(film.material.fragmentShader).toContain('rivulet');
      cliffs.update(19.25);
      expect(film.material.uniforms.uTime?.value).toBe(19.25);
    }finally{cliffs.dispose();}
  });

  it('provides correctly initialized uniform block for Three.js fog',()=>{
    const mat=makeCliffRunoffMaterial();
    expect(mat.vertexShader).toContain('#include <fog_vertex>');
    expect(mat.fragmentShader).toContain('#include <fog_fragment>');
    expect(mat.uniforms.fogDensity?.value).toBeDefined();
    mat.dispose();
  });
});
