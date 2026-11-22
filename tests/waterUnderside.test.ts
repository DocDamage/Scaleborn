import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LakeShoreFoam, PainterlyWaterSurface, makeFoamShader } from '../src/world/waterSurface';
import { UnderwaterLightShafts } from '../src/world/underwaterLightShafts';
import { MirrorfallCascade } from '../src/world/mirrorfallCascade';

describe('submerged water-surface rendering contracts', () => {
  it('uses less opaque, tinted transmission when the camera is beneath water', () => {
    const lake = new PainterlyWaterSurface('lake');
    const ocean = new PainterlyWaterSurface('ocean');
    try {
      for (const surface of [lake, ocean]) {
        const material = surface.mesh.material as THREE.ShaderMaterial;
        expect(material.transparent).toBe(true);
        expect(material.depthWrite).toBe(false);
        expect(material.fragmentShader).toContain('cameraPosition.y-vScWorld.y');
        expect(material.fragmentShader).toContain('undersideAlpha');
        expect(material.fragmentShader).toContain('foam*=1.0-submergedView');
        expect(material.fragmentShader).toContain('mix(alpha,undersideAlpha,underside)');
      }
      expect(lake.mesh.position.y).toBeGreaterThan(ocean.mesh.position.y);
    } finally {
      lake.dispose();
      ocean.dispose();
    }
  });

  it('prevents surface-only shoreline foam from appearing below water', () => {
    const shore = new LakeShoreFoam();
    const seaFoam = makeFoamShader();
    try {
      const fragment = (shore.mesh.material as THREE.ShaderMaterial).fragmentShader;
      expect(fragment).toContain('cameraPosition.y < vWorld.y-.35');
      expect(fragment).toContain('discard;');
      expect(seaFoam.fragmentShader).toBe(fragment);
    } finally {
      shore.dispose();
      seaFoam.dispose();
    }
  });

  it('fades waterfall sheets into deep underwater fog instead of rendering full-bright', () => {
    const cascade = new MirrorfallCascade();
    try {
      const curtain = cascade.group.getObjectByName('water.azure.mirrorfall-curtain');
      expect(curtain).toBeInstanceOf(THREE.Mesh);
      const material = (curtain as THREE.Mesh).material as THREE.ShaderMaterial;
      expect(material.fog).toBe(true);
      expect(material.vertexShader).toContain('#include <fog_vertex>');
      expect(material.fragmentShader).toContain('#include <fog_fragment>');
    } finally {
      cascade.dispose();
    }
  });

  it('softens underwater shafts to prevent narrow bright laser-like lines', () => {
    const shafts = new UnderwaterLightShafts('low');
    try {
      expect(shafts.mesh.material.fragmentShader).toContain('1.65');
      expect(shafts.mesh.material.fragmentShader).toContain('clamp(alpha, 0.0, .12)');
      shafts.update(2.5, 0.5);
      expect(shafts.mesh.visible).toBe(true);
    } finally {
      shafts.dispose();
    }
  });
});
