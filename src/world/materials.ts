import * as THREE from 'three';
import { GRAND_LAKE } from './highlandLake';

/**
 * Painterly physical surface layer. Keeps real Three.js light response and
 * roughness/specularity while applying sub-meter procedural detail in shader.
 * No rectangular debug materials or downloaded texture dependency.
 */
function installSurfaceDetail(material: THREE.MeshStandardMaterial, kind: 'land' | 'rock' | 'bark'): void {
  const lake = GRAND_LAKE;
  material.customProgramCacheKey = () => 'scaleborn-pbr-' + kind + '-v2';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 vScPosition;
      varying vec3 vScNormal;`);
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vScPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vScNormal = normalize(mat3(modelMatrix) * normal);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vScPosition;
      varying vec3 vScNormal;
      float scHash(vec3 p) { p = fract(p * 0.1031); p += dot(p,p.yzx+33.33);
        return fract((p.x+p.y)*p.z); }
      float scNoise(vec3 p) {
        vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(scHash(i),scHash(i+vec3(1,0,0)),f.x),
                       mix(scHash(i+vec3(0,1,0)),scHash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(scHash(i+vec3(0,0,1)),scHash(i+vec3(1,0,1)),f.x),
                       mix(scHash(i+vec3(0,1,1)),scHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      float scFbm(vec3 p) { return scNoise(p)*0.66 + scNoise(p*2.17)*0.34; }
      float scLakeMask(vec2 p) {
        vec2 d=(p-vec2(${lake.x.toFixed(1)},${lake.z.toFixed(1)}))
               /vec2(${lake.radiusX.toFixed(1)},${lake.radiusZ.toFixed(1)});
        return 1.0-smoothstep(0.95,1.05,length(d));
      }
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float micro = scFbm(vScPosition * ${kind==='bark'?'0.37':'0.19'});
      float ultra = scNoise(vScPosition * 2.11);
      float slope = 1.0-abs(normalize(vScNormal).y);
      ${kind==='land'? `
        float rockBand=smoothstep(0.26,0.78,slope);
        vec3 grain=mix(vec3(0.89,0.95,0.82),vec3(1.07,0.99,0.86),micro);
        grain=mix(grain,vec3(0.71,0.76,0.74)*(0.86+micro*0.25),rockBand*0.76);
        diffuseColor.rgb*=grain*(0.96+ultra*0.09);
      `: kind==='rock'?`
        vec3 strata=mix(vec3(0.62,0.70,0.72),vec3(1.05,0.99,0.85),micro);
        strata*=0.88+0.12*sin(vScPosition.y*0.63+micro*2.0);
        diffuseColor.rgb*=strata*(0.91+ultra*0.15);
        float moss=smoothstep(0.70,0.93,normalize(vScNormal).y)
                   *(0.25+0.75*scNoise(vScPosition*.11));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.29,.16),moss*.38);
      `:`
        float furrows=sin(vScPosition.y*15.7+micro*3.5)*0.06;
        diffuseColor.rgb*=vec3(0.88+furrows,0.81+furrows,0.77+furrows)
                         *(0.83+micro*0.25);
      `}
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      float waterHeight=mix(0.0,${lake.surfaceY.toFixed(1)},scLakeMask(vScPosition.xz));
      float wet=1.0-smoothstep(waterHeight-0.4,waterHeight+4.5,vScPosition.y);
      roughnessFactor=mix(roughnessFactor,0.39,wet*0.72);
    `);
  };
}

export function makeTerrainMaterial(quality: 'high' | 'low' = 'high'): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, color: 0xffffff, roughness: 0.93, metalness: 0,
    side: THREE.DoubleSide,
  });
  if (quality === 'high') installSurfaceDetail(mat, 'land');
  return mat;
}
export function makeRockMaterial(quality: 'high' | 'low' = 'high'): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8b9d9c, roughness: 0.87, metalness: 0 });
  if (quality === 'high') installSurfaceDetail(mat, 'rock');
  return mat;
}
export function makeBarkMaterial(quality: 'high' | 'low' = 'high'): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0x716057, roughness: 0.95, metalness: 0 });
  if (quality === 'high') installSurfaceDetail(mat, 'bark');
  return mat;
}
