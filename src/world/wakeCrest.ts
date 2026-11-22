import * as THREE from 'three';
import { GRAND_LAKE } from './highlandLake';
import { MIRRORFALL_IMPACT } from './waterDynamics';

/**
 * Paired Kelvin-style wake shoulders, aft of the swimmer's heading. The
 * V-shaped foam crests are open, tapered and subtly irregular instead of a
 * succession of perfectly circular white donuts.
 *
 * One prototype is shared by each pooled transient wake; no geometry
 * allocations are needed while playing.
 */
export function makeWakeCrestGeometry(quality: 'high' | 'low'='high'): THREE.BufferGeometry {
  const segments=quality==='high'?42:24;
  const positions:number[]=[];
  const uvs:number[]=[];
  const indices:number[]=[];
  const vertex=(x:number,y:number,z:number,u:number,v:number):void=>{
    positions.push(x,y,z);uvs.push(u,v);
  };
  for(const side of [-1,1]){
    const start=positions.length/3;
    for(let i=0;i<=segments;i++){
      const t=i/segments;
      const f=Math.pow(t,.85);
      const lateral=side*(.33+f*3.4+.09*Math.sin(t*23+side));
      const distance=.28+t*8.7;
      const bend=.07*Math.sin(t*20.0+side)*t;
      const thickness=.09+.30*Math.sin(Math.PI*t);
      const y=.015*Math.sin(t*27+side);
      vertex(lateral-side*thickness,y,distance+bend,t,0);
      vertex(lateral+side*thickness,y,distance+bend,t,1);
      if(i<segments) {
        const a=start+i*2,b=a+2;
        // Symmetric winding is unnecessary with double-sided spray material.
        indices.push(a,b,a+1,b,b+1,a+1);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Tiny deterministic whitewater edge texture with feathered ends/sides. */
export function makeWakeCrestTexture(size=64):THREE.DataTexture {
  if(!Number.isInteger(size)||size<32||size>256) {
    throw new Error('Wake crest texture dimensions must be 32..256');
  }
  const pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size,v=(y+.5)/size;
    const taper=Math.pow(Math.max(0,Math.sin(Math.PI*u)),.75);
    const edge=Math.pow(Math.max(0,Math.sin(Math.PI*v)),.63);
    const foam=.84+.16*Math.sin(u*57+Math.sin(v*16)*1.5)
      *Math.sin(v*23-u*9);
    const alpha=Math.max(0,Math.min(1,taper*edge*foam));
    const idx=(y*size+x)*4;
    pixels[idx]=216;pixels[idx+1]=239;pixels[idx+2]=231;
    pixels[idx+3]=Math.round(alpha*205);
  }
  const texture=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.needsUpdate=true;
  return texture;
}

/** Per-event shader uniforms; the material's geometry stays shared. */
export interface WakeWaveUniforms {
  time: { value: number };
  anchorWave: { value: number };
  lake: { value: number };
}

/**
 * Each individual point of the swimmer's V-shaped wake follows the same
 * four wind waves and waterfall ripple as the lake/ocean surface. A single
 * CPU wave sample at the wake origin previously left the 9-m-long trailing
 * crests hovering above, or clipping through, independently moving waves.
 *
 * The origin's sampled height is subtracted in vertex space because the
 * world-space mesh translation already follows that sample in SurfaceWake.
 */
export function installWakeWaveDeformation(
  material: THREE.MeshBasicMaterial,
  uniforms: WakeWaveUniforms,
): void {
  const prior = material.onBeforeCompile;
  material.customProgramCacheKey = () => 'scaleborn-vertex-wave-wake-v1';
  material.onBeforeCompile = (shader, renderer) => {
    prior.call(material, shader, renderer);
    shader.uniforms.uScWakeTime = uniforms.time;
    shader.uniforms.uScWakeAnchorWave = uniforms.anchorWave;
    shader.uniforms.uScWakeLake = uniforms.lake;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       uniform float uScWakeTime;
       uniform float uScWakeAnchorWave;
       uniform float uScWakeLake;
       varying vec2 vScWakeWorldXZ;
       float scWakeHeight(vec2 q) {
         float w1 = dot(q, normalize(vec2(.87,.49)))*.16-uScWakeTime*.95;
         float w2 = dot(q, normalize(vec2(-.23,.97)))*.37-uScWakeTime*1.47;
         float w3 = dot(q, normalize(vec2(.64,-.76)))*.76-uScWakeTime*2.15;
         float w4 = dot(q, normalize(vec2(.18,.98)))*.08-uScWakeTime*.62;
         float d = length(q-vec2(${MIRRORFALL_IMPACT.x.toFixed(4)},${MIRRORFALL_IMPACT.z.toFixed(4)}));
         float plunge = uScWakeLake*exp(-d*.038)*.72*sin(d*.225-uScWakeTime*1.63);
         return .53*sin(w1)+.24*sin(w2)+.10*sin(w3)+.64*sin(w4)+plunge;
       }`,
    ).replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 scWakeWorld = (modelMatrix * vec4(transformed,1.0)).xyz;
       vScWakeWorldXZ = scWakeWorld.xz;
       transformed.y += scWakeHeight(scWakeWorld.xz) - uScWakeAnchorWave;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       uniform float uScWakeLake;
       varying vec2 vScWakeWorldXZ;`,
    ).replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       // The open wake should not continue as a white V on dry lake bank.
       if (uScWakeLake > .5) {
         vec2 shore = (vScWakeWorldXZ-vec2(${GRAND_LAKE.x.toFixed(4)},${GRAND_LAKE.z.toFixed(4)}))
           /vec2(${GRAND_LAKE.radiusX.toFixed(4)},${GRAND_LAKE.radiusZ.toFixed(4)});
         float angle=atan(shore.y,shore.x);
         float boundary=1.0+.067*sin(3.0*angle+1.10)
           +.042*sin(7.0*angle-.72)+.023*sin(13.0*angle+2.0);
         if (length(shore)/boundary > .982) discard;
       }`,
    );
  };
}
