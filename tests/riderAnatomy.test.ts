import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeScalebornRider } from '../src/actors/rider/heroSculpt';
import { makeRiderFabricTextures } from '../src/actors/rider/riderFabric';

describe('original hybrid heroine second-pass anatomy and textiles', () => {
  it('keeps the original slender adolescent face with integrated cheeks and eye depth', () => {
    const rider = makeScalebornRider();
    try {
      const face=rider.getObjectByName('rider.face') as THREE.Mesh;
      expect(face).toBeInstanceOf(THREE.Mesh);
      expect(face.geometry.getAttribute('position').count).toBeGreaterThan(1200);
      expect(face.geometry.getAttribute('normal').count).toBe(
        face.geometry.getAttribute('position').count);
      for (const side of ['left','right']) {
        const eye=rider.getObjectByName('rider.eye.'+side) as THREE.Mesh;
        const iris=rider.getObjectByName('rider.iris.'+side) as THREE.Mesh;
        const horn=rider.getObjectByName('rider.horn.'+side) as THREE.Mesh;
        expect(eye.position.z).toBeGreaterThan(-.15);
        expect(iris.position.z).toBeLessThan(eye.position.z);
        expect(Math.abs(iris.position.z-eye.position.z)).toBeLessThan(.02);
        expect(horn).toBeInstanceOf(THREE.Mesh);
      }
      expect(rider.getObjectByName('rider.elf-ear')).toBeUndefined();
      expect(rider.userData.assetId).toBe('character.rider.hero');
    } finally {
      rider.traverse(node=>{if(node instanceof THREE.Mesh)node.geometry.dispose();});
    }
  });

  it('has actual elbows, knees, ankle pivots and slim original fabric parts', () => {
    const rider=makeScalebornRider();
    try {
      for (const side of ['left','right']) {
        const arm=rider.getObjectByName('rider.'+side+'Arm') as THREE.Group;
        const elbow=rider.getObjectByName('rider.'+side+'Elbow') as THREE.Group;
        const leg=rider.getObjectByName('rider.'+side+'Leg') as THREE.Group;
        const knee=rider.getObjectByName('rider.'+side+'Knee') as THREE.Group;
        const ankle=rider.getObjectByName('rider.'+side+'Ankle') as THREE.Group;
        expect(elbow.parent).toBe(arm);
        expect(knee.parent).toBe(leg);
        expect(ankle.parent).toBe(knee);
        expect(elbow.position.y).toBeLessThan(-.3);
        expect(knee.position.y).toBeLessThan(-.3);
        const hand=elbow.getObjectByName('rider.hand') as THREE.Mesh;
        const boot=ankle.getObjectByName('rider.boot') as THREE.Mesh;
        expect(hand.geometry.type).toBe('BufferGeometry');
        expect(boot.geometry.type).toBe('BufferGeometry');
        boot.geometry.computeBoundingBox();
        expect(boot.geometry.boundingBox!.max.x).toBeLessThan(.1);
      }
      const coat=rider.getObjectByName('rider.fitted-coat') as THREE.Mesh;
      const mat=coat.material as THREE.MeshStandardMaterial;
      expect(mat.map).toBeInstanceOf(THREE.DataTexture);
      expect(mat.normalMap).toBeInstanceOf(THREE.DataTexture);
      expect(mat.roughnessMap).toBeInstanceOf(THREE.DataTexture);
    } finally {
      rider.traverse(node=>{if(node instanceof THREE.Mesh)node.geometry.dispose();});
    }
  });

  it('creates deterministic bounded textile pixels and rejects invalid sizes', () => {
    expect(()=>makeRiderFabricTextures(0)).toThrow();
    expect(()=>makeRiderFabricTextures(300)).toThrow();
    const a=makeRiderFabricTextures(64),b=makeRiderFabricTextures(64);
    for (const key of ['color','normal','roughness'] as const) {
      const pixels=a[key].image.data as Uint8Array;
      expect(pixels.length).toBe(64*64*4);
      expect(Array.from(pixels).every(Number.isFinite)).toBe(true);
      expect(pixels).toEqual(b[key].image.data);
      a[key].dispose();b[key].dispose();
    }
  });
});
