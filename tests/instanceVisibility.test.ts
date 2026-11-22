import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { InstanceVisibility } from '../src/world/instanceVisibility';
import { PainterlyNature } from '../src/world/painterlyNature';
import { GRAND_LAKE } from '../src/world/highlandLake';

describe('deterministic foliage instance visibility',()=>{
  it('streams nearby tree geometry without deleting seed-stable populations',()=>{
    const scene=new THREE.Scene();
    const nature=new PainterlyNature(scene,'low');
    try{
      const tree=scene.getObjectByName('vegetation.azure.pbr-tree-leaves.0')
        as THREE.InstancedMesh;
      expect(tree).toBeInstanceOf(THREE.InstancedMesh);
      const fullCount=tree.count;
      expect(fullCount).toBeGreaterThan(100);
      nature.update(1,GRAND_LAKE.x,GRAND_LAKE.z);
      expect(tree.count).toBeGreaterThan(0);
      expect(tree.count).toBeLessThan(fullCount);
      const saved:number[][]=[],m=new THREE.Matrix4(),p=new THREE.Vector3();
      for(let i=0;i<Math.min(tree.count,10);i++){
        tree.getMatrixAt(i,m);
        p.setFromMatrixPosition(m);
        expect(Math.hypot(p.x-GRAND_LAKE.x,p.z-GRAND_LAKE.z)).toBeLessThanOrEqual(820);
        saved.push(m.toArray());
      }
      nature.update(2,1600,1800);
      nature.update(3,GRAND_LAKE.x,GRAND_LAKE.z);
      saved.forEach((original,i)=>{
        tree.getMatrixAt(i,m);
        expect(m.toArray()).toEqual(original);
      });
    }finally{nature.dispose();}
  });

  it('rejects invalid batches and handles empty result sets without new meshes',()=>{
    const scene=new THREE.Scene();
    const mesh=new THREE.InstancedMesh(
      new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial(),2);
    const p=new THREE.Object3D(),sites=[{x:10,z:10},{x:300,z:300}];
    p.position.set(10,1,10);p.updateMatrix();mesh.setMatrixAt(0,p.matrix);
    p.position.set(300,1,300);p.updateMatrix();mesh.setMatrixAt(1,p.matrix);
    const visibility=new InstanceVisibility();
    expect(()=>visibility.register(mesh,[sites[0]!],50)).toThrow();
    visibility.register(mesh,sites,50);
    expect(mesh.frustumCulled).toBe(false);
    visibility.update(10,10);
    expect(mesh.count).toBe(1);
    visibility.update(1000,1000);
    expect(mesh.count).toBe(0);
    visibility.update(10,10);
    expect(mesh.count).toBe(1);
    scene.add(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
});
