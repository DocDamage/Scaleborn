import * as THREE from 'three';

/**
 * Original hand-tuned hybrid skin surface for the adolescent heroine.
 * Tiny warm pigment islands, cheek-like muted color variation and shallow
 * organic microrelief break the flat plastic face/hand look without changing
 * anatomy, eye sockets or proportions. Procedural textures are generated
 * exactly once at module initialization and never updated per frame.
 */
export interface RiderSkinMaps {
  color: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
}

const clampByte=(value:number):number=>
  Math.max(0,Math.min(255,Math.round(value)));
const fract=(x:number):number=>x-Math.floor(x);
const hash=(x:number,y:number):number=>
  fract(Math.sin(x*127.1+y*311.7)*43758.5453123);
const smooth=(a:number,b:number,x:number):number=>{
  const t=Math.max(0,Math.min(1,(x-a)/(b-a)));
  return t*t*(3-2*t);
};

/** Small, deterministic, repeatable UV textures usable on sculpted skin. */
export function paintRiderSkinMaps(size=128):RiderSkinMaps {
  if(!Number.isInteger(size)||size<64||size>512||(size&(size-1))!==0){
    throw new Error('Rider skin texture must be a power of two from 64 to 512');
  }
  const color=new Uint8Array(size*size*4);
  const normal=new Uint8Array(size*size*4);
  const roughness=new Uint8Array(size*size*4);
  const height=new Float32Array(size*size);
  const tau=Math.PI*2;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size;
    // Multi-scale pigment and subtle directional dermal pores. Periodic
    // fields avoid harsh seams when the longitudinal sculpt UV wraps.
    const broad=.5+.5*Math.sin(tau*(u*3+v*2))
      *Math.cos(tau*(u*2-v*3));
    const mottled=.5+.5*Math.sin(tau*u*17+.4*Math.sin(tau*v*5))
      *Math.cos(tau*v*19+.3*Math.cos(tau*u*7));
    const pore=.5+.5*Math.sin(tau*u*53)*Math.cos(tau*v*47);
    // Sparse, soft, low-contrast freckles (not painted dark dots).
    const fx=u*13,fy=v*11,cx=Math.floor(fx),cy=Math.floor(fy);
    let freckles=0;
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
      const gx=cx+ox,gy=cy+oy;
      const seeded=hash((gx+13)%13,(gy+11)%11);
      if(seeded<.73)continue;
      const dx=fx-gx-(.3+.4*hash(gx+9,gy+2));
      const dy=fy-gy-(.3+.4*hash(gx+3,gy+7));
      const spread=.11+.08*hash(gx+5,gy+4);
      freckles+=smooth(spread,0,Math.hypot(dx,dy))*(seeded-.73)*3.0;
    }
    freckles=Math.min(1,freckles);
    const i=y*size+x,j=i*4;
    const warmth=(broad-.5)*12+(mottled-.5)*11-freckles*18;
    color[j]=clampByte(241+warmth);
    color[j+1]=clampByte(235+warmth*.70-freckles*2);
    color[j+2]=clampByte(231+warmth*.54+3*(broad-.5));
    color[j+3]=255;
    height[i]=.5+(pore-.5)*.043+(mottled-.5)*.016
      +(broad-.5)*.007-freckles*.015;
    const rough=.91+.052*(mottled-.5)+.022*(pore-.5)
      +.035*freckles;
    const roughByte=clampByte(rough*255);
    roughness[j]=roughness[j+1]=roughness[j+2]=roughByte;
    roughness[j+3]=255;
  }
  const at=(x:number,y:number):number=>
    height[((y+size)%size)*size+((x+size)%size)]??.5;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const nx=-(at(x+1,y)-at(x-1,y))*2.2;
    const ny=-(at(x,y+1)-at(x,y-1))*2.2;
    const n=Math.hypot(nx,ny,1);
    const j=(y*size+x)*4;
    normal[j]=clampByte(128+127*nx/n);
    normal[j+1]=clampByte(128+127*ny/n);
    normal[j+2]=clampByte(128+127/n);
    normal[j+3]=255;
  }
  const texture=(bytes:Uint8Array,srgb:boolean):THREE.DataTexture=>{
    const result=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
    result.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
    result.wrapS=result.wrapT=THREE.RepeatWrapping;
    result.magFilter=THREE.LinearFilter;
    result.minFilter=THREE.LinearMipmapLinearFilter;
    result.generateMipmaps=true;
    result.needsUpdate=true;
    return result;
  };
  return {
    color:texture(color,true),
    normal:texture(normal,false),
    roughness:texture(roughness,false),
  };
}

/** Keep portrait skin relatively matte; no clearcoat or metallic sheen. */
export function makeRiderSkinMaterial(
  maps:RiderSkinMaps=paintRiderSkinMaps(),
  color=0xbc947e,
):THREE.MeshStandardMaterial {
  const material=new THREE.MeshStandardMaterial({
    name:'character.rider.hero.painted-skin',
    color,metalness:0,roughness:.86,
    map:maps.color,normalMap:maps.normal,roughnessMap:maps.roughness,
  });
  material.normalScale.set(.16,.16);
  return material;
}
