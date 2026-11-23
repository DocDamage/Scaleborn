import * as THREE from 'three';
import { GRAND_LAKE } from './highlandLake';

/** Animated, near-transparent runoff over an existing eroded cliff mesh. */
const vert=`
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main(){
    vec3 offset=position+normal*.075;
    vec4 world=modelMatrix*vec4(offset,1.0);
    vWorld=world.xyz;
    vNormal=normalize(mat3(modelMatrix)*normal);
    vec4 mvPosition=viewMatrix*world;
    gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
  }
`;
const frag=`
  precision highp float;
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform float uLakeY;
  uniform float uCascadeZ;
  varying vec3 vWorld;
  varying vec3 vNormal;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
      mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  void main(){
    vec2 p=vWorld.zy;
    float cascade=exp(-abs(vWorld.z-uCascadeZ)*.011);
    float low=1.0-smoothstep(uLakeY,uLakeY+100.0,vWorld.y);
    float damp=clamp(cascade*.58+low*.40,0.0,1.0);
    float flow=noise(vec2(p.x*.13,p.y*.17-uTime*.19));
    float stripes=sin(p.x*.41+noise(p*.034)*6.0+
      sin(p.y*.19-uTime*.36)*.48);
    float rivulet=smoothstep(.63,.97,stripes)*(.30+.70*flow);
    float broad=noise(vec2(p.x*.052,p.y*.033-uTime*.055));
    float film=smoothstep(.38,.70,broad+.22*rivulet);
    float cliffFacing=clamp(1.0-abs(normalize(vNormal).y),0.0,1.0);
    float alpha=damp*cliffFacing*(.032+.13*film+.05*rivulet);
    alpha*=exp(-length(cameraPosition-vWorld)*.0015);
    vec3 mineral=mix(vec3(.045,.10,.13),vec3(.20,.36,.39),
      clamp(.18+film*.51+rivulet*.31,0.0,1.0));
    gl_FragColor=vec4(mineral,clamp(alpha,0.0,.24));
    #include <fog_fragment>
  }
`;

export function makeCliffRunoffMaterial():THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms:THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {uTime:{value:0},
       uCascadeZ:{value:GRAND_LAKE.z},
       uLakeY:{value:GRAND_LAKE.surfaceY}},
    ]),
    vertexShader:vert,fragmentShader:frag,
    transparent:true,depthWrite:false,depthTest:true,
    side:THREE.DoubleSide,fog:true,
  });
}
