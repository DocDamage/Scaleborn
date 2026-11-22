import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PainterlyWaterSurface, LakeShoreFoam } from '../src/world/waterSurface';
import { MirrorfallCascade } from '../src/world/mirrorfallCascade';
import { GRAND_LAKE, MIRRORFALL } from '../src/world/highlandLake';
import { makeTerrainMaterial, makeRockMaterial, makeBarkMaterial } from '../src/world/materials';

describe('Mirrorfall visual systems contract', () => {
  it('uses curved, lit procedural terrain, rocks and bark rather than basic color meshes', () => {
    const all = [makeTerrainMaterial(),makeRockMaterial(),makeBarkMaterial()];
    try {
      for (const material of all) {
        expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
        expect(typeof material.onBeforeCompile).toBe('function');
        expect(material.roughness).toBeGreaterThan(0.75);
      }
      expect(all[0]!.vertexColors).toBe(true);
      for (const material of all) {
        expect(material.map).toBeInstanceOf(THREE.DataTexture);
        expect(material.normalMap).toBeInstanceOf(THREE.DataTexture);
        expect(material.roughnessMap).toBeInstanceOf(THREE.DataTexture);
      }
      expect(all[1]!.metalness).toBe(0);
    } finally { all.forEach(m=>m.dispose()); }
  });
  it('creates independent deep freshwater and ocean surfaces with real geometry', () => {
    const ocean=new PainterlyWaterSurface('ocean');
    const lake=new PainterlyWaterSurface('lake');
    const shore=new LakeShoreFoam();
    try {
      expect(lake.mesh.position.y).toBe(GRAND_LAKE.surfaceY);
      expect(ocean.mesh.position.y).toBe(0);
      expect(lake.mesh.geometry.getAttribute('position').count).toBeGreaterThan(10_000);
      expect(shore.mesh.geometry.getAttribute('position').count).toBeGreaterThan(4000);
      expect(lake.mesh.material).toBeInstanceOf(THREE.ShaderMaterial);
      const lakeShader=lake.mesh.material as THREE.ShaderMaterial;
      expect(lakeShader.uniforms.uBathymetry?.value)
        .toBeInstanceOf(THREE.DataTexture);
      const bathy=lakeShader.uniforms.uBathymetry?.value as THREE.DataTexture;
      expect(bathy.image.width).toBeGreaterThanOrEqual(128);
      expect(shore.mesh.geometry.getAttribute('uv').count)
        .toBe(shore.mesh.geometry.getAttribute('position').count);
      lake.update(12.5);
      expect((lake.mesh.material as THREE.ShaderMaterial).uniforms.uTime?.value).toBe(12.5);
    } finally {ocean.dispose();lake.dispose();shore.dispose();}
  });
  it('uses complete scene-fog uniforms for water and shoreline shader passes', () => {
    const ocean=new PainterlyWaterSurface('ocean');
    const lake=new PainterlyWaterSurface('lake');
    const shore=new LakeShoreFoam();
    try {
      const mats=[
        ocean.mesh.material,lake.mesh.material,shore.mesh.material,
      ] as THREE.ShaderMaterial[];
      for(const material of mats){
        expect(material.fog).toBe(true);
        expect(material.uniforms.fogColor?.value).toBeInstanceOf(THREE.Color);
        expect(material.uniforms.fogDensity?.value).toBeDefined();
        expect(material.vertexShader).toContain('#include <fog_vertex>');
        expect(material.vertexShader).toContain('mvPosition');
        expect(material.fragmentShader).toContain('#include <fog_fragment>');
      }
      lake.update(2.4);
      shore.update(2.4);
      expect(mats[1]!.uniforms.uTime?.value).toBe(2.4);
      expect(mats[2]!.uniforms.uTime?.value).toBe(2.4);
    } finally {ocean.dispose();lake.dispose();shore.dispose();}
  });
  it('renders waterfall sheets and gravity-driven impact droplets over the lake', () => {
    const fall=new MirrorfallCascade();
    try {
      const curtains:THREE.Object3D[]=[];
      fall.group.traverse(o=>{if(o.name==='water.azure.mirrorfall-curtain')curtains.push(o);});
      expect(curtains.length).toBe(3);
      expect(fall.group.getObjectByName('water.azure.mirrorfall-ballistic-spray'))
        .toBeInstanceOf(THREE.InstancedMesh);
      expect(MIRRORFALL.topY-MIRRORFALL.bottomY).toBeGreaterThan(95);
      fall.update(1.0);fall.update(1.05);
      const particles=fall.group.getObjectByName('water.azure.mirrorfall-ballistic-spray') as THREE.InstancedMesh;
      const matrix=new THREE.Matrix4();
      particles.getMatrixAt(0,matrix);
      const pos=new THREE.Vector3().setFromMatrixPosition(matrix);
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(pos.y).toBeGreaterThanOrEqual(GRAND_LAKE.surfaceY);
    } finally {fall.dispose();}
  });
});
