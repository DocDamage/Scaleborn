import * as THREE from 'three';

/**
 * The membrane is real skinned geometry, not an opaque billboard. These
 * original painted maps add close-range ribbed skin, veins and micro-roughness
 * while allowing the existing dark violet per-vertex wing pigments to show.
 * No external asset loading or per-frame texture allocations.
 */
export interface WingSurfaceMaps {
  color:THREE.DataTexture;
  normal:THREE.DataTexture;
  roughness:THREE.DataTexture;
}

const clampByte=(v:number):number=>Math.max(0,Math.min(255,Math.round(v)));
const smooth=(a:number,b:number,x:number):number=>{
  const t=Math.max(0,Math.min(1,(x-a)/(b-a)));
  return t*t*(3-2*t);
};

export function paintWingMembraneMaps(size=128):WingSurfaceMaps {
  if(!Number.isInteger(size)||size<64||size>512||(size&(size-1))!==0){
    throw new Error('Wing map size must be a power of 2 between 64 and 512');
  }
  const heights=new Float32Array(size*size);
  const colors=new Uint8Array(size*size*4);
  const normals=new Uint8Array(size*size*4);
  const roughness=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size, v=y/size;
    const ribbon=Math.abs(Math.sin((u*7.5+v*.22)*Math.PI));
    const mainVein=1-smooth(.035,.115,ribbon);
    const diagonal=Math.abs(Math.sin((u*18.5+v*7.2)*Math.PI));
    const crossVein=(1-smooth(.018,.09,diagonal))*.36;
    const grain=Math.sin(u*125.0+v*21.0)
      *Math.sin(v*119.0-u*16.0)*.045;
    const ripple=Math.sin(u*31+v*36)*Math.sin(v*54-u*18)*.025;
    const height=.48+mainVein*.24+crossVein*.12+grain+ripple;
    const i=y*size+x,j=i*4;
    heights[i]=height;
    const dapple=.5+.5*Math.sin(u*22+v*15)*Math.sin(v*31-u*11);
    const darkEdge=1-smooth(.0,.1,Math.min(v,1-v));
    colors[j]=clampByte(211+mainVein*24-crossVein*12+dapple*9);
    colors[j+1]=clampByte(200+mainVein*12-crossVein*9+dapple*12);
    colors[j+2]=clampByte(232+mainVein*20+crossVein*7+dapple*10);
    colors[j+3]=255;
    const rough=.72-.24*mainVein-.08*crossVein+.065*dapple
      +.08*darkEdge;
    const roughPixel=clampByte(rough*255);
    roughness[j]=roughness[j+1]=roughness[j+2]=roughPixel;
    roughness[j+3]=255;
  }
  const heightAt=(x:number,y:number):number=>{
    const ix=(x%size+size)%size,iy=(y%size+size)%size;
    return heights[iy*size+ix]??.5;
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const nx=-(heightAt(x+1,y)-heightAt(x-1,y))*1.25;
    const ny=-(heightAt(x,y+1)-heightAt(x,y-1))*1.25;
    const length=Math.hypot(nx,ny,1);
    const i=(y*size+x)*4;
    normals[i]=clampByte(128+127*nx/length);
    normals[i+1]=clampByte(128+127*ny/length);
    normals[i+2]=clampByte(128+127/length);
    normals[i+3]=255;
  }
  const create=(bytes:Uint8Array,srgb:boolean):THREE.DataTexture=>{
    const texture=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
    texture.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.magFilter=THREE.LinearFilter;
    texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps=true;
    texture.needsUpdate=true;
    return texture;
  };
  return {
    color:create(colors,true),
    normal:create(normals,false),
    roughness:create(roughness,false),
  };
}

export function makeWingMembraneMaterial(
  maps:WingSurfaceMaps=paintWingMembraneMaps(),
):THREE.MeshPhysicalMaterial {
  const mat=new THREE.MeshPhysicalMaterial({
    name:'creature.dragon.onyx.iridescent-wing-membrane',
    side:THREE.DoubleSide,
    vertexColors:true,
    map:maps.color,
    normalMap:maps.normal,
    roughnessMap:maps.roughness,
    metalness:.018,
    roughness:.80,
    clearcoat:.065,
    clearcoatRoughness:.82,
    sheen:.15,
    sheenColor:new THREE.Color(0x343b60),
    sheenRoughness:.88,
    iridescence:.15,
    iridescenceIOR:1.19,
    iridescenceThicknessRange:[110,245],
  });
  mat.normalScale.set(.26,.26);
  return mat;
}
