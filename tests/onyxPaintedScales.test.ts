import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DragonVisual } from '../src/actors/dragon/visual';
import { ONYX_PAINTED_SAMPLE_SIZE, paintedScalePixels,
  makeOnyxPaintedScaleMap } from '../src/actors/dragon/onyxPaintedScales';

describe('original AI-assisted Onyx scale paint is bound to real gameplay',()=>{
  it('unpacks reproducible original sampled pigments',()=>{
    const pixels=paintedScalePixels();
    expect(pixels.length).toBe(ONYX_PAINTED_SAMPLE_SIZE**2*4);
    expect(paintedScalePixels()).toEqual(pixels);
    expect(new Set(Array.from(pixels.filter((_,i)=>i%4===0))).size).toBeGreaterThan(6);
    expect(new Set(Array.from(pixels.filter((_,i)=>i%4===2))).size).toBeGreaterThan(6);
    for(let i=3;i<pixels.length;i+=4)expect(pixels[i]).toBe(255);
  });
  it('applies source painting to continuous torso and skull without losing relief',()=>{
    const dragon=new DragonVisual();
    try{
      const torso=dragon.root.getObjectByName('creature.dragon.onyx.anatomical-torso') as THREE.Mesh;
      const skull=dragon.root.getObjectByName('creature.dragon.onyx.sculpted-skull') as THREE.Mesh;
      expect(torso.material).toBe(skull.material);
      const skin=torso.material as THREE.MeshStandardMaterial;
      expect(skin.map).toBeInstanceOf(THREE.DataTexture);
      expect(skin.map!.name).toContain('original painterly');
      expect(skin.normalMap).toBeInstanceOf(THREE.DataTexture);
      expect(skin.roughnessMap).toBeInstanceOf(THREE.DataTexture);
      expect(skin.vertexColors).toBe(true);
    }finally{dragon.dispose();}
  });
  it('uses repeat wrapped, mipmapped image-derived albedo with no runtime fetch',()=>{
    const texture=makeOnyxPaintedScaleMap();
    try{
      expect(texture.image.width).toBe(64);
      expect(texture.image.height).toBe(64);
      expect(texture.wrapS).toBe(THREE.RepeatWrapping);
      expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
      expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    }finally{texture.dispose();}
  });
});
