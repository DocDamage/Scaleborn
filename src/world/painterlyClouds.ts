import * as THREE from 'three';
import { rng } from '../core/random';
import { AZURE_SEED } from './terrain';

/** Generated soft cloud texture with broad masses and feathered edges. */
function cloudTexture():THREE.DataTexture {
  const w=192,h=96;
  const bytes=new Uint8Array(w*h*4);
  const lobes=[
    [-.57,-.11,.43,.29],[-.31,.13,.37,.37],[.01,.02,.55,.40],
    [.43,.10,.42,.32],[.66,-.12,.32,.24],
  ] as const;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=(x+.5)/w*2-1,v=(y+.5)/h*2-1;
    let density=0;
    for(const [cx,cy,rx,ry] of lobes){
      const dx=(u-cx)/rx,dy=(v-cy)/ry;
      density=Math.max(density,Math.exp(-(dx*dx+dy*dy)*2.7));
    }
    const ripple=(Math.sin(u*23.7+v*17.2)+Math.sin(u*41.4-v*15.5))*0.043;
    const edge=Math.max(0,Math.min(1,(density-.13)*1.62+ripple));
    const j=(y*w+x)*4;
    const shade=Math.round(225+16*(v+.5));
    bytes[j]=Math.min(255,shade+11);
    bytes[j+1]=Math.min(255,shade+3);
    bytes[j+2]=shade;
    bytes[j+3]=Math.round(Math.pow(edge,1.7)*215);
  }
  const tex=new THREE.DataTexture(bytes,w,h,THREE.RGBAFormat);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.magFilter=THREE.LinearFilter;
  tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps=true;
  tex.needsUpdate=true;
  return tex;
}

/** Billowed wisps instead of stacked icosahedron potato-clouds. */
export class PainterlyClouds {
  readonly root=new THREE.Group();
  private readonly texture=cloudTexture();
  private readonly sprites:THREE.Sprite[]=[];
  private readonly origins:THREE.Vector3[]=[];
  constructor(scene:THREE.Scene,quality:'high'|'low'='high'){
    this.root.name='sky.azure.painterly-clouds';
    scene.add(this.root);
    const r=rng(AZURE_SEED+818);
    const n=quality==='low'?0:16;
    for(let i=0;i<n;i++){
      const material=new THREE.SpriteMaterial({
        map:this.texture,transparent:true,depthWrite:false,
        opacity:.40+r()*.25,alphaTest:.015,color:0xf9e8d2,
        fog:false,
      });
      const sprite=new THREE.Sprite(material);
      const x=(r()-.5)*4300,z=(r()-.5)*4300;
      const y=270+r()*340;
      sprite.position.set(x,y,z);
      sprite.scale.set(118+r()*208,41+r()*58,1);
      sprite.name='sky.azure.cloud-wisp';
      this.origins.push(sprite.position.clone());
      this.sprites.push(sprite);
      this.root.add(sprite);
    }
  }
  update(time:number):void{
    for(let i=0;i<this.sprites.length;i++){
      const sprite=this.sprites[i]!,start=this.origins[i]!;
      sprite.position.x=start.x+Math.sin(time*.018+i)*23;
      sprite.position.z=start.z+Math.cos(time*.012+i)*16;
    }
  }
  dispose():void{
    this.sprites.forEach(s=>(s.material as THREE.SpriteMaterial).dispose());
    this.texture.dispose();
    this.root.removeFromParent();
  }
}
