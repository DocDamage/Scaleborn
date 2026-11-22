import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CombatVisual } from '../src/combat/visuals';
import { castDragonFire, newCombatState } from '../src/combat/combat';
import { newFlightState } from '../src/actors/dragon/flight';

describe('Gloam combat scene adapter', () => {
  it('renders original organic enemies and pooled visible flame without influencing hit math', () => {
    const scene = new THREE.Scene();
    const state = newCombatState();
    const visual = new CombatVisual(scene, state);
    try {
      const root = scene.getObjectByName('encounter.azure.gloam-den');
      expect(root).toBeDefined();
      for (const threat of state.hounds) {
        const mesh = scene.getObjectByName(threat.id);
        expect(mesh).toBeDefined();
        expect(mesh!.position.y).toBeCloseTo(threat.y, 5);
      }
      const plume = scene.getObjectByName('fx.dragon.fire-breath') as THREE.InstancedMesh;
      expect(plume.count).toBe(54);
      expect(plume.visible).toBe(false);
      expect(plume.instanceColor).not.toBeNull();
      const flight = newFlightState();
      expect(castDragonFire(state, flight).ok).toBe(true);
      visual.update(state, 0, 1 / 60);
      expect(plume.visible).toBe(true);
      for (let i = 0; i < plume.count; i++) {
        const matrix = new THREE.Matrix4();
        plume.getMatrixAt(i, matrix);
        expect(matrix.elements.every(Number.isFinite)).toBe(true);
      }
      visual.update(state, 0.7, 0.8);
      expect(plume.visible).toBe(false);
      expect(state.hp).toBe(100);
    } finally {
      visual.dispose();
      expect(scene.getObjectByName('encounter.azure.gloam-den')).toBeUndefined();
    }
  });

  it('telegraphs windup and decays defeated enemies without allocating new meshes', () => {
    const scene = new THREE.Scene(), c = newCombatState();
    const visual = new CombatVisual(scene, c);
    try {
      const first = c.hounds[0]!;
      first.windup = 0.4;
      visual.update(c, 1, 1 / 60);
      const target = scene.getObjectByName(first.id) as THREE.Group;
      expect(target.visible).toBe(true);
      const beforeChildren = target.children.length;
      first.hp = 0; first.deathAge = 0.9;
      visual.update(c, 2, 1 / 60);
      expect(target.visible).toBe(false);
      expect(target.children.length).toBe(beforeChildren);
    } finally {
      visual.dispose();
    }
  });
});
