import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { paintWingMembraneMaps, makeWingMembraneMaterial } from '../src/actors/dragon/wingSurface';
import { createWingRig, poseWing, wingMembraneSectionAt } from '../src/actors/dragon/wingRig';
import { newFlightState } from '../src/actors/dragon/flight';
import { dragonPose } from '../src/actors/dragon/animationPose';

describe('Onyx PBR painted wing membranes',()=>{
  it('bakes distinct albedo/roughness/normal maps at bounded resolutions',()=>{
    const maps=paintWingMembraneMaps(64);
    try{
      for(const texture of [maps.color,maps.normal,maps.roughness]){
        expect(texture).toBeInstanceOf(THREE.DataTexture);
        expect(texture.image.width).toBe(64);
        expect(texture.image.height).toBe(64);
        expect(texture.wrapS).toBe(THREE.RepeatWrapping);
        expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
      }
      expect(maps.color.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(maps.normal.colorSpace).toBe(THREE.NoColorSpace);
      expect(maps.roughness.colorSpace).toBe(THREE.NoColorSpace);
      const rough=maps.roughness.image.data as Uint8Array;
      expect(new Set(Array.from(rough.filter((_,i)=>i%4===0))).size)
        .toBeGreaterThan(30);
      const normals=maps.normal.image.data as Uint8Array;
      expect(Array.from(normals).some((b,i)=>i%4===0&&b!==128)).toBe(true);
      expect(()=>paintWingMembraneMaps(32)).toThrow();
      expect(()=>paintWingMembraneMaps(129)).toThrow();
    }finally{Object.values(maps).forEach(t=>t.dispose());}
  });
  it('has restrained, light-responsive iridescence without replacing Onyx pigmentation',()=>{
    const maps=paintWingMembraneMaps(64);
    const mat=makeWingMembraneMaterial(maps);
    try{
      expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
      expect(mat.vertexColors).toBe(true);
      expect(mat.side).toBe(THREE.DoubleSide);
      expect(mat.iridescence).toBeGreaterThan(0);
      expect(mat.iridescence).toBeLessThan(.5);
      expect(mat.sheen).toBeGreaterThan(0);
      expect(mat.map).toBe(maps.color);
      expect(mat.normalMap).toBe(maps.normal);
      expect(mat.roughnessMap).toBe(maps.roughness);
      expect(mat.normalScale.x).toBeLessThan(.5);
    }finally{mat.dispose();Object.values(maps).forEach(t=>t.dispose());}
  });

  it('keeps tapered, five-bay original wing outline continuous and positive',()=>{
    const samples=Array.from({length:201},(_,i)=>wingMembraneSectionAt(i/200));
    for(const part of samples){
      expect(Number.isFinite(part.front+part.rear+part.chord)).toBe(true);
      expect(part.chord).toBeGreaterThan(.025);
      expect(part.rear).toBeGreaterThan(part.front);
    }
    expect(samples[200]!.chord).toBeLessThan(.04);
    expect(samples[150]!.chord).toBeGreaterThan(samples[200]!.chord*8);
    let fingerBays=0;
    for(let i=20;i<180;i++){
      const a=samples[i-1]!.chord,b=samples[i]!.chord,c=samples[i+1]!.chord;
      if(b<a&&b<c&&b<samples[i-7]!.chord*.92)fingerBays++;
    }
    expect(fingerBays).toBeGreaterThanOrEqual(3);
    expect(()=>wingMembraneSectionAt(Number.NaN)).toThrow();
    expect(()=>wingMembraneSectionAt(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('preserves deforming three-bone membranes and animation under the material',()=>{
    const rig=createWingRig(1);
    try{
      const mat=rig.mesh.material as THREE.MeshPhysicalMaterial;
      expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
      expect(mat.map).toBeInstanceOf(THREE.DataTexture);
      expect(rig.mesh.skeleton.bones).toHaveLength(3);
      expect(rig.mesh.geometry.getAttribute('color').count)
        .toBe(rig.mesh.geometry.getAttribute('position').count);
      const state=newFlightState();
      state.time=1.7;
      poseWing(rig,1,dragonPose(state));
      expect(Number.isFinite(rig.elbow.rotation.z)).toBe(true);
      expect(rig.mesh.frustumCulled).toBe(false);
    }finally{rig.mesh.geometry.dispose();}
  });
});
