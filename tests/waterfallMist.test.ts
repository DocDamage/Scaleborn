import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WaterfallMist, makeWaterfallMistTexture } from '../src/world/waterfallMist';
import { GRAND_LAKE } from '../src/world/highlandLake';
import { MIRRORFALL_IMPACT } from '../src/world/waterDynamics';
import { MirrorfallCascade } from '../src/world/mirrorfallCascade';

describe('real-time drifting Mirrorfall waterfall plume', () => {
  it('uses a soft irregular atlas rather than opaque white discs', () => {
    const texture = makeWaterfallMistTexture();
    try {
      expect(texture.image.width).toBe(96);
      expect(texture.image.height).toBe(96);
      const bytes = texture.image.data as Uint8Array;
      const alpha = (x: number, y: number): number =>
        bytes[(y * 96 + x) * 4 + 3]!;
      expect(alpha(48, 48)).toBeGreaterThan(130);
      expect(alpha(0, 0)).toBe(0);
      expect(alpha(85, 48)).toBeLessThan(alpha(60, 48));
      expect(alpha(80, 48)).not.toBe(alpha(48, 80));
    } finally {texture.dispose();}
  });

  it('uses deterministic, finite outward-drifting wisps with fading lifetimes', () => {
    const mist = new WaterfallMist('low');
    const high = new WaterfallMist('high');
    try {
      expect(mist.count).toBe(16);
      expect(high.count).toBe(36);
      expect(mist.group.children).toHaveLength(16);
      const sprites = mist.group.children as THREE.Sprite[];
      expect(sprites.every(s => s.material.depthWrite === false)).toBe(true);
      expect(sprites.every(s => s.material.fog === true)).toBe(true);
      const map = (sprites[0]!.material as THREE.SpriteMaterial).map;
      expect(sprites.every(s => (s.material as THREE.SpriteMaterial).map === map))
        .toBe(true);
      mist.update(9.25);
      const positions = sprites.map(s => s.position.toArray());
      const opacities = sprites.map(
        s => (s.material as THREE.SpriteMaterial).opacity);
      expect(opacities.some(o => o > .03)).toBe(true);
      expect(opacities.some(o => o < .02)).toBe(true);
      for (const s of sprites) {
        expect([s.position.x, s.position.y, s.position.z]
          .every(Number.isFinite)).toBe(true);
        expect(s.position.x).toBeLessThan(MIRRORFALL_IMPACT.x + 2);
        expect(s.position.y).toBeGreaterThan(GRAND_LAKE.surfaceY - 2);
        expect(Math.hypot(s.position.x - MIRRORFALL_IMPACT.x,
          s.position.z - MIRRORFALL_IMPACT.z)).toBeLessThan(70);
        expect(s.scale.x).toBeGreaterThan(s.scale.y);
      }
      mist.update(4);
      mist.update(9.25);
      expect(sprites.map(s => s.position.toArray())).toEqual(positions);
      expect(sprites.map(s => (s.material as THREE.SpriteMaterial).opacity))
        .toEqual(opacities);
      mist.update(Number.NaN);
      expect(sprites.map(s => s.position.toArray())).toEqual(positions);
    } finally {mist.dispose();high.dispose();}
  });

  it('is owned and released by the active waterfall scene graph', () => {
    const cascade = new MirrorfallCascade('low');
    try {
      const plume = cascade.group.getObjectByName(
        'water.azure.mirrorfall-buoyant-mist')!;
      expect(plume.children).toHaveLength(16);
      cascade.update(6);
      expect(plume.children.some(s => (s as THREE.Sprite).position.y
        > GRAND_LAKE.surfaceY + 5)).toBe(true);
    } finally {cascade.dispose();}
  });
});
