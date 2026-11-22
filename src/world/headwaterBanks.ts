import * as THREE from 'three';
import { rng } from '../core/random';
import { AZURE_SEED, heightAt } from './terrain';
import { GRAND_LAKE, MIRRORFALL, headwaterProfileAt } from './highlandLake';
import { makeShoreStone } from './shorelineSediment';
import { makeRockMaterial } from './materials';
import { InstanceVisibility } from './instanceVisibility';

type Quality='high'|'low';
export interface HeadwaterStone {
  x:number; y:number; z:number; size:number; tint:number;
}

/**
 * Small waterworn stones exposed along the upper creek banks. These are
 * decorative, not collidable rock pillars. All placements match the same
 * heightfield, water footprint and procedural seed as the playable stream.
 */
export function sampleHeadwaterStones(quality:Quality):HeadwaterStone[] {
  const r=rng(AZURE_SEED+37768);
  const count=quality==='high'?3300:1220;
  const sites:HeadwaterStone[]=[];
  for(let i=0;i<count;i++){
    const t=.035+r()*.91;
    const x=MIRRORFALL.x-1+132*t;
    const center=headwaterProfileAt(x,GRAND_LAKE.z);
    if(!center)continue;
    const side=r()<.5?-1:1;
    const spread=.88+r()*.64;
    const z=center.centerZ+side*center.halfWidth*spread;
    const p=headwaterProfileAt(x,z);
    if(!p)continue;
    const y=heightAt(x,z);
    // Gravel belongs on visible dry bank margins, not midstream or hovering
    // above the flow. Steep crest stone is left to larger cliff dressing.
    if(y < p.surfaceY-.06 || y>p.surfaceY+8)continue;
    const d=1.8;
    const slope=Math.hypot(
      heightAt(x+d,z)-heightAt(x-d,z),
      heightAt(x,z+d)-heightAt(x,z-d))/(d*2);
    if(slope>1.5)continue;
    const tint=r();
    sites.push({x,y,z,size:.21+r()*.74,tint});
  }
  return sites;
}

/** One existing stone archetype, one shared PBR material and one draw group. */
export class HeadwaterBanks {
  readonly group=new THREE.Group();
  readonly mesh:THREE.InstancedMesh;
  private readonly material:THREE.MeshStandardMaterial;
  private readonly visibility=new InstanceVisibility();

  constructor(scene:THREE.Scene,quality:Quality='high'){
    this.group.name='terrain.azure.mirrorfall-headwater-banks';
    const sites=sampleHeadwaterStones(quality);
    this.material=makeRockMaterial(quality);
    this.material.vertexColors=true;
    const geo=makeShoreStone(quality);
    this.mesh=new THREE.InstancedMesh(geo,this.material,sites.length);
    this.mesh.name='terrain.azure.mirrorfall-headwater-bank-stones';
    const dummy=new THREE.Object3D(),color=new THREE.Color();
    sites.forEach((site,i)=>{
      dummy.position.set(site.x,site.y-site.size*.07,site.z);
      dummy.rotation.set(0,site.tint*Math.PI*2,0);
      dummy.scale.set(site.size,site.size*(.55+.3*site.tint),
        site.size*(.69+.22*site.tint));
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i,dummy.matrix);
      color.setHSL(.09+site.tint*.11,.07+.10*site.tint,.67+.21*site.tint);
      this.mesh.setColorAt(i,color);
    });
    this.mesh.receiveShadow=quality==='high';
    this.visibility.register(this.mesh,sites,quality==='high'?340:250);
    this.mesh.count=0;
    this.group.add(this.mesh);
    scene.add(this.group);
  }

  update(x:number,z:number):void {
    this.visibility.update(x,z);
  }

  dispose():void{
    this.group.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
