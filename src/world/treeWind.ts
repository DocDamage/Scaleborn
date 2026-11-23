import * as THREE from 'three';

/** Shared uniform clock for rooted tree bending and matching shadow passes. */
export interface TreeWindClock { value: number }
export type TreeWindKind = 'wood' | 'foliage';

/**
 * Add the same bounded, height-weighted bending field to bark and foliage
 * without replacing existing PBR shader injections. Three.js only deforms
 * the vertex shader here: neither the physics heightfield nor root sockets
 * move. Shadow depth materials receive this exact operation too.
 */
export function installTreeWind(
  material: THREE.Material,
  time: TreeWindClock,
  kind: TreeWindKind,
): void {
  const inheritedCompile=material.onBeforeCompile.bind(material);
  const inheritedKey=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    inheritedCompile(shader,renderer);
    shader.uniforms.uScTreeWindTime=time;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>\nuniform float uScTreeWindTime;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
        // Position-seeded phase avoids a forest moving in lockstep.
        vec2 scTreeOrigin=vec2(0.0);
        #ifdef USE_INSTANCING
          scTreeOrigin=instanceMatrix[3].xz;
        #endif
        float scTreePhase=dot(scTreeOrigin,vec2(0.013,0.019));
        float scTreeGust=sin(uScTreeWindTime*.53+scTreePhase);
        float scTreeRipple=sin(uScTreeWindTime*1.31+
          scTreePhase*1.23+position.y*.18);
        // Do not displace roots: movement grows continuously into the crown.
        float scTreeWeight=smoothstep(.45,10.5,position.y);
        transformed.x+=scTreeWeight*(.15*scTreeGust+.033*scTreeRipple);
        transformed.z+=scTreeWeight*(.095*scTreeGust+.029*scTreeRipple);
        ${kind==='foliage'? `
        // Subtle short-wave flutter on each card, above shared branch bend.
        transformed.x+=scTreeWeight*.023*sin(
          uScTreeWindTime*2.05+scTreePhase+position.x*3.7);
        transformed.z+=scTreeWeight*.017*cos(
          uScTreeWindTime*2.23+scTreePhase+position.z*3.1);
        `:''}
      `);
  };
  // Both variants use distinct shader programs and preserve any previous
  // texture/PBR cache keys. The color/depth variants share their wind clock.
  material.customProgramCacheKey=()=>inheritedKey()+
    '-scaleborn-foliage-motion-tree-wind-'+kind+'-v1';
}
