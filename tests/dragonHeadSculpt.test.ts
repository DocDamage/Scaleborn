import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeSweptHorn } from '../src/actors/dragon/headSculpt';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';

describe('sculpted dragon face', () => {
  it('rejects bad horn stations and creates outward-facing, finite tapered geometry', () => {
    expect(() => makeSweptHorn([], .2)).toThrow();
    expect(() => makeSweptHorn([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 2, 0),
    ], 0)).toThrow();
    const geo = makeSweptHorn([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(.1, .4, .1),
      new THREE.Vector3(.3, .85, .3), new THREE.Vector3(.5, 1, .6),
    ], .18);
    const positions = geo.getAttribute('position');
    const normals = geo.getAttribute('normal');
    expect(positions.count).toBeGreaterThan(480);
    expect(geo.getAttribute('uv').count).toBe(positions.count);
    expect(geo.index!.count).toBeGreaterThan(2500);
    for (let i = 0; i < positions.count; i++) {
      expect([positions.getX(i), positions.getY(i), positions.getZ(i),
        normals.getX(i), normals.getY(i), normals.getZ(i)].every(Number.isFinite)).toBe(true);
    }
    const first = new THREE.Vector3().fromBufferAttribute(positions, 0);
    const last = new THREE.Vector3().fromBufferAttribute(positions, 30 * 17);
    const centerStart = new THREE.Vector3(0, 0, 0);
    const centerEnd = new THREE.Vector3(.5, 1, .6);
    expect(first.distanceTo(centerStart)).toBeGreaterThan(.14);
    expect(last.distanceTo(centerEnd)).toBeLessThan(.008);
    geo.dispose();
  });

  it('attaches mirrored swept horns and cheek spurs to the animated head across forms', () => {
    const dragon = new DragonVisual();
    try {
      const head = dragon.root.getObjectByName('head') as THREE.Group;
      const eye = head.getObjectByName('creature.dragon.eye.iris.left') as THREE.Mesh;
      const state = newFlightState();
      for (const form of ['small', 'rideable', 'giant'] as const) {
        state.form = form;
        state.time = 2;
        dragon.update(state);
        const open = eye.scale.y;
        state.time = 3.22;
        dragon.update(state);
        expect(eye.scale.y).toBeLessThan(open * .1);
        for (const part of ['horn', 'cheek-spur']) {
          for (const side of ['left', 'right']) {
            const mesh = head.getObjectByName(`creature.dragon.${part}.${side}`) as THREE.Mesh;
            expect(mesh.parent).toBe(head);
            expect(mesh.castShadow).toBe(true);
            mesh.geometry.computeBoundingBox();
            const box = mesh.geometry.boundingBox!;
            if (side === 'left') expect(box.max.x).toBeLessThan(0);
            else expect(box.min.x).toBeGreaterThan(0);
          }
        }
      }
    } finally { dragon.dispose(); }
  });
});
