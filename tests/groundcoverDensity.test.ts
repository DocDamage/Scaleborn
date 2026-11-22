import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LocalGroundcover, makeGrassPatch } from '../src/world/localGroundcover';
import { GRAND_LAKE, lakeContains } from '../src/world/highlandLake';

describe('screenshot-driven grass-carpet quality and safe instance budgets',()=>{
  it('fills larger rider-height meadow areas without creating per-plant objects',()=>{
    const low=new LocalGroundcover(new THREE.Scene(),'low');
    const high=new LocalGroundcover(new THREE.Scene(),'high');
    try{
      expect(low.mesh.instanceMatrix.count).toBeGreaterThan(3200);
      expect(high.mesh.instanceMatrix.count).toBeGreaterThan(7900);
      expect(low.mesh.instanceMatrix.count).toBeLessThan(3900);
      expect(high.mesh.instanceMatrix.count).toBeLessThan(10000);
      low.update(GRAND_LAKE.x+258,GRAND_LAKE.z+320,1);
      expect(low.mesh.count).toBeGreaterThan(170);
      expect(low.mesh.count).toBeLessThan(low.mesh.instanceMatrix.count);
      expect(low.mesh.name).toBe('vegetation.azure.local-groundcover');
      expect(low.mesh.frustumCulled).toBe(false);
      low.update(GRAND_LAKE.x,GRAND_LAKE.z,2);
      expect(lakeContains(GRAND_LAKE.x,GRAND_LAKE.z)).toBe(true);
      expect(low.mesh.count).toBe(0); // no floating mid-lake grass
    }finally{low.dispose();high.dispose();}
  });

  it('gives shaped blade vertices brighter but muted painted root and tip colours',()=>{
    const low=makeGrassPatch('low'),high=makeGrassPatch('high');
    try{
      const colors=low.getAttribute('color');
      expect(colors.count).toBe(low.getAttribute('position').count);
      expect(colors.getX(0)).toBeGreaterThan(.65);
      expect(colors.getY(0)).toBeGreaterThan(.70);
      const tipRow=(2+1)*2-1;
      expect(colors.getY(tipRow)).toBeGreaterThan(colors.getY(0));
      expect(high.getAttribute('position').count)
        .toBeGreaterThan(low.getAttribute('position').count);
    }finally{low.dispose();high.dispose();}
  });
});
