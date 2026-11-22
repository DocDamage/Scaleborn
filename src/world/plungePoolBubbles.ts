import * as THREE from 'three';
import { rng } from '../core/random';
import { AZURE_SEED, heightAt } from './terrain';
import { GRAND_LAKE, lakeContains } from './highlandLake';
import { MIRRORFALL_IMPACT } from './waterDynamics';
import type { UnderwaterOpticsSample } from './underwaterOptics';

type Quality='high'|'low';

/**
 * Air entrainment under the FALLING water, not free-floating spheres.
 * Particles are rooted to physical freshwater depth at the impact and rise
 * inside that depth in a repeatable GPU loop. No per-frame buffer writes,
 * expensive CPU simulation or new material per bubble.
 */
export function makePlungeBubbleGeometry(quality:Quality='high'):THREE.BufferGeometry {
  const random=rng(AZURE_SEED+81294);
  const samples=quality==='high'?1150:370;
  const positions:number[]=[];
  const bed:number[]=[];
  const rise:number[]=[];
  const size:number[]=[];
  const phase:number[]=[];
  for(let i=0;i<samples;i++){
    const theta=random()*Math.PI*2;
    const r=1.5+Math.sqrt(random())*25;
    const x=MIRRORFALL_IMPACT.x+Math.cos(theta)*r;
    const z=MIRRORFALL_IMPACT.z+Math.sin(theta)*r;
    if(!lakeContains(x,z))continue;
    const floor=heightAt(x,z);
    const depth=GRAND_LAKE.surfaceY-floor;
    if(depth<2.6 || depth>GRAND_LAKE.maxDepth+3)continue;
    const v=.03+random()*.92;
    positions.push(x,floor+.45+(depth-1.10)*v,z);
    bed.push(floor);
    rise.push(.34+random()*.86);
    size.push(.44+random()*.92);
    phase.push(random()*Math.PI*2);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('aBedY',new THREE.Float32BufferAttribute(bed,1));
  g.setAttribute('aRise',new THREE.Float32BufferAttribute(rise,1));
  g.setAttribute('aBubbleSize',new THREE.Float32BufferAttribute(size,1));
  g.setAttribute('aBubblePhase',new THREE.Float32BufferAttribute(phase,1));
  g.computeBoundingSphere();
  return g;
}

const vertex=`
  #include <fog_pars_vertex>
  uniform float uTime;
  uniform float uWaterY;
  uniform float uImmersion;
  uniform float uTransmission;
  attribute float aBedY;
  attribute float aRise;
  attribute float aBubbleSize;
  attribute float aBubblePhase;
  varying float vFade;
  varying float vLight;

  void main(){
    float travel=max(.25,uWaterY-aBedY-1.15);
    float y=aBedY+.45+mod(
      max(0.0,position.y-aBedY-.45)+uTime*aRise,travel);
    vec3 bubble=vec3(
      position.x+sin(uTime*.72+aBubblePhase+y*.25)*.20,
      y,
      position.z+cos(uTime*.60+aBubblePhase+y*.19)*.20);
    float bedFade=smoothstep(aBedY+.45,aBedY+1.3,y);
    float surfFade=1.0-smoothstep(uWaterY-2.0,uWaterY-.65,y);
    vFade=bedFade*surfFade*uImmersion;
    vLight=mix(.48,1.0,uTransmission);
    vec4 mvPosition=viewMatrix*vec4(bubble,1.0);
    gl_Position=projectionMatrix*mvPosition;
    gl_PointSize=clamp(32.0*aBubbleSize/max(2.0,-mvPosition.z),.7,5.8);
    #include <fog_vertex>
  }
`;

const fragment=`
  precision highp float;
  #include <fog_pars_fragment>
  varying float vFade;
  varying float vLight;

  void main(){
    vec2 uv=gl_PointCoord*2.0-1.0;
    float radius=length(uv);
    if(radius>=.99 || vFade<.004)discard;
    // Tiny air glints are strongest around their edges; there is no
    // polygonal white sphere, no solid glowing disc, and no foam underwater.
    float rim=smoothstep(.43,.73,radius)
      *(1.0-smoothstep(.81,.99,radius));
    float inner=(1.0-smoothstep(.0,.43,radius))*.055;
    float highlight=exp(-dot(uv-vec2(-.32,.34),
      uv-vec2(-.32,.34))*21.0)*.33;
    float alpha=(rim*.35+inner+highlight)*vFade*vLight;
    vec3 glint=vec3(.65,.85,.83);
    gl_FragColor=vec4(glint,clamp(alpha,0.0,.46));
    #include <fog_fragment>
  }
`;

export class PlungePoolBubbles {
  readonly points:THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>;
  constructor(scene:THREE.Scene,quality:Quality='high'){
    const material=new THREE.ShaderMaterial({
      uniforms:THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {uTime:{value:0},uWaterY:{value:GRAND_LAKE.surfaceY},
         uImmersion:{value:0},uTransmission:{value:1}},
      ]),
      vertexShader:vertex,fragmentShader:fragment,
      fog:true,transparent:true,depthWrite:false,depthTest:true,
      blending:THREE.NormalBlending,
    });
    this.points=new THREE.Points(makePlungeBubbleGeometry(quality),material);
    this.points.name='water.azure.mirrorfall-submerged-plunge-bubbles';
    this.points.frustumCulled=false;
    this.points.renderOrder=4;
    this.points.visible=false;
    scene.add(this.points);
  }

  update(time:number,camera:THREE.Vector3,optics:UnderwaterOpticsSample):void{
    const valid=Number.isFinite(time)&&[camera.x,camera.y,camera.z]
      .every(Number.isFinite);
    const close=valid && Math.hypot(camera.x-MIRRORFALL_IMPACT.x,
      camera.z-MIRRORFALL_IMPACT.z)<108;
    const immersed=optics.medium==='lake'&&optics.immersion>.08;
    this.points.visible=close&&immersed;
    if(!this.points.visible)return;
    this.points.material.uniforms.uTime!.value=time;
    this.points.material.uniforms.uImmersion!.value=optics.immersion;
    this.points.material.uniforms.uTransmission!.value=optics.lightTransmission;
  }

  dispose():void{
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
