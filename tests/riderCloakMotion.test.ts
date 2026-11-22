import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeScalebornRider } from '../src/actors/rider/heroSculpt';
import { RiderCloakMotion } from '../src/actors/rider/cloakMotion';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';

describe('Scaleborn original heroine cloak motion', () => {
  it('pins the shoulder while the hem moves using one geometry buffer', () => {
    const rider = makeScalebornRider();
    const mesh = rider.getObjectByName('rider.travel-cloak') as THREE.Mesh;
    const cloak = new RiderCloakMotion(mesh);
    const attribute = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    const before = array.slice();
    cloak.update(3.7, 28);
    expect(attribute.array).toBe(array);
    for (let i = 0; i < 17 * 3; i++)
      expect(array[i]).toBeCloseTo(before[i]!, 7);
    expect(array[array.length - 1]).not.toBeCloseTo(before[before.length - 1]!, 4);
    expect(Array.from(array).every(Number.isFinite)).toBe(true);
    cloak.update(Number.NaN, Number.POSITIVE_INFINITY);
    expect(Array.from(array).every(Number.isFinite)).toBe(true);
    expect(mesh.geometry.getAttribute('normal').count).toBe(attribute.count);
    mesh.geometry.dispose();
  });

  it('updates the actual hybrid character without changing her size or sockets', () => {
    const model = new DragonVisual();
    const cloak = model.rider.getObjectByName('rider.travel-cloak') as THREE.Mesh;
    const attribute = cloak.geometry.getAttribute('position') as THREE.BufferAttribute;
    const original = Array.from(attribute.array);
    const state = newFlightState();
    try {
      state.form = 'rideable'; state.time = 2.1; state.speed = 30;
      model.update(state);
      expect(Array.from(attribute.array)).not.toEqual(original);
      expect(model.rider.scale.x).toBe(1);
      state.form = 'small'; state.riderSpeed = 5; state.time = 3.1;
      model.update(state);
      expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
      expect(model.rider.getObjectByName('rider.leftArm')).toBeInstanceOf(THREE.Group);
    } finally { model.dispose(); }
  });

  it('rejects unknown cloth topology instead of deforming arbitrary meshes', () => {
    const bad = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',
      new THREE.Float32BufferAttribute([0, 0, 0], 3)), new THREE.MeshStandardMaterial());
    expect(() => new RiderCloakMotion(bad)).toThrow('topology');
    bad.geometry.dispose();
    (bad.material as THREE.Material).dispose();
  });
});
