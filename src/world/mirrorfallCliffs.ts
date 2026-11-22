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
        const x=MIRRORFALL.x+49 + t*38
          + ridge*0.73+noise*10+stratum;
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

    // Disjoint ledges are rounded, differently scaled stone lenses, not blocks.
    // They add a torn cliff silhouette and places where spray wets the wall.
    const stone=new THREE.IcosahedronGeometry(1,2);
    const ledges=new THREE.InstancedMesh(stone,this.material,62);
    const proxy=new THREE.Object3D();
    for(let i=0;i<62;i++){
      const z=middle+Math.sin(i*2.39996)*202;
      const y=GRAND_LAKE.surfaceY+14+(i%9)*12.4;
      const x=MIRRORFALL.x+49+(y-GRAND_LAKE.surfaceY)*.33
        +Math.sin(i*3.87)*11;
      proxy.position.set(x,y,z);
      proxy.rotation.set(i*.22,i*.75,i*.1);
      proxy.scale.set(4.5+(i%4)*2.3,1.7+(i%3)*1.8,7.4+(i%5)*2.3);
      proxy.updateMatrix();
      ledges.setMatrixAt(i,proxy.matrix);
    }
    ledges.name='terrain.azure.mirrorfall-rounded-ledges';
    this.group.add(ledges);
  }
  dispose():void{
    this.group.traverse(node=>{
      if(node instanceof THREE.Mesh)node.geometry.dispose();
    });
    this.material.dispose();
    this.group.removeFromParent();
  }
}
