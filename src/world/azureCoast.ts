import * as THREE from 'three';
import { fbm } from '../core/random';
import { AZURE_SEED, heightAt, SEA_LEVEL, WORLD_WIDTH_METERS } from './terrain';
import { addCoastalDressing } from './dressing';

const TILE = 250;
const RADIUS = 4;
type TerrainTile = { mesh: THREE.Mesh; resolution: number };
const color = new THREE.Color();

/** Stream geometry around the active flight camera. No world-sized high-res mesh. */
export class AzureCoast {
  private tiles = new Map<string, TerrainTile>();
  private lastTileX = Number.NaN;
  private lastTileZ = Number.NaN;
  private terrainMaterial = new THREE.MeshLambertMaterial({
    vertexColors: true, flatShading: false, side: THREE.DoubleSide,
  });
  readonly scene: THREE.Scene;
  readonly ocean: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.background = new THREE.Color(0xc4d9df);
    scene.fog = new THREE.FogExp2(0xb6cbd4, 0.00063);
    scene.add(new THREE.HemisphereLight(0xbde7ee, 0x716251, 2.1));
    const sun = new THREE.DirectionalLight(0xffd29b, 2.0);
    sun.position.set(-420, 600, -520);
    scene.add(sun);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_WIDTH_METERS + 2600, WORLD_WIDTH_METERS + 2600),
      new THREE.MeshStandardMaterial({
        color: 0x338da2, roughness: 0.34, metalness: 0.10,
        transparent: true, opacity: 0.88, depthWrite: false,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = SEA_LEVEL + 0.1;
    water.name = 'water.azure.ocean';
    scene.add(water);
    this.ocean = water;
    addCoastalDressing(scene);
  }

  update(x: number, z: number): void {
    const ix = Math.floor(x / TILE);
    const iz = Math.floor(z / TILE);
    if (ix === this.lastTileX && iz === this.lastTileZ) return;
    this.lastTileX = ix;
    this.lastTileZ = iz;
    const required = new Set<string>();
    for (let dz = -RADIUS; dz <= RADIUS; dz++) {
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        const tx = ix + dx, tz = iz + dz;
        const key = tx + ':' + tz;
        required.add(key);
        const resolution = Math.max(Math.abs(dx), Math.abs(dz)) <= 2 ? 26 : 8;
        const previous = this.tiles.get(key);
        if (previous && previous.resolution === resolution) continue;
        if (previous) this.remove(key, previous);
        const mesh = this.makeTile(tx, tz, resolution);
        this.scene.add(mesh);
        this.tiles.set(key, { mesh, resolution });
      }
    }
    for (const [key, tile] of this.tiles) {
      if (!required.has(key)) this.remove(key, tile);
    }
  }

  private makeTile(tx: number, tz: number, segments: number): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(TILE, TILE, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.getAttribute('position');
    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const wx = (tx + 0.5) * TILE + positions.getX(i);
      const wz = (tz + 0.5) * TILE + positions.getZ(i);
      const h = heightAt(wx, wz);
      positions.setY(i, h);
      if (h < -3) color.setHex(0x426f74);
      else if (h < 6) color.setHex(0xe9ca9e);
      else if (h < 33) color.setHex(0x9aae86);
      else if (h < 90) color.setHex(0x71866e);
      else color.setHex(0x8b8882);
      const grain = fbm(wx * 0.028, wz * 0.028, AZURE_SEED + 431, 3);
      color.offsetHSL(0, 0, grain * 0.075);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, this.terrainMaterial);
    mesh.position.set((tx + 0.5) * TILE, 0, (tz + 0.5) * TILE);
    mesh.name = 'terrain.azure.coast.' + tx + '.' + tz;
    mesh.frustumCulled = true;
    return mesh;
  }

  private remove(key: string, tile: TerrainTile): void {
    this.scene.remove(tile.mesh);
    tile.mesh.geometry.dispose();
    this.tiles.delete(key);
  }

  dispose(): void {
    for (const [key, tile] of this.tiles) this.remove(key, tile);
    this.terrainMaterial.dispose();
    this.ocean.geometry.dispose();
    (this.ocean.material as THREE.Material).dispose();
  }
}
