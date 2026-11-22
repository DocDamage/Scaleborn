import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ShorelineSediment, makeShoreStone, sampleShoreSediment } from '../src/world/shorelineSediment';
import { GRAND_LAKE, lakeShoreDistance } from '../src/world/highlandLake';
import { heightAt } from '../src/world/terrain';

describe('physically grounded shoreline sediment',()=>{
  it('places deterministic, dry water-worn gravel rather than lake-floor floaters',()=>{
    const low=sampleShoreSediment('low'),high=sampleShoreSediment('high');
    expect(low.length).toBeGreaterThan(30);
    expect(high.length).toBeGreaterThan(low.length);
    expect(sampleShoreSediment('low')).toEqual(low);
    for(let i=0;i<low.length;i+=13){
      const p=low[i]!;
      expect(p.y).toBeCloseTo(heightAt(p.x,p.z),5);
      expect(p.y).toBeGreaterThan(GRAND_LAKE.surfaceY+.37);
      expect(p.y).toBeLessThan(GRAND_LAKE.surfaceY+15);
      expect(lakeShoreDistance(p.x,p.z)).toBeGreaterThan(.74);
      expect(lakeShoreDistance(p.x,p.z)).toBeLessThan(31.1);
    }
  });

  it('renders closed chipped stone and preserves a one-group visibility budget',()=>{
    const lowG=makeShoreStone('low'),highG=makeShoreStone('high');
    try{
      expect(lowG.index!.count).toBeGreaterThan(200);
      expect(highG.index!.count).toBeGreaterThan(lowG.index!.count);
      expect(lowG.getAttribute('normal').count).toBe(lowG.getAttribute('position').count);
      expect(lowG.getAttribute('color').count).toBe(lowG.getAttribute('position').count);
    }finally{lowG.dispose();highG.dispose();}
    const scene=new THREE.Scene(),sediment=new ShorelineSediment(scene,'low');
    try{
      expect(sediment.mesh.count).toBe(0);
      expect(sediment.group.children).toHaveLength(1);
      expect(sediment.mesh).toBeInstanceOf(THREE.InstancedMesh);
      const sample=sampleShoreSediment('low')[0]!;
      sediment.update(sample.x,sample.z);
      expect(sediment.mesh.count).toBeGreaterThan(1);
      sediment.update(1650,1650);
      expect(sediment.mesh.count).toBe(0);
    }finally{sediment.dispose();}
    expect(scene.children).toHaveLength(0);
  });
});
