import * as THREE from 'three';
import { GRAND_LAKE, lakeBoundaryScale } from './highlandLake';
import { MIRRORFALL_IMPACT } from './waterDynamics';
import { makeLakeBathymetry, BATHYMETRY_RANGE_METERS, LAKE_MAP_WIDTH, LAKE_MAP_HEIGHT } from './lakeBathymetry';
import { SEA_LEVEL, WORLD_WIDTH_METERS } from './terrain';

/**
 * Wind-driven, four-band Gerstner surface with analytic normals and Fresnel.
 * It is a fast physically inspired approximation rather than an Eulerian CFD
 * solver. Reusable by both the ocean and the fully navigable highland lake.
 */
const vert=`
  varying vec3 vScWorld;
  varying float vScWave;
  uniform float uTime;
  uniform float uLake;
  uniform vec2 uImpactWorld;
  uniform vec2 uWaveOrigin;
  vec3 wavePos(vec3 p) {
    float t=uTime;
    vec2 worldXZ=p.xz+uWaveOrigin;
    float w1=dot(worldXZ,normalize(vec2(.87,.49)))*.16-t*.95;
    float w2=dot(worldXZ,normalize(vec2(-.23,.97)))*.37-t*1.47;
    float w3=dot(worldXZ,normalize(vec2(.64,-.76)))*.76-t*2.15;
    float w4=dot(worldXZ,normalize(vec2(.18,.98)))*.08-t*.62;
    p.y+=.53*sin(w1)+.24*sin(w2)+.10*sin(w3)+.64*sin(w4);
    float plungeD=length(worldXZ-uImpactWorld);
    float plungeDecay=exp(-plungeD*.038);
    p.y += uLake*plungeDecay*.72*sin(plungeD*.225-t*1.63);
    p.x+=.16*cos(w1)+.05*cos(w2);
    p.z+=.12*cos(w1)+.07*cos(w4);
    vScWave=.5+.5*sin(w1);
    return p;
  }
  void main() {
    vec3 offset=wavePos(position);
    vec4 wp=modelMatrix*vec4(offset,1.0);
    vScWorld=wp.xyz;
    gl_Position=projectionMatrix*viewMatrix*wp;
  }
`;
const frag=`
  precision highp float;
  uniform float uTime;
  uniform float uLake;
  uniform vec2 uImpactWorld;
  uniform sampler2D uBathymetry;
  uniform vec2 uBathyOrigin;
  uniform vec2 uBathySpan;
  uniform float uDepthRange;
  varying vec3 vScWorld;
  varying float vScWave;
  float h(vec2 p) {
    return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
  }
  float noise(vec2 p) {
    vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x),
               mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);
  }
  void main() {
    vec2 q=vScWorld.xz;
    vec2 d=(q-vec2(${GRAND_LAKE.x.toFixed(1)},${GRAND_LAKE.z.toFixed(1)}))/
      vec2(${GRAND_LAKE.radiusX.toFixed(1)},${GRAND_LAKE.radiusZ.toFixed(1)});
    float angle=atan(d.y,d.x);
    float shoreShape=1.0+.067*sin(3.0*angle+1.10)
       +.042*sin(7.0*angle-.72)+.023*sin(13.0*angle+2.0);
    float r=length(d)/shoreShape;
    if (uLake>0.5 && r>.981) discard;
    vec2 bathyUv=(q-uBathyOrigin)/uBathySpan;
    float waterDepth=texture2D(uBathymetry,clamp(bathyUv,0.0,1.0)).r*uDepthRange;
    float shallow=uLake*(1.0-smoothstep(0.4,11.0,waterDepth));
    // Remove the ocean below the isolated freshwater basin.
    if (uLake<0.5 && r<1.05) discard;
    float t=uTime;
    float p1=dot(q,normalize(vec2(.87,.49)))*.16-t*.95;
    float p2=dot(q,normalize(vec2(-.23,.97)))*.37-t*1.47;
    float p3=dot(q,normalize(vec2(.64,-.76)))*.76-t*2.15;
    float p4=dot(q,normalize(vec2(.18,.98)))*.08-t*.62;
    vec2 slope=.53*.16*cos(p1)*normalize(vec2(.87,.49)) +
               .24*.37*cos(p2)*normalize(vec2(-.23,.97)) +
               .10*.76*cos(p3)*normalize(vec2(.64,-.76)) +
               .64*.08*cos(p4)*normalize(vec2(.18,.98));
    vec2 impact=q-uImpactWorld;
    float plungeDist=length(impact);
    float plungeDecay=uLake*exp(-plungeDist*.038);
    vec2 plungeNormal=impact/max(.001,plungeDist);
    slope+=plungeNormal*plungeDecay*.27*cos(plungeDist*.225-t*1.63);
    vec3 N=normalize(vec3(-slope.x,1.0,-slope.y));
    vec3 V=normalize(cameraPosition-vScWorld);
    vec3 L=normalize(vec3(-.56,.78,-.35));
    float nv=clamp(dot(N,V),0.0,1.0);
    float fresnel=.022+.978*pow(1.0-nv,5.0);
    float sparkle=pow(max(dot(reflect(-L,N),V),0.0),128.0);
    float ripples=noise(q*.22+vec2(t*.10,t*.08));
    float micro=noise(q*1.25-vec2(t*.24,t*.11));
    float waveFoam=smoothstep(.83,1.07,abs(sin(p2)+sin(p3)*.48))*.14;
    float nearShore=uLake>0.5?smoothstep(.948,.981,r):0.0;
    float surge=sin(r*134.0-t*2.3+noise(q*.055)*3.0);
    float foam=uLake>0.5?
       nearShore*shallow*(.06+.42*smoothstep(.28,.91,surge+micro*.31)):
       waveFoam;
    float turbulence=0.55+0.45*sin(plungeDist*.225-t*1.63);
    foam=clamp(foam+plungeDecay*(0.38+0.34*turbulence),0.0,0.93);
    vec3 deep=uLake>0.5?vec3(.025,.19,.245):vec3(.027,.155,.19);
    vec3 turquoise=uLake>0.5?vec3(.105,.39,.415):vec3(.10,.34,.39);
    float BeerLambert=exp(-waterDepth*.071);
    // Shallows transmit a sand/mineral tint; depth absorbs it progressively.
    vec3 bed=vec3(.40,.49,.38);
    vec3 shallowWater=vec3(.17,.53,.47);
    vec3 lakeAlbedo=mix(deep,shallowWater,BeerLambert*.84);
    lakeAlbedo=mix(lakeAlbedo,bed,BeerLambert*.20);
    vec3 base=mix(deep,turquoise,.18+.28*ripples+.08*sin(p1));
    base=mix(base,lakeAlbedo,uLake);
    base+=vec3(.018,.025,.016)*(micro-.5);
    vec3 reflected=mix(vec3(.27,.43,.57),vec3(.94,.73,.47),
      pow(max(dot(V,L),0.0),15.0));
    float skyFresnel=clamp(fresnel*.86+.05,0.0,.96);
    vec3 color=mix(base,reflected,skyFresnel);
    color+=vec3(.97,.88,.62)*sparkle*.87;
    color=mix(color,vec3(.82,.94,.87),clamp(foam,0.0,.91));
    // Transparent shallow water reveals painted lake-floor terrain.
    float alpha=uLake>.5 ? mix(.97,.49,BeerLambert*.70) : .95;
    gl_FragColor=vec4(color,alpha);
  }
`;

const foamVert=`
  varying vec3 vWorld;
  varying vec2 vFoamUv;
  void main() {
    vWorld=(modelMatrix*vec4(position,1.0)).xyz;
    vFoamUv=uv;
    gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);
  }
`;
const foamFrag=`
  uniform float uTime;
  uniform float uLakeStrip;
  varying vec3 vWorld;
  varying vec2 vFoamUv;
  void main() {
    float noiseA=sin(vWorld.x*.41+uTime*1.3+sin(vWorld.z*.31))*
                 sin(vWorld.z*.57-uTime*.83+sin(vWorld.x*.29));
    float turbulence=.5+.5*noiseA;
    float wisps=pow(turbulence,1.9);
    vec3 foam=mix(vec3(.55,.78,.75),vec3(.97,.99,.93),wisps);
    float coastalFade=sin(clamp(vFoamUv.y,0.0,1.0)*3.1415926);
    float striped=pow(max(0.0,sin(vFoamUv.x*300.0-uTime*1.36
      +noiseA*2.7)),2.0);
    float pulse=mix(1.0,coastalFade*(.3+.7*striped),uLakeStrip);
    gl_FragColor=vec4(foam,clamp((.07+.46*wisps)*pulse,0.0,.61));
  }
`;

export function makeFoamShader(lakeStrip = false): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uLakeStrip:{value:lakeStrip?1:0}},
    vertexShader:foamVert,fragmentShader:foamFrag,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    blending:THREE.NormalBlending,
  });
}

export class PainterlyWaterSurface {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly bathymetry: THREE.DataTexture;
  constructor(kind:'ocean'|'lake') {
    const isLake=kind==='lake';
    this.bathymetry = isLake
      ? makeLakeBathymetry()
      : new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);
    this.bathymetry.needsUpdate=true;
    this.material=new THREE.ShaderMaterial({
      uniforms:{
        uTime:{value:0},
        uLake:{value:isLake?1:0},
        uWaveOrigin:{value:new THREE.Vector2(isLake ? GRAND_LAKE.x : 0,
          isLake ? GRAND_LAKE.z : 0)},
        uImpactWorld:{value:new THREE.Vector2(MIRRORFALL_IMPACT.x,MIRRORFALL_IMPACT.z)},
        uBathymetry:{value:this.bathymetry},
        uBathyOrigin:{value:new THREE.Vector2(
          GRAND_LAKE.x-LAKE_MAP_WIDTH*.5,GRAND_LAKE.z-LAKE_MAP_HEIGHT*.5)},
        uBathySpan:{value:new THREE.Vector2(LAKE_MAP_WIDTH,LAKE_MAP_HEIGHT)},
        uDepthRange:{value:BATHYMETRY_RANGE_METERS},
      },
      vertexShader:vert,fragmentShader:frag,
      transparent:true,depthWrite:false,side:THREE.DoubleSide,
    });
    const geo=isLake?
      new THREE.PlaneGeometry(GRAND_LAKE.radiusX*2.05,GRAND_LAKE.radiusZ*2.05,160,132):
      new THREE.PlaneGeometry(WORLD_WIDTH_METERS+2600,WORLD_WIDTH_METERS+2600,110,110);
    geo.rotateX(-Math.PI/2);
    this.mesh=new THREE.Mesh(geo,this.material);
    this.mesh.position.set(
      isLake?GRAND_LAKE.x:0,
      isLake?GRAND_LAKE.surfaceY:SEA_LEVEL,
      isLake?GRAND_LAKE.z:0,
    );
    this.mesh.name=isLake?'water.azure.mirrorfall-lake':'water.azure.ocean';
    this.mesh.renderOrder=isLake?2:1;
  }
  update(time:number):void{this.material.uniforms.uTime!.value=time;}
  dispose():void{this.mesh.geometry.dispose();this.material.dispose();this.bathymetry.dispose();}
}

export class LakeShoreFoam {
  readonly mesh: THREE.Mesh;
  private readonly material=makeFoamShader(true);
  constructor(){
    const positions:number[]=[],uvs:number[]=[];
    const n=720,ring=0.981;
    for(let i=0;i<n;i++){
      const a=(i/n)*Math.PI*2,b=((i+1)/n)*Math.PI*2;
      const point=(angle:number, inward:number):[number,number,number]=>[
        GRAND_LAKE.x+Math.cos(angle)*GRAND_LAKE.radiusX*(ring-inward)*lakeBoundaryScale(angle),
        GRAND_LAKE.surfaceY+0.82,
        GRAND_LAKE.z+Math.sin(angle)*GRAND_LAKE.radiusZ*(ring-inward)*lakeBoundaryScale(angle),
      ];
      const p0=point(a,0.0),p1=point(a,0.011),p2=point(b,0),p3=point(b,0.011);
      positions.push(...p0,...p1,...p2,...p1,...p3,...p2);
      const u0=i/n,u1=(i+1)/n;
      uvs.push(u0,0,u0,1,u1,0,u0,1,u1,1,u1,0);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.computeVertexNormals();
    this.mesh=new THREE.Mesh(geometry,this.material);
    this.mesh.name='water.azure.lake-shore-foam';
    this.mesh.renderOrder=3;
  }
  update(time:number):void{this.material.uniforms.uTime!.value=time;}
  dispose():void{this.mesh.geometry.dispose();this.material.dispose();}
}
