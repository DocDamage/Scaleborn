import * as THREE from 'three';
import { rng } from '../core/random';
import { AZURE_SEED, heightAt } from './terrain';
import { GRAND_LAKE, lakeBoundaryScale, lakeContains } from './highlandLake';
import { InstanceVisibility } from './instanceVisibility';
import { aquaticTuft } from './lakebedBotany';
export { aquaticTuft } from './lakebedBotany';
import { makeRockMaterial } from './materials';

type Quality = 'high' | 'low';
type Site = { x:number; y:number; z:number; scale:number; hue:number };

function riverStone(quality:Quality):THREE.BufferGeometry {
  // Water-polished pebbles retain a curved silhouette even at rider height.
  // The original subdivided icosahedron exposed conspicuous triangular facets.
  const geometry=new THREE.SphereGeometry(1,
    quality==='high'?20:14,quality==='high'?14:10);
  const p=geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const rough=1+.035*Math.sin(x*5+y*7+z*4)+.018*Math.sin(z*11-x*9);
    p.setXYZ(i,x*rough,y*rough*.77,z*rough);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Seed-stable lakebed dressing sampled from the SAME collision heightfield.
 * Decorative stones stay low and embedded; tall collidable cave rocks require
 * authored collision proxies and are intentionally not simulated here.
 */
export class LakebedHabitat {
  readonly group=new THREE.Group();
  readonly stones:THREE.InstancedMesh;
  readonly weeds:THREE.InstancedMesh;
  private readonly stoneMaterial:THREE.MeshStandardMaterial;
  private readonly weedMaterial:THREE.MeshStandardMaterial;
  private readonly time={value:0};
  private readonly visibility=new InstanceVisibility();

  constructor(scene:THREE.Scene,quality:Quality='high'){
    this.group.name='terrain.azure.mirrorfall-lakebed-habitat';
    scene.add(this.group);
    const random=rng(AZURE_SEED+32841);
    const stones:Site[]=[],plants:Site[]=[];
    const candidates=quality==='high'?18500:6500;
    for(let i=0;i<candidates;i++){
      const a=random()*Math.PI*2;
      const radius=Math.sqrt(random())*.963*lakeBoundaryScale(a);
      const x=GRAND_LAKE.x+Math.cos(a)*GRAND_LAKE.radiusX*radius;
      const z=GRAND_LAKE.z+Math.sin(a)*GRAND_LAKE.radiusZ*radius;
      if(!lakeContains(x,z))continue;
      const y=heightAt(x,z);
      const depth=GRAND_LAKE.surfaceY-y;
      if(depth<2.5 || depth>GRAND_LAKE.maxDepth+10)continue;
      const choice=random();
      if(choice<.26){
        stones.push({x,y,z,scale:.22+random()*.96,hue:random()});
      }else if(choice>.42 && depth<25){
        const e=2.8;
        const slope=Math.hypot(
          heightAt(x+e,z)-heightAt(x-e,z),
          heightAt(x,z+e)-heightAt(x,z-e))/(e*2);
        if(slope<.65)plants.push({x,y,z,scale:.55+random()*.95,hue:random()});
      }
    }
    const dummy=new THREE.Object3D();
    this.stoneMaterial=makeRockMaterial(quality);
    this.stones=new THREE.InstancedMesh(
      riverStone(quality),this.stoneMaterial,stones.length);
    this.stones.name='terrain.azure.mirrorfall-submerged-stones';
    stones.forEach((p,i)=>{
      dummy.position.set(p.x,p.y+.09,p.z);
      dummy.rotation.set(0,p.hue*Math.PI*2,0);
      dummy.scale.set(p.scale,p.scale*(.26+.22*p.hue),
        p.scale*(.64+.35*p.hue));
      dummy.updateMatrix();
      this.stones.setMatrixAt(i,dummy.matrix);
      this.stones.setColorAt(i,new THREE.Color().setHSL(
        .12+p.hue*.12,.08+p.hue*.10,.66+p.hue*.22));
    });
    this.stones.receiveShadow=true;
    this.group.add(this.stones);
    this.visibility.register(this.stones,stones,quality==='high'?380:260);

    this.weedMaterial=new THREE.MeshStandardMaterial({
      color:0xb4c8ac,vertexColors:true,roughness:.87,metalness:0,side:THREE.DoubleSide,
    });
    const anim=this.time;
    this.weedMaterial.customProgramCacheKey=()=> 'scaleborn-freshwater-plants-v1';
    this.weedMaterial.onBeforeCompile=(shader)=>{
      shader.uniforms.uScFreshwaterTime=anim;
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
        '#include <common>\nuniform float uScFreshwaterTime;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
          #ifdef USE_INSTANCING
          float phase=instanceMatrix[3].x*.047+instanceMatrix[3].z*.028;
          #else
          float phase=0.0;
          #endif
          float bend=smoothstep(.25,2.1,position.y);
          transformed.x+=sin(uScFreshwaterTime*.61+phase+position.y*.71)
            *bend*.23;
          transformed.z+=cos(uScFreshwaterTime*.51+phase+position.y*.59)
            *bend*.18;
        `);
    };
    this.weeds=new THREE.InstancedMesh(
      aquaticTuft(quality),this.weedMaterial,plants.length);
    this.weeds.name='vegetation.azure.mirrorfall-freshwater-plants';
    plants.forEach((p,i)=>{
      dummy.position.set(p.x,p.y+.09,p.z);
      dummy.rotation.set(0,p.hue*Math.PI*2,0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      this.weeds.setMatrixAt(i,dummy.matrix);
      this.weeds.setColorAt(i,new THREE.Color().setHSL(
        .29+p.hue*.11,.27+p.hue*.17,.42+p.hue*.19));
    });
    this.weeds.receiveShadow=true;
    this.group.add(this.weeds);
    this.visibility.register(this.weeds,plants,quality==='high'?245:170);
  }

  update(time:number,x:number,z:number,camera?:THREE.Camera):void {
    if(Number.isFinite(time))this.time.value=time;
    if(!Number.isFinite(x)||!Number.isFinite(z))return;
    this.group.visible=Math.hypot(x-GRAND_LAKE.x,z-GRAND_LAKE.z)<1150;
    if(this.group.visible)this.visibility.update(x,z,camera);
  }

  dispose():void {
    this.group.removeFromParent();
    this.stones.geometry.dispose();
    this.weeds.geometry.dispose();
    this.stoneMaterial.dispose();
    this.weedMaterial.dispose();
  }
}
