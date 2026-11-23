import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';
import { onyxBackSurfaceY, onyxDorsalY } from '../src/actors/dragon/organicSculpt';

describe('original heroine cloak-to-Onyx contact',()=>{
  it('samples the real loft cross-section instead of a flat dorsal plane',()=>{
    expect(onyxBackSurfaceY(0,-.23)).toBeCloseTo(onyxDorsalY(-.23),4);
    expect(onyxBackSurfaceY(.20,-.23)!).toBeLessThan(
      onyxBackSurfaceY(0,-.23)!);
    expect(onyxBackSurfaceY(20,-.23)).toBeNull();
    expect(onyxBackSurfaceY(0,20)).toBeNull();
    expect(onyxBackSurfaceY(Number.NaN,-.23)).toBeNull();
  });

  it('keeps the cloth hem clear of the original torso through mounted forms and banking',()=>{
    const dragon=new DragonVisual();
    const cloak=dragon.rider.getObjectByName('rider.travel-cloak') as THREE.Mesh;
    const pos=cloak.geometry.getAttribute('position') as THREE.BufferAttribute;
    const buffer=pos.array;
    const state=newFlightState();
    try{
      for(const [form,bank] of [
        ['rideable',0],['rideable',.42],['giant',-.36],
      ] as const){
        state.form=form;
        state.mode='air';
        state.speed=18;
        state.roll=bank;
        state.time+=1;
        dragon.update(state);
        expect(dragon.rider.scale.x).toBe(1);
        expect(pos.array).toBe(buffer);
        dragon.body.updateWorldMatrix(true,false);
        cloak.updateWorldMatrix(true,false);
        const toBody=dragon.body.matrixWorld.clone().invert()
          .multiply(cloak.matrixWorld);
        let contacts=0;
        for(let row=1;row<=14;row++)for(let col=0;col<=16;col++){
          const i=(row*17+col)*3;
          const p=new THREE.Vector3(
            pos.getX(i/3),pos.getY(i/3),pos.getZ(i/3)).applyMatrix4(toBody);
          const surface=onyxBackSurfaceY(p.x,p.z);
          if(surface===null)continue;
          contacts++;
          expect(p.y).toBeGreaterThanOrEqual(
            surface+.044/dragon.body.scale.x);
        }
        expect(contacts).toBeGreaterThan(25);
        const normals=cloak.geometry.getAttribute('normal');
        expect(normals.count).toBe(pos.count);
        expect(Array.from(pos.array).every(Number.isFinite)).toBe(true);
      }
    }finally{dragon.dispose();}
  });

  it('leaves shoulder attachment untouched and releases contact on dismount',()=>{
    const dragon=new DragonVisual();
    const cloak=dragon.rider.getObjectByName('rider.travel-cloak') as THREE.Mesh;
    const pos=cloak.geometry.getAttribute('position') as THREE.BufferAttribute;
    const shoulder=Array.from(pos.array).slice(0,17*3);
    const state=newFlightState();
    try{
      state.form='giant';state.mode='ground';state.time=3.2;
      dragon.update(state);
      expect(Array.from(pos.array).slice(0,17*3)).toEqual(shoulder);
      state.form='small';state.riderMode='ground';state.riderSpeed=0;
      state.time=4.2;dragon.update(state);
      expect(Array.from(pos.array).slice(0,17*3)).toEqual(shoulder);
      expect(Array.from(pos.array).every(Number.isFinite)).toBe(true);
      expect(dragon.rider.userData.assetId).toBe('character.rider.hero');
    }finally{dragon.dispose();}
  });
});
