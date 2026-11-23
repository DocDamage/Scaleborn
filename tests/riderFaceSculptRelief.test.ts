import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { riderFaceRelief } from '../src/actors/rider/riderFaceRelief';
import { makeScalebornRider } from '../src/actors/rider/heroSculpt';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';

describe('screenshot-directed sculpted heroine facial planes and hairline',()=>{
  it('builds a continuous paired eye socket, brow, bridge and cheek relief',()=>{
    expect(riderFaceRelief(1.302,.50,-.866)).toBeGreaterThan(.001);
    expect(riderFaceRelief(1.359,.53,-.848)).toBeLessThan(-.004);
    expect(riderFaceRelief(1.320,0,-1)).toBeLessThan(-.006);
    expect(riderFaceRelief(1.302,.5, .866)).toBe(0);
    expect(riderFaceRelief(1.302,-.5,-.866))
      .toBeCloseTo(riderFaceRelief(1.302,.5,-.866),8);
    expect(()=>riderFaceRelief(Number.NaN,0,-1)).toThrow('finite');
  });

  it('attaches fine forehead strands to the original child head, not gameplay scale',()=>{
    const rider=makeScalebornRider();
    try{
      const face=rider.getObjectByName('rider.face') as THREE.Mesh;
      const head=rider.getObjectByName('rider.head') as THREE.Group;
      const fringe=rider.getObjectByName('rider.hair-fringe') as THREE.Group;
      expect(fringe).toBeInstanceOf(THREE.Group);
      expect(fringe.parent?.parent).toBe(head);
      expect(fringe.children).toHaveLength(6);
      for(const lock of fringe.children){
        expect(lock).toBeInstanceOf(THREE.Mesh);
        const mesh=lock as THREE.Mesh;
        expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(100);
        mesh.geometry.computeBoundingBox();
        expect(mesh.geometry.boundingBox!.min.y).toBeGreaterThan(1.38);
        expect(mesh.geometry.boundingBox!.max.y).toBeLessThan(1.50);
        const p=mesh.geometry.getAttribute('position');
        const n=mesh.geometry.getAttribute('normal');
        expect(n.count).toBe(p.count);
        for(let i=0;i<p.count;i++)expect([
          p.getX(i),p.getY(i),p.getZ(i),
          n.getX(i),n.getY(i),n.getZ(i),
        ].every(Number.isFinite)).toBe(true);
      }
      const p=face.geometry.getAttribute('position');
      const n=face.geometry.getAttribute('normal');
      expect(n.count).toBe(p.count);
      expect(face.morphTargetInfluences).toHaveLength(2);
      expect(rider.userData.assetId).toBe('character.rider.hero');
      expect(rider.scale.x).toBe(1);
    }finally{rider.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});}
  });

  it('keeps original expression and head transform in giant and rider forms',()=>{
    const dragon=new DragonVisual();
    const state=newFlightState();
    try{
      state.form='giant';state.mode='air';state.roll=.35;state.time=2;
      dragon.update(state);
      expect(dragon.rider.getObjectByName('rider.hair-fringe')).toBeDefined();
      const head=dragon.rider.getObjectByName('rider.head') as THREE.Group;
      expect(head.rotation.z).not.toBe(0);
      state.form='small';state.time=3;dragon.update(state);
      expect(dragon.rider.scale.x).toBe(1);
      expect(dragon.rider.getObjectByName('rider.elf-ear')).toBeUndefined();
    }finally{dragon.dispose();}
  });
});
