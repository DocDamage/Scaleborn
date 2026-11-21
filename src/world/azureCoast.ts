import * as THREE from 'three';
import { TILE_METERS, TILE_RADIUS, specKey, tileSpec } from './tileLod';
import { makeTerrainTile, disposeTerrainTile } from './terrainTile';
import { addCoastalDressing } from './dressing';
import { PainterlyOcean } from './ocean';
import { PainterlySky } from './sky';
import { addMarineDressing } from './marineDressing';

type TerrainTile = { group: THREE.Group; signature: string };

/** Seam-aware streaming, explicit disposal and a shader-based painterly sea. */
export class AzureCoast {
  private tiles = new Map<string, TerrainTile>();
  private lastTileX = Number.NaN;
  private lastTileZ = Number.NaN;
  private readonly terrainMaterial = new THREE.MeshLambertMaterial({
    vertexColors: true, flatShading: false, side: THREE.DoubleSide,
  });
  private readonly foamMaterial = new THREE.MeshBasicMaterial({
    color: 0xccece7, transparent: true, opacity: 0.63,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  private readonly water = new PainterlyOcean();
  private readonly sky = new PainterlySky();
  private readonly airFog = new THREE.FogExp2(0xb6cbd4, 0.00055);
  private readonly seaFog = new THREE.FogExp2(0x1b5866, 0.012);
  private readonly airBackground = new THREE.Color(0xc4d9df);
  private readonly seaBackground = new THREE.Color(0x1b5866);
  private underwater = false;
  readonly scene: THREE.Scene;
  readonly ocean: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.background = this.airBackground;
    scene.fog = this.airFog;
    scene.add(new THREE.HemisphereLight(0xbde7ee, 0x716251, 2.2));
    const sun = new THREE.DirectionalLight(0xffd3a5, 2.0);
    sun.position.set(-420, 600, -520);
    scene.add(sun);
    this.ocean = this.water.mesh;
    scene.add(this.sky.mesh, this.ocean);
    addCoastalDressing(scene);
    addMarineDressing(scene);
  }

  update(x: number, z: number): void {
    const ix = Math.floor(x / TILE_METERS);
    const iz = Math.floor(z / TILE_METERS);
    if (ix === this.lastTileX && iz === this.lastTileZ) return;
    this.lastTileX = ix;
    this.lastTileZ = iz;
    const required = new Set<string>();
    for (let dz = -TILE_RADIUS; dz <= TILE_RADIUS; dz++) {
      for (let dx = -TILE_RADIUS; dx <= TILE_RADIUS; dx++) {
        const tx = ix + dx, tz = iz + dz;
        const key = tx + ':' + tz;
        required.add(key);
        const spec = tileSpec(ix, iz, tx, tz);
        const signature = specKey(spec);
        const previous = this.tiles.get(key);
        if (previous?.signature === signature) continue;
        if (previous) this.remove(key, previous);
        const { group } = makeTerrainTile(
          tx, tz, spec, this.terrainMaterial, this.foamMaterial,
        );
        this.scene.add(group);
        this.tiles.set(key, { group, signature });
      }
    }
    for (const [key, tile] of this.tiles) {
      if (!required.has(key)) this.remove(key, tile);
    }
  }

  setUnderwater(active: boolean): void {
    if (active === this.underwater) return;
    this.underwater = active;
    this.scene.fog = active ? this.seaFog : this.airFog;
    this.scene.background = active ? this.seaBackground : this.airBackground;
    this.sky.mesh.visible = !active;
  }

  animate(time: number, x: number, y: number, z: number): void {
    this.water.update(time);
    this.sky.moveWithCamera(x, y, z);
  }

  tileCount(): number {
    return this.tiles.size;
  }

  private remove(key: string, tile: TerrainTile): void {
    this.scene.remove(tile.group);
    disposeTerrainTile(tile.group);
    this.tiles.delete(key);
  }

  dispose(): void {
    for (const [key, tile] of this.tiles) this.remove(key, tile);
    this.terrainMaterial.dispose();
    this.foamMaterial.dispose();
    this.water.dispose();
    this.sky.dispose();
  }
}
