import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeRiderContour } from '../src/actors/rider/contour';
import { RiderVisual } from '../src/actors/rider/visual';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';

describe('articulated rider silhouette', () => {
  it('rejects invalid vertical contours, closes the ends and faces outwards', () => {
    expect(() => makeRiderContour([])).toThrow();
    expect(() => makeRiderContour([
      { y: 1, x: 0, z: 0, radiusX: .2, radiusZ: .2 },
      { y: 0, x: 0, z: 0, radiusX: .2, radiusZ: .2 },
    ])).toThrow();
    const geo = makeRiderContour([
      { y: 0, x: 0, z: 0, radiusX: .15, radiusZ: .17 },
      { y: 1, x: 0, z: 0, radiusX: .26, radiusZ: .20 },
      { y: 2, x: 0, z: 0, radiusX: .13, radiusZ: .11 },
    ]);
    const p = geo.getAttribute('position'), n = geo.getAttribute('normal');
    expect(geo.index!.count).toBeGreaterThan(1000);
    expect(geo.getAttribute('uv').count).toBe(p.count);
    expect(n.getX(5 * 25)).toBeGreaterThan(.7);
    for (let i = 0; i < p.count; i++) {
      expect([p.getX(i), p.getY(i), p.getZ(i),
        n.getX(i), n.getY(i), n.getZ(i)].every(Number.isFinite)).toBe(true);
    }
    geo.dispose();
  });

  it('uses tapered cloth and articulated limbs rather than primitive body beads', () => {
    const r = new RiderVisual();
    for (const name of ['rider.torso', 'rider.coat',
      'rider.sleeve-left', 'rider.sleeve-right',
      'rider.trouser-left', 'rider.trouser-right',
      'rider.horn-left', 'rider.horn-right']) {
      const mesh = r.group.getObjectByName(name);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      const geo = (mesh as THREE.Mesh).geometry;
      expect(geo.getAttribute('uv').count).toBeGreaterThan(50);
      expect(geo.index!.count).toBeGreaterThan(200);
    }
    expect(r.group.getObjectByName('rider.leftArm')).toBeInstanceOf(THREE.Group);
    expect(r.group.getObjectByName('rider.rightLeg')).toBeInstanceOf(THREE.Group);
    expect(r.group.getObjectByName('rider.elf-ear')).toBeUndefined();
  });

  it('pins cape shoulder vertices while animating bounded finite cloth folds', () => {
    const r = new RiderVisual();
    const cape = r.group.getObjectByName('rider.cloak') as THREE.Mesh;
    expect(cape).toBeInstanceOf(THREE.Mesh);
    const geo = cape.geometry;
    const before = (geo.getAttribute('position').array as Float32Array).slice();
    r.updateCape(2.4, 24);
    const after = geo.getAttribute('position').array as Float32Array;
    for (let i = 0; i < 13 * 3; i++) expect(after[i]).toBeCloseTo(before[i]!, 6);
    expect(after[after.length - 1]).not.toBeCloseTo(before[before.length - 1]!, 4);
    expect(Array.from(after).every(Number.isFinite)).toBe(true);
    r.updateCape(Number.NaN, Number.POSITIVE_INFINITY);
    expect(Array.from(after).every(Number.isFinite)).toBe(true);
    expect((geo.getAttribute('normal') as THREE.BufferAttribute).count)
      .toBe(geo.getAttribute('position').count);
  });

  it('keeps rider scale and limb sockets stable in the dragon visual', () => {
    const dragon = new DragonVisual();
    const state = newFlightState();
    dragon.update(state);
    expect(dragon.rider.scale.x).toBe(1);
    expect(dragon.rider.getObjectByName('rider.travel-cloak')).toBeInstanceOf(THREE.Mesh);
    state.form = 'small';
    state.time = 1;
    dragon.update(state);
    expect(dragon.rider.getObjectByName('rider.leftArm')).toBeInstanceOf(THREE.Group);
    expect(dragon.rider.scale.x).toBe(1);
  });
});
