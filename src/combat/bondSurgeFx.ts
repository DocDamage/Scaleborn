import * as THREE from 'three';

/**
 * Original painterly Bond Surge surface mark: feathered petals laid against
 * the terrain instead of bright cone needles or toroidal white debug rings.
 * The alpha profile has true transparent edges and a soft irregular interior.
 */
export function makeBondSurgePatchTexture(size = 64): THREE.DataTexture {
  if (!Number.isInteger(size) || size < 32 || size > 128) {
    throw new Error('Bond Surge texture size must be 32–128 integral pixels');
  }
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = ((x + .5) / size) * 2 - 1;
    const v = ((y + .5) / size) * 2 - 1;
    const edge = Math.max(0, 1 - u * u - v * v);
    const ribbons = .78 + .14 * Math.sin(u * 8.2 + v * 3.4)
      + .08 * Math.sin(v * 12.6 - u * 4.7);
    const opacity = Math.pow(edge, 2.1) * Math.max(.2, ribbons);
    const i = (y * size + x) * 4;
    pixels[i] = 255;
    pixels[i + 1] = 255;
    pixels[i + 2] = 255;
    pixels[i + 3] = Math.round(255 * opacity);
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

/** Flat XY source rotated onto XZ; normal is upward, not camera-facing. */
export function makeBondSurgePatchGeometry(): THREE.BufferGeometry {
  const plane = new THREE.PlaneGeometry(1, 1, 1, 1);
  plane.rotateX(-Math.PI / 2);
  return plane;
}
