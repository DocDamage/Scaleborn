import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { dragonExpression } from '../src/actors/dragon/dragonExpression';
import { dragonPose } from '../src/actors/dragon/animationPose';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';

describe('original Onyx expressive face, eyes and mobile crests',()=>{
  it('uses complete rapid iris/pupil closure instead of a pupil-only flicker',()=>{
    const state=newFlightState();
    state.time=3.22;
    const face=dragonExpression(state,dragonPose(state));
    expect(face.eyeOpen).toBeLessThan(.04);
    const before=newFlightState();
    before.time=2.5;
    expect(dragonExpression(before,dragonPose(before)).eyeOpen)
      .toBeGreaterThan(.99);
    expect(dragonExpression(state,dragonPose(state)))
      .toEqual(face); // no RNG or time-dependent side effects
  });

  it('expresses surge, splash and submerged states without an invented combat mode',()=>{
    const fast=newFlightState();
    fast.speed=160;fast.time=1.5;
    const surging=dragonExpression(fast,dragonPose(fast));
    const idle=newFlightState();
    idle.mode='ground';idle.speed=0;idle.time=1.5;
    const calm=dragonExpression(idle,dragonPose(idle));
    expect(surging.jawAngle).toBeGreaterThan(calm.jawAngle+.10);
    expect(surging.crestAngle).toBeGreaterThan(calm.crestAngle);
    const underwater=newFlightState();
    underwater.mode='underwater';underwater.time=1.5;
    const swim=dragonExpression(underwater,dragonPose(underwater));
    expect(swim.eyeOpen).toBeLessThan(calm.eyeOpen);
  });

  it('has paired curved muzzle anatomy, without bright protruding bead nostrils',()=>{
    const dragon=new DragonVisual();
    try{
      for(const side of ['left','right']){
        for(const detail of ['nostril','upper-lip']){
          const part=dragon.root.getObjectByName(
            'creature.dragon.'+detail+'.'+side);
          expect(part).toBeInstanceOf(THREE.Mesh);
          const mesh=part as THREE.Mesh;
          const position=mesh.geometry.getAttribute('position');
          const normal=mesh.geometry.getAttribute('normal');
          expect(position.count).toBeGreaterThan(100);
          expect(normal.count).toBe(position.count);
          for(let i=0;i<position.count;i++){
            expect([position.getX(i),position.getY(i),position.getZ(i),
              normal.getX(i),normal.getY(i),normal.getZ(i)]
              .every(Number.isFinite)).toBe(true);
          }
        }
      }
      const eye=dragon.root.getObjectByName(
        'creature.dragon.eye.iris.left') as THREE.Mesh;
      expect((eye.material as THREE.MeshStandardMaterial).emissiveIntensity)
        .toBeLessThan(.4);
      const state=newFlightState();
      state.time=3.22;
      dragon.update(state);
      expect(dragon.root.getObjectByName('creature.dragon.nostril.left'))
        .toBeDefined();
    }finally{dragon.dispose();}
  });

  it('animates both sides of the complete original Onyx eye geometry',()=>{
    const dragon=new DragonVisual();
    try{
      const state=newFlightState();
      state.time=2.5;
      dragon.update(state);
      const iL=dragon.root.getObjectByName('creature.dragon.eye.iris.left') as THREE.Mesh;
      const pL=dragon.root.getObjectByName('creature.dragon.eye.pupil.left') as THREE.Mesh;
      const eyeRight=dragon.root.getObjectByName('creature.dragon.eye.iris.right') as THREE.Mesh;
      const brow=dragon.root.getObjectByName('creature.dragon.brow.left') as THREE.Group;
      const lid=dragon.root.getObjectByName('creature.dragon.upper-lid.left') as THREE.Mesh;
      const crest=dragon.root.getObjectByName('creature.dragon.mobile-crest.left') as THREE.Group;
      const jaw=dragon.root.getObjectByName('creature.dragon.onyx.jaw-hinge') as THREE.Group;
      expect(iL).toBeInstanceOf(THREE.Mesh);
      expect(pL).toBeInstanceOf(THREE.Mesh);
      expect(eyeRight).toBeInstanceOf(THREE.Mesh);
      expect(brow).toBeInstanceOf(THREE.Group);
      expect(lid).toBeInstanceOf(THREE.Mesh);
      expect(crest).toBeInstanceOf(THREE.Group);
      expect(jaw).toBeInstanceOf(THREE.Group);
      const open=iL.scale.y;
      state.time=3.22;
      dragon.update(state);
      expect(iL.scale.y).toBeLessThan(open*.1);
      expect(pL.scale.y).toBeLessThan(.02);
      expect(eyeRight.scale.y).toBeCloseTo(iL.scale.y,5);
      expect(lid.position.y).toBeLessThan(-.08);
      expect(dragon.rider.scale.x).toBe(1);
      const animate=newFlightState();
      animate.time=5.0;animate.speed=155;
      dragon.update(animate);
      expect(jaw.rotation.x).toBeLessThan(-.1);
      expect(Math.abs(crest.rotation.x)).toBeGreaterThan(.01);
    }finally{dragon.dispose();}
  });
});
