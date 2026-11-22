import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GRAND_LAKE, lakeContains } from '../src/world/highlandLake';
import {
  AIR_FOG_DENSITY, underwaterOpticsAt,
} from '../src/world/underwaterOptics';
import { UnderwaterLightShafts } from '../src/world/underwaterLightShafts';

describe('camera-depth-driven underwater rendering', () => {
  it('interpolates through the actual lens waterline and never tints land', () => {
    const x = GRAND_LAKE.x, z = GRAND_LAKE.z;
    const inactive = underwaterOpticsAt(x, GRAND_LAKE.surfaceY - 30, z, false);
    const air = underwaterOpticsAt(x, GRAND_LAKE.surfaceY + 2, z, true);
    const entering = underwaterOpticsAt(x, GRAND_LAKE.surfaceY - .7, z, true);
    const submerged = underwaterOpticsAt(x, GRAND_LAKE.surfaceY - 3, z, true);
    expect(inactive.medium).toBe('air');
    expect(air.immersion).toBe(0);
    expect(air.fogDensity).toBe(AIR_FOG_DENSITY);
    expect(entering.immersion).toBeGreaterThan(0);
    expect(entering.immersion).toBeLessThan(1);
    expect(submerged.immersion).toBe(1);
    expect(submerged.medium).toBe('lake');
    expect(submerged.shaftStrength).toBeGreaterThan(0);
  });

  it('makes deep freshwater darker and more turbid without blacking out exploration', () => {
    const x = GRAND_LAKE.x, z = GRAND_LAKE.z;
    const shallow = underwaterOpticsAt(x, GRAND_LAKE.surfaceY - 8, z, true);
    const deep = underwaterOpticsAt(x, GRAND_LAKE.surfaceY - 127, z, true);
    expect(deep.depth).toBe(127);
    expect(deep.fogDensity).toBeGreaterThan(shallow.fogDensity);
    expect(deep.lightTransmission).toBeLessThan(shallow.lightTransmission);
    expect(deep.lightTransmission).toBeGreaterThan(.35);
    expect(deep.shaftStrength).toBe(0);
    expect(shallow.shaftStrength).toBeGreaterThan(.7);
    expect(deep.tint).toBeInstanceOf(THREE.Color);
    expect(deep.tint.equals(shallow.tint)).toBe(false);
  });

  it('keeps sea and lake absorption independent and rejects invalid coordinates', () => {
    const ocean = underwaterOpticsAt(1900, -18, 1900, true);
    const lake = underwaterOpticsAt(GRAND_LAKE.x,
      GRAND_LAKE.surfaceY - 18, GRAND_LAKE.z, true);
    expect(ocean.medium).toBe('ocean');
    expect(ocean.shaftStrength).toBe(0);
    expect(ocean.fogDensity).toBeGreaterThan(lake.fogDensity);
    expect(underwaterOpticsAt(Number.NaN, -2, 0, true).immersion).toBe(0);
  });

  it('draws only depth-faded crossed shafts inside the actual freshwater boundary', () => {
    const low = new UnderwaterLightShafts('low');
    const high = new UnderwaterLightShafts('high');
    try {
      const p = low.mesh.geometry.getAttribute('position');
      expect(p.count).toBeGreaterThan(1000);
      expect(high.mesh.geometry.getAttribute('position').count).toBeGreaterThan(p.count);
      expect(low.mesh.geometry.getAttribute('aBeamSeed').count).toBe(p.count);
      for (let i = 0; i < p.count; i += 53) {
        expect(lakeContains(p.getX(i), p.getZ(i))).toBe(true);
        expect(p.getY(i)).toBeLessThan(GRAND_LAKE.surfaceY);
        expect(p.getY(i)).toBeGreaterThan(GRAND_LAKE.surfaceY - 60);
      }
      expect(low.mesh.material.transparent).toBe(true);
      expect(low.mesh.material.depthWrite).toBe(false);
      expect(low.mesh.visible).toBe(false);
      low.update(12.5, .8);
      expect(low.mesh.visible).toBe(true);
      expect(low.mesh.material.uniforms.uTime?.value).toBe(12.5);
      expect(low.mesh.material.uniforms.uStrength?.value).toBe(.8);
      low.update(13, 0);
      expect(low.mesh.visible).toBe(false);
    } finally {
      low.dispose();
      high.dispose();
    }
  });
});
