import * as THREE from 'three';

/**
 * Small deterministic textile microtexture, deliberately without a runtime
 * shader or downloaded image. Mipmaps retain painted cloth at distance and
 * the normal variation helps separate coat fabric from smooth hybrid skin.
 */
export interface RiderFabricTextures {
  color: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
}

export function makeRiderFabricTextures(size = 64): RiderFabricTextures {
  if (!Number.isInteger(size) || size < 32 || size > 256) {
    throw new Error('Fabric texture size must be an integer between 32 and 256');
  }
  const colors = new Uint8Array(size * size * 4);
  const normals = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const warp = Math.sin(u * Math.PI * 36);
    const weft = Math.sin(v * Math.PI * 32);
    const crossing = warp * weft;
    const grain = Math.sin(u * Math.PI * 104 + v * 17) *
      Math.sin(v * Math.PI * 78 - u * 11);
    const pigment = clamp(236 + crossing * 7 + grain * 3);
    const i = (y * size + x) * 4;
    colors[i] = clamp(pigment + 2);
    colors[i + 1] = pigment;
    colors[i + 2] = clamp(pigment - 3);
    colors[i + 3] = 255;
    normals[i] = clamp(128 - Math.cos(u * Math.PI * 36) * 15);
    normals[i + 1] = clamp(128 - Math.cos(v * Math.PI * 32) * 15);
    normals[i + 2] = 253;
    normals[i + 3] = 255;
    const matte = clamp(225 + crossing * 15 + grain * 8);
    roughness[i] = roughness[i + 1] = roughness[i + 2] = matte;
    roughness[i + 3] = 255;
  }
  const texture = (pixels: Uint8Array, srgb: boolean): THREE.DataTexture => {
    const map = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    map.needsUpdate = true;
    return map;
  };
  return {
    color: texture(colors, true),
    normal: texture(normals, false),
    roughness: texture(roughness, false),
  };
}
