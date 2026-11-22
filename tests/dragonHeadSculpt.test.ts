import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { sculptDragonHead, makeSweptHorn } from '../src/actors/dragon/headSculpt';
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

  it('uses two lofted facial surfaces, curved symmetric horns, eyes and mouth detail', () => {
    const parent = new THREE.Group();
    const material = new THREE.MeshStandardMaterial();
    const head = sculptDragonHead(parent, {
      skin: material, highlight: material, ridges: material,
      iris: material, pupil: material, glimmer: material,
    });
    expect(head.eyes).toHaveLength(2);
    for (const name of ['creature.dragon.skull', 'creature.dragon.lower-jaw',
      'creature.dragon.horn.left', 'creature.dragon.horn.right',
      'creature.dragon.cheek-spur.left', 'creature.dragon.cheek-spur.right']) {
      const mesh = parent.getObjectByName(name) as THREE.Mesh;
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(200);
      expect(mesh.geometry.getAttribute('uv').count)
        .toBe(mesh.geometry.getAttribute('position').count);
      expect(mesh.castShadow).toBe(true);
    }
    const leftHorn = parent.getObjectByName('creature.dragon.horn.left') as THREE.Mesh;
    const rightHorn = parent.getObjectByName('creature.dragon.horn.right') as THREE.Mesh;
    leftHorn.geometry.computeBoundingBox();
    rightHorn.geometry.computeBoundingBox();
    expect(leftHorn.geometry.boundingBox!.max.x).toBeLessThan(0);
    expect(rightHorn.geometry.boundingBox!.min.x).toBeGreaterThan(0);
    expect(parent.getObjectByName('creature.dragon.nostril.left')).toBeInstanceOf(THREE.Mesh);
    expect(parent.getObjectByName('creature.dragon.mouth-seam.right')).toBeInstanceOf(THREE.Mesh);
    parent.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    material.dispose();
  });

  it('preserves the head socket, movement and eyelid blink across forms', () => {
    const dragon = new DragonVisual();
    const head = dragon.root.getObjectByName('head') as THREE.Group;
    const left = head.getObjectByName('creature.dragon.eye.left') as THREE.Group;
    expect(head).toBeInstanceOf(THREE.Group);
    expect(left).toBeInstanceOf(THREE.Group);
    const state = newFlightState();
    state.time = 7.2;
    dragon.update(state);
    expect(left.scale.y).toBeLessThan(.2);
    state.time = 7.4;
    state.form = 'small';
    dragon.update(state);
    expect(left.scale.y).toBe(1);
    expect(head.position.z).toBeCloseTo(-1.83);
  });
});
