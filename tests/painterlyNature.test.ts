import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PainterlyNature } from '../src/world/painterlyNature';
import { GRAND_LAKE } from '../src/world/highlandLake';

describe('near-camera natural vegetation visual gate', () => {
  it('renders instanced leaf canopies and a dense grass carpet without prop spam', () => {
    const scene=new THREE.Scene();
    const nature=new PainterlyNature(scene,'low');
    try {
      const grass=scene.getObjectByName('vegetation.azure.waving-grass');
      const leaves=scene.getObjectByName('vegetation.azure.pbr-tree-leaves.0');
      const boulders=scene.getObjectByName('terrain.azure.rounded-pbr-boulders');
      expect(grass).toBeInstanceOf(THREE.InstancedMesh);
      expect(leaves).toBeInstanceOf(THREE.InstancedMesh);
      expect(boulders).toBeInstanceOf(THREE.InstancedMesh);
      expect((grass as THREE.InstancedMesh).count).toBeGreaterThan(1000);
      expect((leaves as THREE.InstancedMesh).geometry.getAttribute('position').count)
        .toBeGreaterThanOrEqual(1500);
      expect((boulders as THREE.InstancedMesh).count).toBeGreaterThan(10);
      expect(scene.children.length).toBeLessThan(5);
    } finally {nature.dispose();}
  });
  it('leaves a clear overflight corridor through the official lakeside viewpoint',()=>{
    const scene=new THREE.Scene();
    const nature=new PainterlyNature(scene,'low');
    try {
      const wx=GRAND_LAKE.x+258,wz=GRAND_LAKE.z+320;
      const m=new THREE.Matrix4(),position=new THREE.Vector3();
      for(let species=0;species<4;species++){
        const tree=scene.getObjectByName('vegetation.azure.pbr-tree-wood.'+species)
          as THREE.InstancedMesh | undefined;
        expect(tree).toBeDefined();
        for(let i=0;i<tree!.count;i++){
          tree!.getMatrixAt(i,m);
          position.setFromMatrixPosition(m);
          expect(Math.hypot(position.x-wx,position.z-wz)).toBeGreaterThanOrEqual(35);
        }
      }
    } finally {nature.dispose();}
  });
});
