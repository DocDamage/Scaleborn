import * as THREE from 'three';
import { hash2, fbm } from '../core/random';
import { heightAt, AZURE_SEED, LANDMARKS } from './terrain';
import { waterSurfaceAt } from './highlandLake';

type Quality = 'high' | 'low';

/** Curved, indexed meadow blades with root-to-tip painted albedo.
 * Smooth normals prevent the near-camera groundcover from appearing as
 * a collection of flat, faceted triangles. Both presets share one draw call.
 */
export function makeGrassPatch(quality: Quality): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const blades = quality === 'high' ? 15 : 10;
  const sections = quality === 'high' ? 4 : 2;
  for (let i = 0; i < blades; i++) {
    const angle = i * 2.399963229728653 + Math.sin(i * 1.73) * .24;
    const dx = Math.cos(angle), dz = Math.sin(angle);
    const sideX = -dz, sideZ = dx;
    const rootX = Math.sin(i * 3.17) * .31;
    const rootZ = Math.cos(i * 3.17) * .31;
    const height = .58 + (i % 5) * .13;
    const width = .040 + (i % 3) * .012;
    const hue = Math.sin(i * 2.61) * .055;
    const first = positions.length / 3;
    for (let j = 0; j <= sections; j++) {
      const t = j / sections;
      // Wind-curved blades grow vertically then fold outward toward the tip.
      const forward = height * (.13 * t + .43 * t * t);
      const rise = height * (t - .11 * t * t);
      const halfWidth = width * Math.pow(1 - t, .78) + .0008;
      const r = .46 + t * .33 + hue;
      const g = .57 + t * .32 + hue * .55;
      const b = .30 + t * .25 + (i % 4) * .018;
      for (const sign of [-1, 1]) {
        positions.push(
          rootX + dx * forward + sideX * halfWidth * sign,
          rise,
          rootZ + dz * forward + sideZ * halfWidth * sign,
        );
        colors.push(r, g, b);
      }
    }
    for (let j = 0; j < sections; j++) {
      const a = first + j * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
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
    this.spacing=quality==='high'?2.70:4.35;
    const side=Math.ceil(this.radius*2/this.spacing)+5;
    const capacity=side*side;
    this.material=new THREE.MeshStandardMaterial({
      color:0xd8e4c6,vertexColors:true,side:THREE.DoubleSide,roughness:.94,metalness:0,
    });
    const wind=this.time;
    const fadeRadius={value:this.radius};
    this.material.onBeforeCompile=(shader)=>{
      shader.uniforms.uScGrassDetailTime=wind;
      shader.uniforms.uScGrassDetailRadius=fadeRadius;
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
        '#include <common>\nuniform float uScGrassDetailTime;\nuniform float uScGrassDetailRadius;');
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
          // Scale down the actual grass blade around its root before it
          // enters the local vegetation budget, avoiding a popping ring.
          #ifdef USE_INSTANCING
          float fadeDistance=length(instanceMatrix[3].xz-cameraPosition.xz);
          float scDetailFade=1.0-smoothstep(
            uScGrassDetailRadius-17.0,uScGrassDetailRadius-3.0,fadeDistance);
          transformed*=scDetailFade;
          #endif
        `);
    };
    this.material.customProgramCacheKey=()=> 'scaleborn-groundcover-wind-fade-v2';
    this.mesh=new THREE.InstancedMesh(makeGrassPatch(quality),this.material,capacity);
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
