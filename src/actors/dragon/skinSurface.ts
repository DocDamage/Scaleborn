import * as THREE from 'three';

/** Deterministic original dragon-scale PBR texture triplet. */
export interface DragonScaleTextures {
  color:THREE.DataTexture;
  normal:THREE.DataTexture;
  roughness:THREE.DataTexture;
}
const clamp=(v:number):number=>Math.round(Math.min(255,Math.max(0,v)));

export function makeDragonScaleTextures(size=128):DragonScaleTextures {
  if(!Number.isInteger(size)||size<32||size>512) {
    throw new Error('Scale texture must be 32..512');
  }
  const heights=new Float32Array(size*size);
  const colors=new Uint8Array(size*size*4);
  const normals=new Uint8Array(size*size*4);
  const rough=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size;
    const row=Math.floor(v*20);
    const iu=u*15+(row%2)*.50;
    const du=Math.abs((iu-Math.floor(iu))-.50)*2;
    const dv=Math.abs((v*20-Math.floor(v*20))-.5)*2;
    const elliptical=Math.sqrt(du*du*.72+dv*dv*.99);
    const rim=Math.min(1,Math.max(0,(elliptical-.63)/.36));
    const ripple=Math.sin(u*Math.PI*2*57)*Math.sin(v*Math.PI*2*43)*.024;
    const scaleHeight=.50+.29*(1-rim)+ripple;
    const i=y*size+x,j=i*4;
    heights[i]=scaleHeight;
    const caustic=Math.sin(u*Math.PI*2*2)*Math.sin(v*Math.PI*2*3);
    const pigment=218+(scaleHeight-.5)*31+caustic*6;
    colors[j]=clamp(pigment);
    colors[j+1]=clamp(pigment+9);
    colors[j+2]=clamp(pigment+11);
    colors[j+3]=255;
    rough[j]=rough[j+1]=rough[j+2]=clamp(174+rim*39+caustic*12);
    rough[j+3]=255;
  }
  const sample=(x:number,y:number):number=>
    heights[((y+size)%size)*size+((x+size)%size)]??0;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const nx=-(sample(x+1,y)-sample(x-1,y))*2.1;
    const ny=-(sample(x,y+1)-sample(x,y-1))*2.1;
    const l=Math.hypot(nx,ny,1);
    normals[i]=clamp(128+127*nx/l);
    normals[i+1]=clamp(128+127*ny/l);
    normals[i+2]=clamp(128+127/l);
    normals[i+3]=255;
  }
  const data=(bytes:Uint8Array,srgb:boolean):THREE.DataTexture=>{
    const tex=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
    tex.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.magFilter=THREE.LinearFilter;
    tex.minFilter=THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps=true;
    tex.needsUpdate=true;
    return tex;
  };
  return {color:data(colors,true),normal:data(normals,false),roughness:data(rough,false)};
}

export function applyDragonScales(
  material:THREE.MeshStandardMaterial, textures:DragonScaleTextures,
):THREE.MeshStandardMaterial {
  material.map=textures.color;
  material.normalMap=textures.normal;
  material.roughnessMap=textures.roughness;
  material.normalScale.set(.28,.28);
  return material;
}
