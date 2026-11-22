import * as THREE from 'three';
import { rng } from '../core/random';
import { AZURE_SEED } from './terrain';
import { GRAND_LAKE, MIRRORFALL } from './highlandLake';

const crestX=MIRRORFALL.x+48;
const plungeX=MIRRORFALL.x-58;
const down=MIRRORFALL.topY-GRAND_LAKE.surfaceY;
const gravity=9.81;

const vertex=`
  varying vec2 vFlowUv;
  varying vec3 vFlowWorld;
  void main(){
    vFlowUv=uv;
    vFlowWorld=(modelMatrix*vec4(position,1.0)).xyz;
    gl_Position=projectionMatrix*viewMatrix*vec4(vFlowWorld,1.0);
  }
`;
const fragment=`
  precision highp float;
  uniform float uTime;
  varying vec2 vFlowUv;
  varying vec3 vFlowWorld;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  void main(){
    vec2 p=vFlowUv;
    float t=uTime;
    float strip=noise(vec2(p.x*38.0+sin(p.y*11.0)*.09,p.y*24.0-t*5.4));
    float wash=noise(vec2(p.x*92.0,p.y*72.0-t*11.8));
    float streaks=pow(.5+.5*sin(p.x*154.0+sin(p.y*12.0-t)*2.6),2.2);
    float turbulence=smoothstep(.42,.77,strip*.65+wash*.35);
    float edge=smoothstep(0.0,.06,p.x)*(1.0-smoothstep(.92,1.0,p.x));
    float baseAlpha=edge*(.44+.32*turbulence+.18*streaks);
    vec3 color=mix(vec3(.20,.42,.47),vec3(.87,.96,.98),strip*.55+streaks*.35);
    color+=vec3(.12,.13,.12)*wash;
    gl_FragColor=vec4(color,clamp(baseAlpha,.0,.91));
  }
`;

function ribbon(width:number,zOffset:number,phase:number,material:THREE.ShaderMaterial):THREE.Mesh{
  const nx=24,ny=94;
  const points:number[]=[],uv:number[]=[],faces:number[]=[];
  for(let i=0;i<=ny;i++){
    const t=i/ny;
    const arc=t*t*(.91)+t*.09;
    const x=crestX+(plungeX-crestX)*arc;
    const y=MIRRORFALL.topY - down*t;
    for(let j=0;j<=nx;j++){
      const u=j/nx;
      const offset=(u-.5)*width*(.95+.08*Math.sin(t*17+phase));
      const ruffle=Math.sin(u*29+t*17+phase)*(.45+t*2.5)
          +Math.sin(u*66-t*12+phase)*.35;
      points.push(x+Math.sin(u*8+phase)*1.1,
        y+Math.sin(u*24+phase)*.25,
        GRAND_LAKE.z+zOffset+offset+ruffle);
      uv.push(u,t);
      if(i<ny && j<nx){
        const a=i*(nx+1)+j,b=a+nx+1;
        faces.push(a,b,a+1,b,b+1,a+1);
      }
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(faces);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,material);
  mesh.frustumCulled=false;
  mesh.renderOrder=3;
  mesh.name='water.azure.mirrorfall-curtain';
  return mesh;
}

interface Droplet{
  x:number;y:number;z:number;
  vx:number;vy:number;vz:number;
  life:number;
}

/**
 * Multiple continuous painted curtains and a fixed-pool ballistic splash.
 * Gravity and collision affect emitted spray, while water sheets use an
 * advection shader; they are not a costly full-volume fluid solver.
 */
export class MirrorfallCascade {
  readonly group=new THREE.Group();
  private readonly waterMat:THREE.ShaderMaterial;
  private readonly spray:THREE.InstancedMesh;
  private readonly droplets:Droplet[]=[];
  private readonly random=rng(AZURE_SEED+602);
  private readonly dummy=new THREE.Object3D();
  private readonly rings:THREE.Mesh[]=[];
  private readonly mist:THREE.Sprite[]=[];
  private previousTime=0;
  constructor(){
    this.group.name='water.azure.mirrorfall-cascade';
    this.waterMat=new THREE.ShaderMaterial({
      uniforms:{uTime:{value:0}},vertexShader:vertex,fragmentShader:fragment,
      side:THREE.DoubleSide,transparent:true,depthWrite:false,
    });
    for(const [i,width,offset] of [[0,46,0],[1,24,-9],[2,18,11]] as const){
      this.group.add(ribbon(width,offset,i*2.3,this.waterMat));
    }
    const material=new THREE.MeshBasicMaterial({
      color:0xc8edeb,transparent:true,opacity:.60,depthWrite:false,
    });
    const particleCount=720;
    this.spray=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),material,particleCount);
    this.spray.name='water.azure.mirrorfall-ballistic-spray';
    this.spray.frustumCulled=false;
    for(let i=0;i<particleCount;i++){
      const drop={x:0,y:0,z:0,vx:0,vy:0,vz:0,life:0};
      this.reset(drop, true);this.droplets.push(drop);
    }
    this.group.add(this.spray);

    for(let i=0;i<4;i++){
      const ring=new THREE.Mesh(
        new THREE.TorusGeometry(7+i*4,.38+i*.13,6,72),
        new THREE.MeshBasicMaterial({
          color:i%2?0xb8e6df:0xebf6f1,side:THREE.DoubleSide,
          transparent:true,opacity:.38,depthWrite:false
        }),
      );
      ring.rotation.x=-Math.PI/2;
      ring.position.set(plungeX,GRAND_LAKE.surfaceY+.90+i*.08,GRAND_LAKE.z);
      ring.name='water.azure.mirrorfall-impact-ripple';
      this.rings.push(ring);this.group.add(ring);
    }

    const texture=this.makeMistTexture();
    for(let i=0;i<12;i++){
      const sprite=new THREE.Sprite(new THREE.SpriteMaterial({
        map:texture,transparent:true,opacity:.12+(i%3)*.07,
        depthWrite:false,color:0xe3f6ed,
      }));
      sprite.position.set(plungeX+(this.random()-.5)*49,
        GRAND_LAKE.surfaceY+8+(i%5)*4,
        GRAND_LAKE.z+(this.random()-.5)*42);
      sprite.scale.set(23+(i%4)*13,17+(i%3)*8,1);
      this.mist.push(sprite);this.group.add(sprite);
    }
  }

  private makeMistTexture():THREE.Texture{
    const n=64,bytes=new Uint8Array(n*n*4);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const dx=(x+.5-n/2)/(n/2),dy=(y+.5-n/2)/(n/2);
      const a=Math.exp(-(dx*dx+dy*dy)*5.0);
      const j=(y*n+x)*4;
      bytes[j]=226;bytes[j+1]=246;bytes[j+2]=241;bytes[j+3]=Math.round(a*255);
    }
    const t=new THREE.DataTexture(bytes,n,n,THREE.RGBAFormat);
    t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearFilter;t.needsUpdate=true;
    return t;
  }

  private reset(d:Droplet,randomAge:boolean):void{
    d.x=plungeX+(this.random()-.5)*MIRRORFALL.width*.90;
    d.y=GRAND_LAKE.surfaceY+.90;
    d.z=GRAND_LAKE.z+(this.random()-.5)*32;
    const phi=this.random()*Math.PI*2;
    const horizontal=2+this.random()*17;
    d.vx=Math.cos(phi)*horizontal;
    d.vz=Math.sin(phi)*horizontal;
    d.vy=5+this.random()*20;
    d.life=randomAge?this.random()*3.7:0;
    if(randomAge){d.x+=d.vx*d.life*.55;d.z+=d.vz*d.life*.55;
      d.y=Math.max(GRAND_LAKE.surfaceY+.9,d.y+d.vy*d.life-.5*gravity*d.life*d.life);}
  }

  update(time:number):void{
    const dt=Math.min(.065,Math.max(0,time-this.previousTime));
    this.previousTime=time;
    this.waterMat.uniforms.uTime!.value=time;
    this.droplets.forEach((d,i)=>{
      d.vy-=gravity*dt;
      d.vx*=Math.exp(-.42*dt);d.vz*=Math.exp(-.42*dt);
      d.x+=d.vx*dt;d.z+=d.vz*dt;d.y+=d.vy*dt;d.life+=dt;
      if(d.y<GRAND_LAKE.surfaceY+.15||d.life>4.8)this.reset(d,false);
      const s=.10+(i%4)*.082;
      this.dummy.position.set(d.x,d.y,d.z);
      this.dummy.scale.set(s,s*(1.1+(i%5)*.14),s);
      this.dummy.updateMatrix();
      this.spray.setMatrixAt(i,this.dummy.matrix);
    });
    this.spray.instanceMatrix.needsUpdate=true;
    this.rings.forEach((ring,i)=>{
      const k=(time*.20+i*.25)%1;
      ring.scale.setScalar(.8+k*1.8);
      (ring.material as THREE.MeshBasicMaterial).opacity=.46*(1-k);
    });
    this.mist.forEach((s,i)=>{
      s.position.y=GRAND_LAKE.surfaceY+5+(i%5)*4+Math.sin(time*.56+i)*2.1;
      s.position.x=plungeX+Math.sin(time*.18+i*1.4)*11;
    });
  }
  dispose():void{
    this.group.traverse(obj=>{
      if(obj instanceof THREE.Mesh || obj instanceof THREE.Sprite){
        if(obj instanceof THREE.Mesh)obj.geometry.dispose();
        if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose());
        else obj.material.dispose();
      }
    });
    const tex=(this.mist[0]?.material as THREE.SpriteMaterial|undefined)?.map;
    tex?.dispose();this.waterMat.dispose();
    this.group.removeFromParent();
  }
}
