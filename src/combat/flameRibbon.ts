import * as THREE from 'three';

/**
 * Crossed, feathered flame ribbons for Onyx's directional fire breath.
 * The real damage cone is in combat.ts; these soft painterly tongues are
 * a replaceable renderer-only visualization, with no primitive cone spikes.
 */
export function makeDragonFlameRibbonGeometry(): THREE.BufferGeometry {
  const vertices=[
    -.5,0,0, .5,0,0, -.5,1,0, .5,1,0,
    0,0,-.5, 0,0,.5, 0,1,-.5, 0,1,.5,
  ];
  const uvs=[0,0,1,0,0,1,1,1,0,0,1,0,0,1,1,1];
  const indices=[0,1,2,2,1,3,4,5,6,6,5,7];
  const geo=new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geo.computeVertexNormals();
  return geo;
}

/** Deterministic tapered alpha envelope; no hard-edged white quads. */
export function makeDragonFlameRibbonTexture(size=64): THREE.DataTexture {
  if(!Number.isInteger(size)||size<32||size>128) {
    throw new Error('Invalid dragon flame texture size');
  }
  const rgba=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const v=(y+.5)/size;
    const u=(x+.5)/size*2-1;
    const width=(.24+.75*Math.pow(1-v,.85))
      * (.88+.12*Math.sin(v*19+u*3.2));
    const edge=Math.max(0,1-Math.abs(u)/width);
    const tip=Math.pow(Math.sin(Math.PI*v),.67);
    const variation=.78+.22*Math.sin(10.4*v+u*4.2);
    const alpha=Math.round(255*Math.pow(edge,1.8)*tip*variation);
    const k=(y*size+x)*4;
    rgba[k]=255;rgba[k+1]=255;rgba[k+2]=255;rgba[k+3]=alpha;
  }
  const tex=new THREE.DataTexture(rgba,size,size,THREE.RGBAFormat);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
  tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.magFilter=THREE.LinearFilter;
  tex.generateMipmaps=true;
  tex.needsUpdate=true;
  return tex;
}
