import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  makeGloamHoundBody, makeGloamHoundLeg, makeGloamHoundPaw,
  makeGloamPeltNormal,
} from '../src/combat/gloamHoundSculpt';
import { CombatVisual } from '../src/combat/visuals';
import { newCombatState } from '../src/combat/combat';

describe('original non-primitive Gloam hound anatomy',()=>{
  it('uses one connected organic body with real UVs, normals and tapered muzzle',()=>{
    const geo=makeGloamHoundBody();
    try{
      expect(geo).toBeInstanceOf(THREE.BufferGeometry);
      expect(geo).not.toBeInstanceOf(THREE.SphereGeometry);
      const pos=geo.getAttribute('position');
      expect(pos.count).toBeGreaterThan(1200);
      expect(geo.index!.count).toBeGreaterThan(5000);
      expect(geo.getAttribute('normal').count).toBe(pos.count);
      expect(geo.getAttribute('uv').count).toBe(pos.count);
      geo.computeBoundingBox();
      expect(geo.boundingBox!.min.z).toBeLessThan(-2);
      expect(geo.boundingBox!.max.z).toBeGreaterThan(1.3);
      expect(geo.boundingBox!.max.y).toBeGreaterThan(1.7);
      for(let i=0;i<pos.count;i+=17){
        expect([pos.getX(i),pos.getY(i),pos.getZ(i)]
          .every(Number.isFinite)).toBe(true);
      }
    }finally{geo.dispose();}
  });

  it('creates joint-ready smooth legs with shaped paws instead of spheres',()=>{
    for(const rear of [true,false]){
      const leg=makeGloamHoundLeg(rear),paw=makeGloamHoundPaw();
      try{
        expect(leg.getAttribute('position').count).toBeGreaterThan(250);
        expect(paw.getAttribute('position').count).toBeGreaterThan(200);
        expect(leg.getAttribute('uv').count).toBe(leg.getAttribute('position').count);
        for(const g of [leg,paw]){
          const normals=g.getAttribute('normal');
          expect(normals.count).toBe(g.getAttribute('position').count);
        }
      }finally{leg.dispose();paw.dispose();}
    }
  });

  it('keeps hound pelt normals bounded and regenerates the same pixels',()=>{
    const a=makeGloamPeltNormal(),b=makeGloamPeltNormal();
    try{
      expect(a.image.data).toEqual(b.image.data);
      expect(a.colorSpace).toBe(THREE.NoColorSpace);
      const pixels=a.image.data as Uint8Array;
      expect(new Set(Array.from(pixels.filter((_,i)=>i%4===0))).size)
        .toBeGreaterThan(20);
      expect(()=>makeGloamPeltNormal(256)).toThrow();
    }finally{a.dispose();b.dispose();}
  });

  it('renders three original hounds with the new sculpt and shared pelt detail',()=>{
    const scene=new THREE.Scene(),combat=newCombatState();
    const render=new CombatVisual(scene,combat);
    try{
      for(const h of combat.hounds){
        const actor=scene.getObjectByName(h.id) as THREE.Group;
        const body=actor.getObjectByName('enemy.gloam.sculpted-body') as THREE.Mesh;
        expect(body).toBeInstanceOf(THREE.Mesh);
        expect(body.geometry).not.toBeInstanceOf(THREE.SphereGeometry);
        const material=body.material as THREE.MeshStandardMaterial;
        expect(material.normalMap).toBeInstanceOf(THREE.DataTexture);
        expect(actor.getObjectByName('enemy.gloam.leg-surface')).toBeDefined();
        expect(actor.getObjectByName('enemy.gloam.curved-ridge')).toBeDefined();
      }
      render.update(combat,1,.016);
      expect(scene.getObjectByName(combat.hounds[0]!.id)).toBeDefined();
    }finally{render.dispose();}
  });
});
