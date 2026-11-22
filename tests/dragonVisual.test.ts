import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState, requestDragonForm, stepFlight, toggleLanding } from '../src/actors/dragon/flight';
import { FORMS } from '../src/actors/dragon/forms';
import { heightAt } from '../src/world/terrain';

describe('procedural dragon model', () => {
  it('uses a deforming three-bone skin chain on each wing', () => {
    const dragon = new DragonVisual();
    for (const name of ['wing.left.membrane', 'wing.right.membrane']) {
      const mesh = dragon.root.getObjectByName(name);
      expect(mesh).toBeInstanceOf(THREE.SkinnedMesh);
      const skinned = mesh as THREE.SkinnedMesh;
      expect(skinned.skeleton.bones).toHaveLength(3);
      const weights = skinned.geometry.getAttribute('skinWeight');
      expect(weights.count).toBeGreaterThan(6);
      for (let i = 0; i < weights.count; i++) {
        expect(weights.getX(i) + weights.getY(i)).toBeCloseTo(1, 5);
      }
    }
  });
  it('animates an original Onyx foreleg claw sweep from combat metadata', () => {
    const dragon = new DragonVisual();
    const state = newFlightState();
    try {
      state.mode = 'ground'; state.speed = 0; state.pitch = 0; state.roll = 0;
      state.time = 10;
      dragon.update(state);
      const left = dragon.root.getObjectByName('leg.frontLeft') as THREE.Group;
      const right = dragon.root.getObjectByName('leg.frontRight') as THREE.Group;
      expect(left).toBeInstanceOf(THREE.Group);
      expect(right).toBeInstanceOf(THREE.Group);
      const initial = left.rotation.x;
      const cast = { id: 1, time: 10, form: 'rideable' as const,
        origin: { x: state.x, y: state.y, z: state.z },
        direction: { x: 0, z: -1 }, reach: 5.4 };
      state.time = 10.2;
      dragon.update(state, cast);
      expect(left.rotation.x).toBeLessThan(initial - .4);
      expect(right.rotation.x).toBeLessThan(initial - .2);
      expect(left.rotation.z).toBeLessThan(0);
      expect(right.rotation.z).toBeGreaterThan(0);
      state.time = 10.8;
      dragon.update(state, cast);
      expect(left.rotation.x).toBeCloseTo(initial, 5);
      expect(right.rotation.z).toBeCloseTo(0, 5);
    } finally { dragon.dispose(); }
  });

  it('keeps the rider normal-sized as the creature grows', () => {
    const dragon = new DragonVisual();
    const state = newFlightState();
    state.y = 220;
    dragon.update(state);
    expect(requestDragonForm(state, 'giant').ok).toBe(true);
    state.time += 1;
    dragon.update(state);
    expect(dragon.body.scale.x).toBeGreaterThan(FORMS.rideable.visualScale);
    expect(dragon.rider.scale.x).toBe(1);
    expect(dragon.rider.parent).toBe(dragon.root);
  });
  it('dismounts rider into scene space when controlled dragon becomes small', () => {
    const dragon = new DragonVisual();
    const scene = new THREE.Scene();
    dragon.attach(scene);
    const state = newFlightState();
    state.x = -555; state.z = 100;
    state.y = heightAt(state.x, state.z) + 13;
    expect(toggleLanding(state).ok).toBe(true);
    const idle = { turn: 0, pitch: 0, bank: 0, boost: false, flap: false, move: 0 };
    for (let i = 0; i < 90; i++) stepFlight(state, idle, 1 / 60);
    expect(requestDragonForm(state, 'small').ok).toBe(true);
    state.time = 1;
    dragon.update(state);
    expect(dragon.rider.parent).toBe(scene);
    expect(dragon.rider.position.x).toBe(state.riderX);
    expect(dragon.rider.scale.x).toBe(1);
    state.x = state.riderX; state.z = state.riderZ;
    expect(requestDragonForm(state, 'rideable').ok).toBe(true);
    state.time += 1;
    dragon.update(state);
    expect(dragon.rider.parent).toBe(dragon.root);
  });
});
