import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, fbm } from '../core/random';
import { AZURE_SEED, heightAt, LANDMARKS } from './terrain';
import { GRAND_LAKE, waterSurfaceAt, lakeShoreDistance } from './highlandLake';
import { makeBarkMaterial, makeRockMaterial } from './materials';

interface PlantSite { x: number; y: number; z: number; scale: number; hue: number }
const dummy = new THREE.Object3D();

function taperBranch(a: THREE.Vector3, b: THREE.Vector3, bottom: number, top: number): THREE.BufferGeometry {
  const axis = b.clone().sub(a);
  const geo = new THREE.CylinderGeometry(top, bottom, axis.length(), 7, 3);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), axis.clone().normalize()));
  geo.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
  return geo;
}

function leafTexture(): THREE.DataTexture {
  const size = 64;
  const bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size * 2 - 1;
      const v = (y + 0.5) / size * 2 - 1;
      const span = Math.pow(Math.max(0, 1 - v * v), 0.65);
      const notch = 0.025 * Math.sin(v * 29) * Math.sin(v * 13);
      const edge = span * (0.61 + 0.25 * (1 - Math.abs(v))) + notch;
      const inside = Math.abs(u) < edge;
      const vein = Math.exp(-Math.abs(u) * 14);
      const i = (y * size + x) * 4;
      bytes[i] = Math.round(121 + vein * 22 + (1 - v) * 8);
      bytes[i + 1] = Math.round(168 + vein * 10 - v * 10);
      bytes[i + 2] = Math.round(104 + vein * 12);
      // Antialiased lobes instead of hard cardboard edges.
      const feather=Math.max(0,Math.min(1,(edge-Math.abs(u))*7.5));
      bytes[i + 3] = inside ? Math.round(255*feather) : 0;
    }
  }
  const texture = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function addLeaf(vertices: number[], uv: number[],
  pos: THREE.Vector3, angle: number, length: number, width: number): void {
  const axis = new THREE.Vector3(
    Math.cos(angle), 0.24 + Math.sin(angle * 1.7) * 0.15, Math.sin(angle)).normalize();
  // Lean the leaf plane upright. Earlier horizontal-only leaf cards were
  // almost edge-on in third-person views, making canopies look skeletal.
  const side = new THREE.Vector3(
    -Math.sin(angle)*.68,
    .57+.23*Math.sin(angle*2.7),
    Math.cos(angle)*.68,
  ).normalize();
  const root = pos;
  const tip = root.clone().addScaledVector(axis, length);
  const left = root.clone().addScaledVector(axis, length * 0.50).addScaledVector(side, width);
  const right = root.clone().addScaledVector(axis, length * 0.50).addScaledVector(side, -width);
  const add = (p: THREE.Vector3, u: number, v: number): void => {
    vertices.push(p.x,p.y,p.z);
    uv.push(u,v);
  };
  add(root,0.5,0); add(left,0,0.5); add(tip,0.5,1);
  add(root,0.5,0); add(tip,0.5,1); add(right,1,0.5);
}

/** Four distinct branch distributions share one high-density leaf-card material. */
function treePrototypes(seed: number, quality: 'high'|'low'): {wood: THREE.BufferGeometry; foliage: THREE.BufferGeometry} {
  const rand = rng(seed);
  const wood: THREE.BufferGeometry[] = [];
  const leaves: number[] = [], uv: number[] = [];
  const trunkHeight = 9.0 + rand() * 2.8;
  const trunk = new THREE.Vector3(Math.sin(seed)*0.16,trunkHeight,Math.cos(seed)*0.15);
  wood.push(taperBranch(new THREE.Vector3(0,0,0), trunk, 0.46, 0.10));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rand() * 0.72;
    const y = 3.7 + (i / 10) * 5.3;
    const distance = 3.0 + rand() * 2.7;
    const start = new THREE.Vector3(0.08 * Math.sin(a), y, 0.08 * Math.cos(a));
    const end = new THREE.Vector3(Math.cos(a) * distance, y + 1.7 + rand() * 1.6,
      Math.sin(a) * distance);
    wood.push(taperBranch(start, end, 0.18 + rand() * .11, 0.035));
    for (let k = 0; k < (quality==='high'?42:30); k++) {
      const t = 0.33 + rand() * 0.83;
      const p = start.clone().lerp(end,t);
      p.x += (rand()-.5) * 1.75; p.y += (rand()-.5) * 2.5;
      p.z += (rand()-.5) * 1.75;
      addLeaf(leaves,uv,p,a+rand()*6.28,0.48+rand()*0.64,0.20+rand()*0.25);
    }
  }
  const combined = mergeGeometries(wood, false);
  if (!combined) throw new Error('Procedural tree branch merge failed');
  wood.forEach(g => g.dispose());
  const crown = new THREE.BufferGeometry();
  crown.setAttribute('position', new THREE.Float32BufferAttribute(leaves,3));
  crown.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  crown.computeVertexNormals();
  return { wood: combined, foliage: crown };
}

function grassTuft(): THREE.BufferGeometry {
  const positions: number[] = [];
  for(let i=0;i<7;i++){
    const angle = i * Math.PI*2/7;
    const base = new THREE.Vector3(Math.cos(angle)*0.14,0,Math.sin(angle)*0.14);
    const middle = new THREE.Vector3(Math.cos(angle)*0.28,0.50,Math.sin(angle)*0.28);
    const tip = new THREE.Vector3(Math.cos(angle)*0.44,1.10+(i%3)*0.12,Math.sin(angle)*0.44);
    const s=new THREE.Vector3(-Math.sin(angle),0,Math.cos(angle));
    const verts=[
      base.clone().addScaledVector(s,-0.095),
      base.clone().addScaledVector(s,0.095),
      middle.clone().addScaledVector(s,-0.057),
      middle.clone().addScaledVector(s,0.057),
    ];
    for(const p of [verts[0],verts[1],verts[2],verts[1],verts[3],verts[2],
      verts[2],verts[3],tip]){
      if(!p) continue;
      positions.push(p.x,p.y,p.z);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.computeVertexNormals();
  return geo;
}

function irregularRock(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1,2);
  const p=g.getAttribute('position');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    const perturb=1+0.09*Math.sin(x*12.9+y*17.3+z*7.2)+0.07*Math.sin(z*23.1-x*11.4);
    p.setXYZ(i,x*perturb,y*perturb,z*perturb);
  }
  g.computeVertexNormals();
  return g;
}

export class PainterlyNature {
  private readonly root = new THREE.Group();
  private readonly materials: THREE.Material[] = [];
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly textures: THREE.Texture[] = [];
  private grassWind: { value: number } | null = null;
  private leafWind: { value: number } | null = null;
  constructor(scene: THREE.Scene, quality: 'high' | 'low' = 'high') {
    this.root.name='vegetation.azure.painterly-nature';
    scene.add(this.root);
    const rand=rng(AZURE_SEED+181);
    const trees: PlantSite[][]=[[],[],[],[]];
    const grasses: PlantSite[] = [], rocks: PlantSite[] = [];

    const overlook = { x:GRAND_LAKE.x+258, z:GRAND_LAKE.z+320 };
    const isOverlook=(x:number,z:number):boolean=>
      Math.hypot(x-overlook.x,z-overlook.z)<35;
    const candidates = quality === 'low' ? 4400 : 23000;
    for(let i=0;i<candidates;i++){
      const x=(rand()-.5)*3750, z=(rand()-.5)*3750;
      const y=heightAt(x,z);
      const water=waterSurfaceAt(x,z);
      if(y < water + 0.9 || y > 188)continue;
      if(LANDMARKS.some(l=>Math.hypot(l.x-x,l.z-z)<(l.id==='azure.harbor'?120: l.id==='azure.tidegate'?24:28)))continue;
      const density=fbm(x*.0037,z*.0037,AZURE_SEED+339,3);
      const shore=Math.abs(lakeShoreDistance(x,z))<110;
      if(rand()<.23 && density>-0.34 && y>water+2.4 && !shore && !isOverlook(x,z)) {
        const type=Math.floor(rand()*4);
        trees[type]!.push({x,y,z,scale:0.85+rand()*0.96,hue:rand()});
      } else {
        if(rand()<.72)grasses.push({x,y:y+.04,z,scale:0.34+rand()*0.9,hue:rand()});
        if(rand()<.035)rocks.push({x,y,z,scale:.55+rand()*2.75,hue:rand()});
      }
    }
    // Dedicated shoreline forest: natural density where lake banks, falls,
    // inlets and sunlit cliffs dominate the player's field of view.
    // Still instanced by tree archetype; avoids global high-cost grass floods.
    const bankSamples = quality === 'low' ? 1950 : 6900;
    for (let i = 0; i < bankSamples; i++) {
      const theta=rand()*Math.PI*2;
      const radius=1.07+rand()*0.46;
      const x=GRAND_LAKE.x+Math.cos(theta)*GRAND_LAKE.radiusX*radius;
      const z=GRAND_LAKE.z+Math.sin(theta)*GRAND_LAKE.radiusZ*radius;
      const y=heightAt(x,z);
      if(y<waterSurfaceAt(x,z)+2.5 || y>196)continue;
      if(Math.hypot(x-(GRAND_LAKE.x+GRAND_LAKE.radiusX*1.13),z-GRAND_LAKE.z)<42)continue;
      const pick=rand();
      if(pick<.41){
        const species=Math.floor(rand()*4);
        const step=5;
        const slope=(Math.abs(heightAt(x+step,z)-heightAt(x-step,z))+
          Math.abs(heightAt(x,z+step)-heightAt(x,z-step)))/(2*step);
        // Root trees on actual stable slopes, not the sheer waterfall face.
        if(slope<1.05 && !isOverlook(x,z)) {
          trees[species]!.push({x,y,z,scale:1.10+rand()*1.15,hue:rand()});
        }
      }else if(pick<.57){
        grasses.push({x,y:y+.06,z,scale:.65+rand()*.82,hue:rand()});
      }else if(pick<.65){
        rocks.push({x,y,z,scale:.85+rand()*2.9,hue:rand()});
      }
    }
    // Close-range ground-cover carpet along navigable lake overlooks.
    // Finite instanced blade count: no per-frame geometry allocations.
    const coverSamples=quality==='low'?5200:15500;
    for(let i=0;i<coverSamples;i++){
      const angle=rand()*Math.PI*2;
      const radii=.99+rand()*.55;
      const x=GRAND_LAKE.x+Math.cos(angle)*GRAND_LAKE.radiusX*radii;
      const z=GRAND_LAKE.z+Math.sin(angle)*GRAND_LAKE.radiusZ*radii;
      const y=heightAt(x,z), waterY=waterSurfaceAt(x,z);
      if(y<waterY+1.0||y>186)continue;
      const e=3.0;
      const slope=Math.hypot(heightAt(x+e,z)-heightAt(x-e,z),
        heightAt(x,z+e)-heightAt(x,z-e))/(2*e);
      if(slope>1.12)continue;
      const heightBias=isOverlook(x,z) ? 1.25 : .70;
      grasses.push({x,y:y+.04,z,scale:heightBias*(.65+rand()*.82),hue:rand()});
    }
    const woodMat=makeBarkMaterial(quality);
    const rockMat=makeRockMaterial(quality);
    const leafTex=leafTexture();
    const leafMat=new THREE.MeshStandardMaterial({
      color:0x8ebb79,map:leafTex,roughness:.88,metalness:0,
      side:THREE.DoubleSide,alphaTest:0.28,depthWrite:true,
    });
    // Gentle leaf motion follows the rooted tree, not a rotating billboard.
    // The tips sway more than the branch attachment, with a world-seeded
    // gust phase so distant tree crowns do not oscillate in lockstep.
    const leafWind={value:0};
    this.leafWind=leafWind;
    leafMat.onBeforeCompile=(shader)=>{
      shader.uniforms.uScLeafTime=leafWind;
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
        '#include <common>\nuniform float uScLeafTime;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float gustPhase=instanceMatrix[3].x*.015+
              instanceMatrix[3].z*.017;
          #else
            float gustPhase=0.0;
          #endif
          float canopyWeight=smoothstep(1.0,7.5,position.y);
          transformed.x+=sin(uScLeafTime*.74+gustPhase+
            position.z*.33)*canopyWeight*.12;
          transformed.z+=cos(uScLeafTime*.63+gustPhase+
            position.x*.22)*canopyWeight*.10;
        `);
    };
    leafMat.customProgramCacheKey=()=> 'scaleborn-foliage-motion-v1';
    const grassMat=new THREE.MeshStandardMaterial({
      color:0xb8c99c,roughness:.94,metalness:0,side:THREE.DoubleSide
    });
    grassMat.onBeforeCompile=(shader)=>{
      const time={value:0};
      shader.uniforms.uScWindTime=time;
      this.grassWind=time;
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
        '#include <common>\nuniform float uScWindTime;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float phase=instanceMatrix[3].x*0.027+instanceMatrix[3].z*0.021;
          #else
            float phase=0.0;
          #endif
          transformed.x += sin(uScWindTime*1.26+phase+position.y*1.2)
            * position.y*position.y*0.085;
        `);
    };
    grassMat.customProgramCacheKey=()=> 'scaleborn-grass-wind-v1';
    this.materials.push(woodMat,rockMat,leafMat,grassMat);
    this.textures.push(leafTex);

    for(let species=0;species<4;species++){
      const sites=trees[species]!;
      const proto=treePrototypes(AZURE_SEED+species*439,quality);
      const wood=new THREE.InstancedMesh(proto.wood,woodMat,sites.length);
      const crown=new THREE.InstancedMesh(proto.foliage,leafMat,sites.length);
      sites.forEach((item,i)=>{
        dummy.position.set(item.x,item.y,item.z);
        dummy.rotation.set(0,item.hue*Math.PI*2,0);
        dummy.scale.setScalar(item.scale);
        dummy.updateMatrix();
        wood.setMatrixAt(i,dummy.matrix);crown.setMatrixAt(i,dummy.matrix);
        const tint=new THREE.Color().setHSL(
          item.hue<.19 ? .09+item.hue*.2 : .28+item.hue*.07,
          .28+item.hue*.15,.55+item.hue*.10);
        crown.setColorAt(i,tint);
      });
      wood.name='vegetation.azure.pbr-tree-wood.'+species;
      crown.name='vegetation.azure.pbr-tree-leaves.'+species;
      wood.castShadow = quality === 'high';
      crown.castShadow = quality === 'high';
      wood.receiveShadow = quality === 'high';
      this.root.add(wood,crown);
      this.meshes.push(wood,crown);
    }

    const grass=new THREE.InstancedMesh(grassTuft(),grassMat,grasses.length);
    grasses.forEach((p,i)=>{
      dummy.position.set(p.x,p.y,p.z);
      dummy.rotation.set(0,p.hue*Math.PI*2,0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
      grass.setColorAt(i,new THREE.Color().setHSL(.22+p.hue*.10,.31,.42+p.hue*.16));
    });
    grass.name='vegetation.azure.waving-grass';
    grass.receiveShadow = quality === 'high';
    this.root.add(grass);this.meshes.push(grass);

    const rock=new THREE.InstancedMesh(irregularRock(),rockMat,rocks.length);
    rocks.forEach((p,i)=>{
      dummy.position.set(p.x,p.y-p.scale*.11,p.z);
      dummy.rotation.set(rand()*2,rand()*6.28,rand()*.8);
      dummy.scale.set(p.scale,p.scale*(.27+rand()*.28),p.scale*(.55+rand()*.35));
      dummy.updateMatrix();rock.setMatrixAt(i,dummy.matrix);
    });
    rock.name='terrain.azure.rounded-pbr-boulders';
    rock.castShadow=quality==='high';
    rock.receiveShadow=quality==='high';
    this.root.add(rock);this.meshes.push(rock);
  }
  update(time:number):void{
    if(this.grassWind)this.grassWind.value=time;
    if(this.leafWind)this.leafWind.value=time;
  }
  dispose():void{
    this.meshes.forEach(mesh=>mesh.geometry.dispose());
    this.materials.forEach(m=>m.dispose());
    this.textures.forEach(t=>t.dispose());
    this.root.removeFromParent();
  }
}
