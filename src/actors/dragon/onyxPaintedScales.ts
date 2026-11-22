import * as THREE from 'three';
/**
 * Sampling of the *original* hand-painted navy/violet scales generated for
 * Scaleborn on 2026-11-22. This compact index texture is extracted from the
 * painting, rather than invented noise or an unrelated character asset.
 * The full-resolution original remains the production texture-art source;
 * this low-budget version must NOT be visually signed off as final.
 */
export const ONYX_PAINTED_SAMPLE_SIZE = 64;
const PALETTE = [
  0x3c3b60,0x322f51,0x2f294b,0x272843,
  0x292341,0x24223b,0x212138,0x1f1e35,
  0x201d35,0x1f1a32,0x1d1a30,0x1a192d,
  0x19172a,0x181528,0x161525,0x141120,
] as const;
// Two 4-bit indices / byte: source painting, sampled at 64x64, 16 pigments.
const SAMPLE = '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';
export function paintedScalePixels(): Uint8Array {
  const packed = atob(SAMPLE);
  if (packed.length !== ONYX_PAINTED_SAMPLE_SIZE ** 2 / 2) throw new Error('Invalid original Onyx painted-scale atlas');
  const pixels = new Uint8Array(ONYX_PAINTED_SAMPLE_SIZE ** 2 * 4);
  for (let i=0; i<ONYX_PAINTED_SAMPLE_SIZE ** 2; i++) {
    const packedIndex=packed.charCodeAt(i >> 1);
    const index=(i & 1) === 0 ? packedIndex >> 4 : packedIndex & 15;
    const color=PALETTE[index]!;
    const base=i*4;
    // The sample supplies pigment transitions; brighten to a PBR modulation
    // map so Onyx's original navy/charcoal shader remains the material owner.
    // Keep the original sampled image's individual scale layout, but
    // compress pigment contrast at gameplay distance. The first full 64px
    // render showed large olive/greenish spots against midnight-navy hide.
    // A neutral dark-indigo tint keeps authored hide/vertex PBR in charge.
    const red=(color >> 16) & 255;
    const green=(color >> 8) & 255;
    const blue=color & 255;
    pixels[base]=208+Math.round((red-32)*.35);
    pixels[base+1]=210+Math.round((green-28)*.15);
    pixels[base+2]=218+Math.round((blue-49)*.32);
    pixels[base+3]=255;
  }
  return pixels;
}
export function makeOnyxPaintedScaleMap(): THREE.DataTexture {
  const map = new THREE.DataTexture(paintedScalePixels(),ONYX_PAINTED_SAMPLE_SIZE,ONYX_PAINTED_SAMPLE_SIZE,THREE.RGBAFormat);
  map.name = 'Onyx original painterly scale pigments';
  map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.magFilter=THREE.LinearFilter;
  map.minFilter=THREE.LinearMipmapLinearFilter;
  map.generateMipmaps=true;
  map.needsUpdate=true;
  return map;
}
