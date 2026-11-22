import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MirrorfallCliffs } from '../src/world/mirrorfallCliffs';
import { PainterlyClouds } from '../src/world/painterlyClouds';
import { GRAND_LAKE, lakeBoundaryScale, lakeRadius } from '../src/world/highlandLake';

describe('Natural Mirrorfall environment rather than primitive props', () => {
  it('carves irregular coves and maintains one shared shoreline function', () => {
    expect(lakeBoundaryScale(0)).not.toBeCloseTo(lakeBoundaryScale(Math.PI/4),2);
    const x=GRAND_LAKE.x+GRAND_LAKE.radiusX*1.1,z=GRAND_LAKE.z;
    expect(Number.isFinite(lakeRadius(x,z))).toBe(true);
  });
  it('builds a continuous eroded cliff with many surface triangles', () => {
    const cliffs=new MirrorfallCliffs('low');
    try {
      const wall=cliffs.group.getObjectByName('terrain.azure.mirrorfall-eroded-strata');
      expect(wall).toBeInstanceOf(THREE.Mesh);
      const geo=(wall as THREE.Mesh).geometry as THREE.BufferGeometry;
      expect(geo.getAttribute('position').count).toBeGreaterThan(1000);
      expect(geo.index?.count).toBeGreaterThan(3000);
      // The waterfall gap is truly open geometry, not a transparent overlay.
      expect(geo.index!.count).toBeLessThan(52*35*6);
    } finally {cliffs.dispose();}
  });
  it('generates alpha-textured cloud wisps, not icosahedral blobs', () => {
    const scene=new THREE.Scene();
    const clouds=new PainterlyClouds(scene,'low');
    try {
      const sprites=clouds.root.children.filter(x=>x instanceof THREE.Sprite);
      expect(sprites).toHaveLength(0);
      clouds.update(12.5);
      const high = new PainterlyClouds(new THREE.Scene(), 'high');
      expect(high.root.children).toHaveLength(16);
      expect((high.root.children[0] as THREE.Sprite).material)
        .toBeInstanceOf(THREE.SpriteMaterial);
      high.dispose();
    } finally {clouds.dispose();}
  });
});
