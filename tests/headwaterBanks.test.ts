import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { HeadwaterBanks, sampleHeadwaterStones } from '../src/world/headwaterBanks';
import { heightAt } from '../src/world/terrain';
import { GRAND_LAKE, headwaterProfileAt, headwaterContains } from '../src/world/highlandLake';

describe('deterministic stony banks on Mirrorfall upper creek',()=>{
  it('roots small rock debris on dry creek shoulders, never in shallow water',()=>{
    const low=sampleHeadwaterStones('low');
    const high=sampleHeadwaterStones('high');
    expect(low.length).toBeGreaterThan(35);
    expect(high.length).toBeGreaterThan(low.length);
    expect(sampleHeadwaterStones('low')).toEqual(low);
    for(let i=0;i<low.length;i+=11){
      const p=low[i]!;
      const profile=headwaterProfileAt(p.x,p.z);
      expect(profile).not.toBeNull();
      expect(headwaterContains(p.x,p.z)).toBe(false);
      expect(Math.abs(profile!.relativeWidth)).toBeGreaterThan(.86);
      expect(p.y).toBeCloseTo(heightAt(p.x,p.z),5);
      expect(p.y).toBeGreaterThanOrEqual(profile!.surfaceY-.06);
      expect(Math.abs(p.z-GRAND_LAKE.z)).toBeLessThan(70);
    }
  });

  it('uses one instanced draw batch and restores source matrices after travel',()=>{
    const scene=new THREE.Scene(),banks=new HeadwaterBanks(scene,'low');
    try{
      const sites=sampleHeadwaterStones('low');
      const one=sites[0]!;
      expect(banks.mesh.count).toBe(0);
      expect(banks.mesh.instanceMatrix.count).toBe(sites.length);
      banks.update(one.x,one.z);
      expect(banks.mesh.count).toBeGreaterThan(5);
      const count=banks.mesh.count;
      const a=new THREE.Matrix4();
      banks.mesh.getMatrixAt(0,a);
      banks.update(1900,1800);
      expect(banks.mesh.count).toBe(0);
      banks.update(one.x,one.z);
      const b=new THREE.Matrix4();
      banks.mesh.getMatrixAt(0,b);
      expect(banks.mesh.count).toBe(count);
      expect(b.toArray()).toEqual(a.toArray());
      expect(banks.group.children).toHaveLength(1);
    }finally{banks.dispose();}
    expect(scene.children).toHaveLength(0);
  });
});
