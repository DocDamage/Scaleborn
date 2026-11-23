import * as THREE from 'three';

/**
 * Low-draw-call boulder prototype: sediment bedding, directional fracture,
 * and eroded shoulders are sculpted into one indexed mesh. The reusable
 * geometry receives the same rock PBR maps as Mirrorfall's cliff wall.
 *
 * No per-instance geometry or textures are created; High has extra silhouette
 * resolution while Low retains the same stratigraphy and closed topology.
 */
export function createStratifiedRockGeometry(
  quality: 'high' | 'low' = 'high',
): THREE.BufferGeometry {
  const radial=quality==='high'?40:26;
  const latitudes=quality==='high'?24:16;
  const positions:number[]=[];
  const colors:number[]=[];
  const uvs:number[]=[];
  const indices:number[]=[];
  const sandstone=new THREE.Color(0xbab19f);
  const slate=new THREE.Color(0x697c81);
  const top=new THREE.Color(0xa3a99a);

  function sample(y:number,theta:number,radius:number):void {
    const bedPhase=y*21.4+Math.sin(theta*3.0)*.34;
    const seam=Math.pow(Math.max(0,Math.cos(bedPhase)),12);
    const warm=.43+.24*Math.sin(y*6.7+Math.sin(theta*2)*.5)
      +.18*Math.sin(theta*4.0+y*4.1);
    const color=slate.clone().lerp(sandstone,
      THREE.MathUtils.clamp(warm,0,1));
    const weather=.89+.09*Math.sin(theta*7.1+y*8.6)
      -.20*seam+.06*Math.sin(y*28.3);
    color.multiplyScalar(weather);
    color.lerp(top,Math.max(0,y-.48)*.12);
    colors.push(color.r,color.g,color.b);
    // The top and bottom poles share the same position as real triangles;
    // latitude rings use duplicated seam vertices for continuous rock maps.
    positions.push(
      Math.cos(theta)*radius,
      y,
      Math.sin(theta)*radius*.90,
    );
  }

  // Two single vertices seal the poles; ring construction avoids degenerate
  // zero-area pole triangles and keeps all computed normals finite.
  const topIndex=0;
  sample(1.0,0,0);uvs.push(.5,1);
  for(let ring=1;ring<latitudes;ring++){
    const v=ring/latitudes;
    const phi=v*Math.PI;
    const height=Math.cos(phi);
    const circumference=Math.sin(phi);
    for(let j=0;j<=radial;j++){
      const theta=j/radial*Math.PI*2;
      const seam=.033*Math.sin(height*19.6+theta*3.0);
      const fracture=.088*Math.sin(theta*3.0+height*.68)
        +.048*Math.sin(theta*7.0-height*2.1)
        +.036*Math.cos(theta*11.0+height*8.0);
      const strata=.049*Math.sin(height*24.0+
        .40*Math.sin(theta*4.0));
      const r=circumference*(1.0+fracture+strata+seam);
      const y=height*(.92+.07*Math.cos(theta*2.0))
        +circumference*.034*Math.sin(theta*5.0+height*9.0);
      sample(y,theta,r);
      uvs.push(j/radial,1-v);
    }
  }
  const bottomIndex=positions.length/3;
  sample(-.97,0,0);uvs.push(.5,0);
  const firstRing=1;
  for(let j=0;j<radial;j++){
    indices.push(topIndex,firstRing+j+1,firstRing+j);
  }
  for(let ring=0;ring<latitudes-2;ring++){
    const row=firstRing+ring*(radial+1);
    const next=row+radial+1;
    for(let j=0;j<radial;j++){
      const a=row+j,b=next+j;
      indices.push(a,a+1,b,a+1,b+1,b);
    }
  }
  const lastRing=firstRing+(latitudes-2)*(radial+1);
  for(let j=0;j<radial;j++)
    indices.push(bottomIndex,lastRing+j,lastRing+j+1);

  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Merge the UV meridian's shading normals so a vertical highlight seam
  // does not remain visible when an instance is rotated toward the camera.
  const normals=geometry.getAttribute('normal') as THREE.BufferAttribute;
  for(let ring=0;ring<latitudes-1;ring++){
    const a=firstRing+ring*(radial+1),b=a+radial;
    const n=new THREE.Vector3(
      normals.getX(a)+normals.getX(b),
      normals.getY(a)+normals.getY(b),
      normals.getZ(a)+normals.getZ(b),
    ).normalize();
    normals.setXYZ(a,n.x,n.y,n.z);
    normals.setXYZ(b,n.x,n.y,n.z);
  }
  normals.needsUpdate=true;
  geometry.computeBoundingSphere();
  return geometry;
}
