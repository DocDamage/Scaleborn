import * as THREE from 'three';

/**
 * Small crossed veils aligned to ballistic velocity instead of chunky bright
 * icosahedra. Alpha fades at the tips and sides of a tapered spray streak;
 * the two rotated planes preserve its visibility from chase, rider and
 * lateral cameras without billboard updates.
 */
export function makeSprayStreakGeometry(): THREE.BufferGeometry {
  const positions:number[]=[];
  const uv:number[]=[];
  const push=(x:number,y:number,z:number,u:number,v:number):void=>{
    positions.push(x,y,z);uv.push(u,v);
  };
  for(let plane=0;plane<2;plane++){
    const a=plane*Math.PI/2;
    const dx=Math.cos(a),dz=Math.sin(a);
    const point=(side:number,height:number,u:number,v:number):void=>
      push(dx*side,height,dz*side,u,v);
    // Each plane is two triangles spanning a narrow vertical flare.
    point(-.5,-.5,0,0);point(.5,-.5,1,0);point(-.5,.5,0,1);
    point(.5,-.5,1,0);point(.5,.5,1,1);point(-.5,.5,0,1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.computeVertexNormals();
  return geometry;
}

export function makeSprayStreakTexture(size=64):THREE.DataTexture {
  if(!Number.isInteger(size)||size<32||size>256) {
    throw new Error('Spray-streak texture dimension must be 32..256');
  }
  const pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size,v=(y+.5)/size;
    const across=Math.abs(u-.5)*2;
    const along=Math.sin(Math.PI*v);
    // Thin tapered tip, broken feathering, no opaque rectangular particles.
    const width=.22+.36*Math.pow(Math.max(0,along),.55);
    const envelope=Math.max(0,1-across/width);
    const alpha=Math.pow(envelope,1.55)*Math.pow(Math.max(0,along),.88);
    const index=(y*size+x)*4;
    const glare=.45+.55*Math.pow(Math.max(0,along),.8);
    pixels[index]=Math.round(206+43*glare);
    pixels[index+1]=Math.round(225+28*glare);
    pixels[index+2]=Math.round(220+30*glare);
    pixels[index+3]=Math.round(alpha*196);
  }
  const texture=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.needsUpdate=true;
  return texture;
}
