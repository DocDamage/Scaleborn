import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CombatVisual } from '../src/combat/visuals';
import { castDragonFire, castRiderSigil, castBondSurge, newCombatState } from '../src/combat/combat';
import { heightAt } from '../src/world/terrain';
import { FORMS } from '../src/actors/dragon/forms';
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
      first.alert = true;
      visual.update(c, 1, 1 / 60);
      const target = scene.getObjectByName(first.id) as THREE.Group;
      expect(target.visible).toBe(true);
      const beforeChildren = target.children.length;
      const health = scene.getObjectByName(first.id + '.vitality') as THREE.Group;
      expect(health.visible).toBe(true);
      expect(health.children).toHaveLength(2);
      const fill = health.children[1] as THREE.Sprite;
      first.hp = first.maxHp / 2;
      visual.update(c, 1.1, 1 / 60);
      expect(fill.scale.x).toBeCloseTo(1.14, 4);
      first.hp = 0; first.deathAge = 0.9;
      visual.update(c, 2, 1 / 60);
      expect(target.visible).toBe(false);
      expect(target.children.length).toBe(beforeChildren);
    } finally {
      visual.dispose();
    }
  });
  it('uses bounded reusable rider sigil and two-character surge geometry', () => {
    const scene = new THREE.Scene(), c = newCombatState();
    const visual = new CombatVisual(scene, c);
    try {
      const flight = newFlightState();
      flight.x = -446; flight.z = -52;
      flight.form = 'small'; flight.mode = 'ground';
      flight.y = heightAt(flight.x, flight.z) + FORMS.small.standHeight;
      flight.controlTarget = 'rider';
      flight.riderX = flight.x + 2; flight.riderZ = flight.z;
      flight.riderY = heightAt(flight.riderX, flight.riderZ) + 0.05;
      flight.riderYaw = Math.PI / 2; flight.riderMode = 'ground';
      expect(castRiderSigil(c, flight).ok).toBe(true);
      expect(castBondSurge(c, flight).ok).toBe(true);
      visual.update(c, flight.time, 1 / 60);
      const sigil = scene.getObjectByName('fx.rider.tidal-sigil') as THREE.InstancedMesh;
      const bond = scene.getObjectByName('fx.bond.surge') as THREE.InstancedMesh;
      expect(sigil.visible).toBe(true);
      expect(bond.visible).toBe(true);
      expect(sigil.count).toBe(21);
      expect(bond.count).toBe(36);
      for (const pool of [sigil, bond]) {
        for (let i = 0; i < pool.count; i++) {
          const matrix = new THREE.Matrix4();
          pool.getMatrixAt(i, matrix);
          expect(matrix.elements.every(Number.isFinite)).toBe(true);
        }
      }
      visual.update(c, 1, 1);
      expect(sigil.visible).toBe(false);
      expect(bond.visible).toBe(false);
    } finally {
      visual.dispose();
    }
  });

});
