import * as THREE from 'three';
import type { PaintedSurfaceTextures } from './surfaceTextures';

/**
 * World-space triplanar PBR sampling for streamed terrain.
 *
 * The previous top-down UVs stretch soil/stone grain down almost-vertical
 * escarpments. Blend the three axis projections per fragment, including the
 * normal and roughness maps, rather than interpolating UV directions at
 * vertices (which previously created visible moiré).
 *
 * Projections use the same metres-per-repeat on every tile and LOD. No
 * textures, instance identities, heightfields or collision data are changed.
 */
export function installTerrainTriplanar(
  material: THREE.MeshStandardMaterial,
  metresPerRepeat = 13,
  rockMaps?: PaintedSurfaceTextures,
): void {
  if (!Number.isFinite(metresPerRepeat) || metresPerRepeat <= 0) {
    throw new Error('Terrain projection scale must be positive');
  }
  const previousCompile = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey.bind(material);
  const inverseScale = (1 / metresPerRepeat).toFixed(9);

  material.customProgramCacheKey = () =>
    previousKey() + '-scaleborn-terrain-triplanar-v2-' + inverseScale
      + (rockMaps ? '-rock-strata' : '-soil-only');

  material.onBeforeCompile = (shader, renderer) => {
    previousCompile.call(material, shader, renderer);
    if (rockMaps) {
      shader.uniforms.uScRockColor = { value: rockMaps.color };
      shader.uniforms.uScRockNormal = { value: rockMaps.normal };
      shader.uniforms.uScRockRoughness = { value: rockMaps.roughness };
    }
    const rockDecl = rockMaps ? `uniform sampler2D uScRockColor;
       uniform sampler2D uScRockNormal;
       uniform sampler2D uScRockRoughness;
       float scRockWeight() {
         float slope = 1.0 - abs(normalize(vScTriNormal).y);
         float cliff = smoothstep(0.17, 0.62, slope);
         float shore = smoothstep(-5.0, 12.0, vScTriPosition.y);
         return cliff * mix(0.58, 1.0, shore);
       }` : '';
    const colorSample = rockMaps
      ? 'diffuseColor *= mix(scTriSample(map), scTriSample(uScRockColor), scRockWeight());'
      : 'diffuseColor *= scTriSample(map);';
    const roughSample = rockMaps
      ? 'roughnessFactor *= mix(scTriSample(roughnessMap).g, scTriSample(uScRockRoughness).g, scRockWeight());'
      : 'roughnessFactor *= scTriSample(roughnessMap).g;';
    const rockNormal = rockMaps ? `float scRock = scRockWeight();
         scX = mix(scX, texture2D(uScRockNormal, scQ.zy).xyz * 2.0 - 1.0, scRock);
         scY = mix(scY, texture2D(uScRockNormal, scQ.xz).xyz * 2.0 - 1.0, scRock);
         scZ = mix(scZ, texture2D(uScRockNormal, scQ.xy).xyz * 2.0 - 1.0, scRock);
         vec2 scNormalStrength = mix(normalScale, vec2(0.72), scRock);` : 'vec2 scNormalStrength = normalScale;';
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vScTriPosition;
       varying vec3 vScTriNormal;`,
    ).replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
       vScTriPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
       vScTriNormal = normalize(mat3(modelMatrix) * normal);`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vScTriPosition;
       varying vec3 vScTriNormal;
       ${rockDecl}
       vec3 scTriWeights() {
         vec3 w = pow(abs(normalize(vScTriNormal)), vec3(4.0));
         return w / max(w.x + w.y + w.z, 0.0001);
       }
       vec4 scTriSample(sampler2D tex) {
         vec3 w = scTriWeights();
         vec3 q = vScTriPosition * ${inverseScale};
         return texture2D(tex, q.zy) * w.x
              + texture2D(tex, q.xz) * w.y
              + texture2D(tex, q.xy) * w.z;
       }`,
    ).replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
         ${colorSample}
       #endif`,
    ).replace(
      '#include <roughnessmap_fragment>',
      `float roughnessFactor = roughness;
       #ifdef USE_ROUGHNESSMAP
         ${roughSample}
       #endif`,
    ).replace(
      '#include <normal_fragment_maps>',
      `#ifdef USE_NORMALMAP_TANGENTSPACE
         // Transform three bump projections into world coordinates before
         // lighting. The normal-map strength is preserved in each tangent.
         vec3 scW = scTriWeights();
         vec3 scQ = vScTriPosition * ${inverseScale};
         vec3 scX = texture2D(normalMap, scQ.zy).xyz * 2.0 - 1.0;
         vec3 scY = texture2D(normalMap, scQ.xz).xyz * 2.0 - 1.0;
         vec3 scZ = texture2D(normalMap, scQ.xy).xyz * 2.0 - 1.0;
         ${rockNormal}
         scX.xy *= scNormalStrength;
         scY.xy *= scNormalStrength;
         scZ.xy *= scNormalStrength;
         vec3 scFace = normalize(vScTriNormal);
         // Preserve the true mesh normal when a painted map is flat.
         // Reconstructing the entire axis normal from blend weights alone
         // would over-sharpen diagonal faces and distort cliff lighting.
         vec3 scPerturb =
           vec3(0.0, scX.y, scX.x) * scW.x +
           vec3(scY.x, 0.0, scY.y) * scW.y +
           vec3(scZ.x, scZ.y, 0.0) * scW.z;
         vec3 scWorldNormal = normalize(scFace + scPerturb);
         normal = normalize(mat3(viewMatrix) * scWorldNormal);
         #ifdef DOUBLE_SIDED
           normal *= faceDirection;
         #endif
       #endif`,
    );
  };
}
