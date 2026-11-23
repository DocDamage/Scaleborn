import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DragonVisual } from '../src/actors/dragon/visual';
import { loftDragon, ONYX_HEAD, ONYX_TORSO } from '../src/actors/dragon/organicSculpt';
import { onyxSurfaceOffset } from '../src/actors/dragon/onyxSurfaceAnatomy';
import { newFlightState } from '../src/actors/dragon/flight';

describe('Onyx anatomical silhouette and breathing', () => {
  it('sculpts the cheek, eye orbit, chest keel and scapulae into continuous skin', () => {
    expect(onyxSurfaceOffset('skull', -.43, .94, -.3).x).toBeGreaterThan(.05);
    expect(onyxSurfaceOffset('skull', -.35, .95, .32).x).toBeLessThan(.04);
    expect(onyxSurfaceOffset('torso', -.94, 1, 0).x).toBeGreaterThan(.065);
    expect(onyxSurfaceOffset('torso', -.57, 0, -1).y).toBeLessThan(-.08);
    for (const z of [-1, -.5, .1]) {
      const right = onyxSurfaceOffset('skull', z, .9, -.3);
      const left = onyxSurfaceOffset('skull', z, -.9, -.3);
      expect(left.x).toBeCloseTo(-right.x, 8);
      expect(left.y).toBeCloseTo(right.y, 8);
    }
    expect(() => onyxSurfaceOffset('skull', NaN, 0, 1)).toThrow();
  });

  it('keeps both updated high resolution surfaces outward and finite', () => {
    for (const [sections, region] of [
      [ONYX_HEAD, 'skull'], [ONYX_TORSO, 'torso'],
    ] as const) {
      const geometry = loftDragon(sections, 70, 36, region);
      try {
        const position = geometry.getAttribute('position');
        const normal = geometry.getAttribute('normal');
        expect(position.count).toBeGreaterThan(2500);
        expect(normal.count).toBe(position.count);
        for (let i = 0; i < position.count; i++) {
          expect([position.getX(i),position.getY(i),position.getZ(i),
            normal.getX(i),normal.getY(i),normal.getZ(i)].every(Number.isFinite)).toBe(true);
        }
        // Outward-facing ring normals, preserving mirrored anatomy.
        expect(normal.getX(35 * 37)).toBeGreaterThan(.3);
      } finally { geometry.dispose(); }
    }
  });

  it('animates a bounded torso morph while keeping all three form scales unchanged', () => {
    const dragon = new DragonVisual();
    const torso = dragon.root.getObjectByName('creature.dragon.onyx.anatomical-torso') as THREE.Mesh;
    const state = newFlightState();
    try {
      expect(torso.geometry.morphAttributes.position).toHaveLength(1);
      expect(torso.morphTargetInfluences).toHaveLength(1);
      const base = torso.geometry.getAttribute('position');
      const inhale = torso.geometry.morphAttributes.position![0]!;
      expect(inhale.getX(60*41)).toBeGreaterThan(base.getX(60*41));
      state.time = 1; dragon.update(state);
      const a = torso.morphTargetInfluences![0]!;
      state.time = 2; dragon.update(state);
      const b = torso.morphTargetInfluences![0]!;
      expect(Math.abs(a-b)).toBeGreaterThan(.04);
      expect(Math.min(a,b)).toBeGreaterThanOrEqual(0);
      expect(Math.max(a,b)).toBeLessThanOrEqual(.75);
      expect(dragon.rider.scale.x).toBe(1);
      expect(dragon.body.scale.x).toBeGreaterThan(0);
    } finally { dragon.dispose(); }
  });
});
