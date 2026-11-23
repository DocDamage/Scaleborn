import * as THREE from 'three';
import { GRAND_LAKE, MIRRORFALL, headwaterProfileAt } from './highlandLake';

type Quality='high'|'low';

/**
 * The shallow source stream is real geometry, not a sprite laid over the
 * escarpment. Its bank coordinates and water height are the same ones that
 * carve the collision terrain and drive swimming.
 *
 * A gently advected PBR-inspired shader imitates small riffles and lip foam;
 * this is not an incompressible fluid simulation or a separate physics lake.
 */
export function makeHeadwaterGeometry(quality:Quality='high'):THREE.BufferGeometry {
  const along=quality==='high'?116:64;
  const across=quality==='high'?14:8;
  const positions:number[]=[];
  const uv:number[]=[];
  const indices:number[]=[];
  const start=MIRRORFALL.x-1;
  for(let i=0;i<=along;i++){
    const t=i/along;
    const x=start+132*t;
    const center=headwaterProfileAt(x,GRAND_LAKE.z);
    if(!center)throw new Error('Headwater centerline profile missing');
    for(let j=0;j<=across;j++){
      const v=j/across;
      const cross=(2*v-1)*.855;
      const z=center.centerZ+center.halfWidth*cross;
      positions.push(x,center.surfaceY+.055,z);
      uv.push(t,v);
      if(i<along&&j<across){
        const a=i*(across+1)+j,b=a+across+1;
        // Keep the entire surface facing upward for water specularity.
        indices.push(a,a+1,b,b,a+1,b+1);
      }
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

const vertex=`
  #include <fog_pars_vertex>
  uniform float uTime;
  varying vec3 vHeadWorld;
  varying vec2 vHeadUv;
  void main(){
    vec3 p=position;
    float f1=p.x*.32+p.z*.11+uTime*2.35;
    float f2=p.x*.57-p.z*.28+uTime*3.4;
    // Same amplitudes/phases as headwaterWaveAt in the movement physics.
    p.y+=.065*sin(f1)+.035*sin(f2);
    vec4 world=modelMatrix*vec4(p,1.0);
    vHeadWorld=world.xyz;
    vHeadUv=uv;
    vec4 mvPosition=viewMatrix*world;
    gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
  }
`;
const fragment=`
  precision highp float;
  #include <fog_pars_fragment>
  uniform float uTime;
  varying vec3 vHeadWorld;
  varying vec2 vHeadUv;

  float hash(vec2 p){
    return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
  }
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),
      mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
  }
  void main(){
    vec2 q=vHeadWorld.xz;
    float phase1=q.x*.32+q.y*.11+uTime*2.35;
    float phase2=q.x*.57-q.y*.28+uTime*3.4;
    vec3 N=normalize(vec3(
      -.0133-.065*.32*cos(phase1)-.035*.57*cos(phase2),
      1.0,-.065*.11*cos(phase1)+.035*.28*cos(phase2)));
    vec3 V=normalize(cameraPosition-vHeadWorld);
    float nv=clamp(dot(N,V),0.0,1.0);
    float fresnel=.028+.972*pow(1.0-nv,5.0);

    // From upstream (UV.x=1) toward the lip (UV.x=0): all flow phases
    // move toward smaller UV.x as time grows.
    float advected=vHeadUv.x*90.0+uTime*3.8;
    float turbulence=noise(vec2(advected*.27,
      vHeadUv.y*19.0+sin(advected*.14)*.19));
    float comb=pow(.5+.5*sin(advected*1.16+
      vHeadUv.y*25.0+turbulence*4.0),5.0);
    float ripple=noise(q*.33+vec2(uTime*.22,-uTime*.12));
    float mouth=1.0-smoothstep(.02,.16,vHeadUv.x);
    float edge=abs(vHeadUv.y*2.0-1.0);
    float wetShore=1.0-smoothstep(.67,1.0,edge);
    float bubbles=comb*(.14+.26*turbulence)
      +mouth*(.18+.35*turbulence);
    vec3 deep=vec3(.060,.225,.247);
    vec3 light=vec3(.15,.38,.36);
    vec3 sky=vec3(.55,.68,.69);
    vec3 color=mix(deep,light,.38+.44*ripple);
    color=mix(color,sky,clamp(fresnel*.76,0.0,.78));
    color=mix(color,vec3(.82,.93,.88),clamp(bubbles,0.0,.65));
    float alpha=(.73+.10*turbulence+.08*fresnel)*wetShore;
    alpha*=.92+.08*mouth;
    gl_FragColor=vec4(color,clamp(alpha,0.0,.92));
    #include <fog_fragment>
  }
`;

export class MirrorfallHeadwaters {
  readonly mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;

  constructor(quality:Quality='high'){
    const material=new THREE.ShaderMaterial({
      uniforms:THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,{uTime:{value:0}},
      ]),
      vertexShader:vertex,fragmentShader:fragment,
      side:THREE.DoubleSide,transparent:true,
      depthWrite:false,depthTest:true,fog:true,
    });
    this.mesh=new THREE.Mesh(makeHeadwaterGeometry(quality),material);
    this.mesh.name='water.azure.mirrorfall-feeder-headwaters';
    this.mesh.renderOrder=3;
  }

  update(time:number):void{
    this.mesh.material.uniforms.uTime!.value=time;
  }
  dispose():void{
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
