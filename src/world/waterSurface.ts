import * as THREE from 'three';
import { GRAND_LAKE } from './highlandLake';
import { makeLakeShoreBreakGeometry } from './lakeShoreBreak';
import { MIRRORFALL_IMPACT } from './waterDynamics';
import { makeLakeBathymetry, BATHYMETRY_RANGE_METERS, LAKE_MAP_WIDTH, LAKE_MAP_HEIGHT } from './lakeBathymetry';
import { SEA_LEVEL, WORLD_WIDTH_METERS } from './terrain';

/**
 * Wind-driven, four-band Gerstner surface with analytic normals and Fresnel.
 * It is a fast physically inspired approximation rather than an Eulerian CFD
 * solver. Reusable by both the ocean and the fully navigable highland lake.
 */
const vert=`
  #include <fog_pars_vertex>
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
    vec4 mvPosition=viewMatrix*wp;
    gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
  }
`;
const frag=`
  precision highp float;
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform float uLake;
  uniform vec2 uImpactWorld;
  uniform sampler2D uBathymetry;
  uniform vec2 uBathyOrigin;
  uniform vec2 uBathySpan;
  uniform float uDepthRange;
  // The coarse 6 km ocean is not tessellated finely enough for the
  // shortest wind waves. A camera-following detail patch replaces it nearby.
  uniform float uNearRole;
  uniform vec2 uNearCenter;
  uniform float uNearHole;
  uniform float uNearHalf;
  uniform vec2 uMidCenter;
  uniform float uMidHole;
  uniform float uMidHalf;
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
    float nearDist=max(abs(q.x-uNearCenter.x),abs(q.y-uNearCenter.y));
    float midDist=max(abs(q.x-uMidCenter.x),abs(q.y-uMidCenter.y));
    // Three nested LODs: far ocean is cut beneath the mid-field; the
    // mid-field is cut beneath the high-resolution near-field. Without
    // both masks, overlapping coarse vertices visibly pierce the waves.
    if (uNearRole>.5 && uNearRole<1.5 && midDist<uMidHole) discard;
    if (uNearRole>2.5 && nearDist<uNearHole) discard;
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
    // The near detail patch fades into a moderately tessellated 640 m
    // mid-field, rather than straight into 60 m-spaced ocean polygons.
    // The middle patch then blends into the distant ocean. Both borders
    // are feathered outside their respective underlying cutouts.
    float patchFade=1.0;
    if(uNearRole>1.5 && uNearRole<2.5)
      patchFade=1.0-smoothstep(uNearHole-.5,uNearHalf,nearDist);
    if(uNearRole>2.5)
      patchFade=1.0-smoothstep(uMidHole-.5,uMidHalf,midDist);
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
    // Crest foam is a TOP-side phenomenon. The back of the translucent
    // water surface must not paint a bright shoreline ring beneath a diver.
    float submergedView=1.0-smoothstep(-.25,1.15,cameraPosition.y-vScWorld.y);
    foam*=1.0-submergedView;
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
    // Above water: deep regions remain reflective and opaque while shallow
    // water reveals the terrain. Beneath the surface the opposite is needed:
    // the underside is a thin, transmitting canopy, not an opaque teal wall.
    float alpha=uLake>.5 ? mix(.97,.49,BeerLambert*.70) : .95;
    float underside=submergedView;
    float undersideAlpha=.10+.25*pow(1.0-nv,2.0);
    vec3 transmitted=uLake>.5 ? vec3(.065,.31,.355) : vec3(.065,.27,.32);
    color=mix(color,transmitted,underside*.47);
    alpha=mix(alpha,undersideAlpha,underside);
    gl_FragColor=vec4(color,alpha*patchFade);
    #include <fog_fragment>
  }
`;

const foamVert=`
  #include <fog_pars_vertex>
  uniform float uTime;
  uniform float uLakeStrip;
  uniform vec2 uImpactWorld;
  varying vec3 vWorld;
  varying vec2 vFoamUv;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    // Both freshwater and ocean surf must ride the *same* four world-space
    // wave components and horizontal Gerstner drift as the water surface.
    // Previously ocean foam hovered at a fixed sea level while waves passed
    // through it; this also made spray intermittently disappear behind crests.
    vec2 q = world.xz;
    float w1 = dot(q, normalize(vec2(.87,.49))) * .16 - uTime * .95;
    float w2 = dot(q, normalize(vec2(-.23,.97))) * .37 - uTime * 1.47;
    float w3 = dot(q, normalize(vec2(.64,-.76))) * .76 - uTime * 2.15;
    float w4 = dot(q, normalize(vec2(.18,.98))) * .08 - uTime * .62;
    world.y += .53*sin(w1) + .24*sin(w2) + .10*sin(w3) + .64*sin(w4);
    if (uLakeStrip > 0.5) {
      // Freshwater alone receives the shared waterfall impact ripple.
      float plungeD = length(q-uImpactWorld);
      world.y += exp(-plungeD*.038)*.72*
        sin(plungeD*.225-uTime*1.63);
    }
    world.x += .16*cos(w1) + .05*cos(w2);
    world.z += .12*cos(w1) + .07*cos(w4);
    vWorld = world.xyz;
    vFoamUv = uv;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const foamFrag=`
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform float uLakeStrip;
  varying vec3 vWorld;
  varying vec2 vFoamUv;
  void main() {
    // Shore-break foam is surface-only; it must never form a submerged ring.
    if (cameraPosition.y < vWorld.y-.35) discard;
    float noiseA=sin(vWorld.x*.41+uTime*1.3+sin(vWorld.z*.31))*
                 sin(vWorld.z*.57-uTime*.83+sin(vWorld.x*.29));
    float turbulence=.5+.5*noiseA;
    float wisps=pow(turbulence,1.9);
    // Width coordinates are explicitly authored for ocean ribbons too.
    // Fade both edges to avoid white rectangular coastline strips.
    float coastalFade=pow(max(0.0,
      sin(clamp(vFoamUv.y,0.0,1.0)*3.1415926)),1.35);
    float oceanCrest=pow(max(0.0,sin(vWorld.x*.85+vWorld.z*.59-
      uTime*2.8+noiseA*2.2)),2.0);
    float lakeBands=pow(max(0.0,sin((vWorld.x*.085+vWorld.z*.112)-uTime*1.36
      +noiseA*2.7)),2.0);
    float pulse=mix(.17+.83*oceanCrest,.25+.75*lakeBands,uLakeStrip);
    vec3 foam=mix(vec3(.55,.78,.75),vec3(.97,.99,.93),
      clamp(wisps*.75+oceanCrest*.25,0.0,1.0));
    // The lake's foam is now many separated short washes. Feather each
    // short arc's ends; the ocean shader still uses its existing UVs.
    float shorePatches=mix(1.0,
      smoothstep(.0,.12,vFoamUv.x)*(1.0-smoothstep(.82,1.0,vFoamUv.x)),
      uLakeStrip);
    float alpha=coastalFade*(.055+.47*wisps)*pulse*shorePatches;
    gl_FragColor=vec4(foam,clamp(alpha,0.0,.58));
    #include <fog_fragment>
  }
`;

export function makeFoamShader(lakeStrip = false): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms:THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTime:{value:0},uLakeStrip:{value:lakeStrip?1:0},
        uImpactWorld:{value:new THREE.Vector2(MIRRORFALL_IMPACT.x,MIRRORFALL_IMPACT.z)} },
    ]),
    vertexShader:foamVert,fragmentShader:foamFrag,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:true,
    blending:THREE.NormalBlending,
  });
}

export class PainterlyWaterSurface {
  readonly mesh: THREE.Mesh;
  readonly nearMesh: THREE.Mesh | null = null;
  readonly midMesh: THREE.Mesh | null = null;
  private readonly material: THREE.ShaderMaterial;
  private readonly nearMaterial: THREE.ShaderMaterial | null = null;
  private readonly midMaterial: THREE.ShaderMaterial | null = null;
  private readonly bathymetry: THREE.DataTexture;
  constructor(kind:'ocean'|'lake', quality:'high'|'low'='high') {
    const isLake=kind==='lake';
    this.bathymetry = isLake
      ? makeLakeBathymetry()
      : new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);
    this.bathymetry.needsUpdate=true;
    this.material=new THREE.ShaderMaterial({
      uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{
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
        uNearRole:{value:isLake?0:1},
        uNearCenter:{value:new THREE.Vector2(0,0)},
        uNearHole:{value:116},
        uNearHalf:{value:128},
        uMidCenter:{value:new THREE.Vector2(0,0)},
        uMidHole:{value:296},
        uMidHalf:{value:320},
      }]),
      vertexShader:vert,fragmentShader:frag,
      transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:true,
    });
    // The 8.3m shortest wave requires <4.1m vertex spacing to avoid
    // Nyquist aliasing. Use ~2.4m on High; Low keeps ~4m lake spacing.
    const lakeSteps=quality==='high'?[320,264]:[192,156];
    const geo=isLake?
      new THREE.PlaneGeometry(GRAND_LAKE.radiusX*2.05,GRAND_LAKE.radiusZ*2.05,
        lakeSteps[0]!,lakeSteps[1]!):
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
    if (!isLake) {
      const material=this.material.clone();
      material.uniforms.uNearRole!.value=2;
      const steps=quality==='high'?160:104;
      const detailGeometry=new THREE.PlaneGeometry(256,256,steps,steps);
      detailGeometry.rotateX(-Math.PI/2);
      const detail=new THREE.Mesh(detailGeometry,material);
      detail.name='water.azure.ocean-nearfield';
      detail.position.y=SEA_LEVEL;
      // The near patch renders after the distant sea, before the lake.
      detail.renderOrder=1.5;
      this.nearMaterial=material;
      this.nearMesh=detail;

      // Resolve the short wind-wave bands beyond the 128 m near patch.
      // 3.33 m vertex spacing on High (5 m on Low) avoids the severe
      // undersampling of the 60 m far-ocean grid at common camera heights.
      const middleMaterial=this.material.clone();
      middleMaterial.uniforms.uNearRole!.value=3;
      const middleSteps=quality==='high'?192:128;
      const middleGeometry=new THREE.PlaneGeometry(
        640,640,middleSteps,middleSteps);
      middleGeometry.rotateX(-Math.PI/2);
      const middle=new THREE.Mesh(middleGeometry,middleMaterial);
      middle.name='water.azure.ocean-midfield';
      middle.position.y=SEA_LEVEL;
      middle.renderOrder=1.25;
      this.midMaterial=middleMaterial;
      this.midMesh=middle;
      this.follow(0,0);
    }
  }
  /** Snap the detail patch near the camera without restarting wave phases. */
  follow(x:number,z:number):void {
    if (!this.nearMesh || !this.nearMaterial || !this.midMesh ||
      !this.midMaterial || !Number.isFinite(x) || !Number.isFinite(z)) return;
    const cx=Math.round(x/16)*16,cz=Math.round(z/16)*16;
    if(this.nearMesh.position.x===cx && this.nearMesh.position.z===cz)return;
    this.nearMesh.position.set(cx,SEA_LEVEL,cz);
    this.midMesh.position.set(cx,SEA_LEVEL,cz);
    // Keep all three surfaces on the same absolute wind-wave phases.
    for(const mat of [this.material,this.midMaterial,this.nearMaterial]){
      (mat.uniforms.uNearCenter!.value as THREE.Vector2).set(cx,cz);
      (mat.uniforms.uMidCenter!.value as THREE.Vector2).set(cx,cz);
    }
    (this.nearMaterial.uniforms.uWaveOrigin!.value as THREE.Vector2).set(cx,cz);
    (this.midMaterial.uniforms.uWaveOrigin!.value as THREE.Vector2).set(cx,cz);
  }
  update(time:number):void {
    this.material.uniforms.uTime!.value=time;
    if(this.nearMaterial) this.nearMaterial.uniforms.uTime!.value=time;
    if(this.midMaterial) this.midMaterial.uniforms.uTime!.value=time;
  }
  dispose():void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.nearMesh?.geometry.dispose();
    this.nearMaterial?.dispose();
    this.midMesh?.geometry.dispose();
    this.midMaterial?.dispose();
    this.bathymetry.dispose();
  }
}

export class LakeShoreFoam {
  readonly mesh: THREE.Mesh;
  private readonly material=makeFoamShader(true);
  constructor(){
    const geometry=makeLakeShoreBreakGeometry();
    this.mesh=new THREE.Mesh(geometry,this.material);
    this.mesh.name='water.azure.lake-shore-foam';
    this.mesh.renderOrder=3;
  }
  update(time:number):void{this.material.uniforms.uTime!.value=time;}
  dispose():void{this.mesh.geometry.dispose();this.material.dispose();}
}
