import * as THREE from 'three';
import { AZURE_SEED, SEA_LEVEL } from './terrain';
import { fbm } from '../core/random';
import { GRAND_LAKE, lakeShoreDistance } from './highlandLake';
import { stitchedHeight, TILE_METERS, type TileSpec } from './tileLod';

const sand = new THREE.Color(0xc5b698);
const grass = new THREE.Color(0x668d61);
const forest = new THREE.Color(0x496e5b);
const stone = new THREE.Color(0x737c7d);
const deep = new THREE.Color(0x376c79);
const ochre = new THREE.Color(0xb9a57c);
const blueSage = new THREE.Color(0x6e9c95);
const temp = new THREE.Color();
const white = new THREE.Color(0xffffff);

/** Elevation and painted-noise blend; no external texture required. */
function paintTerrain(x: number, z: number, h: number, target: THREE.Color): void {
  const variation = fbm(x * 0.011, z * 0.011, AZURE_SEED + 631, 3);
  const wash = fbm(x * 0.0032, z * 0.0032, AZURE_SEED + 137, 4);
  if (h < -3) target.copy(deep);
  else if (h < 8) target.copy(sand);
  else if (h < 32) target.copy(sand).lerp(grass, Math.min(1, (h - 8) / 24));
  else if (h < 88) target.copy(grass).lerp(forest, Math.min(1, (h - 32) / 56));
  else target.copy(forest).lerp(stone, Math.min(1, (h - 88) / 45));
  if (Math.abs(lakeShoreDistance(x,z)) < 18 && Math.abs(h-GRAND_LAKE.surfaceY)<10) {
    target.copy(sand).lerp(stone, .26 + Math.abs(wash)*.21);
  }
  if (h > 9) target.lerp(wash > 0 ? ochre : blueSage, Math.min(0.24, Math.abs(wash) * 0.42));
  target.lerp(white, Math.max(0, variation) * 0.06);
  target.multiplyScalar(0.95 + variation * 0.14);
}

type Point = { x: number; z: number; h: number };
function intersect(a: Point, b: Point): Point {
  const t = (SEA_LEVEL - a.h) / (b.h - a.h);
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, h: SEA_LEVEL };
}

/** A subtle quad strip following the coastline, not a rectangular alpha overlay. */
function coastlineFoam(points: Point[][]): THREE.BufferGeometry | null {
  const vertices: number[] = [];
  const indices: number[] = [];
  const n = points.length - 1;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const p00 = points[row]?.[col];
      const p10 = points[row]?.[col + 1];
      const p11 = points[row + 1]?.[col + 1];
      const p01 = points[row + 1]?.[col];
      if (!p00 || !p10 || !p11 || !p01) continue;
      const edges: Array<[Point, Point]> = [
        [p00, p10], [p10, p11], [p11, p01], [p01, p00],
      ];
      const crossings: Point[] = [];
      for (const [a, b] of edges) {
        if ((a.h < SEA_LEVEL) !== (b.h < SEA_LEVEL)) crossings.push(intersect(a, b));
      }
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        const a = crossings[k], b = crossings[k + 1];
        if (!a || !b) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const length = Math.hypot(dx, dz);
        if (length < 0.0001) continue;
        const halfWidth = 2.4;
        const ox = -dz / length * halfWidth;
        const oz = dx / length * halfWidth;
        const start = vertices.length / 3;
        const y = SEA_LEVEL + 0.73;
        vertices.push(
          a.x - ox, y, a.z - oz,
          a.x + ox, y, a.z + oz,
          b.x - ox, y, b.z - oz,
          b.x + ox, y, b.z + oz,
        );
        indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
      }
    }
  }
  if (vertices.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export interface TileGeometry {
  group: THREE.Group;
  geometryCount: number;
}

export function makeTerrainTile(
  tx: number, tz: number, spec: TileSpec,
  terrainMaterial: THREE.Material, foamMaterial: THREE.Material,
): TileGeometry {
  const n = spec.segments;
  const geometry = new THREE.PlaneGeometry(TILE_METERS, TILE_METERS, n, n);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const points: Point[][] = [];
  for (let row = 0; row <= n; row++) {
    const line: Point[] = [];
    for (let col = 0; col <= n; col++) {
      const index = row * (n + 1) + col;
      const wx = (tx + col / n) * TILE_METERS;
      const wz = (tz + row / n) * TILE_METERS;
      const h = stitchedHeight(tx, tz, col, row, spec);
      positions.setY(index, h);
      paintTerrain(wx, wz, h, temp);
      colors[index * 3] = temp.r;
      colors[index * 3 + 1] = temp.g;
      colors[index * 3 + 2] = temp.b;
      // Foam geometry is tile-local, as are all positions.
      line.push({ x: col / n * TILE_METERS - TILE_METERS / 2,
        z: row / n * TILE_METERS - TILE_METERS / 2, h });
    }
    points.push(line);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  // Alpine escarpments must remain stone even on the inexpensive renderer.
  // Shader-based slope blending covers high mode, vertex color acts as a
  // cheaper but physically grounded fallback for low / software WebGL.
  const normals=geometry.getAttribute('normal');
  const colorsAttr=geometry.getAttribute('color');
  const slate=new THREE.Color(0x65787b);
  for(let i=0;i<normals.count;i++){
    const steep=1-Math.abs(normals.getY(i));
    const weather=Math.max(0,Math.min(1,(steep-.20)/.54));
    if(weather<.01)continue;
    temp.setRGB(colorsAttr.getX(i),colorsAttr.getY(i),colorsAttr.getZ(i));
    const variation=0.04*Math.sin(i*7.13);
    temp.lerp(slate,Math.min(.96,weather*.89+variation));
    colorsAttr.setXYZ(i,temp.r,temp.g,temp.b);
  }
  colorsAttr.needsUpdate=true;
  const group = new THREE.Group();
  group.position.set((tx + 0.5) * TILE_METERS, 0, (tz + 0.5) * TILE_METERS);
  group.name = 'terrain.azure.tile.' + tx + '.' + tz;
  const surface = new THREE.Mesh(geometry, terrainMaterial);
  surface.name = 'terrain.azure.coast';
  group.add(surface);
  const foam = coastlineFoam(points);
  if (foam) {
    const ribbon = new THREE.Mesh(foam, foamMaterial);
    ribbon.name = 'water.azure.shore-foam';
    ribbon.renderOrder = 2;
    group.add(ribbon);
  }
  return { group, geometryCount: foam ? 2 : 1 };
}

export function disposeTerrainTile(group: THREE.Group): void {
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) node.geometry.dispose();
  });
}
