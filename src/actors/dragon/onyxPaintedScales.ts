import * as THREE from 'three';
/**
 * Sampling of the *original* hand-painted navy/violet scales generated for
 * Scaleborn on 2026-11-22. This compact index texture is extracted from the
 * painting, rather than invented noise or an unrelated character asset.
 * The full-resolution original remains the production texture-art source;
 * this low-budget version must NOT be visually signed off as final.
 */
export const ONYX_PAINTED_SAMPLE_SIZE = 32;
const PALETTE = [3486806,3025995,2959175,2500417,2630208,2302267,2171192,2105142,2235959,2169653,2038834,1841968,1775917,1775404,1578793,1446693] as const;
// Two 4-bit indices / byte: source painting, downsampled to 32x32, 16 pigments.
const SAMPLE = 'h6Qsc7kt7lWthezDE4t0mBzxHmGmnugUf0HeuwHWrpK1LUA/xUGLAVXfKNzfQLIram5xc4/Ugbc+INUIUXpUUhJzf1OyKqFa5jREjBJhK7S8exXcVB7yGjPtFbjuocEVtlfOskrlpV2vRfoBA3+4qlWzztvVGqvlVF+r+idyArz4Grt62TtxfdTjNUV15IUKq5W+qxL6PkO/s+8C/Dvnd0CHGvzIVcu+MTxKrUI8OIRIcgX2qAP8XqKI2qQE+sgB3KHfMeqfxQqtUiVxkhd2AlXkBFpl1X/MFdwm5OmDDPtOMxL+NqTHM/gEszx78z5x1QW7nNYe9gWFn8VVFBr1xQXtMaU8oyz8Avc7vXZpraMcVdnyGmNsi87iD+YA91SUQoskEvYeuZsxfsp7EzyAHSLX1QRT7RCqMFtzPNt3avy8qjGuE0XtFF3jbuIESM0hEX46cV6CSZoqSFBb+hW4Ix1Rz/oA+kGa5QRgPUjmBaW17kRehLfOoBo7TPQYiEGumYSgXO9zp1dwBaItzKv6ZpEBj+3Rv8M8sQySzjHeV6s+40MYvlJN53zQCiFZSlrWW2uwBS5yMY41tCU1pADvcdMxP6Xjr1K30zsR+1QCUZUS5nxb6+a/y7ID/8UZ9wblRVfQRxNa034B/1tKkruqyssU9+xkBLNmI/+7c17YMaI=';
export function paintedScalePixels(): Uint8Array {
  const packed = atob(SAMPLE);
  if (packed.length !== 512) throw new Error('Invalid original Onyx painted-scale atlas');
  const pixels = new Uint8Array(32 * 32 * 4);
  for (let i=0; i<1024; i++) {
    const packedIndex=packed.charCodeAt(i >> 1);
    const index=(i & 1) === 0 ? packedIndex >> 4 : packedIndex & 15;
    const color=PALETTE[index]!;
    const base=i*4;
    // The sample supplies pigment transitions; brighten to a PBR modulation
    // map so Onyx's original navy/charcoal shader remains the material owner.
    pixels[base]=176+((color >> 16) & 255);
    pixels[base+1]=178+((color >> 8) & 255);
    pixels[base+2]=176+(color & 255);
    pixels[base+3]=255;
  }
  return pixels;
}
export function makeOnyxPaintedScaleMap(): THREE.DataTexture {
  const map = new THREE.DataTexture(paintedScalePixels(),32,32,THREE.RGBAFormat);
  map.name = 'Onyx original painterly scale pigments';
  map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.magFilter=THREE.LinearFilter;
  map.minFilter=THREE.LinearMipmapLinearFilter;
  map.generateMipmaps=true;
  map.needsUpdate=true;
  return map;
}
