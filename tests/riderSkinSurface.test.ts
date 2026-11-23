import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeScalebornRider } from '../src/actors/rider/heroSculpt';
import {
  makeRiderSkinMaterial, paintRiderSkinMaps,
} from '../src/actors/rider/riderSkinSurface';

describe('original heroine painterly skin maps',()=>{
  it('generates bounded, reproducible color/normal/roughness pixels',()=>{
    for(const invalid of [0,32,63,65,100,513,Infinity,Number.NaN]){
      expect(()=>paintRiderSkinMaps(invalid)).toThrow();
    }
    const a=paintRiderSkinMaps(64),b=paintRiderSkinMaps(64);
    try{
      for(const kind of ['color','normal','roughness'] as const){
        const pixels=a[kind].image.data as Uint8Array;
        expect(pixels.length).toBe(64*64*4);
        expect(pixels).toEqual(b[kind].image.data);
        expect(a[kind].wrapS).toBe(THREE.RepeatWrapping);
        expect(a[kind].wrapT).toBe(THREE.RepeatWrapping);
        expect(a[kind].generateMipmaps).toBe(true);
        expect(a[kind].minFilter).toBe(THREE.LinearMipmapLinearFilter);
      }
      const pigment=a.color.image.data as Uint8Array;
      expect(a.color.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(a.normal.colorSpace).toBe(THREE.NoColorSpace);
      const samples=new Set<number>();
      for(let i=0;i<pigment.length;i+=4){
        expect(pigment[i+3]).toBe(255);
        samples.add(pigment[i]!);
      }
      expect(samples.size).toBeGreaterThan(8);
    }finally{
      for(const kind of ['color','normal','roughness'] as const){
        a[kind].dispose();b[kind].dispose();
      }
    }
  });

  it('uses one shared matte, non-metallic original pigment atlas',()=>{
    const first=makeRiderSkinMaterial(),second=makeRiderSkinMaterial();
    try{
      expect(first.map).toBeInstanceOf(THREE.DataTexture);
      expect(first.normalMap).toBeInstanceOf(THREE.DataTexture);
      expect(first.roughnessMap).toBeInstanceOf(THREE.DataTexture);
      expect(first.map).toBe(second.map);
      expect(first.normalMap).toBe(second.normalMap);
      expect(first.metalness).toBe(0);
      expect(first.roughness).toBeGreaterThan(.82);
      expect(first.normalScale.length()).toBeLessThan(.25);
    }finally{
      first.dispose();second.dispose();
    }
  });

  it('renders the existing child face, hands and neck with sampled skin',()=>{
    const rider=makeScalebornRider();
    try{
      const face=rider.getObjectByName('rider.face') as THREE.Mesh;
      const neck=rider.getObjectByName('rider.neck') as THREE.Mesh;
      const hand=rider.getObjectByName('rider.hand') as THREE.Mesh;
      for(const object of [face,neck,hand]){
        expect(object).toBeInstanceOf(THREE.Mesh);
        const material=object.material as THREE.MeshStandardMaterial;
        expect(material.map).toBeInstanceOf(THREE.DataTexture);
        expect(material.normalMap).toBeInstanceOf(THREE.DataTexture);
        expect(material.roughnessMap).toBeInstanceOf(THREE.DataTexture);
        const uv=object.geometry.getAttribute('uv');
        expect(uv.count).toBe(object.geometry.getAttribute('position').count);
        expect(object.material).toBe(face.material);
      }
      expect(rider.userData.assetId).toBe('character.rider.hero');
      expect(rider.getObjectByName('rider.horn.left')).toBeDefined();
      expect(rider.scale.x).toBe(1);
    }finally{
      rider.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
    }
  });
});
