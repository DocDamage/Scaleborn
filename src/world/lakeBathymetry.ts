import * as THREE from 'three';
import { GRAND_LAKE, lakeContains } from './highlandLake';
import { heightAt } from './terrain';

/**
 * Terrain-driven lake bathymetry. Uses the EXACT heightAt() world function
 * shared by collision and diving, not a decorative color-only texture.
 * Values are encoded linearly as depth/192 in the red channel.
 */
export const BATHYMETRY_RANGE_METERS = 192;
export const LAKE_MAP_WIDTH = 2.05 * GRAND_LAKE.radiusX;
export const LAKE_MAP_HEIGHT = 2.05 * GRAND_LAKE.radiusZ;

export function lakeDepthAt(x: number, z: number): number {
  if (!lakeContains(x, z)) return 0;
  return Math.min(BATHYMETRY_RANGE_METERS,
    Math.max(0, GRAND_LAKE.surfaceY - heightAt(x, z)));
}

export function makeLakeBathymetry(width = 192, height = 144): THREE.DataTexture {
  if (!Number.isInteger(width) || !Number.isInteger(height)
      || width < 2 || height < 2 || width > 1024 || height > 1024) {
    throw new Error('Bathymetry dimensions must be 2..1024');
  }
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const z = GRAND_LAKE.z + ((y + 0.5) / height - 0.5) * LAKE_MAP_HEIGHT;
    for (let x = 0; x < width; x++) {
      const wx = GRAND_LAKE.x + ((x + 0.5) / width - 0.5) * LAKE_MAP_WIDTH;
      const depth = lakeDepthAt(wx, z);
      const i = 4 * (y * width + x);
      const encoded = Math.round(depth / BATHYMETRY_RANGE_METERS * 255);
      pixels[i] = encoded;
      pixels[i + 1] = encoded;
      pixels[i + 2] = encoded;
      pixels[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
