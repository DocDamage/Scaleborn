import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeScalebornRider } from '../src/actors/rider/heroSculpt';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';
import { riderPose } from '../src/actors/rider/pose';

describe("original hybrid girl's original hands and mounted reins articulation",()=>{
  it('sculpts four natural curved fingers and a thumb into both wrists',()=>{
    const rider=makeScalebornRider();
    try{
      for(const side of ['left','right']){
        const arm=rider.getObjectByName('rider.'+side+'Arm') as THREE.Group;
        const elbow=rider.getObjectByName('rider.'+side+'Elbow') as THREE.Group;
        const wrist=rider.getObjectByName('rider.'+side+'Wrist') as THREE.Group;
        expect(arm).toBeInstanceOf(THREE.Group);
        expect(wrist.parent).toBe(elbow);
        expect(elbow.parent).toBe(arm);
        const palm=wrist.getObjectByName('rider.hand') as THREE.Mesh;
        expect(palm).toBeInstanceOf(THREE.Mesh);
        expect(palm.geometry).not.toBeInstanceOf(THREE.SphereGeometry);
        const digits=wrist.children.filter(x=>x.name.startsWith('rider.finger.'));
        expect(digits).toHaveLength(4);
        const thumb=wrist.getObjectByName('rider.thumb') as THREE.Mesh;
        expect(thumb).toBeInstanceOf(THREE.Mesh);
        for(const mesh of [...digits,thumb] as THREE.Mesh[]){
          expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(150);
          const attr=mesh.geometry.getAttribute('position');
          for(let i=0;i<attr.count;i++){
            expect([attr.getX(i),attr.getY(i),attr.getZ(i)].every(Number.isFinite))
              .toBe(true);
          }
        }
      }
      expect(rider.userData.scalebornDesign).toBe('scaleborn.hero.design.v1');
      expect(rider.getObjectByName('rider.elf-ear')).toBeUndefined();
    }finally{rider.traverse(x=>{if(x instanceof THREE.Mesh)x.geometry.dispose();});}
  });

  it('curls both wrists during mounting and releases them when on foot',()=>{
    const dragon=new DragonVisual(),state=newFlightState();
    try{
      state.time=1;state.mode='ground';state.speed=0;
      dragon.update(state);
      const mounted=riderPose(state);
      for(const side of ['left','right'] as const){
        const wrist=dragon.rider.getObjectByName('rider.'+side+'Wrist') as THREE.Group;
        expect(wrist.rotation.x).toBeCloseTo(
          side==='left'?mounted.leftWrist:mounted.rightWrist,6);
        expect(wrist.rotation.x).toBeLessThan(-.15);
      }
      state.form='small';state.riderMode='ground';state.riderSpeed=0;
      state.time=2;dragon.update(state);
      expect(dragon.rider.getObjectByName('rider.leftWrist')!.rotation.x)
        .toBeCloseTo(0,6);
      expect(dragon.rider.getObjectByName('rider.rightWrist')!.rotation.x)
        .toBeCloseTo(0,6);
      expect(dragon.rider.scale.x).toBe(1);
    }finally{dragon.dispose();}
  });
});
