import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GRAND_LAKE, lakeContains } from '../src/world/highlandLake';
import { heightAt } from '../src/world/terrain';
import { LakebedHabitat, aquaticTuft } from '../src/world/lakebedHabitat';

describe('Mirrorfall underwater rock and vegetation dressing',()=>{
  it('roots both instanced groups on the real lakebed without leaving the basin',()=>{
    const scene=new THREE.Scene(),habitat=new LakebedHabitat(scene,'low');
    try{
      expect(habitat.stones.count).toBeGreaterThan(250);
      expect(habitat.weeds.count).toBeGreaterThan(80);
      const m=new THREE.Matrix4(),p=new THREE.Vector3();
      for(const mesh of [habitat.stones,habitat.weeds]){
        for(let i=0;i<mesh.count;i+=31){
          mesh.getMatrixAt(i,m);p.setFromMatrixPosition(m);
          expect(lakeContains(p.x,p.z)).toBe(true);
          expect(p.y).toBeCloseTo(heightAt(p.x,p.z)+.09,3);
          expect(p.y).toBeLessThan(GRAND_LAKE.surfaceY-2);
        }
      }
      habitat.update(12,1900,1900);
      expect(habitat.group.visible).toBe(false);
      habitat.update(13,GRAND_LAKE.x,GRAND_LAKE.z);
      expect(habitat.group.visible).toBe(true);
    }finally{habitat.dispose();}
    expect(scene.children).toHaveLength(0);
  });
  it('scales the fixed two-draw-call ecosystem by graphics quality',()=>{
    const low=new LakebedHabitat(new THREE.Scene(),'low');
    const high=new LakebedHabitat(new THREE.Scene(),'high');
    try{
      expect(high.stones.count).toBeGreaterThan(low.stones.count);
      expect(high.weeds.count).toBeGreaterThan(low.weeds.count);
      expect(high.weeds.geometry.getAttribute('position').count)
        .toBeGreaterThan(low.weeds.geometry.getAttribute('position').count);
      expect(low.group.children).toHaveLength(2);
      const mat=low.weeds.material as THREE.MeshStandardMaterial;
      expect(mat.customProgramCacheKey()).toContain('freshwater-plants');
    }finally{low.dispose();high.dispose();}
    const extra=aquaticTuft('low');
    expect(extra.getAttribute('normal').count).toBe(extra.getAttribute('position').count);
    extra.dispose();
  });
});
