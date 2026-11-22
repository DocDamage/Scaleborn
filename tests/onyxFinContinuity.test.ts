import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';

describe('sculpted Onyx tail-fin attachment and fully folded wing reach',()=>{
  it('embeds all three original fins into the moving skinned tail',()=>{
    const dragon=new DragonVisual();
    try{
      const fins=dragon.root.getObjectByName('tailTip.fins') as THREE.Group;
      expect(fins).toBeInstanceOf(THREE.Group);
      const names=['central','left','right'];
      for(const name of names){
        const mesh=fins.getObjectByName('creature.dragon.tail-fin.'+name) as THREE.Mesh;
        expect(mesh).toBeInstanceOf(THREE.Mesh);
        const geometry=mesh.geometry;
        const pos=geometry.getAttribute('position');
        const baseY=pos.getY(0),baseZ=pos.getZ(0);
        expect(baseY).toBeLessThan(-.10);
        expect(baseZ).toBeGreaterThan(2.06);
        expect(baseZ).toBeLessThan(2.2);
        geometry.computeBoundingBox();
        expect(geometry.boundingBox!.max.z).toBeLessThan(2.76);
        expect(geometry.boundingBox!.max.z).toBeGreaterThan(2.55);
      }
      const skinned=dragon.root.getObjectByName('creature.dragon.onyx.skinned-tail') as THREE.SkinnedMesh;
      expect(skinned).toBeInstanceOf(THREE.SkinnedMesh);
      expect(fins.parent).toBe(skinned.skeleton.bones[2]);
    }finally{dragon.dispose();}
  });

  it('tucks entire grounded three-bone wings without changing form dimensions or opening reach',()=>{
    const dragon=new DragonVisual();
    const state=newFlightState();
    try{
      state.mode='ground';state.speed=0;state.time=1;
      dragon.update(state);
      for(const side of ['left','right']){
        const wing=dragon.root.getObjectByName(side==='left'?'leftWing':'rightWing') as THREE.Group;
        expect(wing).toBeInstanceOf(THREE.Group);
        expect(wing.scale.x).toBeLessThan(.55);
        expect(wing.scale.z).toBeLessThan(.55);
        expect(wing.getObjectByName('wing.'+side+'.membrane')).toBeInstanceOf(THREE.SkinnedMesh);
      }
      state.mode='air';state.time=1.1;
      dragon.update(state);
      expect(dragon.root.getObjectByName('leftWing')!.scale.x).toBe(1);
      expect(dragon.root.getObjectByName('rightWing')!.scale.z).toBe(1);
      expect(dragon.rider.scale.x).toBe(1);
    }finally{dragon.dispose();}
  });
});
