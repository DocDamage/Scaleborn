import * as THREE from 'three';
import { rng } from '../core/random';
import { AZURE_SEED, heightAt } from './terrain';
import { GRAND_LAKE, MIRRORFALL, lakeBoundaryScale, lakeShoreDistance } from './highlandLake';
import { makeRockMaterial } from './materials';
import { InstanceVisibility } from './instanceVisibility';

export interface ShoreStoneSite { x:number; y:number; z:number; size:number; yaw:number; hue:number }
type Quality = 'high'|'low';

/**
 * Angular, water-worn flattened sediment, not a spherical debug prop.
 * The low-polygon count is intentional: each rock is only a few decimetres
 * wide and hundreds share a single geometry/material/instanced draw call.
 */
export function makeShoreStone(quality:Quality):THREE.BufferGeometry {
  const radial=quality==='high'?15:10;
  const sections=[
    {y:-.28,r:.48},{y:-.10,r:.92},{y:.05,r:1.04},{y:.17,r:.81},{y:.25,r:.34},
  ];
  const positions:number[]=[],uvs:number[]=[],colors:number[]=[],indices:number[]=[];
  for(let row=0;row<sections.length;row++){
    const level=sections[row]!;
    for(let j=0;j<=radial;j++){
      const a=j/radial*Math.PI*2;
      const fracture=.075*Math.sin(a*5.1+row*.46)
        +.047*Math.cos(a*9.1-row*.34);
      const r=level.r*(1+fracture);
      positions.push(Math.cos(a)*r,level.y+.021*Math.sin(a*4.9+row),
        Math.sin(a)*r*.73);
      uvs.push(j/radial,row/(sections.length-1));
      const stone=.69+.11*Math.sin(row*1.9+a*2.1);
      colors.push(stone*.94,stone,stone*.91);
      if(row<sections.length-1&&j<radial){
        const k=row*(radial+1)+j,next=k+radial+1;
        indices.push(k,next,k+1,next,next+1,k+1);
      }
    }
  }
  // Close the underside/top so oblique shore views cannot see open shells.
  for(const top of [false,true]){
    const y=top?sections[sections.length-1]!.y:sections[0]!.y;
    const center=positions.length/3,ring=top?sections.length-1:0;
    positions.push(0,y,0);uvs.push(.5,top?1:0);
    colors.push(.69,.70,.65);
    const row=ring*(radial+1);
    for(let j=0;j<radial;j++){
      if(top)indices.push(center,row+j,row+j+1);
      else indices.push(center,row+j+1,row+j);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Stable sediment positions, avoiding deep lake, tall cliffs, and falls. */
export function sampleShoreSediment(quality:Quality):ShoreStoneSite[] {
  const rand=rng(AZURE_SEED+67420);
  const sites:ShoreStoneSite[]=[];
  const count=quality==='high'?19000:6900;
  for(let i=0;i<count;i++){
    const theta=rand()*Math.PI*2;
    const radius=.987+rand()*.15;
    const x=GRAND_LAKE.x+GRAND_LAKE.radiusX*radius*Math.cos(theta)*lakeBoundaryScale(theta);
    const z=GRAND_LAKE.z+GRAND_LAKE.radiusZ*radius*Math.sin(theta)*lakeBoundaryScale(theta);
    const distance=lakeShoreDistance(x,z);
    if(distance<.75||distance>31)continue;
    const y=heightAt(x,z);
    if(y<GRAND_LAKE.surfaceY+.38||y>GRAND_LAKE.surfaceY+15)continue;
    // Decorative shoreline gravel belongs on walkable or gently sloped
    // banks, not suspended on the near-vertical cascade wall.
    const step=1.8;
    const sx=(heightAt(x+step,z)-heightAt(x-step,z))/(2*step);
    const sz=(heightAt(x,z+step)-heightAt(x,z-step))/(2*step);
    if(Math.hypot(sx,sz)>1.22)continue;
    if(Math.hypot(x-MIRRORFALL.x,z-MIRRORFALL.z)<96)continue;
    if(rand()>.76)continue;
    sites.push({x,y,z,size:.18+rand()*.78,yaw:rand()*Math.PI*2,hue:rand()});
  }
  return sites;
}

/**
 * Add an irregular dry-to-wet sediment belt without altering the shared
 * lake shoreline function, foam geometry or gameplay collision.
 */
export class ShorelineSediment {
  readonly group=new THREE.Group();
  readonly mesh:THREE.InstancedMesh;
  private readonly rockMaterial:THREE.MeshStandardMaterial;
  private readonly visibility=new InstanceVisibility();

  constructor(scene:THREE.Scene,quality:Quality='high'){
    this.group.name='terrain.azure.mirrorfall-littoral-sediment';
    const sites=sampleShoreSediment(quality);
    this.rockMaterial=makeRockMaterial(quality);
    this.rockMaterial.vertexColors=true;
    this.mesh=new THREE.InstancedMesh(
      makeShoreStone(quality),this.rockMaterial,sites.length);
    this.mesh.name='terrain.azure.mirrorfall-waterworn-gravel';
    const dummy=new THREE.Object3D(),color=new THREE.Color();
    sites.forEach((site,i)=>{
      dummy.position.set(site.x,site.y-.08*site.size,site.z);
      dummy.rotation.set(0,site.yaw,0);
      dummy.scale.set(site.size,site.size*(.53+site.hue*.18),
        site.size*(.61+site.hue*.23));
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i,dummy.matrix);
      color.setHSL(.10+site.hue*.12,.07+site.hue*.09,.66+site.hue*.21);
      this.mesh.setColorAt(i,color);
    });
    this.mesh.receiveShadow=true;
    this.mesh.castShadow=quality==='high';
    this.visibility.register(this.mesh,sites,quality==='high'?330:250);
    this.mesh.count=0;
    this.group.add(this.mesh);
    scene.add(this.group);
  }
  update(x:number,z:number):void{this.visibility.update(x,z);}
  dispose():void{
    this.group.removeFromParent();
    this.mesh.geometry.dispose();
    this.rockMaterial.dispose();
  }
}
