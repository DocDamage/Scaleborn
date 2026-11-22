import * as THREE from 'three';
import { TILE_METERS, TILE_RADIUS, specKey, tileSpec } from './tileLod';
import { makeTerrainTile, disposeTerrainTile } from './terrainTile';
import { addCoastalDressing } from './dressing';
import { PainterlyWaterSurface, LakeShoreFoam, makeFoamShader } from './waterSurface';
import { MirrorfallCascade } from './mirrorfallCascade';
import { PainterlyNature } from './painterlyNature';
import { PainterlyClouds } from './painterlyClouds';
import { MirrorfallCliffs } from './mirrorfallCliffs';
import { makeTerrainMaterial } from './materials';
import { PainterlySky } from './sky';
import { addMarineDressing } from './marineDressing';
import { TidegateVisual } from './tidegateVisual';
import { TidalEchoVisual } from './tidalEchoVisual';
import type { EchoPhase } from './tidalEcho';
import type { TidegateState } from './tidegate';

type TerrainTile = { group: THREE.Group; signature: string };

/** Seam-aware streaming, explicit disposal and a shader-based painterly sea. */
export class AzureCoast {
  private tiles = new Map<string, TerrainTile>();
  private lastTileX = Number.NaN;
  private lastTileZ = Number.NaN;
  private readonly terrainMaterial: THREE.MeshStandardMaterial;
  private readonly foamMaterial = makeFoamShader();
  private readonly water = new PainterlyWaterSurface('ocean');
  private readonly lake = new PainterlyWaterSurface('lake');
  private readonly lakeFoam = new LakeShoreFoam();
  private readonly waterfall = new MirrorfallCascade();
  private readonly nature: PainterlyNature;
  private readonly clouds: PainterlyClouds;
  private readonly cliffs: MirrorfallCliffs;
  private readonly sky = new PainterlySky();
  private readonly tidegate = new TidegateVisual();
  private readonly echoVisual = new TidalEchoVisual();
  private readonly airFog = new THREE.FogExp2(0xb6cbd4, 0.00038);
  private readonly seaFog = new THREE.FogExp2(0x1b5866, 0.012);
  private readonly airBackground = new THREE.Color(0xc4d9df);
  private readonly seaBackground = new THREE.Color(0x1b5866);
  private underwater = false;
  readonly scene: THREE.Scene;
  readonly ocean: THREE.Mesh;

  constructor(scene: THREE.Scene, quality: 'high' | 'low' = 'high') {
    this.terrainMaterial = makeTerrainMaterial(quality);
    this.scene = scene;
    scene.background = this.airBackground;
    scene.fog = this.airFog;
    scene.add(new THREE.HemisphereLight(0xbde7ee, 0x716251, 1.4));
    const sun = new THREE.DirectionalLight(0xffd3a5, 2.1);
    sun.position.set(-420, 600, -520);
    scene.add(sun);
    this.ocean = this.water.mesh;
    scene.add(this.sky.mesh, this.ocean, this.lake.mesh, this.lakeFoam.mesh, this.waterfall.group);
    this.nature = new PainterlyNature(scene, quality);
    this.clouds = new PainterlyClouds(scene, quality);
    this.cliffs = new MirrorfallCliffs(quality);
    scene.add(this.cliffs.group);
    addCoastalDressing(scene, false);
    addMarineDressing(scene);
    scene.add(this.tidegate.root, this.echoVisual.root);
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

  updateTidegate(state: TidegateState, time: number, echoAttuned = false): void {
    this.tidegate.update(state, time, echoAttuned);
  }

  updateEcho(phase: EchoPhase, time: number): void {
    this.echoVisual.update(phase, time);
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
    this.lake.update(time);
    this.lakeFoam.update(time);
    this.waterfall.update(time);
    this.nature.update(time);
    this.clouds.update(time);
    this.foamMaterial.uniforms.uTime!.value=time;
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
    this.lake.dispose();
    this.lakeFoam.dispose();
    this.waterfall.dispose();
    this.nature.dispose();
    this.clouds.dispose();
    this.cliffs.dispose();
    this.sky.dispose();
    this.echoVisual.dispose();
  }
}
