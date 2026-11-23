import * as THREE from 'three';
import { GRAND_LAKE, MIRRORFALL } from './highlandLake';
import { waterfallCenterXAt } from './waterfallTrajectory';

type Quality='high'|'low';

/**
 * Narrow, irregular vertical ropes through the waterfall's whole depth.
 * Two crossed, tapered sheets per rope give the cascade actual layered
 * volume instead of one continuous rectangular translucent wall.
 * All filaments are merged into ONE indexed geometry and ONE draw call.
 */
export function createCascadeFilaments(quality:Quality='high'):THREE.BufferGeometry {
  const ropes=quality==='high'?26:14;
  const steps=quality==='high'?112:70;
  const drop=MIRRORFALL.topY-GRAND_LAKE.surfaceY;
  const points:number[]=[],uvs:number[]=[],indices:number[]=[];
  const push=(x:number,y:number,z:number,u:number,v:number):void=>{
    points.push(x,y,z);
    uvs.push(u,v);
  };
  for(let strand=0;strand<ropes;strand++){
    const relative=(strand+.5)/ropes-.5;
    const phase=strand*2.399963229728653;
    const thickness=.42+.26*Math.sin(phase)*Math.sin(phase)+strand%4*.11;
    const zStart=GRAND_LAKE.z+relative*MIRRORFALL.width*.86;
    for(let cross=0;cross<2;cross++){
      const start=points.length/3;
      for(let row=0;row<=steps;row++){
        const t=row/steps;
        // Smooth ballistic trajectory is shared with the broad curtain.
        // The former unused down variable is intentionally omitted.
        const shift=Math.sin(t*18+phase)*(.18+t*.90);
        const x=waterfallCenterXAt(t)
          +Math.sin(t*9+phase)*(.15+t*.58);
        const y=MIRRORFALL.topY-drop*t;
        const z=zStart + relative*MIRRORFALL.width*t*.16
          +shift+Math.sin(t*27+phase*1.4)*t*.23;
        const width=thickness*(.82+t*.83)
          *(.88+.12*Math.sin(t*21+phase));
        for(let edge=0;edge<2;edge++){
          const sign=edge===0?-1:1;
          const ox=cross===1?sign*width*.58:0;
          const oz=cross===0?sign*width:.0;
          push(x+ox,y,z+oz,
            (strand+.5)/ropes+(edge-.5)*.019,
            t);
        }
        if(row<steps){
          const i=start+row*2,n=i+2;
          indices.push(i,n,i+1,n,n+1,i+1);
        }
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
