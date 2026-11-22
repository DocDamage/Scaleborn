import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeScalebornRider } from '../src/actors/rider/heroSculpt';
import { createWingRig } from '../src/actors/dragon/wingRig';

describe('approved child-scale hybrid features and restrained Onyx pigments',()=>{
  it('keeps the hybrid rider face child-appropriate with attached, smaller eyes',()=>{
    const rider=makeScalebornRider();
    try{
      const face=rider.getObjectByName('rider.face') as THREE.Mesh;
      const nose=rider.getObjectByName('rider.nose') as THREE.Mesh;
      expect(face).toBeInstanceOf(THREE.Mesh);
      expect(nose).toBeInstanceOf(THREE.Mesh);
      for(const side of ['left','right']){
        const eye=rider.getObjectByName('rider.eye.'+side) as THREE.Mesh;
        const iris=rider.getObjectByName('rider.iris.'+side) as THREE.Mesh;
        const horn=rider.getObjectByName('rider.horn.'+side) as THREE.Mesh;
        expect(eye).toBeInstanceOf(THREE.Mesh);
        expect(iris).toBeInstanceOf(THREE.Mesh);
        expect(horn).toBeInstanceOf(THREE.Mesh);
        expect(eye.scale.y).toBeLessThan(.03);
        expect(iris.scale.x).toBeLessThan(eye.scale.x*.5);
        expect(iris.position.z).toBeLessThan(eye.position.z);
        expect(Math.abs(iris.position.z-eye.position.z)).toBeLessThan(.02);
        expect(horn.geometry).not.toBeInstanceOf(THREE.ConeGeometry);
      }
      expect(rider.getObjectByName('rider.elf-ear')).toBeUndefined();
    }finally{
      rider.traverse(x=>{
        if(x instanceof THREE.Mesh)x.geometry.dispose();
      });
    }
  });

  it('uses dark navy painted wing vertex pigments, not full-bright purple surfaces',()=>{
    const wing=createWingRig(-1);
    try{
      const colors=wing.mesh.geometry.getAttribute('color');
      expect(colors.count).toBeGreaterThan(1200);
      let r=0,g=0,b=0;
      for(let i=0;i<colors.count;i++){
        r+=colors.getX(i);g+=colors.getY(i);b+=colors.getZ(i);
      }
      r/=colors.count;g/=colors.count;b/=colors.count;
      expect(b).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(r);
      expect(b).toBeLessThan(.4);
      const material=wing.mesh.material as THREE.MeshPhysicalMaterial;
      expect(material.iridescence).toBeGreaterThan(0);
      expect(material.map).toBeInstanceOf(THREE.DataTexture);
    }finally{wing.mesh.geometry.dispose();}
  });
});
