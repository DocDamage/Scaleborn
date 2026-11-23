import * as THREE from 'three';

/**
 * Three mutually crossed translucent surfaces form each flowing Tidal Sigil
 * crest. A feathered painted atlas makes the small trail read as moving
 * water, not a procession of bright spheres. Combat owns the hit volume.
 */
export function makeTidalSigilRibbonGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let panel = 0; panel < 3; panel++) {
    const angle = panel * Math.PI / 3;
    const x = Math.cos(angle) * .5;
    const z = Math.sin(angle) * .5;
    const base = positions.length / 3;
    positions.push(-x, 0, -z, x, 0, z, -x, 1, -z, x, 1, z);
    uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Soft-edged, streaked freshwater pigment generated once per game scene. */
export function makeTidalSigilRibbonTexture(size = 96): THREE.DataTexture {
  if (!Number.isInteger(size) || size < 32 || size > 128) {
    throw new Error('Tidal Sigil texture size must be an integer from 32 to 128');
  }
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = (y + .5) / size;
    const endFade = Math.pow(Math.sin(Math.PI * v), .75);
    for (let x = 0; x < size; x++) {
      const u = ((x + .5) / size) * 2 - 1;
      // A traveling off-center channel breaks up the perfectly straight
      // transparent-card silhouette. The tip and roots vanish smoothly.
      const offset = .12 * Math.sin(v * 18.3 + 1.7);
      const width = (.22 + .68 * Math.sin(Math.PI * v) ** .7)
        * (.95 + .05 * Math.cos(v * 31.0));
      const core = Math.max(0, 1 - Math.abs(u - offset) / width);
      const ripples = .71 + .19 * Math.sin(v * 31 + u * 8)
        + .10 * Math.sin(v * 51 - u * 13);
      const opacity = Math.pow(core, 1.65) * endFade
        * Math.max(.22, ripples);
      const index = (y * size + x) * 4;
      pixels[index] = 207;
      pixels[index + 1] = 247;
      pixels[index + 2] = 239;
      pixels[index + 3] = Math.round(255 * opacity);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
