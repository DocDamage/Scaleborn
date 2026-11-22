import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DragonVisual } from '../src/actors/dragon/visual';
import { loftDragon, ONYX_HEAD, ONYX_TORSO } from '../src/actors/dragon/organicSculpt';
import { makeScalebornRider } from '../src/actors/rider/heroSculpt';
import { CHARACTER_MODEL_SOURCES } from '../src/actors/dragon/characterSources';

describe('original Scaleborn dragon and young hybrid heroine sculpts',()=>{
  it('uses a continuous high-resolution anatomical torso and bespoke skull',()=>{
    const visual=new DragonVisual();
    const body=visual.root.getObjectByName('creature.dragon.onyx.anatomical-torso');
    const skull=visual.root.getObjectByName('creature.dragon.onyx.sculpted-skull');
    expect(body).toBeInstanceOf(THREE.Mesh);
    expect(skull).toBeInstanceOf(THREE.Mesh);
    for(const part of [body,skull] as THREE.Mesh[]){
      expect(part.geometry).toBeInstanceOf(THREE.BufferGeometry);
      expect(part.geometry).not.toBeInstanceOf(THREE.SphereGeometry);
      expect(part.geometry.getAttribute('position').count).toBeGreaterThan(1500);
      expect(part.geometry.getAttribute('normal').count).toBe(
        part.geometry.getAttribute('position').count);
      expect(part.geometry.getAttribute('uv').count).toBe(
        part.geometry.getAttribute('position').count);
    }
    expect(ONYX_TORSO.length).toBeGreaterThan(9);
    expect(ONYX_HEAD.length).toBeGreaterThan(5);
    const standalone=loftDragon(ONYX_HEAD,30,20);
    expect(standalone.getAttribute('color').count).toBe(standalone.getAttribute('position').count);
    standalone.dispose();
    visual.dispose();
  });

  it('has swept original crests, curved horns, tapered tail and four distinct feet',()=>{
    const visual=new DragonVisual();
    try {
      for(const name of [
        'creature.dragon.crest.left','creature.dragon.crest.right',
        'creature.dragon.horn.left','creature.dragon.horn.right',
        'creature.dragon.tail-fin.central','creature.dragon.tail-fin.left',
        'creature.dragon.tail-fin.right','leg.frontLeft','leg.frontRight',
        'leg.hindLeft','leg.hindRight',
      ]) expect(visual.root.getObjectByName(name),name).toBeDefined();
      const wing=visual.root.getObjectByName('wing.left.membrane') as THREE.SkinnedMesh;
      expect(wing).toBeInstanceOf(THREE.SkinnedMesh);
      expect(wing.geometry.getAttribute('position').count).toBeGreaterThan(1200);
      expect(wing.skeleton.bones).toHaveLength(3);
      expect(wing.geometry.getAttribute('skinWeight').count).toBe(
        wing.geometry.getAttribute('position').count);
    }finally{visual.dispose();}
  });

  it('builds a child-proportioned female hybrid with real face, horns and tail',()=>{
    const rider=makeScalebornRider();
    for(const name of ['rider.face','rider.crown','rider.horn.left',
      'rider.horn.right','rider.bond-pendant','rider.travel-cloak',
      'rider.tail','rider.leftArm','rider.rightArm','rider.leftLeg',
      'rider.rightLeg']) expect(rider.getObjectByName(name),name).toBeDefined();
    expect(rider.userData.scalebornDesign).toBe('scaleborn.hero.design.v1');
    const face=rider.getObjectByName('rider.face') as THREE.Mesh;
    expect(face.geometry).not.toBeInstanceOf(THREE.SphereGeometry);
    expect(face.geometry.getAttribute('position').count).toBeGreaterThan(600);
    rider.traverse((obj)=>{
      if(obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const materials=Array.isArray(obj.material)?obj.material:[obj.material];
        materials.forEach(m=>m.dispose());
      }
    });
  });

  it('never fetches unapproved donor characters',()=>{
    expect(CHARACTER_MODEL_SOURCES.dragon.installed).toBe(false);
    expect(CHARACTER_MODEL_SOURCES.rider.installed).toBe(false);
    expect(CHARACTER_MODEL_SOURCES.dragon.design).toContain('onyx');
    expect(CHARACTER_MODEL_SOURCES.rider.design).toContain('hero');
  });
});
