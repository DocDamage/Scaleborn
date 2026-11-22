import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DragonVisual } from '../src/actors/dragon/visual';
import { makeOrganicLoft } from '../src/actors/dragon/organicLoft';
import { createWingRig } from '../src/actors/dragon/wingRig';

describe('continuous dragon silhouette geometry', () => {
  it('makes an indexed, closed UV loft with finite lit normals and tapered ends', () => {
    const sections = [
      { z:-2, y:.2, width:.1, height:.2 },
      { z:-1, y:.1, width:.8, height:.6 },
      { z:1, y:-.1, width:.7, height:.5 },
      { z:2, y:0, width:.08, height:.11 },
    ];
    const geometry=makeOrganicLoft(sections,24,6);
    try {
      const positions=geometry.getAttribute('position');
      const uv=geometry.getAttribute('uv');
      const normals=geometry.getAttribute('normal');
      expect(positions.count).toBeGreaterThan(450);
      expect(uv.count).toBe(positions.count);
      expect(normals.count).toBe(positions.count);
      expect(geometry.index!.count).toBeGreaterThan(2000);
      for(let i=0;i<positions.count;i++){
        expect([positions.getX(i),positions.getY(i),positions.getZ(i),
          normals.getX(i),normals.getY(i),normals.getZ(i)]
          .every(Number.isFinite)).toBe(true);
      }
      // Section +X vertices must point out, not into the body.
      expect(normals.getX(9*25)).toBeGreaterThan(.5);
    } finally {geometry.dispose();}
  });

  it('rejects zero-sized and unordered cross-sections', () => {
    expect(()=>makeOrganicLoft([{z:1,y:0,width:1,height:1}])).toThrow();
    expect(()=>makeOrganicLoft([
      {z:1,y:0,width:1,height:1},{z:0,y:0,width:1,height:1},
    ])).toThrow();
    expect(()=>makeOrganicLoft([
      {z:0,y:0,width:0,height:1},{z:1,y:0,width:1,height:1},
    ])).toThrow();
  });

  it('exposes continuous torso/tail surfaces instead of body bead chains', () => {
    const dragon=new DragonVisual();
    for(const name of ['creature.dragon.torso','creature.dragon.tail-surface']){
      const mesh=dragon.root.getObjectByName(name);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      const geometry=(mesh as THREE.Mesh).geometry;
      expect(geometry.getAttribute('uv').count).toBeGreaterThan(200);
      expect(geometry.index!.count).toBeGreaterThan(1000);
      const material=(mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
      expect(material.normalMap).toBeInstanceOf(THREE.DataTexture);
    }
  });
});

describe('cambered dragon wing membranes', () => {
  it('has continuous subdivided geometry and normalized bone weights on both sides', () => {
    for (const side of [-1,1] as const) {
      const rig=createWingRig(side);
      const positions=rig.mesh.geometry.getAttribute('position');
      const normals=rig.mesh.geometry.getAttribute('normal');
      const weights=rig.mesh.geometry.getAttribute('skinWeight');
      expect(positions.count).toBeGreaterThan(500);
      expect(rig.mesh.geometry.index!.count).toBeGreaterThan(2500);
      expect(rig.mesh.geometry.getAttribute('uv').count).toBe(positions.count);
      for(let i=0;i<positions.count;i++){
        expect(weights.getX(i)+weights.getY(i)).toBeCloseTo(1,5);
        expect([positions.getX(i),positions.getY(i),positions.getZ(i),
          normals.getX(i),normals.getY(i),normals.getZ(i)]
          .every(Number.isFinite)).toBe(true);
      }
      const spar=rig.shoulder.children.find(c=>c instanceof THREE.Mesh);
      expect(spar).toBeDefined();
      expect(Math.sign(spar!.position.x)).toBe(side);
    }
  });
});
