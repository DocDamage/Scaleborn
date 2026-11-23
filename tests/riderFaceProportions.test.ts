import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeScalebornRider } from '../src/actors/rider/heroSculpt';
import { DragonVisual } from '../src/actors/dragon/visual';

describe('screenshot-directed original adolescent face proportion correction',()=>{
  it('brings almond eyes inward, shortens nose and embeds cheek scales',()=>{
    const rider=makeScalebornRider();
    try{
      for(const side of ['left','right']){
        const eye=rider.getObjectByName('rider.eye.'+side) as THREE.Mesh;
        const iris=rider.getObjectByName('rider.iris.'+side) as THREE.Mesh;
        const horn=rider.getObjectByName('rider.horn.'+side) as THREE.Mesh;
        const cheek=rider.getObjectByName('rider.temple-scales.'+side) as THREE.Mesh;
        expect(Math.abs(eye.position.x)).toBeLessThan(.095);
        expect(iris.position.x).toBeCloseTo(eye.position.x,6);
        expect(Math.abs(iris.position.z-eye.position.z)).toBeLessThan(.01);
        expect(cheek).toBeInstanceOf(THREE.Mesh);
        cheek.geometry.computeBoundingBox();
        expect(Math.abs(cheek.geometry.boundingBox!.max.x)).toBeLessThan(.20);
        horn.geometry.computeBoundingBox();
        expect(horn.geometry.boundingBox!.max.z).toBeGreaterThan(.26);
      }
      const nose=rider.getObjectByName('rider.nose') as THREE.Mesh;
      nose.geometry.computeBoundingBox();
      expect(nose.geometry.boundingBox!.min.y).toBeGreaterThan(1.24);
      expect(nose.geometry.boundingBox!.min.z).toBeGreaterThan(-.20);
      expect(rider.getObjectByName('rider.elf-ear')).toBeUndefined();
    }finally{rider.traverse(n=>{if(n instanceof THREE.Mesh)n.geometry.dispose();});}
  });
  it('preserves identity and smaller shoulders across all dragon forms',()=>{
    const visual=new DragonVisual();
    try{
      expect(visual.rider.userData.assetId).toBe('character.rider.hero');
      expect(visual.rider.getObjectByName('rider.leftArm')!.position.x)
        .toBeGreaterThan(-.24);
      expect(visual.rider.getObjectByName('rider.rightArm')!.position.x)
        .toBeLessThan(.24);
      expect(visual.rider.getObjectByName('rider.tail')).toBeInstanceOf(THREE.Group);
      expect(visual.rider.scale.x).toBe(1);
    }finally{visual.dispose();}
  });
});
