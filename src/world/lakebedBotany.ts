import * as THREE from 'three';

type Quality='high'|'low';

/**
 * Freshwater vegetation with curved tapering stems and paired, individually
 * shaped lanceolate leaves. All plants of a quality share one indexed mesh.
 * The leaflets are actual geometry, not crossed rectangles or opaque cards.
 */
export function aquaticTuft(quality:Quality='high'):THREE.BufferGeometry {
  const blades=quality==='high'?9:6;
  const steps=quality==='high'?10:6;
  const leafRows=quality==='high'?5:3;
  const leafPairs=quality==='high'?3:2;
  const positions:number[]=[];
  const colors:number[]=[];
  const uvs:number[]=[];
  const indices:number[]=[];

  const add=(x:number,y:number,z:number,u:number,v:number,
    pigment:number):number=>{
    const id=positions.length/3;
    positions.push(x,y,z);
    // Root tissue is olive; thinner illuminated tips are cool green.
    colors.push(.73+.18*pigment,.78+.21*pigment,.63+.26*pigment);
    uvs.push(u,v);
    return id;
  };
  const connect=(a:number,b:number,c:number,d:number):void=>{
    indices.push(a,b,c,b,d,c);
  };

  for(let k=0;k<blades;k++){
    const angle=(k+.13*(k%3))*2*Math.PI/blades;
    const forwardX=Math.cos(angle),forwardZ=Math.sin(angle);
    const sideX=-forwardZ,sideZ=forwardX;
    const length=1.28+(k%4)*.30;
    const stem=(t:number):[number,number,number]=>{
      const lean=.34*t*t;
      const sway=.075*Math.sin(t*3.7+k*.91)*t;
      return [
        forwardX*lean+sideX*sway,
        length*t,
        forwardZ*lean+sideZ*sway,
      ];
    };

    let previousLeft=-1,previousRight=-1;
    for(let j=0;j<=steps;j++){
      const t=j/steps;
      const center=stem(t);
      const width=.009+.105*Math.pow(1-t,1.15);
      const left=add(center[0]-sideX*width,center[1],
        center[2]-sideZ*width,t,0,t*.70);
      const right=add(center[0]+sideX*width,center[1],
        center[2]+sideZ*width,t,1,t*.70);
      if(j>0)connect(previousLeft,previousRight,left,right);
      previousLeft=left;previousRight=right;
    }

    // Leaves emerge in staggered whorls. A convex, curved midrib plus
    // varying width produces broad almond silhouettes from oblique angles.
    for(let leaf=0;leaf<leafPairs;leaf++){
      const anchorT=.28+leaf*.20;
      for(const sign of [-1,1]){
        const base=stem(anchorT);
        const span=.34+.07*((k+leaf)%3);
        const width=.12+.018*((k+2*leaf)%3);
        let prevL=-1,prevR=-1;
        for(let j=0;j<=leafRows;j++){
          const t=j/leafRows;
          const lateral=span*t;
          const crown=length*(.065*t+.068*Math.sin(Math.PI*t));
          const sweep=.10*t*t;
          const cx=base[0]+sign*sideX*lateral+forwardX*sweep;
          const cy=base[1]+crown;
          const cz=base[2]+sign*sideZ*lateral+forwardZ*sweep;
          // Rounded pointed blade, never a quad with square corners.
          const halfWidth=.005+width*Math.pow(Math.sin(Math.PI*t),.82);
          const twist=(t-.5)*.16*sign;
          const l=add(cx-forwardX*halfWidth,cy-twist*halfWidth,
            cz-forwardZ*halfWidth,t,0,.26+t*.72);
          const r=add(cx+forwardX*halfWidth,cy+twist*halfWidth,
            cz+forwardZ*halfWidth,t,1,.26+t*.72);
          if(j>0)connect(prevL,prevR,l,r);
          prevL=l;prevR=r;
        }
      }
    }
  }

  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
