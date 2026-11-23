import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { disposeTerrainTile, makeTerrainTile } from '../src/world/terrainTile';
import { tileSpec } from '../src/world/tileLod';

const surfaceMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
const foamMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.4 });
function surface(group: THREE.Group): THREE.BufferGeometry {
  const mesh = group.getObjectByName('terrain.azure.coast');
  if (!(mesh instanceof THREE.Mesh)) throw new Error('Terrain mesh missing');
  return mesh.geometry as THREE.BufferGeometry;
}

describe('procedural terrain geometry', () => {
  it('creates stitch-aligned vertices across a high/low boundary', () => {
    const a = makeTerrainTile(2, 0, tileSpec(0, 0, 2, 0), surfaceMaterial, foamMaterial);
    const b = makeTerrainTile(3, 0, tileSpec(0, 0, 3, 0), surfaceMaterial, foamMaterial);
    try {
      const high = surface(a.group).getAttribute('position');
      const low = surface(b.group).getAttribute('position');
      for (let k = 0; k <= 16; k++) {
        const fineVertex = (k * 4) * 65 + 64;
        const coarseVertex = k * 17;
        expect(high.getY(fineVertex)).toBeCloseTo(low.getY(coarseVertex), 4);
      }
    } finally {
      disposeTerrainTile(a.group);
      disposeTerrainTile(b.group);
    }
  });

  it('keeps boundary normals identical across high-to-low streamed terrain', () => {
    const highTile = makeTerrainTile(2, 0, tileSpec(0, 0, 2, 0), surfaceMaterial, foamMaterial);
    const lowTile = makeTerrainTile(3, 0, tileSpec(0, 0, 3, 0), surfaceMaterial, foamMaterial);
    try {
      const a = surface(highTile.group).getAttribute('normal');
      const b = surface(lowTile.group).getAttribute('normal');
      for (let k = 0; k <= 16; k++) {
        const highIndex = k * 4 * 65 + 64;
        const lowIndex = k * 17;
        for (const axis of ['X', 'Y', 'Z'] as const) {
          const read = axis === 'X' ? 'getX' : axis === 'Y' ? 'getY' : 'getZ';
          expect(a[read](highIndex)).toBeCloseTo(b[read](lowIndex), 5);
        }
      }
    } finally {
      disposeTerrainTile(highTile.group);
      disposeTerrainTile(lowTile.group);
    }
  });

  it('keeps boundary normals identical across matching-detail neighbors', () => {
    const aTile = makeTerrainTile(0, 0, tileSpec(0, 0, 0, 0), surfaceMaterial, foamMaterial);
    const bTile = makeTerrainTile(1, 0, tileSpec(0, 0, 1, 0), surfaceMaterial, foamMaterial);
    try {
      const a = surface(aTile.group).getAttribute('normal');
      const b = surface(bTile.group).getAttribute('normal');
      for (let k = 0; k <= 64; k++) {
        expect(a.getX(k * 65 + 64)).toBeCloseTo(b.getX(k * 65), 6);
        expect(a.getY(k * 65 + 64)).toBeCloseTo(b.getY(k * 65), 6);
        expect(a.getZ(k * 65 + 64)).toBeCloseTo(b.getZ(k * 65), 6);
      }
    } finally {
      disposeTerrainTile(aTile.group);
      disposeTerrainTile(bTile.group);
    }
  });

  it('creates deterministic vertex colors with natural coast categories', () => {
    const spec = tileSpec(-6, 0, -6, 0);
    const a = makeTerrainTile(-6, 0, spec, surfaceMaterial, foamMaterial);
    const b = makeTerrainTile(-6, 0, spec, surfaceMaterial, foamMaterial);
    try {
      const aColors = Array.from(surface(a.group).getAttribute('color').array);
      const bColors = Array.from(surface(b.group).getAttribute('color').array);
      expect(aColors).toEqual(bColors);
      expect(new Set(aColors.map((c) => c.toFixed(3))).size).toBeGreaterThan(1);
    } finally {
      disposeTerrainTile(a.group);
      disposeTerrainTile(b.group);
    }
  });

  it('makes foam ribbons only when a tile includes the sea-level contour', () => {
    const coast = makeTerrainTile(-6, 0, tileSpec(-6, 0, -6, 0), surfaceMaterial, foamMaterial);
    const inland = makeTerrainTile(-2, 0, tileSpec(-2, 0, -2, 0), surfaceMaterial, foamMaterial);
    try {
      expect(coast.group.getObjectByName('water.azure.shore-foam')).toBeDefined();
      expect(inland.group.getObjectByName('terrain.azure.coast')).toBeDefined();
    } finally {
      disposeTerrainTile(coast.group);
      disposeTerrainTile(inland.group);
    }
  });
});
