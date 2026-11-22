import * as THREE from 'three';
import { GRAND_LAKE, lakeContains } from './highlandLake';
import { MIRRORFALL_IMPACT } from './waterDynamics';

/**
 * Actual area foam instead of four rigid, bright torus outlines. Broad
 * broken-up bands near the waterfall impact surface, deforming with the SAME
 * four wave phases and plunge-point ripple as the freshwater lake shader.
 * Terrain/lake clipping is done once during mesh construction.
 *
 * Not CFD: froth opacity is an artistic approximation driven by overlapping
 * waves and a deterministic radial impact region.
 */
const vertex = `
  #include <fog_pars_vertex>
  uniform float uTime;
  uniform vec2 uImpactWorld;
  attribute float aRing;
  varying vec2 vFoamUv;
  varying float vRing;
  varying vec3 vWorld;

  void main() {
    vec3 p=position;
    vec2 q=p.xz;
    float t=uTime;
    float w1=dot(q,normalize(vec2(.87,.49)))*.16-t*.95;
    float w2=dot(q,normalize(vec2(-.23,.97)))*.37-t*1.47;
    float w3=dot(q,normalize(vec2(.64,-.76)))*.76-t*2.15;
    float w4=dot(q,normalize(vec2(.18,.98)))*.08-t*.62;
    p.y+=.53*sin(w1)+.24*sin(w2)+.10*sin(w3)+.64*sin(w4);
    float plungeD=length(q-uImpactWorld);
    p.y+=exp(-plungeD*.038)*.72*sin(plungeD*.225-t*1.63);
    p.x+=.16*cos(w1)+.05*cos(w2);
    p.z+=.12*cos(w1)+.07*cos(w4);
    vec4 world=modelMatrix*vec4(p,1.0);
    vWorld=world.xyz;
    vFoamUv=uv;
    vRing=aRing;
    vec4 mvPosition=viewMatrix*world;
    gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
  }
`;
const fragment = `
  precision highp float;
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec2 uImpactWorld;
  varying vec2 vFoamUv;
  varying float vRing;
  varying vec3 vWorld;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),
               mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
  }
  void main(){
    // Break the flow into bright foam patches, not complete circle outlines.
    if(cameraPosition.y < vWorld.y-.35) discard;
    vec2 q=vWorld.xz;
    float t=uTime;
    // Follow the waterfall's outward water-current direction rather than
    // sliding a uniform screen-space noise field across stationary rings.
    vec2 radial=q-uImpactWorld;
    vec2 outflow=radial/max(length(radial),.001);
    float strength=1.0-smoothstep(0.0,43.0,length(radial));
    vec2 flowQ=q-outflow*t*(.65+strength*1.25);
    float flow=noise(flowQ*.16+vec2(t*.09,-t*.06));
    float finer=noise(flowQ*.57-vec2(t*.18,t*.10));
    float fizz=noise(flowQ*1.28+vec2(-t*.36,t*.24));
    float irregularity=(flow-.5)*.38+(finer-.5)*.24;
    float across=sin(clamp(vFoamUv.y+irregularity,0.0,1.0)*3.14159265);
    float tips=smoothstep(.0,.09,vFoamUv.x)
      *(1.0-smoothstep(.76,1.0,vFoamUv.x));
    float breakUp=smoothstep(.38,.82,flow*.60+finer*.28+fizz*.12);
    float eddies=.5+.5*sin(vFoamUv.x*65.0-vRing*3.2+t*1.7);
    float band=1.0-smoothstep(.16,.96,abs(vRing-.15));
    float alpha=pow(max(0.0,across),1.35)*tips*(.12+.37*breakUp)
      *(.52+.48*eddies)*(.79+.21*band);
    alpha*=exp(-length(cameraPosition-vWorld)*.0045);
    // The inner sheet has some continuous water whitening. Outer patches
    // dissipate into independent small foam islands.
    alpha*=mix(1.0,.64,vRing);
    vec3 color=mix(vec3(.48,.69,.69),vec3(.89,.96,.92),
      clamp(.24+.55*fizz+.21*eddies,0.0,1.0));
    gl_FragColor=vec4(color,clamp(alpha,0.0,.46));
    #include <fog_fragment>
  }
`;


/**
 * A single, indexed foam draw made of separate narrow streamlines.
 *
 * Previous geometry was four concentric ring bands, so even transparent
 * turbulence read as artificial circles in the live lake. These detached
 * open-ended streaks radiate along the plunge pool's existing outward
 * current and gently curve through its local swirl. They remain tied to
 * the same impact coordinates and never submit faces over the dry bank.
 *
 * Only deterministic geometry is built here, once; animated wet foam
 * breakup remains in the original fog-aware shader.
 */
export function makePlungeFoamTrails(quality:'high'|'low'='high'):THREE.BufferGeometry {
  const trails=quality==='high'?48:30;
  const steps=quality==='high'?28:18;
  const positions:number[]=[], uvs:number[]=[], rings:number[]=[], indices:number[]=[];
  const goldenAngle=2.399963229728653;

  for(let i=0;i<trails;i++){
    const azimuth=(i+.31)*goldenAngle;
    const phase=Math.sin(i*13.73)*.5+.5;
    const startRadius=2.6+phase*15.4;
    const length=9.5+((i*17)%29)/29*23;
    const width=.70+((i*11)%13)/13*1.25;
    const swirl=(i%2===0?1:-1)*(.12+.13*phase);
    const start=positions.length/3;

    const center=(t:number):{x:number;z:number}=>{
      const r=startRadius+t*length;
      const bend=swirl*t*(1-.28*t)+.045*Math.sin(t*5.6+i*.71)*t;
      const angle=azimuth+bend;
      return {
        x:MIRRORFALL_IMPACT.x+Math.cos(angle)*r,
        z:MIRRORFALL_IMPACT.z+Math.sin(angle)*r,
      };
    };

    for(let j=0;j<=steps;j++){
      const t=j/steps;
      const mid=center(t);
      const back=center(Math.max(0,t-.002));
      const ahead=center(Math.min(1,t+.002));
      const tx=ahead.x-back.x,tz=ahead.z-back.z;
      const inverse=1/Math.max(1e-5,Math.hypot(tx,tz));
      const nx=-tz*inverse,nz=tx*inverse;
      // Subtle taper at both ends prevents rectangular, closed ring pieces.
      // Each strip has its own irregular width and no repeated center.
      const tapered=.04+.96*Math.pow(Math.max(0,Math.sin(Math.PI*t)),.65);
      const halfWidth=width*tapered*
        (.86+.14*Math.sin(t*11.2+i*.87));
      for(let side=0;side<=2;side++){
        const offset=side-1;
        positions.push(
          mid.x+nx*halfWidth*offset,
          GRAND_LAKE.surfaceY+.20,
          mid.z+nz*halfWidth*offset,
        );
        uvs.push(t,side/2);
        rings.push(Math.min(1,(startRadius+length*t)/MIRRORFALL_IMPACT.turbulenceRadius));
      }
    }
    // Index *after* both edge rows exist. Checking a future vertex while
    // streaming row j silently rejected every quad as outside the lake.
    for(let j=0;j<steps;j++){
      const a=start+j*3,b=a+3;
      for(let strip=0;strip<2;strip++){
        const v0=a+strip,v1=v0+1,v2=b+strip,v3=v2+1;
        const inside=(index:number):boolean=>
          lakeContains(positions[index*3]!,positions[index*3+2]!);
        // No extrapolation onto the escarpment or through shore geometry.
        if([v0,v1,v2,v3].every(inside)) {
          indices.push(v0,v2,v1,v2,v3,v1);
        }
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('aRing',new THREE.Float32BufferAttribute(rings,1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.trailCount=trails;
  geometry.userData.stepsPerTrail=steps;
  return geometry;
}

export class PlungePoolFoam {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor(quality: 'high' | 'low' = 'high') {
    const geometry=makePlungeFoamTrails(quality);
    const material=new THREE.ShaderMaterial({
      uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{
        uTime:{value:0},
        uImpactWorld:{value:new THREE.Vector2(MIRRORFALL_IMPACT.x,MIRRORFALL_IMPACT.z)},
      }]),
      vertexShader:vertex,fragmentShader:fragment,
      transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:true,
      depthTest:true,blending:THREE.NormalBlending,
    });
    this.mesh=new THREE.Mesh(geometry,material);
    this.mesh.name='water.azure.mirrorfall-impact-foam';
    this.mesh.renderOrder=4;
    this.mesh.frustumCulled=false;
  }

  update(time:number):void {
    this.mesh.material.uniforms.uTime!.value=time;
  }

  dispose():void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
