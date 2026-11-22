import * as THREE from 'three';
import { rng } from '../core/random';
import { GRAND_LAKE, MIRRORFALL, waterSurfaceAt } from './highlandLake';
import { AZURE_SEED, heightAt } from './terrain';
import { makeRockMaterial } from './materials';

export type CliffDetailQuality = 'high'|'low';

export interface CliffOutcropSite {
  x:number; y:number; z:number; size:number; aspect:number; yaw:number;
}

/**
 * Broken sedimentary ledges with visibly fractured, tiered outlines.
 * Geometry stays closed and reuses one instanced rock material, with no
 * detached sphere props or source assets.
 */
export function fracturedLedgeGeometry(quality:CliffDetailQuality):THREE.BufferGeometry {
  const sides=quality==='high'?22:14;
  const rings=[
    {y:-.58,r:.67}, {y:-.28,r:1.09}, {y:-.02,r:1.16},
    {y:.14,r:.94}, {y:.33,r:.74}, {y:.43,r:.39},
  ];
  const positions:number[]=[],uvs:number[]=[],colors:number[]=[],triangles:number[]=[];
  const lighter=new THREE.Color(0xb0ae9c),darker=new THREE.Color(0x53656b);
  for(let ring=0;ring<rings.length;ring++) {
    const level=rings[ring]!;
    for(let j=0;j<=sides;j++) {
      const a=j/sides*Math.PI*2;
      const fracture=.09*Math.sin(a*5+ring*.36)
        +.044*Math.sin(a*11-ring*.78)
        +.025*Math.cos(a*17+ring*.31);
      const edge=level.r*(1+fracture);
      const x=Math.cos(a)*edge;
      const z=Math.sin(a)*edge*.62;
      const bedding=.035*Math.sin(a*7+ring*2.1);
      positions.push(x,level.y+bedding,z);
      uvs.push(j/sides,ring/(rings.length-1));
      const mineral=.36+.18*Math.sin(level.y*14.1+a*.8)
        +.12*Math.cos(a*4+ring*.7);
      const color=darker.clone().lerp(lighter,Math.max(0,Math.min(1,mineral)));
      if(ring===2||ring===3)color.multiplyScalar(.93);
      colors.push(color.r,color.g,color.b);
      if(ring<rings.length-1&&j<sides) {
        const i=ring*(sides+1)+j,n=i+sides+1;
        triangles.push(i,n,i+1,n,n+1,i+1);
      }
    }
  }
  const cap=(top:boolean):void=>{
    const i=positions.length/3;
    const ring=top?rings.length-1:0;
    positions.push(0,rings[ring]!.y,0);
    uvs.push(.5,top?1:0);
    const c=top?lighter:darker;
    colors.push(c.r,c.g,c.b);
    const row=ring*(sides+1);
    for(let j=0;j<sides;j++){
      if(top)triangles.push(i,row+j,row+j+1);
      else triangles.push(i,row+j+1,row+j);
    }
  };
  cap(false);cap(true);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Concentrate physically embedded sedimentary rock where Mirrorfall's east
 * escarpment is steep. Root positions use the authoritative heightfield and
 * exclude the waterfall's open center and dry gentle viewing meadows.
 */
export function sampleCliffOutcrops(quality:CliffDetailQuality):CliffOutcropSite[] {
  const rand=rng(AZURE_SEED+53488);
  const sites:CliffOutcropSite[]=[];
  const tries=quality==='high'?9400:3700;
  for(let i=0;i<tries;i++){
    const x=GRAND_LAKE.x+GRAND_LAKE.radiusX*(.83+rand()*.68);
    const z=GRAND_LAKE.z+(rand()-.5)*525;
    const y=heightAt(x,z);
    if(y<GRAND_LAKE.surfaceY+8||y>218)continue;
    if(y<waterSurfaceAt(x,z)+7)continue;
    // Keep the actual falling sheet and plume gap open.
    if(Math.abs(z-MIRRORFALL.z)<MIRRORFALL.width*.58+9
      && x>MIRRORFALL.x-118 && x<MIRRORFALL.x+58)continue;
    const h=3.2;
    const slopeX=(heightAt(x+h,z)-heightAt(x-h,z))/(2*h);
    const slopeZ=(heightAt(x,z+h)-heightAt(x,z-h))/(2*h);
    const slope=Math.hypot(slopeX,slopeZ);
    if(slope<.57 || slope>11)continue;
    if(rand()>(quality==='high'?.53:.39))continue;
    const size=1.65+rand()*4.1+Math.min(3.2,slope*.42);
    sites.push({
      x,y,z,size,aspect:.62+rand()*.66,
      yaw:rand()*Math.PI*2,
    });
  }
  return sites;
}

export class CliffOutcrops {
  readonly group=new THREE.Group();
  readonly mesh:THREE.InstancedMesh;
  private readonly material:THREE.MeshStandardMaterial;

  constructor(scene:THREE.Scene,quality:CliffDetailQuality='high'){
    this.group.name='terrain.azure.mirrorfall-fractured-outcrops';
    const sites=sampleCliffOutcrops(quality);
    this.material=makeRockMaterial(quality);
    this.material.vertexColors=true;
    const geometry=fracturedLedgeGeometry(quality);
    this.mesh=new THREE.InstancedMesh(geometry,this.material,sites.length);
    this.mesh.name='terrain.azure.mirrorfall-embedded-strata';
    const normal=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
    const dummy=new THREE.Object3D();
    const color=new THREE.Color();
    const h=3.2;
    const rand=rng(AZURE_SEED+44716);
    sites.forEach((site,i)=>{
      const dx=(heightAt(site.x+h,site.z)-heightAt(site.x-h,site.z))/(2*h);
      const dz=(heightAt(site.x,site.z+h)-heightAt(site.x,site.z-h))/(2*h);
      normal.set(-dx,1,-dz).normalize();
      dummy.position.set(site.x,site.y-normal.y*site.size*.24,site.z);
      dummy.quaternion.setFromUnitVectors(up,normal);
      dummy.rotateY(site.yaw);
      dummy.scale.set(site.size,site.size*(.61+rand()*.40),site.size*site.aspect);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i,dummy.matrix);
      color.setHSL(.12+rand()*.085,.08+rand()*.10,.68+rand()*.20);
      this.mesh.setColorAt(i,color);
    });
    this.mesh.castShadow=quality==='high';
    this.mesh.receiveShadow=true;
    this.mesh.frustumCulled=false;
    this.group.add(this.mesh);
    scene.add(this.group);
  }

  dispose():void{
    this.group.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
