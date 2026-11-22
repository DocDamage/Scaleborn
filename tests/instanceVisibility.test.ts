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
      const tree=scene.getObjectByName('vegetation.azure.pbr-tree-leaves.0') as THREE.InstancedMesh;
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
      const unfilteredCount=tree.count;
      const camera=new THREE.PerspectiveCamera(71,16/9,.2,1500);
      camera.position.set(GRAND_LAKE.x,GRAND_LAKE.surfaceY+12,GRAND_LAKE.z);
      camera.lookAt(GRAND_LAKE.x+100,GRAND_LAKE.surfaceY+12,GRAND_LAKE.z);
      nature.update(4,GRAND_LAKE.x,GRAND_LAKE.z,camera);
      expect(tree.count).toBeGreaterThan(0);
      expect(tree.count).toBeLessThan(unfilteredCount);
      // The camera optimization must not destroy the seed-stable trees.
      nature.update(5,GRAND_LAKE.x,GRAND_LAKE.z);
      expect(tree.count).toBe(unfilteredCount);
    }finally{nature.dispose();}
  });

  it('culls distant behind-camera leaf geometry without hiding nearby trees or overhead views',()=>{
    const camera=new THREE.PerspectiveCamera(71,16/9,.2,1500);
    camera.position.set(0,2,0);
    const mesh=new THREE.InstancedMesh(
      new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial(),3);
    const sites=[{x:0,z:-160},{x:0,z:160},{x:0,z:15}];
    const object=new THREE.Object3D();
    sites.forEach((site,i)=>{
      object.position.set(site.x,0,site.z);
      object.updateMatrix();
      mesh.setMatrixAt(i,object.matrix);
    });
    const visibility=new InstanceVisibility();
    visibility.register(mesh,sites,250);
    const position=new THREE.Vector3(),matrix=new THREE.Matrix4();
    const renderedZ=():number[]=>{
      const values:number[]=[];
      for(let i=0;i<mesh.count;i++){
        mesh.getMatrixAt(i,matrix);
        position.setFromMatrixPosition(matrix);
        values.push(position.z);
      }
      return values.sort((a,b)=>a-b);
    };
    camera.lookAt(0,2,-50);
    visibility.update(0,0,camera);
    expect(renderedZ()).toEqual([-160,15]);

    // Rotating in place must invalidate the orientation cache even without
    // crossing the actor's 48m streaming cell.
    camera.lookAt(0,2,50);
    visibility.update(0,0,camera);
    expect(renderedZ()).toEqual([15,160]);

    // A top-down or near-vertical orbit needs the complete 360-degree area.
    camera.lookAt(0,-50,0);
    visibility.update(0,0,camera);
    expect(renderedZ()).toEqual([-160,15,160]);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
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

  it('preserves nearby canopy and refreshes far-tree visibility when camera FOV changes',()=>{
    const camera=new THREE.PerspectiveCamera(60,16/9,.2,2000);
    camera.position.set(0,2,0);
    camera.lookAt(0,2,-300);
    const sites=[{x:140,z:0},{x:15,z:0},{x:0,z:-150}];
    const mesh=new THREE.InstancedMesh(
      new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial(),sites.length);
    const object=new THREE.Object3D();
    sites.forEach((site,i)=>{
      object.position.set(site.x,0,site.z);
      object.updateMatrix();
      mesh.setMatrixAt(i,object.matrix);
    });
    const visibility=new InstanceVisibility();
    visibility.register(mesh,sites,250);
    const matrix=new THREE.Matrix4(),position=new THREE.Vector3();
    const visibleX=():number[]=>{
      const result:number[]=[];
      for(let i=0;i<mesh.count;i++){
        mesh.getMatrixAt(i,matrix);
        position.setFromMatrixPosition(matrix);
        result.push(position.x);
      }
      return result.sort((a,b)=>a-b);
    };
    try{
      // Nearby off-axis foliage must remain while the distant side tree
      // falls outside the camera's field of view and conservative margin.
      visibility.update(0,0,camera);
      expect(visibleX()).toEqual([0,15]);
      // Zooming out without moving the player or camera invalidates the
      // FOV-dependent cache and reveals the previous side tree.
      camera.fov=130;
      camera.updateProjectionMatrix();
      visibility.update(0,0,camera);
      expect(visibleX()).toEqual([0,15,140]);
      camera.fov=60;
      camera.updateProjectionMatrix();
      visibility.update(0,0,camera);
      expect(visibleX()).toEqual([0,15]);
    }finally{
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  });


  it('reuses original instance matrices and paint colors when camera direction changes',()=>{
    const camera=new THREE.PerspectiveCamera(65,16/9,.2,1500);
    camera.position.set(0,2,0);
    const sites=[{x:0,z:-130},{x:0,z:130},{x:0,z:15}];
    const mesh=new THREE.InstancedMesh(
      new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial(),sites.length);
    const object=new THREE.Object3D();
    const palette=[0xcc3322,0x3399cc,0x66aa55] as const;
    sites.forEach((site,i)=>{
      object.position.set(site.x,0,site.z);object.updateMatrix();
      mesh.setMatrixAt(i,object.matrix);
      mesh.setColorAt(i,new THREE.Color(palette[i]!));
    });
    const controller=new InstanceVisibility();
    controller.register(mesh,sites,200);
    const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),color=new THREE.Color();
    const snapshot=():number[]=>{
      const packed:number[]=[];
      for(let i=0;i<mesh.count;i++){
        mesh.getMatrixAt(i,matrix);
        position.setFromMatrixPosition(matrix);
        mesh.getColorAt(i,color);
        packed.push(position.z,Math.round(color.r*1000),
          Math.round(color.g*1000),Math.round(color.b*1000));
      }
      return packed;
    };
    try{
      camera.lookAt(0,2,-100);
      controller.update(0,0,camera);
      expect(mesh.count).toBe(2);
      const first=snapshot();
      camera.lookAt(0,2,100);
      controller.update(0,0,camera);
      expect(mesh.count).toBe(2);
      const other=snapshot();
      expect(other).not.toEqual(first);
      camera.lookAt(0,2,-100);
      controller.update(0,0,camera);
      expect(snapshot()).toEqual(first);
    }finally{
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  });

});
