import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createStratifiedRockGeometry } from '../src/world/stratifiedRock';
import { PainterlyNature } from '../src/world/painterlyNature';
import { heightAt } from '../src/world/terrain';

describe('eroded boulder surface and terrain-grounded talus', () => {
  it('produces closed, indexed, UV-mapped non-spherical strata at both budgets', () => {
    const low=createStratifiedRockGeometry('low');
    const high=createStratifiedRockGeometry('high');
    try {
      expect(high.index!.count).toBeGreaterThan(low.index!.count);
      for(const geometry of [low,high]){
        const p=geometry.getAttribute('position');
        const n=geometry.getAttribute('normal');
        const c=geometry.getAttribute('color');
        expect(p.count).toBeGreaterThan(350);
        expect(n.count).toBe(p.count);
        expect(c.count).toBe(p.count);
        expect(geometry.getAttribute('uv').count).toBe(p.count);
        expect(geometry.index!.count%3).toBe(0);
        expect(geometry.boundingSphere!.radius).toBeGreaterThan(.9);
        expect(geometry.boundingSphere!.radius).toBeLessThan(1.5);
        const radial:number[]=[];
        for(let i=0;i<p.count;i++){
          const len=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));
          expect(Number.isFinite(len)).toBe(true);
          expect(len).toBeGreaterThan(.6);
          if(Math.abs(p.getY(i))<.11)
            radial.push(Math.hypot(p.getX(i),p.getZ(i)));
        }
        expect(Math.max(...radial)-Math.min(...radial)).toBeGreaterThan(.09);
      }
    } finally {low.dispose();high.dispose();}
  });

  it('uses one instanced PBR mesh with genuine vertex strata and embedded footings', () => {
    const scene=new THREE.Scene();
    const nature=new PainterlyNature(scene,'low');
    try {
      const boulders=scene.getObjectByName(
        'terrain.azure.rounded-pbr-boulders') as THREE.InstancedMesh;
      expect(boulders).toBeInstanceOf(THREE.InstancedMesh);
      expect(boulders.count).toBeGreaterThan(10);
      expect((boulders.material as THREE.MeshStandardMaterial).vertexColors)
        .toBe(true);
      expect(boulders.geometry.getAttribute('color')).toBeDefined();
      const world=new THREE.Matrix4();
      const pos=new THREE.Vector3();
      for(let i=0;i<Math.min(boulders.count,80);i++){
        boulders.getMatrixAt(i,world);
        pos.setFromMatrixPosition(world);
        expect(pos.y).toBeLessThan(heightAt(pos.x,pos.z)+.01);
        expect(pos.y).toBeGreaterThan(heightAt(pos.x,pos.z)-3);
      }
    }finally {nature.dispose();}
  });
});
