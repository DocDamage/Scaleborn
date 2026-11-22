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
    gl_Position=projectionMatrix*viewMatrix*world;
  }
`;
const fragment = `
  precision highp float;
  uniform float uTime;
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
    float flow=noise(q*.16+vec2(t*.21,-t*.16));
    float finer=noise(q*.57-vec2(t*.38,t*.20));
    float fizz=noise(q*1.28+vec2(-t*.48,t*.32));
    float irregularity=(flow-.5)*.38+(finer-.5)*.24;
    float radial=sin(clamp(vFoamUv.y+irregularity,0.0,1.0)*3.14159265);
    float breakUp=smoothstep(.38,.82,flow*.60+finer*.28+fizz*.12);
    float eddies=.5+.5*sin(vFoamUv.x*65.0-vRing*3.2+t*1.7);
    float band=1.0-smoothstep(.16,.96,abs(vRing-.15));
    float alpha=pow(max(0.0,radial),1.35)*(.12+.37*breakUp)
      *(.52+.48*eddies)*(.79+.21*band);
    alpha*=exp(-length(cameraPosition-vWorld)*.0045);
    // The inner sheet has some continuous water whitening. Outer patches
    // dissipate into independent small foam islands.
    alpha*=mix(1.0,.64,vRing);
    vec3 color=mix(vec3(.48,.69,.69),vec3(.89,.96,.92),
      clamp(.24+.55*fizz+.21*eddies,0.0,1.0));
    gl_FragColor=vec4(color,clamp(alpha,0.0,.46));
  }
`;

export class PlungePoolFoam {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor(quality: 'high' | 'low' = 'high') {
    const ringCount = 4;
    const segments = quality === 'high' ? 160 : 88;
    const positions: number[] = [];
    const uvs: number[] = [];
    const rings: number[] = [];
    const indices: number[] = [];
    const radii = [7.0, 12.6, 20.2, 30.5];

    for (let band = 0; band < ringCount; band++) {
      const radius = radii[band]!;
      const halfWidth = 1.8 + band * .48;
      const base = positions.length / 3;
      for (let j = 0; j <= segments; j++) {
        const arc = j / segments;
        const angle = arc * Math.PI * 2;
        // World-space noise varying only along the band creates a ragged
        // edge while preserving a seamless wrap at 0/2π.
        const warp = .38 * Math.sin(angle*5+band*1.4)
          + .29 * Math.sin(angle*11-band*.65);
        for (let edge = 0; edge <= 2; edge++) {
          const widthFraction = edge / 2;
          const r = radius + warp + (widthFraction-.5)*halfWidth*2;
          const x = MIRRORFALL_IMPACT.x + Math.cos(angle) * r;
          const z = MIRRORFALL_IMPACT.z + Math.sin(angle) * r;
          positions.push(x, GRAND_LAKE.surfaceY+.20, z);
          uvs.push(arc, widthFraction);
          rings.push(band/(ringCount-1));
        }
      }

      for (let j = 0; j < segments; j++) {
        const offset=base+j*3, next=offset+3;
        // Some impact rings intersect the dry bank. The shore is a real
        // constraint, so no foam triangles overhang dry hillside polygons.
        for (let strip=0; strip<2; strip++) {
          const a=offset+strip,b=next+strip,c=a+1,d=b+1;
          const inside=(i:number):boolean=>
            lakeContains(positions[i*3]!,positions[i*3+2]!);
          if (![a,b,c,d].every(inside)) continue;
          indices.push(a,b,c,b,d,c);
        }
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setAttribute('aRing',new THREE.Float32BufferAttribute(rings,1));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material=new THREE.ShaderMaterial({
      uniforms:{
        uTime:{value:0},
        uImpactWorld:{value:new THREE.Vector2(MIRRORFALL_IMPACT.x,MIRRORFALL_IMPACT.z)},
      },
      vertexShader:vertex,fragmentShader:fragment,
      transparent:true,depthWrite:false,side:THREE.DoubleSide,
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
