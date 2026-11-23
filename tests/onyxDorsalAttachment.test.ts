import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DragonVisual } from '../src/actors/dragon/visual';
import { ONYX_TORSO, loftDragon, onyxDorsalY } from '../src/actors/dragon/organicSculpt';

describe('Onyx anatomical dorsal spines conform to the tapering continuous torso',()=>{
  it('samples the dorsal sculpt curve rather than using one fixed height',()=>{
    const sculpt=loftDragon(ONYX_TORSO,124,40,'torso');
    try{
      const positions=sculpt.getAttribute('position');
      for(const z of [-1.24,-.87,-.50,-.13,.24,.61,.98,1.35,1.72]){
        let index=-1,distance=Infinity;
        for(let i=0;i<=124;i++){
          const j=i*41+10; // top meridian (sin(angle) == 1)
          const d=Math.abs(positions.getZ(j)-z);
          if(d<distance){distance=d;index=j;}
        }
        expect(distance).toBeLessThan(.045);
        expect(onyxDorsalY(z)).toBeCloseTo(positions.getY(index),1);
      }
      expect(onyxDorsalY(-.13)).toBeGreaterThan(onyxDorsalY(1.72)+.2);
      for(const invalid of [NaN,Infinity,-3,10]){
        expect(()=>onyxDorsalY(invalid)).toThrow();
      }
    }finally{sculpt.dispose();}
  });
  it('attaches original nine sculpted fins into the actual back, reducing rider clipping',()=>{
    const visual=new DragonVisual();
    try{
      for(let i=0;i<9;i++){
        const z=-1.13+i*.37,rootZ=z-.11;
        const fin=visual.root.getObjectByName('creature.dragon.dorsal-ridge.'+i) as THREE.Mesh;
        expect(fin).toBeInstanceOf(THREE.Mesh);
        expect(fin.geometry.type).toBe('BufferGeometry');
        const points=fin.geometry.getAttribute('position');
        expect(points.getY(0)).toBeCloseTo(onyxDorsalY(rootZ)-.045,5);
        fin.geometry.computeBoundingBox();
        const bounds=fin.geometry.boundingBox!;
        expect(bounds.max.y).toBeGreaterThan(bounds.min.y+.02);
        expect(bounds.min.y).toBeLessThan(onyxDorsalY(rootZ));
        expect(bounds.max.y).toBeLessThan(onyxDorsalY(rootZ)+.3);
      }
      const saddlePlate=visual.root.getObjectByName('creature.dragon.dorsal-ridge.2') as THREE.Mesh;
      const rearPlate=visual.root.getObjectByName('creature.dragon.dorsal-ridge.8') as THREE.Mesh;
      saddlePlate.geometry.computeBoundingBox();
      rearPlate.geometry.computeBoundingBox();
      expect(saddlePlate.geometry.boundingBox!.min.y)
        .toBeGreaterThan(rearPlate.geometry.boundingBox!.min.y+.1);
    }finally{visual.dispose();}
  });
});
