import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState, requestDragonForm, toggleLanding } from '../src/actors/dragon/flight';
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
