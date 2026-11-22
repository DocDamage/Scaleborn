import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { fracturedLedgeGeometry, CliffOutcrops, sampleCliffOutcrops } from '../src/world/cliffOutcrops';
import { GRAND_LAKE, MIRRORFALL } from '../src/world/highlandLake';
import { heightAt } from '../src/world/terrain';

describe('Mirrorfall rock shelf visual detail',()=>{
  it('makes closed tiered fractured stone rather than white oval props',()=>{
    const low=fracturedLedgeGeometry('low');
    const high=fracturedLedgeGeometry('high');
    try{
      const p=low.getAttribute('position');
      expect(p.count).toBeGreaterThan(70);
      expect(low.index?.count).toBeGreaterThan(300);
      expect(high.index!.count).toBeGreaterThan(low.index!.count);
      expect(low.getAttribute('normal').count).toBe(p.count);
      expect(low.getAttribute('color').count).toBe(p.count);
      expect(low.getAttribute('uv').count).toBe(p.count);
      const arr=(p.array as Float32Array);
      expect([...arr].every(Number.isFinite)).toBe(true);
      const n=low.getAttribute('normal');
      expect(n.getY(p.count-1)).toBeGreaterThan(.4);
      expect(n.getY(p.count-2)).toBeLessThan(-.4);
    }finally{low.dispose();high.dispose();}
  });

  it('places seeded outcrops on steep actual terrain, away from the waterfall cleft',()=>{
    const low=sampleCliffOutcrops('low');
    const high=sampleCliffOutcrops('high');
    expect(low.length).toBeGreaterThan(25);
    expect(high.length).toBeGreaterThan(low.length);
    expect(sampleCliffOutcrops('low')).toEqual(low);
    for(let i=0;i<low.length;i+=11){
      const s=low[i]!;
      expect(s.y).toBeCloseTo(heightAt(s.x,s.z),5);
      expect(s.y).toBeGreaterThan(GRAND_LAKE.surfaceY+7);
      expect(s.size).toBeGreaterThan(1);
      const overlapsCleft=Math.abs(s.z-MIRRORFALL.z)<MIRRORFALL.width*.58+9
        && s.x>MIRRORFALL.x-118 && s.x<MIRRORFALL.x+58;
      expect(overlapsCleft).toBe(false);
    }
  });

  it('uses just one reusable instanced rocky ledge mesh and releases resources',()=>{
    const scene=new THREE.Scene();
    const rocks=new CliffOutcrops(scene,'low');
    try{
      expect(rocks.group.children).toHaveLength(1);
      expect(rocks.mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(rocks.mesh.count).toBe(0);
      rocks.update(GRAND_LAKE.x+GRAND_LAKE.radiusX*1.15, GRAND_LAKE.z);
      expect(rocks.mesh.count).toBeGreaterThan(25);
      const nearbyCount=rocks.mesh.count;
      rocks.update(1600,1600);
      expect(rocks.mesh.count).toBe(0);
      rocks.update(GRAND_LAKE.x+GRAND_LAKE.radiusX*1.15, GRAND_LAKE.z);
      expect(rocks.mesh.count).toBe(nearbyCount);
      expect(rocks.mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const m=new THREE.Matrix4(),pos=new THREE.Vector3();
      rocks.mesh.getMatrixAt(0,m);
      pos.setFromMatrixPosition(m);
      expect(Number.isFinite(pos.y)).toBe(true);
    }finally{rocks.dispose();}
    expect(scene.children).toHaveLength(0);
  });
});
