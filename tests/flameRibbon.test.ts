import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeDragonFlameRibbonGeometry, makeDragonFlameRibbonTexture } from '../src/combat/flameRibbon';
import { newCombatState, castDragonFire } from '../src/combat/combat';
import { CombatVisual } from '../src/combat/visuals';
import { newFlightState } from '../src/actors/dragon/flight';

describe('Onyx feathered combat fire breath',()=>{
  it('uses crossed paint-textured ribbons rather than solid 3D cone spikes',()=>{
    const geometry=makeDragonFlameRibbonGeometry();
    try{
      expect(geometry).not.toBeInstanceOf(THREE.ConeGeometry);
      expect(geometry.getAttribute('position').count).toBe(8);
      expect(geometry.index!.count).toBe(12);
      expect(geometry.getAttribute('uv').count).toBe(8);
      const p=geometry.getAttribute('position');
      expect(p.getY(0)).toBe(0);
      expect(p.getY(2)).toBe(1);
      expect(p.getZ(4)).toBeLessThan(0);
      expect(p.getX(4)).toBe(0);
    }finally{geometry.dispose();}
  });

  it('softens flame roots, edges, and tips with deterministic alpha',()=>{
    expect(()=>makeDragonFlameRibbonTexture(8)).toThrow();
    expect(()=>makeDragonFlameRibbonTexture(128.5)).toThrow();
    const a=makeDragonFlameRibbonTexture(64),b=makeDragonFlameRibbonTexture(64);
    try{
      const image=a.image.data as Uint8Array;
      const alpha=(x:number,y:number)=>image[(y*64+x)*4+3]!;
      expect(a.image.data).toEqual(b.image.data);
      expect(alpha(0,32)).toBe(0);
      expect(alpha(32,0)).toBeLessThan(15);
      expect(alpha(32,63)).toBeLessThan(15);
      expect(alpha(32,32)).toBeGreaterThan(90);
      expect(alpha(32,32)).toBeLessThan(255);
      expect(a.colorSpace).toBe(THREE.SRGBColorSpace);
    }finally{a.dispose();b.dispose();}
  });

  it('keeps all pooled fire casts bounded without additive overexposure',()=>{
    const scene=new THREE.Scene(),state=newCombatState();
    const vfx=new CombatVisual(scene,state);
    try{
      const flight=newFlightState();
      expect(castDragonFire(state,flight).ok).toBe(true);
      vfx.update(state,0,1/60);
      const plume=scene.getObjectByName('fx.dragon.fire-breath') as THREE.InstancedMesh;
      expect(plume.visible).toBe(true);
      expect(plume.count).toBe(54);
      const material=plume.material as THREE.MeshBasicMaterial;
      expect(material.map).toBeInstanceOf(THREE.DataTexture);
      expect(material.blending).toBe(THREE.NormalBlending);
      expect(material.opacity).toBeLessThan(.7);
      const matrix=new THREE.Matrix4();
      for(let i=0;i<plume.count;i++){
        plume.getMatrixAt(i,matrix);
        expect(matrix.elements.every(Number.isFinite)).toBe(true);
      }
      vfx.update(state,0.6,0.6);
      expect(plume.visible).toBe(false);
    }finally{vfx.dispose();}
  });
});
