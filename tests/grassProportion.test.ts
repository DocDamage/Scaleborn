import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LocalGroundcover, makeGrassPatch } from '../src/world/localGroundcover';
import { PainterlyNature } from '../src/world/painterlyNature';

type Shader = Parameters<THREE.MeshStandardMaterial['onBeforeCompile']>[0];

function shaderMock(): Shader {
  return {
    uniforms:{},
    vertexShader:'#include <common>\n#include <begin_vertex>',
    fragmentShader:'',
  } as Shader;
}

describe('human-scale meadow grass and actor interaction',()=>{
  it('limits local tuft height before scale/placement to avoid obscuring small Onyx',()=>{
    for(const quality of ['low','high'] as const){
      const geometry=makeGrassPatch(quality);
      try{
        const positions=geometry.getAttribute('position');
        let maxY=0;
        for(let i=0;i<positions.count;i++)
          maxY=Math.max(maxY,positions.getY(i));
        expect(maxY).toBeGreaterThan(.25);
        expect(maxY).toBeLessThan(.57);
      }finally{geometry.dispose();}
    }
  });

  it('lets the playable rider or dragon flatten local blades in one shader pass',()=>{
    const scene=new THREE.Scene();
    const grass=new LocalGroundcover(scene,'low');
    try{
      const material=grass.mesh.material as THREE.MeshStandardMaterial;
      const shader=shaderMock();
      material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
      expect(shader.vertexShader).toContain('closeDisturbance');
      expect(shader.vertexShader).toContain('smoothstep(.65,3.1,actorDistance)');
      expect(shader.vertexShader).toContain('transformed.y*=1.0-.74*closeDisturbance');
      grass.update(-521,-104,1);
      expect(shader.uniforms.uScGrassActor?.value.x).toBe(-521);
      expect(shader.uniforms.uScGrassActor?.value.y).toBe(-104);
    }finally{grass.dispose();}
  });

  it('scales distant forest grass down while keeping the same draw batches',()=>{
    const scene=new THREE.Scene();
    const nature=new PainterlyNature(scene,'low');
    try{
      const mesh=scene.getObjectByName('vegetation.azure.waving-grass') as THREE.InstancedMesh;
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      const p=mesh.geometry.getAttribute('position');
      let maxHeight=0;
      for(let i=0;i<p.count;i++)maxHeight=Math.max(maxHeight,p.getY(i));
      expect(maxHeight).toBeGreaterThan(.45);
      expect(maxHeight).toBeLessThan(.7);
      const shader=shaderMock();
      (mesh.material as THREE.MeshStandardMaterial)
        .onBeforeCompile(shader,{} as THREE.WebGLRenderer);
      expect(shader.vertexShader).toContain('scActorDistance');
      nature.update(2,-521,-104);
      expect(shader.uniforms.uScGrassActor?.value.x).toBe(-521);
      expect(shader.uniforms.uScGrassActor?.value.y).toBe(-104);
      expect(mesh.instanceMatrix.count).toBeGreaterThan(0);
    }finally{nature.dispose();}
  });
});
