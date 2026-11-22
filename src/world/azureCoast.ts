import * as THREE from 'three';
import { TILE_METERS, TILE_RADIUS, specKey, tileSpec } from './tileLod';
import { makeTerrainTile, disposeTerrainTile } from './terrainTile';
import { addCoastalDressing } from './dressing';
import { PainterlyWaterSurface, LakeShoreFoam, makeFoamShader } from './waterSurface';
import { MirrorfallCascade } from './mirrorfallCascade';
import { LakeCaustics } from './lakeCaustics';
import { LakebedHabitat } from './lakebedHabitat';
import { UnderwaterLightShafts } from './underwaterLightShafts';
import { UnderwaterParticulates } from './underwaterParticulates';
import { underwaterOpticsAt } from './underwaterOptics';
import { PainterlyNature } from './painterlyNature';
import { LocalGroundcover } from './localGroundcover';
import { ShorelineReeds } from './shorelineReeds';
import { PainterlyClouds } from './painterlyClouds';
import { MirrorfallCliffs } from './mirrorfallCliffs';
import { CliffOutcrops } from './cliffOutcrops';
import { SurfaceWake } from './surfaceWake';
import { CreatureSplash } from './creatureSplash';
import type { FlightState } from '../actors/dragon/flight';
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
  private readonly water: PainterlyWaterSurface;
  private readonly lake: PainterlyWaterSurface;
  private readonly lakeFoam = new LakeShoreFoam();
  private readonly caustics: LakeCaustics;
  private readonly lakebed: LakebedHabitat;
  private readonly shafts: UnderwaterLightShafts;
  private readonly particulates: UnderwaterParticulates;
  private readonly waterfall: MirrorfallCascade;
  private readonly nature: PainterlyNature;
  private readonly nearGrass: LocalGroundcover;
  private readonly reeds: ShorelineReeds;
  private readonly clouds: PainterlyClouds;
  private readonly cliffs: MirrorfallCliffs;
  private readonly outcrops: CliffOutcrops;
  private readonly wake: SurfaceWake;
  private readonly splash: CreatureSplash;
  private readonly sky = new PainterlySky();
  private readonly sun = new THREE.DirectionalLight(0xffd3a5, 2.1);
  private readonly hemisphere: THREE.HemisphereLight;
  private readonly sunTarget = new THREE.Object3D();
  private readonly quality: 'high' | 'low';
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
    this.quality = quality;
    this.water = new PainterlyWaterSurface('ocean',quality);
    this.lake = new PainterlyWaterSurface('lake',quality);
    this.terrainMaterial = makeTerrainMaterial(quality);
    this.scene = scene;
    scene.background = this.airBackground;
    scene.fog = this.airFog;
    this.hemisphere = new THREE.HemisphereLight(0xbde7ee, 0x716251,
      quality === 'high' ? 1.17 : 1.4);
    scene.add(this.hemisphere);
    this.sun.position.set(-420,600,-520);
    this.sun.castShadow = quality === 'high';
    if (this.sun.castShadow) {
      this.sun.shadow.mapSize.set(2048,2048);
      this.sun.shadow.camera.left=-215;
      this.sun.shadow.camera.right=215;
      this.sun.shadow.camera.top=215;
      this.sun.shadow.camera.bottom=-215;
      this.sun.shadow.camera.near=1;
      this.sun.shadow.camera.far=1500;
      this.sun.shadow.bias=-0.00017;
      this.sun.shadow.normalBias=0.052;
      this.sun.shadow.blurSamples=5;
    }
    this.sun.target=this.sunTarget;
    scene.add(this.sun,this.sunTarget);
    this.ocean = this.water.mesh;
    this.caustics = new LakeCaustics(quality);
    this.lakebed = new LakebedHabitat(scene,quality);
    this.shafts = new UnderwaterLightShafts(quality);
    this.particulates = new UnderwaterParticulates(scene, quality);
    this.waterfall = new MirrorfallCascade(quality);
    scene.add(this.sky.mesh, this.ocean, this.caustics.mesh, this.shafts.mesh,
      this.lake.mesh, this.lakeFoam.mesh, this.waterfall.group);
    if (this.water.midMesh) scene.add(this.water.midMesh);
    if (this.water.nearMesh) scene.add(this.water.nearMesh);
    this.nature = new PainterlyNature(scene, quality);
    this.nearGrass = new LocalGroundcover(scene, quality);
    this.reeds = new ShorelineReeds(scene, quality);
    this.clouds = new PainterlyClouds(scene, quality);
    this.cliffs = new MirrorfallCliffs(quality);
    this.outcrops = new CliffOutcrops(scene,quality);
    this.wake = new SurfaceWake(scene,quality);
    this.splash = new CreatureSplash(scene,quality);
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
    this.underwater = active;
  }

  /**
   * Sample the actual chase-camera water depth after the camera moves. Player
   * dive mode may place the camera above water during transitions, so toggling
   * a binary blue filter from character state produces visibly wrong scenes.
   */
  updateAtmosphere(time: number, camera: THREE.Vector3): number {
    const optics = underwaterOpticsAt(
      camera.x, camera.y, camera.z, this.underwater,
    );
    this.shafts.update(time, optics.shaftStrength);
    this.particulates.update(time, camera, optics);
    if (optics.immersion > 0) {
      this.seaFog.density = optics.fogDensity;
      this.seaFog.color.copy(this.airFog.color).lerp(optics.tint, optics.immersion);
      this.seaBackground.copy(this.airBackground).lerp(optics.tint, optics.immersion);
      this.scene.fog = this.seaFog;
      this.scene.background = this.seaBackground;
    } else {
      this.scene.fog = this.airFog;
      this.scene.background = this.airBackground;
    }
    this.sky.mesh.visible = optics.immersion < .08;
    this.sun.intensity = 2.1 * optics.lightTransmission;
    this.hemisphere.intensity = (this.quality === 'high' ? 1.17 : 1.4)
      * optics.lightTransmission;
    return optics.immersion;
  }

  animate(time: number, x: number, y: number, z: number, state?: FlightState): void {
    this.water.follow(x,z);
    this.water.update(time);
    this.lake.update(time);
    this.lakeFoam.update(time);
    this.caustics.update(time);
    this.lakebed.update(time,x,z);
    this.waterfall.update(time);
    this.cliffs.update(time);
    if(state){
      this.wake.update(state,time);
      this.splash.update(state,time);
    }
    this.nature.update(time,x,z);
    this.nearGrass.update(x,z,time);
    this.reeds.update(x,z,time);
    this.clouds.update(time);
    this.foamMaterial.uniforms.uTime!.value=time;
    this.sky.update(time);
    this.sky.moveWithCamera(x, y, z);
    if (this.quality === 'high') {
      // Camera-centered shadow frustum avoids blurry 1km-wide texture maps.
      this.sun.position.set(x-350,y+650,z-440);
      this.sunTarget.position.set(x,0,z);
      this.sunTarget.updateMatrixWorld();
    }
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
    this.caustics.dispose();
    this.lakebed.dispose();
    this.shafts.dispose();
    this.particulates.dispose();
    this.waterfall.dispose();
    this.nature.dispose();
    this.nearGrass.dispose();
    this.reeds.dispose();
    this.clouds.dispose();
    this.cliffs.dispose();
    this.outcrops.dispose();
    this.wake.dispose();
    this.splash.dispose();
    this.sky.dispose();
    this.echoVisual.dispose();
    this.hemisphere.removeFromParent();
    this.sun.removeFromParent();
    this.sunTarget.removeFromParent();
  }
}
