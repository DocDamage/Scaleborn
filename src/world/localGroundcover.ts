import * as THREE from 'three';
import { hash2, fbm } from '../core/random';
import { heightAt, AZURE_SEED, LANDMARKS } from './terrain';
import { waterSurfaceAt } from './highlandLake';

type Quality = 'high' | 'low';

function grassPatch(quality: Quality): THREE.BufferGeometry {
  const positions: number[]=[];
  const blades=quality==='high'?14:10;
  const v=(p:THREE.Vector3):void=>{positions.push(p.x,p.y,p.z);};
  for(let i=0;i<blades;i++){
    const angle=i*2.399963229728653+Math.sin(i*1.73)*.24;
    const dir=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
    const sideways=new THREE.Vector3(-dir.z,0,dir.x);
    const center=new THREE.Vector3(
      Math.sin(i*3.17)*.31,0,Math.cos(i*3.17)*.31);
    const length=.56+(i%5)*.13;
    const width=.036+(i%3)*.011;
    const baseL=center.clone().addScaledVector(sideways,-width);
    const baseR=center.clone().addScaledVector(sideways,width);
    const middle=center.clone().addScaledVector(dir,length*.25)
      .add(new THREE.Vector3(0,length*.63,0));
    const midL=middle.clone().addScaledVector(sideways,-width*.55);
    const midR=middle.clone().addScaledVector(sideways,width*.55);
    const tip=center.clone().addScaledVector(dir,length*.56)
      .add(new THREE.Vector3(0,length,0));
    v(baseL);v(midL);v(baseR);
    v(baseR);v(midL);v(midR);
    v(midL);v(tip);v(midR);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Grid-stable detail for land near the player's active dragon/rider. This is
 * intentionally bounded: the old global plant population left ten-meter
 * gaps in close screenshots, while millions of global instanced blades would
 * overwhelm low-end GPUs. One instanced draw call covers the local view.
 *
 * Re-generates matrices only when the observer crosses four grid cells;
 * deterministic per-cell jitter means the same terrain has the same plants.
 */
export class LocalGroundcover {
  readonly mesh: THREE.InstancedMesh;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly time={value:0};
  private readonly radius: number;
  private readonly spacing: number;
  private readonly dummy=new THREE.Object3D();
  private readonly color=new THREE.Color();
  private lastX=Number.NaN;
  private lastZ=Number.NaN;

  constructor(scene:THREE.Scene,quality:Quality='high') {
    this.radius=quality==='high'?94:76;
    this.spacing=quality==='high'?3.05:4.65;
    const side=Math.ceil(this.radius*2/this.spacing)+5;
    const capacity=side*side;
    this.material=new THREE.MeshStandardMaterial({
      color:0xb6caa3,side:THREE.DoubleSide,roughness:.94,metalness:0,
    });
    const wind=this.time;
    this.material.onBeforeCompile=(shader)=>{
      shader.uniforms.uScGrassDetailTime=wind;
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
        '#include <common>\nuniform float uScGrassDetailTime;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
          #ifdef USE_INSTANCING
          float phase=instanceMatrix[3].x*.029+instanceMatrix[3].z*.018;
          #else
          float phase=0.0;
          #endif
          transformed.x+=sin(uScGrassDetailTime*1.16+phase+position.y*2.2)
            *position.y*position.y*.065;
          transformed.z+=cos(uScGrassDetailTime*.91+phase+position.y*1.5)
            *position.y*position.y*.047;
        `);
    };
    this.material.customProgramCacheKey=()=> 'scaleborn-groundcover-wind-v1';
    this.mesh=new THREE.InstancedMesh(grassPatch(quality),this.material,capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count=0;
    this.mesh.frustumCulled=false;
    this.mesh.name='vegetation.azure.local-groundcover';
    this.mesh.receiveShadow=quality==='high';
    scene.add(this.mesh);
  }

  update(x:number,z:number,time:number):void {
    this.time.value=time;
    if(!Number.isFinite(x)||!Number.isFinite(z))return;
    const centerX=Math.floor(x/(this.spacing*4));
    const centerZ=Math.floor(z/(this.spacing*4));
    if(centerX===this.lastX&&centerZ===this.lastZ)return;
    this.lastX=centerX;this.lastZ=centerZ;
    const minX=Math.floor((x-this.radius)/this.spacing);
    const maxX=Math.ceil((x+this.radius)/this.spacing);
    const minZ=Math.floor((z-this.radius)/this.spacing);
    const maxZ=Math.ceil((z+this.radius)/this.spacing);
    const radiusSq=this.radius*this.radius;
    const limit=this.mesh.instanceMatrix.count;
    let count=0;
    for(let cz=minZ;cz<=maxZ;cz++){
      for(let cx=minX;cx<=maxX;cx++){
        const h=hash2(cx,cz,AZURE_SEED+707);
        if(h<.16)continue;
        const wx=(cx+(hash2(cx,cz,AZURE_SEED+29)-.5)*.73)*this.spacing;
        const wz=(cz+(hash2(cx,cz,AZURE_SEED+83)-.5)*.73)*this.spacing;
        const dx=wx-x,dz=wz-z;
        if(dx*dx+dz*dz>radiusSq)continue;
        const ground=heightAt(wx,wz);
        const level=waterSurfaceAt(wx,wz);
        if(ground<=level+1.15||ground>188)continue;
        const step=2;
        const slope=Math.hypot(
          heightAt(wx+step,wz)-heightAt(wx-step,wz),
          heightAt(wx,wz+step)-heightAt(wx,wz-step))/(2*step);
        if(slope>.72)continue;
        if(fbm(wx*.006,wz*.006,AZURE_SEED+338,3)<-.38)continue;
        if(LANDMARKS.some(p=>Math.hypot(wx-p.x,wz-p.z)<
          (p.id==='azure.harbor'?118:22)))continue;
        if(count>=limit)break;
        const tint=hash2(cx,cz,AZURE_SEED+517);
        this.dummy.position.set(wx,ground+.035,wz);
        this.dummy.rotation.set(0,tint*Math.PI*2,0);
        this.dummy.scale.setScalar(.58+tint*.75);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(count,this.dummy.matrix);
        this.color.setHSL(.22+tint*.11,.28+tint*.13,.46+tint*.17);
        this.mesh.setColorAt(count,this.color);
        count++;
      }
      if(count>=limit)break;
    }
    this.mesh.count=count;
    this.mesh.instanceMatrix.needsUpdate=true;
    if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
  }

  dispose():void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
