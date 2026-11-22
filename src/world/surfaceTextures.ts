import * as THREE from 'three';

export type SurfaceKind = 'soil' | 'rock' | 'bark';
export interface PaintedSurfaceTextures {
  color: THREE.DataTexture;
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
}

/** Periodic value-noise avoids obvious seams when procedural textures repeat. */
function hash2(x: number, y: number, seed: number): number {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263)
    + Math.imul(seed, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function smooth(t: number): number { return t*t*(3-2*t); }
function periodicNoise(x: number, y: number, period: number, seed: number): number {
  const a=Math.floor(x),b=Math.floor(y);
  const fx=smooth(x-a),fy=smooth(y-b);
  const wrap=(q:number):number=>((q%period)+period)%period;
  const n00=hash2(wrap(a),wrap(b),seed);
  const n10=hash2(wrap(a+1),wrap(b),seed);
  const n01=hash2(wrap(a),wrap(b+1),seed);
  const n11=hash2(wrap(a+1),wrap(b+1),seed);
  return (n00+(n10-n00)*fx)*(1-fy)+(n01+(n11-n01)*fx)*fy;
}
function multiNoise(u: number, v: number, seed: number): number {
  return periodicNoise(u*4,v*4,4,seed)*.45
    + periodicNoise(u*13,v*13,13,seed+11)*.29
    + periodicNoise(u*39,v*39,39,seed+31)*.17
    + periodicNoise(u*97,v*97,97,seed+59)*.09;
}
function clamped(x: number): number { return Math.max(0,Math.min(255,Math.round(x))); }

/**
 * Tiled albedo / normal / roughness maps with deterministic individual soil,
 * schist and bark material character. Runtime generation replaces missing
 * purchased texture assets; these are original image buffers, not placeholders.
 */
export function makePaintedSurfaceTextures(kind: SurfaceKind, size=256): PaintedSurfaceTextures {
  if (!Number.isInteger(size)||size<32||size>512) {
    throw new Error('Painted map resolution must be 32..512');
  }
  const seed=kind==='soil'?713:kind==='rock'?1901:3179;
  const heights=new Float32Array(size*size);
  const color=new Uint8Array(size*size*4);
  const normals=new Uint8Array(size*size*4);
  const roughness=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size;
    const fine=multiNoise(u,v,seed);
    const wide=periodicNoise(u*7,v*7,7,seed+73);
    const veins=kind==='rock'
      ? Math.sin(v*2*Math.PI*23.0+wide*3.2)*.095
      : kind==='bark'
        ? Math.sin(u*2*Math.PI*37+wide*7)*.12
        : Math.sin(u*2*Math.PI*5+wide*2)*.02;
    heights[y*size+x]=fine*.81+wide*.19+veins;
    const granule=(fine-.5), mineral=kind==='rock'?(fine-.40)*1.23:(fine-.5)*.95;
    const idx=(y*size+x)*4;
    let r:number,g:number,b:number;
    if(kind==='soil'){
      // Neutral light film so vertex colors still control grass/soil/cliff.
      const bleached=235+granule*32+wide*10;
      r=bleached+5;g=bleached+1;b=bleached-9;
    }else if(kind==='rock'){
      // Pale stone grain allows schist albedo to remain visible.
      const stone=228+mineral*51+veins*79;
      r=stone+5;g=stone+3;b=stone+1;
    }else{
      const grain=226+granule*47+veins*90;
      r=grain+6;g=grain-3;b=grain-13;
    }
    color[idx]=clamped(r); color[idx+1]=clamped(g);
    color[idx+2]=clamped(b); color[idx+3]=255;
    const rough=kind==='bark'?218:kind==='rock'?194:218;
    roughness[idx]=roughness[idx+1]=roughness[idx+2]=clamped(
      rough+(fine-.5)*53+veins*65);
    roughness[idx+3]=255;
  }
  const at=(x:number,y:number):number=>{
    const xx=(x+size)%size, yy=(y+size)%size;
    return heights[yy*size+xx]??0;
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    const dhdx=at(x+1,y)-at(x-1,y);
    const dhdy=at(x,y+1)-at(x,y-1);
    const power=kind==='rock'?2.3:kind==='bark'?2.0:1.45;
    const nx=-dhdx*power,ny=-dhdy*power,nz=1;
    const length=Math.hypot(nx,ny,nz);
    normals[i]=clamped(128+127*nx/length);
    normals[i+1]=clamped(128+127*ny/length);
    normals[i+2]=clamped(128+127*nz/length);
    normals[i+3]=255;
  }
  const texture=(pixels:Uint8Array,srgb:boolean):THREE.DataTexture=>{
    const t=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
    t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.magFilter=THREE.LinearFilter;
    t.minFilter=THREE.LinearMipmapLinearFilter;
    t.generateMipmaps=true;
    t.anisotropy=8;
    t.needsUpdate=true;
    return t;
  };
  return {
    color:texture(color,true),
    normal:texture(normals,false),
    roughness:texture(roughness,false),
  };
}
