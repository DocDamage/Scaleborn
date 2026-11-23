import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DragonVisual } from '../src/actors/dragon/visual';
import { newFlightState } from '../src/actors/dragon/flight';

/**
 * Character quality has to stay viable on a dedicated midrange GPU as well
 * as SwiftShader. These checks guard allocations and draw geometry budgets;
 * they are NOT a substitute for a real RTX 3060 performance profile.
 */
describe('original three-form character morph geometry budget',()=>{
  it('keeps shared source geometry and shape-key counts bounded',()=>{
    const visual=new DragonVisual();
    try{
      let morphSamples=0,vertices=0,triangleIndices=0;
      const geometry=new Set<THREE.BufferGeometry>();
      visual.root.traverse(node=>{
        if(!(node instanceof THREE.Mesh))return;
        geometry.add(node.geometry);
      });
      for(const g of geometry){
        const base=g.getAttribute('position');
        if(!base)continue;
        vertices+=base.count;
        triangleIndices+=g.index?.count??0;
        const targets=g.morphAttributes.position??[];
        for(const morph of targets){
          expect(morph.count).toBe(base.count);
          morphSamples+=morph.count;
        }
      }
      expect(geometry.size).toBeGreaterThan(50);
      expect(geometry.size).toBeLessThan(300);
      expect(vertices).toBeLessThan(160_000);
      expect(triangleIndices).toBeLessThan(750_000);
      expect(morphSamples).toBeLessThan(65_000);
      // Every frame reuses the same geometry: there is one dragon actor
      // scaled into three forms, NOT three full copies of those meshes.
      const leftWing=visual.root.getObjectByName('wing.left.membrane') as THREE.SkinnedMesh;
      const coat=visual.rider.getObjectByName('rider.fitted-coat') as THREE.Mesh;
      const knee=visual.rider.getObjectByName('rider.trousers') as THREE.Mesh;
      expect(leftWing.geometry.morphAttributes.position).toHaveLength(2);
      expect(coat.geometry.morphAttributes.position).toHaveLength(4);
      expect(knee.geometry.morphAttributes.position).toHaveLength(1);
    }finally{visual.dispose();}
  });

  it('reuses every animation buffer through walking, folded wings, flight and dismount',()=>{
    const dragon=new DragonVisual(),state=newFlightState();
    try{
      const names=[
        'wing.left.membrane','wing.right.membrane',
        'rider.fitted-coat','rider.face','rider.sleeve',
        'rider.trousers','creature.dragon.leg-surface',
      ];
      const meshes=names.map(name=>{
        const mesh=dragon.root.getObjectByName(name) as THREE.Mesh;
        expect(mesh,name).toBeInstanceOf(THREE.Mesh);
        return mesh;
      });
      const captured=meshes.map(mesh=>({
        geometry:mesh.geometry,
        array:mesh.geometry.getAttribute('position').array,
        morphs:[...(mesh.geometry.morphAttributes.position??[])].map(m=>m.array),
      }));
      for(const [i,form,mode] of [
        [1,'rideable','ground'],
        [2,'rideable','air'],
        [3,'rideable','underwater'],
        [4,'giant','ground'],
        [5,'small','ground'],
      ] as const){
        state.form=form;state.mode=mode;state.time=i*.5;
        state.speed=mode==='ground'?3:12;
        state.roll=mode==='air'?.25:0;
        state.riderMode=mode==='underwater'?'underwater':'ground';
        dragon.update(state);
        for(let j=0;j<meshes.length;j++){
          const mesh=meshes[j]!,old=captured[j]!;
          expect(mesh.geometry).toBe(old.geometry);
          expect(mesh.geometry.getAttribute('position').array).toBe(old.array);
          const morphs=mesh.geometry.morphAttributes.position??[];
          expect(morphs).toHaveLength(old.morphs.length);
          for(let k=0;k<morphs.length;k++){
            expect(morphs[k]!.array).toBe(old.morphs[k]);
          }
          expect((mesh.morphTargetInfluences??[]).every(Number.isFinite)).toBe(true);
        }
        expect(dragon.rider.scale.x).toBe(1);
      }
    }finally{dragon.dispose();}
  });
});
