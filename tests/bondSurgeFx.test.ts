import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeBondSurgePatchGeometry, makeBondSurgePatchTexture } from '../src/combat/bondSurgeFx';
import { newCombatState, castBondSurge } from '../src/combat/combat';
import { CombatVisual } from '../src/combat/visuals';
import { newFlightState } from '../src/actors/dragon/flight';
import { FORMS } from '../src/actors/dragon/forms';
import { heightAt } from '../src/world/terrain';

describe('painterly ground-hugging Bond Surge effect', () => {
  it('uses a feathered alpha patch with no hard borders or white opaque shards', () => {
    for (const invalid of [0, 16, 256, 64.5, Number.NaN])
      expect(() => makeBondSurgePatchTexture(invalid)).toThrow();
    const texture = makeBondSurgePatchTexture(64);
    try {
      expect(texture.image.width).toBe(64);
      expect(texture.image.height).toBe(64);
      expect(texture.generateMipmaps).toBe(true);
      const bytes = texture.image.data as Uint8Array;
      const alpha = (x:number,y:number):number => bytes[(y*64+x)*4+3]!;
      expect(alpha(0,0)).toBe(0);
      expect(alpha(0,32)).toBe(0);
      expect(alpha(63,31)).toBe(0);
      expect(alpha(32,32)).toBeGreaterThan(100);
      expect(alpha(32,32)).toBeLessThan(255);
      expect(alpha(24,32)).not.toBe(alpha(32,24));
    } finally { texture.dispose(); }
  });

  it('keeps every effect vertex on the terrain plane rather than pointing into the sky', () => {
    const geometry = makeBondSurgePatchGeometry();
    try {
      const p = geometry.getAttribute('position');
      expect(p.count).toBe(4);
      for (let i=0;i<p.count;i++) {
        expect(p.getY(i)).toBeCloseTo(0,6);
      }
      expect(geometry.index!.count).toBe(6);
    } finally { geometry.dispose(); }
  });

  it('stays low, local, finite, and does not brighten via additive blending', () => {
    const scene = new THREE.Scene(), combat = newCombatState();
    const visual = new CombatVisual(scene, combat);
    try {
      const flight = newFlightState();
      flight.mode='ground'; flight.form='small';
      flight.x=-446;flight.z=-52;
      flight.y=heightAt(flight.x,flight.z)+FORMS.small.standHeight;
      flight.controlTarget='rider';
      flight.riderX=flight.x+1.5;flight.riderZ=flight.z;
      flight.riderY=heightAt(flight.riderX,flight.riderZ)+.05;
      flight.riderMode='ground';
      expect(castBondSurge(combat,flight).ok).toBe(true);
      visual.update(combat,flight.time,1/60);
      const mesh = scene.getObjectByName('fx.bond.surge') as THREE.InstancedMesh;
      const material=mesh.material as THREE.MeshBasicMaterial;
      expect(mesh.count).toBe(36);
      expect(mesh.visible).toBe(true);
      expect(material.map).toBeInstanceOf(THREE.DataTexture);
      expect(material.blending).toBe(THREE.NormalBlending);
      expect(material.opacity).toBeLessThan(.6);
      expect(mesh.instanceColor).not.toBeNull();
      const position = new THREE.Vector3();
      const matrix = new THREE.Matrix4();
      for(let i=0;i<mesh.count;i++){
        mesh.getMatrixAt(i,matrix);
        expect(matrix.elements.every(Number.isFinite)).toBe(true);
        position.setFromMatrixPosition(matrix);
        expect(position.y-heightAt(position.x,position.z)).toBeGreaterThan(0);
        expect(position.y-heightAt(position.x,position.z)).toBeLessThan(.4);
        expect(Math.hypot(position.x-combat.lastBond!.x,position.z-combat.lastBond!.z))
          .toBeLessThanOrEqual(combat.lastBond!.radius+1);
      }
      visual.update(combat,.8,.8);
      expect(mesh.visible).toBe(false);
    }finally{visual.dispose();}
  });
});
