import * as THREE from 'three';
import { describe,expect,it } from 'vitest';
import { makeDragonScaleTextures,applyDragonScales } from '../src/actors/dragon/skinSurface';
import { DragonVisual } from '../src/actors/dragon/visual';

describe('painterly dragon-scale materials',()=>{
  it('creates repeatable normal and roughness microstructure',()=>{
    const a=makeDragonScaleTextures(64),b=makeDragonScaleTextures(64);
    try {
      expect(Array.from(a.color.image.data as Uint8Array))
        .toEqual(Array.from(b.color.image.data as Uint8Array));
      const p=a.normal.image.data as Uint8Array;
      expect(new Set(Array.from(p).filter((_,i)=>i%4===0)).size)
        .toBeGreaterThan(8);
      expect(a.normal.colorSpace).toBe(THREE.NoColorSpace);
    } finally {
      for(const t of Object.values(a))t.dispose();
      for(const t of Object.values(b))t.dispose();
    }
  });
  it('uses physically lit scale maps on actual dragon body surfaces',()=>{
    const dragon=new DragonVisual();
    const torso=dragon.root.getObjectByName('creature.dragon.body');
    expect(torso).toBeDefined();
    const materials:THREE.MeshStandardMaterial[]=[];
    torso!.traverse(o=>{
      if(o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial &&
        o.material.map)materials.push(o.material);
    });
    expect(materials.length).toBeGreaterThan(3);
    expect(materials.some(m=>m.normalMap instanceof THREE.DataTexture)).toBe(true);
  });
  it('rejects runaway texture sizes and can apply maps to PBR material',()=>{
    expect(()=>makeDragonScaleTextures(4)).toThrow();
    const textures=makeDragonScaleTextures(32);
    const m=applyDragonScales(new THREE.MeshStandardMaterial(),textures);
    try {
      expect(m.normalMap).toBe(textures.normal);
      expect(m.roughnessMap).toBe(textures.roughness);
    } finally {
      m.dispose();
      Object.values(textures).forEach(t=>t.dispose());
    }
  });
});
