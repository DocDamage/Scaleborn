import * as THREE from 'three';
import { rng } from '../core/random';
import { AZURE_SEED } from './terrain';
import { GRAND_LAKE, MIRRORFALL, lakeContains } from './highlandLake';
import { waterWaveOffsetAt } from './waterWaves';
import { MIRRORFALL_IMPACT } from './waterDynamics';
import { PlungePoolFoam } from './plungePoolFoam';
import { makeSprayStreakGeometry, makeSprayStreakTexture } from './sprayStreak';

const crestX=MIRRORFALL.x-1;
const plungeX=MIRRORFALL_IMPACT.x;
const down=MIRRORFALL.topY-GRAND_LAKE.surfaceY;
const gravity=9.81;

/** Match ballistic-spray contact with the rendered lake, not a static plane.
 * Droplets outside the shoreline should still be retired at the lake rim.
 */
export function waterfallSpraySurfaceY(x:number,z:number,time:number):number {
  if (![x,z,time].every(Number.isFinite) || !lakeContains(x,z))
    return GRAND_LAKE.surfaceY;
  // Only height is needed here: the normal/slope finite differences in
  // sampleWaterWaves would multiply trigonometric work by five per drop.
  return GRAND_LAKE.surfaceY + waterWaveOffsetAt(x,z,time);
}

const vertex=`
  #include <fog_pars_vertex>
  uniform float uTime;
  varying vec2 vFlowUv;
  varying vec3 vFlowWorld;
  varying float vSheetFold;
  void main(){
    vFlowUv=uv;
    // An accelerating, wind-sheared fall. The crown remains attached
    // to the rock; lower portions flex and separate into uneven veils.
    float fallMix=smoothstep(.08,.92,uv.y);
    float gust=uTime*.58 + position.z*.034;
    float wave=sin(uv.y*23.0-gust*2.8+uv.x*12.0);
    float filament=sin(uv.x*35.0+uv.y*48.0-uTime*3.7);
    vec3 sheetFlutter=position;
    sheetFlutter.z += fallMix*(1.45*wave+.43*filament);
    sheetFlutter.x += fallMix*(.69*sin(uv.y*18.0-uTime*2.1+uv.x*22.0));
    vSheetFold=.5+.5*wave;
    vFlowWorld=(modelMatrix*vec4(sheetFlutter,1.0)).xyz;
    vec4 mvPosition=viewMatrix*vec4(vFlowWorld,1.0);
    gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
  }
`;
const fragment=`
  precision highp float;
  #include <fog_pars_fragment>
  uniform float uTime;
  varying vec2 vFlowUv;
  varying vec3 vFlowWorld;
  varying float vSheetFold;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  void main(){
    vec2 p=vFlowUv;
    float t=uTime;
    // Advected streaks vary in flow velocity and separate into finer
    // jets near the plunge pool. Edges are turbulent, not rectangular.
    // Higher vertical sheet speed near the lake yields flowing streaks
    // without moving the fixed waterfall crest.
    float flowAccel=mix(7.4,16.5,sqrt(clamp(p.y,0.0,1.0)));
    float strip=noise(vec2(p.x*29.0+sin(p.y*10.0)*.24,
      p.y*35.0-t*(flowAccel+p.x*1.1)));
    float wash=noise(vec2(p.x*78.0+p.y*1.9,
      p.y*95.0-t*(flowAccel*1.8)));
    float longFlow=pow(.5+.5*sin(p.x*84.0+wash*3.1+
      sin(p.y*20.0-t*2.1)*1.4),3.3);
    float whiteJet=pow(.5+.5*sin(p.x*155.0+
      sin(p.y*37.0-t*2.3)*2.3),4.0);
    float broken=smoothstep(.35,.86,strip*.57+wash*.43);
    float turbulence=clamp(broken*.55+whiteJet*.36+longFlow*.26,0.0,1.0);
    float edgeNoise=.07*(strip-.5)+.028*sin(p.y*43.0-t*2.4);
    float ragged=p.x+edgeNoise;
    float edge=smoothstep(.035,.18,ragged)
      *(1.0-smoothstep(.79,.965,ragged));
    float nearImpact=smoothstep(.66,.98,p.y);
    // Break the lower curtain into intermittent voids and brighter jets,
    // instead of a continuous semi-opaque rectangular water billboard.
    float porosity=noise(vec2(p.x*58.0+vSheetFold*2.3,
      p.y*66.0-t*flowAccel*.7));
    float breakup=smoothstep(.31,.67,porosity+broken*.15);
    float baseAlpha=edge*(.18+.40*turbulence+.13*wash);
    baseAlpha*=mix(1.0,.38+.62*breakup,nearImpact*.85);
    baseAlpha+=nearImpact*edge*broken*breakup*.15;
    vec3 base=vec3(.11,.29,.36);
    vec3 white=vec3(.91,.98,.96);
    vec3 color=mix(base,white,
      clamp(.20+.54*turbulence+.16*longFlow,0.0,.95));
    color+=vec3(.08,.09,.08)*wash;
    gl_FragColor=vec4(color,clamp(baseAlpha,0.0,.78));
    #include <fog_fragment>
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
      const offset=(u-.5)*width*(.74+t*.49+.065*Math.sin(t*17+phase));
      const ruffle=Math.sin(u*29+t*17+phase)*(.62+t*3.1)
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
  private readonly foam:PlungePoolFoam;
  private readonly sprayTexture:THREE.DataTexture;
  private readonly velocity=new THREE.Vector3();
  private readonly up=new THREE.Vector3(0,1,0);
  private readonly mist:THREE.Sprite[]=[];
  private previousTime=0;
  constructor(quality:'high'|'low'='high'){
    this.group.name='water.azure.mirrorfall-cascade';
    this.foam=new PlungePoolFoam(quality);
    this.waterMat=new THREE.ShaderMaterial({
      // Custom ShaderMaterial fog chunks require the full stock fog uniform
      // block. Without it WebGLRenderer dereferences undefined.value on the
      // first rendered frame, freezing gameplay and screenshot automation.
      uniforms:THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {uTime:{value:0}},
      ]),
      vertexShader:vertex,fragmentShader:fragment,
      side:THREE.DoubleSide,transparent:true,depthWrite:false,fog:true,
    });
    for(const [i,width,offset] of [[0,78,0],[1,42,-21],[2,32,24]] as const){
      this.group.add(ribbon(width,offset,i*2.3,this.waterMat));
    }
    this.sprayTexture=makeSprayStreakTexture();
    const material=new THREE.MeshBasicMaterial({
      color:0xe2f5f0,map:this.sprayTexture,transparent:true,
      opacity:.68,alphaTest:.025,depthWrite:false,
      side:THREE.DoubleSide,fog:true,
    });
    const particleCount=quality==='high'?720:420;
    this.spray=new THREE.InstancedMesh(
      makeSprayStreakGeometry(),material,particleCount);
    this.spray.name='water.azure.mirrorfall-ballistic-spray';
    this.spray.frustumCulled=false;
    for(let i=0;i<particleCount;i++){
      const drop={x:0,y:0,z:0,vx:0,vy:0,vz:0,life:0};
      this.reset(drop, true);this.droplets.push(drop);
    }
    this.group.add(this.spray);

    // Irregular, lake-clipped foam surface replaces artificial torus circles.
    this.group.add(this.foam.mesh);

    const texture=this.makeMistTexture();
    for(let i=0;i<18;i++){
      const sprite=new THREE.Sprite(new THREE.SpriteMaterial({
        map:texture,transparent:true,opacity:.15+(i%4)*.055,
        depthWrite:false,color:0xe3f6ed,
      }));
      sprite.position.set(plungeX+(this.random()-.5)*49,
        GRAND_LAKE.surfaceY+8+(i%5)*4,
        GRAND_LAKE.z+(this.random()-.5)*42);
      sprite.scale.set(29+(i%5)*12,19+(i%3)*10,1);
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
    d.z=GRAND_LAKE.z+(this.random()-.5)*32;
    d.y=waterfallSpraySurfaceY(d.x,d.z,this.previousTime)+.90;
    const phi=this.random()*Math.PI*2;
    const horizontal=2+this.random()*17;
    d.vx=Math.cos(phi)*horizontal;
    d.vz=Math.sin(phi)*horizontal;
    d.vy=5+this.random()*20;
    d.life=randomAge?this.random()*3.7:0;
    if(randomAge){d.x+=d.vx*d.life*.55;d.z+=d.vz*d.life*.55;
      d.y=Math.max(waterfallSpraySurfaceY(d.x,d.z,this.previousTime)+.9,
        d.y+d.vy*d.life-.5*gravity*d.life*d.life);}
  }

  update(time:number):void{
    const dt=Math.min(.065,Math.max(0,time-this.previousTime));
    this.previousTime=time;
    this.waterMat.uniforms.uTime!.value=time;
    this.droplets.forEach((d,i)=>{
      d.vy-=gravity*dt;
      d.vx*=Math.exp(-.42*dt);d.vz*=Math.exp(-.42*dt);
      d.x+=d.vx*dt;d.z+=d.vz*dt;d.y+=d.vy*dt;d.life+=dt;
      // Recycle at the same crest/trough that swimmers and the surface
      // shader use, avoiding droplets sinking into a raised wind wave.
      if(d.y<waterfallSpraySurfaceY(d.x,d.z,time)+.15||d.life>4.8)
        this.reset(d,false);
      const s=.10+(i%4)*.082;
      this.dummy.position.set(d.x,d.y,d.z);
      this.velocity.set(d.vx,d.vy,d.vz);
      const speed=this.velocity.length();
      if(speed>.0001) {
        this.velocity.multiplyScalar(1/speed);
        this.dummy.quaternion.setFromUnitVectors(this.up,this.velocity);
      }else this.dummy.quaternion.identity();
      this.dummy.scale.set(s*.82,.38+Math.min(1.05,speed*.018),s*.82);
      this.dummy.updateMatrix();
      this.spray.setMatrixAt(i,this.dummy.matrix);
    });
    this.spray.instanceMatrix.needsUpdate=true;
    this.foam.update(time);
    this.mist.forEach((s,i)=>{
      s.position.y=GRAND_LAKE.surfaceY+5+(i%5)*4+Math.sin(time*.56+i)*2.1;
      s.position.x=plungeX+Math.sin(time*.18+i*1.4)*11;
    });
  }
  dispose():void{
    this.foam.dispose();
    const geometries=new Set<THREE.BufferGeometry>();
    const materials=new Set<THREE.Material>();
    this.group.traverse(obj=>{
      if(obj instanceof THREE.Mesh || obj instanceof THREE.Sprite){
        if(obj instanceof THREE.Mesh)geometries.add(obj.geometry);
        if(Array.isArray(obj.material))obj.material.forEach(m=>materials.add(m));
        else materials.add(obj.material);
      }
    });
    geometries.forEach(g=>g.dispose());
    materials.forEach(m=>m.dispose());
    const tex=(this.mist[0]?.material as THREE.SpriteMaterial|undefined)?.map;
    tex?.dispose();
    this.sprayTexture.dispose();
    this.group.removeFromParent();
  }
}
