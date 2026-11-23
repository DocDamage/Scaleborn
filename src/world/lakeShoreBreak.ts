import * as THREE from 'three';
import { GRAND_LAKE, lakeBoundaryScale } from './highlandLake';

/**
 * Deterministic, discontinuous freshwater shore-break ribbons. Previous
 * geometry followed the entire lake perimeter as one uniform white stripe.
 * The bank remains collision-stable: patches are inset from the exact same
 * radial shoreline used by the water fragment mask and terrain wetline.
 *
 * One indexed geometry/draw pass, no per-frame geometry allocations.
 * These are painterly surface swashes, not simulated wave breaking.
 */
export function makeLakeShoreBreakGeometry():THREE.BufferGeometry {
  const sectors=240, steps=6, rim=.981;
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  const patchSectors:number[]=[];
  const tau=2*Math.PI;
  const hash=(i:number,salt:number):number=>{
    const x=Math.sin((i+1)*17.731+salt*87.17)*43758.5453;
    return x-Math.floor(x);
  };

  for(let i=0;i<sectors;i++){
    // Gaps and asymmetric lengths prevent one continuous geometric annulus.
    if(hash(i,1)<.27)continue;
    const arcStart=(i+.05+.16*hash(i,2))*tau/sectors;
    const arcSpan=(.37+.51*hash(i,3))*tau/sectors;
    const width=.0032+.0095*hash(i,4);
    const phase=tau*hash(i,5);
    const start=positions.length/3;
    patchSectors.push(i);

    for(let j=0;j<=steps;j++){
      const t=j/steps;
      const theta=arcStart+t*arcSpan;
      const shape=lakeBoundaryScale(theta);
      const taper=.10+.90*Math.pow(Math.sin(Math.PI*t),.75);
      const ripple=.93+.07*Math.sin(t*8.2+phase);
      const outer=rim-.00035-.0007*hash(i,6);
      const inner=outer-width*taper*ripple;
      const ca=Math.cos(theta),sa=Math.sin(theta);
      for(const radial of [outer,inner]){
        positions.push(
          GRAND_LAKE.x+ca*GRAND_LAKE.radiusX*radial*shape,
          GRAND_LAKE.surfaceY+.14,
          GRAND_LAKE.z+sa*GRAND_LAKE.radiusZ*radial*shape,
        );
        // x is *local* patch progress, y is across the fading wash.
        uvs.push(t,radial===outer?0:1);
      }
    }
    for(let j=0;j<steps;j++){
      const a=start+j*2,b=a+2;
      indices.push(a,a+1,b,a+1,b+1,b);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.patchSectors=patchSectors;
  geometry.userData.sectorCount=sectors;
  geometry.userData.stepsPerPatch=steps;
  return geometry;
}
