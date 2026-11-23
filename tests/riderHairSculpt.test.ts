import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeScalebornRider } from '../src/actors/rider/heroSculpt';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';
import {
  makeRiderHairLock,riderHairSway,poseRiderHairLocks,
} from '../src/actors/rider/riderHairSculpt';

describe('original layered hybrid heroine hair',()=>{
  it('replaces the rigid hair tubes with finite tapered strands on head sockets',()=>{
    const rider=makeScalebornRider();
    try{
      for(const side of ['left','right'] as const){
        const pivot=rider.getObjectByName('rider.hair-lock.'+side) as THREE.Group;
        expect(pivot).toBeInstanceOf(THREE.Group);
        expect(pivot.children).toHaveLength(4);
        expect(pivot.parent?.name).toBe('rider.head-rest-space');
        expect(pivot.position.y).toBeCloseTo(1.442,5);
        for(let i=0;i<4;i++){
          const strand=pivot.getObjectByName('rider.hair-strand.'+i) as THREE.Mesh;
          expect(strand).toBeInstanceOf(THREE.Mesh);
          expect(strand.geometry).not.toBeInstanceOf(THREE.CylinderGeometry);
          const p=strand.geometry.getAttribute('position');
          const n=strand.geometry.getAttribute('normal');
          expect(p.count).toBeGreaterThan(250);
          expect(n.count).toBe(p.count);
          for(let j=0;j<p.count;j++){
            expect([p.getX(j),p.getY(j),p.getZ(j),
              n.getX(j),n.getY(j),n.getZ(j)].every(Number.isFinite)).toBe(true);
          }
        }
        expect(rider.getObjectByName('rider.horn.'+side)).toBeDefined();
      }
      expect(rider.getObjectByName('rider.elf-ear')).toBeUndefined();
      expect(rider.userData.assetId).toBe('character.rider.hero');
    }finally{
      rider.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
    }
  });

  it('produces smooth deterministic bounded swimming and banking motion',()=>{
    const state=newFlightState();
    state.time=2.1;state.roll=.4;state.speed=11;
    const left=riderHairSway(state,'mounted',-1);
    const right=riderHairSway(state,'mounted',1);
    expect(left).toEqual(riderHairSway(state,'mounted',-1));
    expect(left.yaw).not.toBeCloseTo(right.yaw,3);
    expect(left.roll).not.toBeCloseTo(right.roll,3);
    for(const motion of ['mounted','walk','swim','dive','idle'] as const){
      for(const side of [-1,1] as const){
        const v=riderHairSway(state,motion,side);
        expect(Object.values(v).every(Number.isFinite)).toBe(true);
        expect(Math.abs(v.pitch)).toBeLessThan(.18);
        expect(Math.abs(v.yaw)).toBeLessThan(.11);
        expect(Math.abs(v.roll)).toBeLessThan(.12);
      }
    }
    const mat=new THREE.MeshStandardMaterial();
    const l=makeRiderHairLock(-1,mat),r=makeRiderHairLock(1,mat);
    try{
      state.time=Number.NaN;state.roll=Infinity;state.speed=NaN;
      poseRiderHairLocks(l,r,state,'mounted');
      expect([l.rotation.x,l.rotation.y,l.rotation.z,
        r.rotation.x,r.rotation.y,r.rotation.z].every(Number.isFinite)).toBe(true);
    }finally{
      l.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
      r.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
      mat.dispose();
    }
  });

  it('animates the live original head without changing child mounting or expression',()=>{
    const dragon=new DragonVisual(),state=newFlightState();
    try{
      state.form='rideable';state.mode='air';state.roll=.5;state.time=2.2;
      dragon.update(state);
      const left=dragon.rider.getObjectByName('rider.hair-lock.left') as THREE.Group;
      const right=dragon.rider.getObjectByName('rider.hair-lock.right') as THREE.Group;
      expect(left.rotation.y).not.toBeCloseTo(right.rotation.y,4);
      const before=left.rotation.x;
      state.form='small';state.riderMode='underwater';state.riderSpeed=3;
      state.time=2.9;dragon.update(state);
      expect(left.rotation.x).not.toBeCloseTo(before,3);
      expect(dragon.rider.getObjectByName('rider.face')).toBeDefined();
      expect(dragon.rider.scale.x).toBe(1);
    }finally{dragon.dispose();}
  });
});
