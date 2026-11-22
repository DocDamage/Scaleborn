import * as THREE from 'three';
import { GRAND_LAKE } from './highlandLake';

/**
 * Painterly landcover and geological bedding are blended in world-space
 * over the existing soil/rock triplanar PBR maps, with no extra draw calls.
 * Runtime uniforms keep the shoreline aligned with the actual lake.
 */
export function installTerrainPigment(material:THREE.MeshStandardMaterial):void {
  const original=material.onBeforeCompile;
  const originalKey=material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey=()=>originalKey()+'-scaleborn-terrain-pigment-v1';
  material.onBeforeCompile=(shader,renderer)=>{
    original.call(material,shader,renderer);
    if(!shader.fragmentShader.includes('varying vec3 vScTriPosition;')
       ||!shader.fragmentShader.includes('varying vec3 vScTriNormal;')){
      throw new Error('Terrain pigment requires installed world triplanar projections');
    }
    shader.uniforms.uScPigLakeCenter={value:new THREE.Vector2(GRAND_LAKE.x,GRAND_LAKE.z)};
    shader.uniforms.uScPigLakeRadii={
      value:new THREE.Vector2(GRAND_LAKE.radiusX,GRAND_LAKE.radiusZ)};
    shader.uniforms.uScPigLakeLevel={value:GRAND_LAKE.surfaceY};
    const functions=`
      uniform vec2 uScPigLakeCenter;
      uniform vec2 uScPigLakeRadii;
      uniform float uScPigLakeLevel;
      float scPigHash(vec2 p){
        vec3 q=fract(vec3(p.xyx)*.1031);
        q+=dot(q,q.yzx+33.33);
        return fract((q.x+q.y)*q.z);
      }
      float scPigNoise(vec2 p){
        vec2 i=floor(p),f=fract(p);
        f=f*f*(3.0-2.0*f);
        return mix(
          mix(scPigHash(i),scPigHash(i+vec2(1.0,0.0)),f.x),
          mix(scPigHash(i+vec2(0.0,1.0)),
              scPigHash(i+vec2(1.0,1.0)),f.x),f.y);
      }
      float scPigShoreDistance(vec2 point){
        vec2 d=(point-uScPigLakeCenter)/uScPigLakeRadii;
        float a=atan(d.y,d.x);
        float shore=1.0+.067*sin(a*3.0+1.10)
          +.042*sin(a*7.0-.72)+.023*sin(a*13.0+2.0);
        return (length(d)/shore-.982)*min(uScPigLakeRadii.x,uScPigLakeRadii.y);
      }
    `;
    const originalColor='#include <color_fragment>';
    shader.fragmentShader=shader.fragmentShader.replace(
      '#include <common>','#include <common>\n'+functions)
      .replace(originalColor, `${originalColor}
        vec2 worldPig=vScTriPosition.xz;
        float terrainUp=abs(normalize(vScTriNormal).y);
        float scPigBroad=scPigNoise(worldPig*.021);
        float scPigMiddle=scPigNoise(worldPig*.092+vec2(14.3,7.7));
        float scPigFine=scPigNoise(worldPig*.41-vec2(9.4,12.2));
        float scPigVariation=(scPigBroad-.5)*.35+
          (scPigMiddle-.5)*.18+(scPigFine-.5)*.055;
        float soilCover=smoothstep(.47,.84,terrainUp);
        // Landscape-scale pigment washes and scattered fallen-leaf color.
        vec3 scGrassPigment=mix(vec3(.86,.94,.82),vec3(1.09,1.01,.91),
          smoothstep(.31,.71,scPigBroad+.19*(scPigMiddle-.5)));
        float litter=smoothstep(.59,.77,scPigBroad*.65+scPigMiddle*.35);
        scGrassPigment=mix(scGrassPigment,vec3(.83,.80,.69),litter*.22);
        vec3 scStonePigment=mix(vec3(.82,.90,.93),vec3(1.15,1.09,.93),
          smoothstep(.25,.76,scPigMiddle+scPigBroad*.15));
        float bedding=.5+.5*sin(vScTriPosition.y*.36+
          scPigBroad*4.7+scPigMiddle*1.7);
        scStonePigment*=mix(.89,1.13,bedding);
        vec3 scLayeredPigment=mix(scStonePigment,scGrassPigment,soilCover);
        diffuseColor.rgb*=mix(vec3(1.0),scLayeredPigment,
          .58+.18*abs(scPigVariation));
        diffuseColor.rgb*=1.0+scPigVariation*.19;
        // Damp, shallow lakebanks follow the irregular collision shoreline.
        float bankDistance=scPigShoreDistance(worldPig);
        float bankMask=(1.0-smoothstep(3.0,26.0,bankDistance))
          *smoothstep(-1.5,2.5,bankDistance);
        float lowBank=1.0-smoothstep(
          uScPigLakeLevel+1.0,uScPigLakeLevel+23.0,vScTriPosition.y);
        float wetBank=bankMask*lowBank
          *(.55+.45*scPigNoise(worldPig*.22));
        diffuseColor.rgb=mix(diffuseColor.rgb,
          diffuseColor.rgb*vec3(.53,.69,.64),wetBank*.50);
      `);
  };
}
