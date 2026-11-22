import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GRAND_LAKE } from '../src/world/highlandLake';
import { heightAt } from '../src/world/terrain';
import { terrainUvAt } from '../src/world/terrainUv';
import { makeTerrainTile, disposeTerrainTile } from '../src/world/terrainTile';
import { tileSpec } from '../src/world/tileLod';

describe('Mirrorfall erosion and continuous terrain projection', () => {
  it('projects cliff grain vertically and ordinary grass horizontally', () => {
    const x=GRAND_LAKE.x+GRAND_LAKE.radiusX*1.19;
    const z=GRAND_LAKE.z+42;
    const height=heightAt(x,z);
    const cliff=terrainUvAt(x,height,z);
    const meadow=terrainUvAt(-900,50,-200);
    expect(cliff.cliffBlend).toBeGreaterThan(.6);
    expect(meadow.cliffBlend).toBe(0);
    expect(meadow.u).toBeCloseTo(-900/13);
    expect(meadow.v).toBeCloseTo(-200/13);
    expect(cliff.u).not.toBeCloseTo(x/13,1);
    expect(Number.isFinite(cliff.v)).toBe(true);
  });

  it('uses the same world UVs at neighboring tile seams regardless of LOD', () => {
    // Tile edges share their world position, so a 64:16 LOD transition
    // cannot produce the former per-tile 0..1 texture discontinuity.
    const x=250,z=560,y=heightAt(x,z);
    const fromWest=terrainUvAt(x,y,z);
    const fromEast=terrainUvAt(x,y,z);
    expect(fromWest).toEqual(fromEast);
    const originX=-2, originZ=2;
    const nearSpec=tileSpec(originX,originZ,0,2);
    const farSpec=tileSpec(originX,originZ,1,2);
    expect(nearSpec.segments).toBe(64);
    expect(farSpec.segments).toBe(16);
    const near=makeTerrainTile(0,2,nearSpec,
      new THREE.MeshBasicMaterial(),new THREE.MeshBasicMaterial());
    const far=makeTerrainTile(1,2,farSpec,
      new THREE.MeshBasicMaterial(),new THREE.MeshBasicMaterial());
    try {
      const meshA=near.group.getObjectByName('terrain.azure.coast') as THREE.Mesh;
      const meshB=far.group.getObjectByName('terrain.azure.coast') as THREE.Mesh;
      const a=meshA.geometry.getAttribute('uv');
      const b=meshB.geometry.getAttribute('uv');
      const posA=meshA.geometry.getAttribute('position');
      const posB=meshB.geometry.getAttribute('position');
      // Check matching border endpoints in projected world-space.
      const widthA=nearSpec.segments;
      const widthB=farSpec.segments;
      for(const row of [0,Math.floor(widthA/2),widthA]){
        const colA=row*(widthA+1)+widthA;
        const rowB=row/widthA*widthB;
        const colB=rowB*(widthB+1);
        expect(posA.getY(colA)).toBeCloseTo(posB.getY(colB),4);
        expect(a.getX(colA)).toBeCloseTo(b.getX(colB),4);
        expect(a.getY(colA)).toBeCloseTo(b.getY(colB),4);
      }
    } finally {
      disposeTerrainTile(near.group);
      disposeTerrainTile(far.group);
    }
  });

  it('retains traversable steep rock with smooth lake and outer terrain transitions', () => {
    const cx=GRAND_LAKE.x, cz=GRAND_LAKE.z;
    const r=(radius:number)=>heightAt(cx+radius*GRAND_LAKE.radiusX,cz+88);
    expect(r(1.18)).toBeGreaterThan(GRAND_LAKE.surfaceY+30);
    expect(Math.abs(r(1.72)-r(1.725))).toBeLessThan(10);
    const edgeA=r(1.0),edgeB=r(1.005);
    expect(Math.abs(edgeA-edgeB)).toBeLessThan(16);
  });
});
