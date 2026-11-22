import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GRAND_LAKE, lakeBoundaryScale } from '../src/world/highlandLake';
import { LakebedHabitat, aquaticTuft } from '../src/world/lakebedHabitat';

describe('Mirrorfall underwater botanical and sediment visual quality',()=>{
  it('builds curved indexed vegetation with individual colored leaflets',()=>{
    const low=aquaticTuft('low'),high=aquaticTuft('high');
    try{
      const positions=high.getAttribute('position');
      const normals=high.getAttribute('normal');
      const colors=high.getAttribute('color');
      expect(high.index).not.toBeNull();
      expect(positions.count).toBeGreaterThan(low.getAttribute('position').count);
      expect(high.index!.count).toBeGreaterThan(800);
      expect(colors.count).toBe(positions.count);
      expect(normals.count).toBe(positions.count);
      const xs:number[]=[],ys:number[]=[],zs:number[]=[];
      for(let i=0;i<positions.count;i++){
        xs.push(positions.getX(i));ys.push(positions.getY(i));zs.push(positions.getZ(i));
        expect(Number.isFinite(normals.getX(i))).toBe(true);
        expect(Number.isFinite(normals.getY(i))).toBe(true);
        expect(Number.isFinite(normals.getZ(i))).toBe(true);
      }
      expect(Math.max(...ys)).toBeGreaterThan(1.5);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...xs)-Math.min(...xs)).toBeGreaterThan(.6);
      expect(Math.max(...zs)-Math.min(...zs)).toBeGreaterThan(.6);
      expect(colors.getY(0)).toBeLessThan(1);
    }finally{low.dispose();high.dispose();}
  });

  it('submits nearby plants and pebbles without regenerating stable instances',()=>{
    const scene=new THREE.Scene();
    const habitat=new LakebedHabitat(scene,'low');
    try{
      const originalStones=habitat.stones.count;
      const originalPlants=habitat.weeds.count;
      expect(originalStones).toBeGreaterThan(250);
      expect(originalPlants).toBeGreaterThan(80);
      expect(habitat.stones.geometry.type).toBe('SphereGeometry');
      const material=habitat.weeds.material as THREE.MeshStandardMaterial;
      expect(material.vertexColors).toBe(true);
      const x=GRAND_LAKE.x+GRAND_LAKE.radiusX*.94*lakeBoundaryScale(0);
      const z=GRAND_LAKE.z;
      habitat.update(1,x,z);
      const stones=habitat.stones.count,plants=habitat.weeds.count;
      expect(stones).toBeLessThan(originalStones);
      expect(plants).toBeLessThanOrEqual(originalPlants);
      expect(stones).toBeGreaterThan(0);
      const matrix=new THREE.Matrix4();
      habitat.stones.getMatrixAt(0,matrix);
      const initial=matrix.elements.slice();
      habitat.update(2,x-410,z);
      habitat.update(3,x,z);
      expect(habitat.stones.count).toBe(stones);
      expect(habitat.weeds.count).toBe(plants);
      habitat.stones.getMatrixAt(0,matrix);
      expect(matrix.elements).toEqual(initial);
      expect(habitat.group.children).toHaveLength(2);
    }finally{habitat.dispose();}
    expect(scene.children).toHaveLength(0);
  });
});
