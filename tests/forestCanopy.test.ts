import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createTreePrototype, makeLeafAtlas, TREE_SPECIES } from '../src/world/treeCanopy';
import { makeFernTuft } from '../src/world/fernUnderstory';
import { PainterlyNature } from '../src/world/painterlyNature';

describe('non-repeating forest geometry and real understory', () => {
  it('generates four distinct woody silhouettes with real multi-angle leaf cards', () => {
    const prototypes=TREE_SPECIES.map((_,i)=>createTreePrototype(
      i as 0|1|2|3,'low',0x5ca1e0+i*439));
    try {
      expect(prototypes.map(p=>p.height)).toEqual([12.2,16.7,18.6,13.3]);
      expect(new Set(prototypes.map(p=>p.foliage.getAttribute('position').count)).size)
        .toBeGreaterThan(2);
      for(const p of prototypes){
        expect(p.wood.getAttribute('position').count).toBeGreaterThan(150);
        expect(p.foliage.getAttribute('uv').count)
          .toBe(p.foliage.getAttribute('position').count);
        expect(p.leafCards).toBeGreaterThan(170);
        expect(p.wood.getAttribute('normal').count).toBeGreaterThan(150);
        expect(p.foliage.getAttribute('normal').count).toBeGreaterThan(1000);
      }
      expect(prototypes[2]!.height).toBeGreaterThan(prototypes[0]!.height);
      expect(prototypes[2]!.crownRadius).toBeLessThan(prototypes[0]!.crownRadius);
    }finally {
      prototypes.forEach(p=>{p.wood.dispose();p.foliage.dispose();});
    }
  });
  it('uses a deterministic alpha atlas with genuinely different foliage shapes',()=>{
    const atlas=makeLeafAtlas(128);
    const another=makeLeafAtlas(128);
    try{
      const pixels=atlas.image.data as Uint8Array;
      const next=another.image.data as Uint8Array;
      expect(pixels).toEqual(next);
      const alpha=(x:number,y:number)=>pixels[(y*128+x)*4+3];
      expect(alpha(32,32)).toBeGreaterThan(100);
      expect(alpha(96,32)).toBeGreaterThan(100);
      expect(alpha(96,96)).toBeGreaterThan(100);
      expect(alpha(10,96)).toBe(0); // outside pine needle silhouette
      expect(atlas.colorSpace).toBe(THREE.SRGBColorSpace);
    }finally {atlas.dispose();another.dispose();}
    expect(()=>makeLeafAtlas(65)).toThrow();
  });
  it('batches fern leaflets into one instanced mesh and supports disposal',()=>{
    const geom=makeFernTuft('low'),hi=makeFernTuft('high');
    try{
      expect(geom.getAttribute('position').count).toBeGreaterThan(500);
      expect(hi.getAttribute('position').count).toBeGreaterThan(
        geom.getAttribute('position').count);
      expect(geom.getAttribute('normal').count).toBe(geom.getAttribute('position').count);
    }finally{geom.dispose();hi.dispose();}
    const scene=new THREE.Scene();
    const nature=new PainterlyNature(scene,'low');
    try{
      const fern=scene.getObjectByName('vegetation.azure.forest-ferns');
      expect(fern).toBeInstanceOf(THREE.InstancedMesh);
      expect((fern as THREE.InstancedMesh).count).toBeGreaterThan(100);
      expect(scene.children.length).toBeLessThan(5);
    }finally{nature.dispose();}
  });
});
