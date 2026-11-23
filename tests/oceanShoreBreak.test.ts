import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeFoamShader, LakeShoreFoam } from '../src/world/waterSurface';
import { disposeTerrainTile, makeTerrainTile } from '../src/world/terrainTile';
import { SEA_LEVEL } from '../src/world/terrain';
import { tileSpec } from '../src/world/tileLod';

describe('wave-aligned ocean shoreline foam', () => {
  it('moves both sea and lake surf with the same four wind waves as the water mesh', () => {
    const ocean=makeFoamShader();
    const lake=new LakeShoreFoam();
    try {
      const fresh=lake.mesh.material as THREE.ShaderMaterial;
      for (const mat of [ocean,fresh]) {
        expect(mat.vertexShader).toContain('world.y += .53*sin(w1)');
        expect(mat.vertexShader).toContain('.24*sin(w2)');
        expect(mat.vertexShader).toContain('.10*sin(w3)');
        expect(mat.vertexShader).toContain('.64*sin(w4)');
        expect(mat.vertexShader).toContain('world.x += .16*cos(w1)');
        expect(mat.vertexShader).toContain('world.z += .12*cos(w1)');
        expect(mat.fragmentShader).toContain('coastalFade*(');
        expect(mat.fragmentShader).toContain('cameraPosition.y < vWorld.y-.35');
        expect(mat.depthWrite).toBe(false);
      }
      expect(ocean.uniforms.uLakeStrip!.value).toBe(0);
      expect(fresh.uniforms.uLakeStrip!.value).toBe(1);
      expect(ocean.vertexShader).toContain('if (uLakeStrip > 0.5)');
      expect(ocean.fragmentShader).toContain('oceanCrest');
    } finally {
      ocean.dispose();
      lake.dispose();
    }
  });

  it('provides a smoothly fading two-sided surf profile on streamed sea contours', () => {
    const ground=new THREE.MeshLambertMaterial({vertexColors:true});
    const foam=new THREE.MeshBasicMaterial();
    const tile=makeTerrainTile(-6,0,tileSpec(-6,0,-6,0),ground,foam);
    try {
      const surf=tile.group.getObjectByName('water.azure.shore-foam');
      expect(surf).toBeInstanceOf(THREE.Mesh);
      if (!(surf instanceof THREE.Mesh)) throw new Error('Missing shoreline');
      const geometry=surf.geometry as THREE.BufferGeometry;
      const pos=geometry.getAttribute('position');
      const uv=geometry.getAttribute('uv');
      expect(uv.count).toBe(pos.count);
      expect(pos.count).toBeGreaterThan(0);
      for(let i=0;i<pos.count;i++){
        expect(pos.getY(i)).toBeCloseTo(SEA_LEVEL+.08,4);
        expect(Number.isFinite(uv.getX(i))).toBe(true);
        expect(uv.getY(i)).toBe(i%4===0||i%4===2?0:1);
      }
    } finally {
      disposeTerrainTile(tile.group);
      ground.dispose();
      foam.dispose();
    }
  });
});
