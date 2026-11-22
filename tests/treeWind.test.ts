import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { installTreeWind } from '../src/world/treeWind';
import { PainterlyNature } from '../src/world/painterlyNature';

function compileWind(material:THREE.Material) {
  // Inspect shader patching without claiming a real WebGL renderer was run.
  const shader={
    uniforms:{} as Record<string,{value:number}>,
    vertexShader:'#include <common>\n#include <begin_vertex>\n#include <worldpos_vertex>',
    fragmentShader:'#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>',
  };
  material.onBeforeCompile(shader as never, {} as never);
  return shader;
}

describe('synchronized forest wind and alpha-tested shadow rendering',()=>{
  it('preserves prior shader hooks and anchors both materials at the trunk base',()=>{
    const clock={value:2};
    const material=new THREE.MeshStandardMaterial();
    let inheritedCalls=0;
    material.onBeforeCompile=()=>{inheritedCalls++;};
    installTreeWind(material,clock,'wood');
    const wood=compileWind(material);
    expect(inheritedCalls).toBe(1);
    expect(wood.uniforms.uScTreeWindTime).toBe(clock);
    expect(wood.vertexShader).toContain('smoothstep(.45,10.5,position.y)');
    expect(wood.vertexShader).toContain('instanceMatrix[3].xz');
    expect(wood.vertexShader).not.toContain('uScTreeWindTime*2.05');
    const leafMaterial=new THREE.MeshStandardMaterial();
    installTreeWind(leafMaterial,clock,'foliage');
    const leaves=compileWind(leafMaterial);
    expect(leaves.vertexShader).toContain('.15*scTreeGust+.033*scTreeRipple');
    expect(leaves.vertexShader).toContain('uScTreeWindTime*2.05');
    expect(leaves.uniforms.uScTreeWindTime).toBe(clock);
    clock.value=5;
    expect(wood.uniforms.uScTreeWindTime!.value).toBe(5);
    material.dispose();leafMaterial.dispose();
  });

  it('uses matching tree and foliage depth shaders, sharing the atlas alpha test',()=>{
    const scene=new THREE.Scene();
    const nature=new PainterlyNature(scene,'high');
    try{
      const wood=scene.getObjectByName('vegetation.azure.pbr-tree-wood.0') as THREE.InstancedMesh;
      const leaves=scene.getObjectByName('vegetation.azure.pbr-tree-leaves.0') as THREE.InstancedMesh;
      expect(wood.customDepthMaterial).toBeInstanceOf(THREE.MeshDepthMaterial);
      expect(leaves.customDepthMaterial).toBeInstanceOf(THREE.MeshDepthMaterial);
      const leafColor=leaves.material as THREE.MeshStandardMaterial;
      const leafDepth=leaves.customDepthMaterial as THREE.MeshDepthMaterial;
      expect(leafDepth.map).toBe(leafColor.map);
      expect(leafDepth.alphaTest).toBe(leafColor.alphaTest);
      const woodColor=compileWind(wood.material as THREE.Material);
      const woodShadow=compileWind(wood.customDepthMaterial!);
      const leafShader=compileWind(leaves.material as THREE.Material);
      const leafShadow=compileWind(leafDepth);
      for(const shader of [woodColor,woodShadow,leafShader,leafShadow]){
        expect(shader.vertexShader).toContain('scTreeGust');
        expect(shader.vertexShader).toContain('smoothstep(.45,10.5,position.y)');
      }
      const shared=woodColor.uniforms.uScTreeWindTime;
      expect(woodShadow.uniforms.uScTreeWindTime).toBe(shared);
      expect(leafShader.uniforms.uScTreeWindTime).toBe(shared);
      expect(leafShadow.uniforms.uScTreeWindTime).toBe(shared);
      nature.update(6.75);
      expect(shared!.value).toBe(6.75);
    }finally{nature.dispose();}
  });

  it('does not allocate shadow materials in the low preset',()=>{
    const scene=new THREE.Scene();
    const nature=new PainterlyNature(scene,'low');
    try{
      const wood=scene.getObjectByName('vegetation.azure.pbr-tree-wood.0') as THREE.InstancedMesh;
      const leaves=scene.getObjectByName('vegetation.azure.pbr-tree-leaves.0') as THREE.InstancedMesh;
      expect(wood.customDepthMaterial).toBeUndefined();
      expect(leaves.customDepthMaterial).toBeUndefined();
      expect(compileWind(wood.material as THREE.Material).vertexShader)
        .toContain('scTreeWeight');
    }finally{nature.dispose();}
  });
});
