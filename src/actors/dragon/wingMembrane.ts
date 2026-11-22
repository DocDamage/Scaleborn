import * as THREE from 'three';

/**
 * Original, deterministic painterly membrane material for the existing
 * skinned wing. U is the span from shoulder to tip; V follows the chord.
 * Painted vessel ridges therefore deform WITH the skinned membrane instead
 * of becoming disconnected unskinned LineSegments or rigid spars.
 */
export interface WingMembraneTextures {
  color: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
}

const clampByte = (x: number): number =>
  Math.max(0, Math.min(255, Math.round(x)));

function membraneHeight(u: number, v: number): number {
  // Three tapered, diverging structural veins, not a screen-space overlay.
  const width = 0.012 + u * 0.009;
  const ridge = (center: number, scale: number): number =>
    scale * Math.exp(-Math.pow((v - center) / width, 2));
  const vessel = ridge(0.07 + 0.09 * u, 0.75)
    + ridge(0.14 + 0.37 * u, 0.55)
    + ridge(0.23 + 0.59 * u, 0.35);
  const webbing = Math.sin(u * 91 + Math.sin(v * 17) * 2.7)
    * Math.cos(v * 57 - u * 8) * (0.3 + 0.7 * u);
  return vessel * 0.21
    + 0.014 * webbing
    + 0.022 * Math.sin(u * 21 + v * 33) * Math.sin(v * 19 - u * 37);
}

/**
 * Generates albedo, tangent-space normal and roughness textures using the
 * wing's actual (span,chord) UV orientation. Colors remain pale because the
 * existing vertex pigments provide the dragon's dark blue-green palette.
 * No transparent billboard or costly per-frame texture uploads are needed.
 */
export function makeWingMembraneTextures(size = 256): WingMembraneTextures {
  if (!Number.isInteger(size) || size < 64 || size > 512) {
    throw new Error('Wing membrane texture size must be 64..512');
  }
  const colors = new Uint8Array(size * size * 4);
  const normals = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1), v = y / (size - 1);
      const h = membraneHeight(u, v);
      const pores = Math.sin(u * 149 + v * 73) * Math.cos(v * 131 - u * 67);
      // Slightly leathery edges, fine irregular mottling and readable ribs.
      const leadingEdge = Math.exp(-Math.pow(v / 0.065, 2));
      const trailingEdge = Math.exp(-Math.pow((1 - v) / 0.12, 2));
      const edge = leadingEdge * 0.72 + trailingEdge * 0.53;
      const mottle = Math.sin(u * 24 + Math.cos(v * 17) * 2.4)
        * Math.sin(v * 31 - u * 11) + pores * 0.40;
      const veinTint = Math.min(1, Math.max(0, h * 3.8));
      const j = (y * size + x) * 4;
      heights[y * size + x] = h;
      colors[j] = clampByte(213 - 27 * edge + 14 * veinTint + 7 * mottle);
      colors[j + 1] = clampByte(225 - 22 * edge + 10 * veinTint + 6 * mottle);
      colors[j + 2] = clampByte(226 - 17 * edge + 9 * veinTint + 6 * mottle);
      colors[j + 3] = 255;
      const r = clampByte(185 + 22 * edge + 12 * mottle - 17 * veinTint);
      roughness[j] = roughness[j + 1] = roughness[j + 2] = r;
      roughness[j + 3] = 255;
    }
  }
  const sample = (x: number, y: number): number =>
    heights[Math.max(0, Math.min(size - 1, y)) * size
      + Math.max(0, Math.min(size - 1, x))]!;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Finite differences generate tangent-space normals, filtered by
      // mipmaps at long flight distances to reduce sparkling/moire.
      const dx = -(sample(x + 1, y) - sample(x - 1, y)) * 2.8;
      const dy = -(sample(x, y + 1) - sample(x, y - 1)) * 2.8;
      const length = Math.hypot(dx, dy, 1);
      const j = (y * size + x) * 4;
      normals[j] = clampByte(127.5 + dx / length * 127.5);
      normals[j + 1] = clampByte(127.5 + dy / length * 127.5);
      normals[j + 2] = clampByte(127.5 + 127.5 / length);
      normals[j + 3] = 255;
    }
  }
  const texture = (data: Uint8Array, srgb: boolean): THREE.DataTexture => {
    const image = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    image.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    image.wrapS = image.wrapT = THREE.ClampToEdgeWrapping;
    image.magFilter = THREE.LinearFilter;
    image.minFilter = THREE.LinearMipmapLinearFilter;
    image.generateMipmaps = true;
    image.needsUpdate = true;
    return image;
  };
  return {
    color: texture(colors, true),
    normal: texture(normals, false),
    roughness: texture(roughness, false),
  };
}
