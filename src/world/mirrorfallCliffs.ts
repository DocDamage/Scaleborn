import * as THREE from 'three';
import { MIRRORFALL, GRAND_LAKE } from './highlandLake';
import { makeRockMaterial } from './materials';
import { fbm } from '../core/random';
import { AZURE_SEED } from './terrain';

/**
 * Irregular eroded rock wall enclosing the cascading water.
 * It uses a continuous tessellated surface with carved gullies rather than
 * giant cubes, and an actual roughness/specularity response.
 */
export class MirrorfallCliffs {
  readonly group=new THREE.Group();
  private readonly material:THREE.MeshStandardMaterial;
  private readonly wall:THREE.Mesh;
  constructor(quality:'high'|'low'='high'){
    this.group.name='terrain.azure.mirrorfall-cliff';
    this.material=makeRockMaterial(quality);
    this.material.side=THREE.DoubleSide;
    const segmentZ=quality==='low'?52:100;
    const segmentY=quality==='low'?35:66;
    const positions:number[]=[];
    const indices:number[]=[];
    const middle=GRAND_LAKE.z;
    for(let row=0;row<=segmentY;row++){
      const t=row/segmentY;
      for(let col=0;col<=segmentZ;col++){
        const u=col/segmentZ*2-1;
        const z=middle + u*211;
        const noise=fbm(u*4.2+t*.6,u*2.4+t*3.2,AZURE_SEED+781,4);
        const top=MIRRORFALL.topY+12
          -Math.pow(Math.abs(u),1.25)*38
          +fbm(u*3.8,0,AZURE_SEED+379,3)*13;
        const y=GRAND_LAKE.surfaceY-1+(top-(GRAND_LAKE.surfaceY-1))*t;
        const stratum=2.3*Math.sin(t*76+u*14)*Math.sin(u*22+t*5);
        const ridge=8*Math.sin(u*10.5+noise*2.4)+5*Math.sin(u*24.6+t*6.3);
        // The face follows the actual falling sheet a few meters behind it.
        // This keeps rock visible alongside water instead of hiding it
        // behind the preexisting raised terrain.
        const waterfallX=MIRRORFALL.x-82 + 81*t;
        const x=waterfallX+7 + ridge*0.20+noise*3.4+stratum*.23;
        positions.push(x,y,z);
        if(row<segmentY&&col<segmentZ){
          const a=row*(segmentZ+1)+col,b=a+segmentZ+1;
          indices.push(a,b,a+1,b,b+1,a+1);
        }
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    this.wall=new THREE.Mesh(geometry,this.material);
    this.wall.name='terrain.azure.mirrorfall-eroded-strata';
    this.wall.receiveShadow=true;
    this.wall.castShadow=quality==='high';
    this.group.add(this.wall);

    // Cliff silhouette comes from the continuous triangulated rock face.
    // Never scatter detached white ovals as a substitute for exposed rock.
  }
  dispose():void{
    this.group.traverse(node=>{
      if(node instanceof THREE.Mesh)node.geometry.dispose();
    });
    this.material.dispose();
    this.group.removeFromParent();
  }
}
