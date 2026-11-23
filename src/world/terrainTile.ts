import * as THREE from 'three';
import { AZURE_SEED, SEA_LEVEL, heightAt } from './terrain';
import { fbm } from '../core/random';
import { GRAND_LAKE, lakeContains, lakeRadius, lakeShoreDistance } from './highlandLake';
import { stitchedHeight, TILE_METERS, type TileSpec } from './tileLod';
import { terrainUvAt } from './terrainUv';
import { heightfieldNormalAt, seamNormalWeight } from './terrainNormals';

const sand = new THREE.Color(0xc5b698);
const grass = new THREE.Color(0x668d61);
const forest = new THREE.Color(0x496e5b);
const stone = new THREE.Color(0x737c7d);
const schist = new THREE.Color(0x53636d);
const limestone = new THREE.Color(0x96938b);
const lichen = new THREE.Color(0x455c4b);
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
  else target.copy(forest).lerp(stone,
    Math.min(.72,Math.max(0,(h-118)/100)));
  // Freshwater lake and ocean have different bed color. The bathymetry
  // texture in waterSurface samples these same terrain heights.
  if (lakeContains(x,z) && h < GRAND_LAKE.surfaceY + 1) {
    const depth = Math.max(0, GRAND_LAKE.surfaceY - h);
    target.copy(sand).lerp(deep, Math.min(.92, depth / 54));
  }
  const lakeEdge = lakeShoreDistance(x,z);
  if (Math.abs(lakeEdge) < 17 && Math.abs(h-GRAND_LAKE.surfaceY)<11) {
    target.copy(sand).lerp(stone, .18 + Math.abs(wash)*.22);
  }

  // The steep Mirrorfall escarpment needs geological material, NOT grass.
  // Heightfield slope is sampled only around the rocky shoreline to keep
  // the entire procedural world fast to stream.
  const r=lakeRadius(x,z);
  const east=(x-GRAND_LAKE.x)/GRAND_LAKE.radiusX;
  const cliffZone=east>.38 && r>.94 && r<1.52 &&
    Math.abs(z-GRAND_LAKE.z)<330;
  let rockWeight=0;
  if(cliffZone) {
    const e=3.5;
    const gx=(heightAt(x+e,z)-heightAt(x-e,z))/(2*e);
    const gz=(heightAt(x,z+e)-heightAt(x,z-e))/(2*e);
    const slope=Math.hypot(gx,gz);
    const towardFall=Math.max(0,Math.min(1,(east-.38)/.39));
    const steep=Math.max(0,Math.min(1,(slope-.26)/.84));
    rockWeight=steep*towardFall;
    // Do not paint *every* high bank gray. Expose schist where the
    // actual local slope is steep, and leave walkable terraces grassy.
    if(h>GRAND_LAKE.surfaceY+9 && h<GRAND_LAKE.surfaceY+146) {
      rockWeight=Math.max(rockWeight,towardFall*steep*.90);
    }
  }
  if(rockWeight>.005) {
    const grain=fbm(x*.035+7.0,z*.047-4.0,AZURE_SEED+718,4);
    const seams=Math.sin(h*.29+grain*6.2)*.11;
    const mineral=Math.max(0,Math.min(1,.44+grain*.67+seams));
    const patina=fbm(x*.014,z*.018,AZURE_SEED+1999,3);
    const ledges=Math.abs(Math.sin(h*.112+patina*.63));
    const blend=Math.max(0,Math.min(1,rockWeight));
    temp.copy(schist).lerp(limestone,mineral*.75+.10);
    temp.lerp(lichen,Math.max(0,patina-.16)*.16*ledges);
    target.lerp(temp,blend);
  } else if (h > 9) {
    target.lerp(wash > 0 ? ochre : blueSage, Math.min(0.17, Math.abs(wash)*.28));
  }
  target.lerp(white,Math.max(0,variation)*.034);
  target.multiplyScalar(.93+variation*.15);
}

const groupWorldX = (tx: number, localX: number): number =>
  (tx + .5) * TILE_METERS + localX;
const groupWorldZ = (tz: number, localZ: number): number =>
  (tz + .5) * TILE_METERS + localZ;

type Point = { x: number; z: number; h: number };
function intersect(a: Point, b: Point): Point {
  const t = (SEA_LEVEL - a.h) / (b.h - a.h);
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, h: SEA_LEVEL };
}

/** A subtle quad strip following the coastline, not a rectangular alpha overlay. */
function coastlineFoam(points: Point[][]): THREE.BufferGeometry | null {
  const vertices: number[] = [];
  const uvs: number[] = [];
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
        // Sea surf and the water mesh share the same moving wave elevation.
        // Keep only a small depth-bias to avoid z-fighting, not the old
        // 0.73m high static foam shelf floating above every trough.
        const y = SEA_LEVEL + 0.08;
        vertices.push(
          a.x - ox, y, a.z - oz,
          a.x + ox, y, a.z + oz,
          b.x - ox, y, b.z - oz,
          b.x + ox, y, b.z + oz,
        );
        // UV.x tracks each piece's contour length; UV.y is the cross-shore
        // profile. The fragment shader tapers both edges rather than painting
        // a full-width opaque rectangle over water and land.
        uvs.push(0,0, 0,1, length * 0.075,0, length * 0.075,1);
        indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
      }
    }
  }
  if (vertices.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
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
  const texCoords = geometry.getAttribute('uv');
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
      const uv = terrainUvAt(wx, h, wz);
      texCoords.setXY(index, uv.u, uv.v);
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
  texCoords.needsUpdate = true;
  geometry.computeVertexNormals();
  // A per-tile triangle average cannot see neighboring triangles. That
  // creates hard lighting seams where the camera streams a different LOD.
  // Preserve triangle-derived interior normals, but converge to the same
  // collision-heightfield gradient at every shared tile boundary. The two
  // interior rings smooth the shading transition without extra geometry.
  const tileNormals = geometry.getAttribute('normal');
  for (let row = 0; row <= n; row++) {
    for (let col = 0; col <= n; col++) {
      const weight = seamNormalWeight(col, row, n);
      if (weight === 0) continue;
      const index = row * (n + 1) + col;
      const wx = (tx + col / n) * TILE_METERS;
      const wz = (tz + row / n) * TILE_METERS;
      const [nx, ny, nz] = heightfieldNormalAt(wx, wz);
      const ox = tileNormals.getX(index), oy = tileNormals.getY(index);
      const oz = tileNormals.getZ(index);
      const dx = ox * (1 - weight) + nx * weight;
      const dy = oy * (1 - weight) + ny * weight;
      const dz = oz * (1 - weight) + nz * weight;
      const inverseLength = 1 / Math.hypot(dx, dy, dz);
      tileNormals.setXYZ(index, dx * inverseLength,
        dy * inverseLength, dz * inverseLength);
    }
  }
  tileNormals.needsUpdate = true;
  // Alpine escarpments must remain stone even on the inexpensive renderer.
  // Shader-based slope blending covers high mode, vertex color acts as a
  // cheaper but physically grounded fallback for low / software WebGL.
  const normals=geometry.getAttribute('normal');
  const colorsAttr=geometry.getAttribute('color');
  const slate=new THREE.Color(0x738183);
  const darkStratum=new THREE.Color(0x475e65);
  const warmStratum=new THREE.Color(0x95988c);
  for(let i=0;i<normals.count;i++){
    const steep=1-Math.abs(normals.getY(i));
    const weather=Math.max(0,Math.min(1,(steep-.20)/.54));
    if(weather<.01)continue;
    temp.setRGB(colorsAttr.getX(i),colorsAttr.getY(i),colorsAttr.getZ(i));
    const worldX=groupWorldX(tx, positions.getX(i));
    const worldZ=groupWorldZ(tz, positions.getZ(i));
    const y=positions.getY(i);
    const bedding=.5+.5*Math.sin(y*.082+
      Math.sin(worldZ*.028+worldX*.013)*1.7);
    const variation=.04*Math.sin(worldX*.31+worldZ*.19);
    temp.lerp(slate,Math.min(.96,weather*.78+variation));
    temp.lerp(darkStratum,weather*(1-bedding)*.24);
    temp.lerp(warmStratum,weather*bedding*.19);
    colorsAttr.setXYZ(i,temp.r,temp.g,temp.b);
  }
  colorsAttr.needsUpdate=true;
  const group = new THREE.Group();
  group.position.set((tx + 0.5) * TILE_METERS, 0, (tz + 0.5) * TILE_METERS);
  group.name = 'terrain.azure.tile.' + tx + '.' + tz;
  const surface = new THREE.Mesh(geometry, terrainMaterial);
  surface.name = 'terrain.azure.coast';
  surface.receiveShadow = true;
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
