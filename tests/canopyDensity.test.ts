import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createTreePrototype, makeLeafAtlas } from '../src/world/treeCanopy';

describe('ground-view readable leaf clusters and tree quality budget',()=>{
  it('fills different species with separate angled leaf cards without primitive blobs',()=>{
    for(const species of [0,1,2,3] as const){
      const low=createTreePrototype(species,'low',0x537b20+species*237);
      const high=createTreePrototype(species,'high',0x537b20+species*237);
      try {
        expect(low.leafCards).toBeGreaterThan(500);
        expect(high.leafCards).toBeGreaterThan(low.leafCards*1.35);
        expect(high.leafCards).toBeLessThan(5000);
        const p=low.foliage.getAttribute('position');
        const normals=low.foliage.getAttribute('normal');
        expect(p.count).toBe(low.leafCards*6);
        expect(normals.count).toBe(p.count);
        let elevated=0,lateralNormals=0;
        for(let i=0;i<p.count;i+=53) {
          if(p.getY(i)>6)elevated++;
          const n=Math.abs(normals.getY(i));
          if(n<.76)lateralNormals++;
          expect(Number.isFinite(normals.getX(i))).toBe(true);
        }
        expect(elevated).toBeGreaterThan(5);
        // Cards actually face sideways too; not a horizontal-only canopy
        // that disappears when viewed along the terrain.
        expect(lateralNormals).toBeGreaterThan(5);
      }finally{
        low.wood.dispose();low.foliage.dispose();
        high.wood.dispose();high.foliage.dispose();
      }
    }
  });

  it('widens feathered conifer needle sprays without filling transparent atlas corners',()=>{
    const atlas=makeLeafAtlas(128);
    try {
      const bytes=atlas.image.data as Uint8Array;
      const alpha=(x:number,y:number):number=>bytes[(y*128+x)*4+3]??0;
      expect(alpha(32,96)).toBeGreaterThan(100);
      expect(alpha(10,96)).toBe(0);
      expect(alpha(1,65)).toBe(0);
      expect(atlas.colorSpace).toBe(THREE.SRGBColorSpace);
    }finally{atlas.dispose();}
  });
});
