import * as THREE from 'three';
import { MIRRORFALL, GRAND_LAKE } from './highlandLake';
import { makeRockMaterial } from './materials';
import { fbm } from '../core/random';
import { AZURE_SEED } from './terrain';
import { makeCliffRunoffMaterial } from './cliffRunoff';

/**
 * Irregular eroded rock wall enclosing the cascading water.
 * It uses a continuous tessellated surface with carved gullies rather than
 * giant cubes, and an actual roughness/specularity response.
 */
export class MirrorfallCliffs {
  readonly group=new THREE.Group();
  private readonly material:THREE.MeshStandardMaterial;
  private readonly wall:THREE.Mesh;
  private readonly runoff:THREE.Mesh;
  private readonly runoffMaterial:THREE.ShaderMaterial;
  constructor(quality:'high'|'low'='high'){
    this.group.name='terrain.azure.mirrorfall-cliff';
    this.material=makeRockMaterial(quality);
    this.material.side=THREE.DoubleSide;
    this.material.vertexColors=true;
    const segmentZ=quality==='low'?76:160;
    const segmentY=quality==='low'?58:112;
    const positions:number[]=[];
    const colors:number[]=[];
    const uvs:number[]=[];
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
        uvs.push(col/segmentZ*12.0,t*6.0);
        // Rock albedo is geological rather than a flat grey slab. Broad
        // strata, mineral veins, and moss near the crest are baked into
        // vertex colors so the low renderer benefits as well.
        const striation=Math.sin(y*.19+u*24+noise*1.5)*.09;
        const mineral=Math.max(0,Math.min(1,.46+noise*.43+striation));
        const rock=new THREE.Color(0x54636c).lerp(
          new THREE.Color(0xb0aaa0),mineral*.77+.06);
        const crestMoss=Math.pow(t,4)*.28*
          Math.max(0,Math.min(1,noise+.42));
        rock.lerp(new THREE.Color(0x445a4b),crestMoss);
        colors.push(rock.r,rock.g,rock.b);
        if(row<segmentY&&col<segmentZ){
          // An open cleft must separate the cliff wings; opaque rock should
          // never obscure the center of the falling-water curtain.
          const nextU=(col+1)/segmentZ*2-1;
          if (u < -0.23 && nextU > -0.23 || u < 0.23 && nextU > 0.23 ||
            (u >= -0.23 && u <= 0.23)) continue;
          const a=row*(segmentZ+1)+col,b=a+segmentZ+1;
          indices.push(a,b,a+1,b,b+1,a+1);
        }
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    this.wall=new THREE.Mesh(geometry,this.material);
    this.wall.name='terrain.azure.mirrorfall-eroded-strata';
    this.wall.receiveShadow=true;
    this.wall.castShadow=quality==='high';
    this.group.add(this.wall);
    // Same indexed geometry; the wet shader offsets only its draw vertices.
    this.runoffMaterial=makeCliffRunoffMaterial();
    this.runoff=new THREE.Mesh(geometry,this.runoffMaterial);
    this.runoff.name='terrain.azure.mirrorfall-wet-runnels';
    this.runoff.renderOrder=1;
    this.group.add(this.runoff);

    // Cliff silhouette comes from the continuous triangulated rock face.
    // Never scatter detached white ovals as a substitute for exposed rock.
  }
  update(time:number):void{
    this.runoffMaterial.uniforms.uTime!.value=time;
  }
  dispose():void{
    this.wall.geometry.dispose();
    this.material.dispose();
    this.runoffMaterial.dispose();
    this.group.removeFromParent();
  }
}
