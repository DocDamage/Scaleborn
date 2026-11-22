import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createDragonLegSculpt } from '../src/actors/dragon/limbSculpt';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';

describe('sculpted dragon limbs', () => {
  it('builds smooth curved surfaces with finite lit vertices and UVs', () => {
    const material = new THREE.MeshStandardMaterial();
    for (const front of [true, false]) {
      const sculpt = createDragonLegSculpt(front, material, material, material);
      const limb = sculpt.group.getObjectByName('creature.dragon.leg-surface') as THREE.Mesh;
      const paw = sculpt.foot.getObjectByName('creature.dragon.paw-surface') as THREE.Mesh;
      expect(limb.geometry.type).toBe('BufferGeometry');
      expect(limb.geometry.getAttribute('position').count).toBeGreaterThan(600);
      expect(limb.geometry.getAttribute('uv').count).toBe(limb.geometry.getAttribute('position').count);
      expect(paw.geometry.getAttribute('position').count).toBeGreaterThan(400);
      limb.geometry.computeBoundingBox();
      expect(limb.geometry.boundingBox!.max.y).toBeGreaterThan(.1);
      expect(limb.geometry.boundingBox!.min.y).toBeLessThan(-.6);
      for (const node of [limb, paw]) {
        const position = node.geometry.getAttribute('position');
        const normal = node.geometry.getAttribute('normal');
        for (let i = 0; i < position.count; i++) {
          expect([position.getX(i), position.getY(i), position.getZ(i),
            normal.getX(i), normal.getY(i), normal.getZ(i)]
            .every(Number.isFinite)).toBe(true);
        }
        node.geometry.dispose();
      }
      const claws = sculpt.foot.children.filter(o => o.name.startsWith('creature.dragon.claw.'));
      expect(claws).toHaveLength(3);
      for (const claw of claws) {
        const mesh = claw as THREE.Mesh;
        const positions = mesh.geometry.getAttribute('position');
        expect(positions.count).toBeGreaterThan(100);
        mesh.geometry.computeBoundingBox();
        expect(mesh.geometry.boundingBox!.min.z).toBeLessThan(-.54);
        mesh.geometry.dispose();
      }
    }
    material.dispose();
  });

  it('retains four independent hip sockets with articulated toes, no sphere or cone legs', () => {
    const dragon = new DragonVisual();
    for (const name of ['leg.frontLeft', 'leg.frontRight', 'leg.hindLeft', 'leg.hindRight']) {
      const group = dragon.root.getObjectByName(name) as THREE.Group;
      expect(group).toBeInstanceOf(THREE.Group);
      const ankle = group.getObjectByName('creature.dragon.ankle') as THREE.Group;
      expect(ankle).toBeInstanceOf(THREE.Group);
      expect(group.children.filter(o => o instanceof THREE.Mesh)).toHaveLength(1);
      group.traverse(o => {
        if (o instanceof THREE.Mesh) {
          expect(o.geometry).not.toBeInstanceOf(THREE.SphereGeometry);
          expect(o.geometry).not.toBeInstanceOf(THREE.ConeGeometry);
        }
      });
    }
    const state = newFlightState();
    state.mode = 'ground'; state.speed = 5; state.time = .3;
    dragon.update(state);
    const ankle = dragon.root.getObjectByName('leg.frontLeft')!
      .getObjectByName('creature.dragon.ankle')!;
    expect(Math.abs(ankle.rotation.x)).toBeGreaterThan(.001);
    state.speed = 0; state.time = .7;
    dragon.update(state);
    expect(ankle.rotation.x).toBe(0);
  });
  it('embeds paired shoulder roots inside the actual torso rather than exposing cap disks',()=>{
    const dragon=new DragonVisual();
    try {
      for (const side of ['Left','Right'] as const) {
        for(const position of ['front','hind'] as const) {
          const leg=dragon.root.getObjectByName('leg.'+position+side) as THREE.Group;
          const flesh=leg.getObjectByName('creature.dragon.leg-surface') as THREE.Mesh;
          expect(flesh).toBeInstanceOf(THREE.Mesh);
          const geo=flesh.geometry;
          const attr=geo.getAttribute('position');
          const first=attr.getX(0);
          // First root point curves inward, relative to the same old hip.
          const sign=side==='Left'?-1:1;
          const minX=leg.position.x + first;
          expect(minX*sign).toBeLessThan(.55);
          expect(attr.getY(0)).toBeGreaterThan(.2);
          const foot=leg.getObjectByName('creature.dragon.ankle') as THREE.Group;
          expect(foot).toBeInstanceOf(THREE.Group);
          expect(foot.position.y).toBeCloseTo(-.63,6);
        }
      }
    }finally{dragon.dispose();}
  });
});
