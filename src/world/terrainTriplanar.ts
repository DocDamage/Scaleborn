import * as THREE from 'three';

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
): void {
  if (!Number.isFinite(metresPerRepeat) || metresPerRepeat <= 0) {
    throw new Error('Terrain projection scale must be positive');
  }
  const previousCompile = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey.bind(material);
  const inverseScale = (1 / metresPerRepeat).toFixed(9);

  material.customProgramCacheKey = () =>
    previousKey() + '-scaleborn-terrain-triplanar-v1';

  material.onBeforeCompile = (shader, renderer) => {
    previousCompile.call(material, shader, renderer);
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
         diffuseColor *= scTriSample(map);
       #endif`,
    ).replace(
      '#include <roughnessmap_fragment>',
      `#ifdef USE_ROUGHNESSMAP
         roughnessFactor *= scTriSample(roughnessMap).g;
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
         scX.xy *= normalScale;
         scY.xy *= normalScale;
         scZ.xy *= normalScale;
         vec3 scFace = normalize(vScTriNormal);
         vec3 scWorldNormal = normalize(
           vec3(sign(scFace.x) * scX.z, scX.y, scX.x) * scW.x +
           vec3(scY.x, sign(scFace.y) * scY.z, scY.y) * scW.y +
           vec3(scZ.x, scZ.y, sign(scFace.z) * scZ.z) * scW.z
         );
         normal = normalize(mat3(viewMatrix) * scWorldNormal);
         #ifdef DOUBLE_SIDED
           normal *= faceDirection;
         #endif
       #endif`,
    );
  };
}
