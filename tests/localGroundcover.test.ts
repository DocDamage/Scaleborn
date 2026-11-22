import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LocalGroundcover } from '../src/world/localGroundcover';
import { waterSurfaceAt, GRAND_LAKE } from '../src/world/highlandLake';
import { heightAt } from '../src/world/terrain';

describe('bounded rider-height meadow detail',()=>{
  it('creates stable world-anchored grass around shore without carpeting the lake',()=>{
    const scene=new THREE.Scene();
    const cover=new LocalGroundcover(scene,'low');
    const sx=GRAND_LAKE.x+258,sz=GRAND_LAKE.z+320;
    try {
      cover.update(sx,sz,1.25);
      expect(cover.mesh.count).toBeGreaterThan(70);
      expect(cover.mesh.count).toBeLessThan(cover.mesh.instanceMatrix.count);
      expect(cover.mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const m=new THREE.Matrix4(),p=new THREE.Vector3();
      const initial:number[][]=[];
      for(let i=0;i<Math.min(25,cover.mesh.count);i++){
        cover.mesh.getMatrixAt(i,m);p.setFromMatrixPosition(m);
        expect(p.y).toBeCloseTo(heightAt(p.x,p.z)+.035,4);
        expect(p.y).toBeGreaterThan(waterSurfaceAt(p.x,p.z)+1);
        initial.push(m.toArray());
      }
      cover.update(sx+100,sz+50,3);
      cover.update(sx,sz,4);
      expect(cover.mesh.count).toBeGreaterThan(70);
      initial.forEach((values,i)=>{
        cover.mesh.getMatrixAt(i,m);
        expect(m.toArray()).toEqual(values);
      });
    }finally { cover.dispose(); }
    expect(scene.children.length).toBe(0);
  });

  it('scales patch complexity with GPU budget without new draw-call groups',()=>{
    const low=new LocalGroundcover(new THREE.Scene(),'low');
    const high=new LocalGroundcover(new THREE.Scene(),'high');
    try {
      expect(high.mesh.instanceMatrix.count).toBeGreaterThan(
        low.mesh.instanceMatrix.count);
      expect(high.mesh.geometry.getAttribute('position').count).toBeGreaterThan(
        low.mesh.geometry.getAttribute('position').count);
      expect(high.mesh.material.customProgramCacheKey())
        .toContain('groundcover-wind');
      low.update(GRAND_LAKE.x,GRAND_LAKE.z,1);
      expect(low.mesh.count).toBe(0);
      low.update(Number.NaN,0,2);
      expect(low.mesh.count).toBe(0);
    }finally {low.dispose();high.dispose();}
  });
});
