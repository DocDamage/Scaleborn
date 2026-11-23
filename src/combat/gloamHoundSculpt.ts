import * as THREE from 'three';
import { makeOrganicLoft } from '../actors/dragon/organicLoft';
import { makeRiderContour } from '../actors/rider/contour';

/** Original Gloam hound anatomy, not stacked spherical debug volumes. */
export function makeGloamHoundBody(): THREE.BufferGeometry {
  return makeOrganicLoft([
    {z:-2.04,y:1.31,width:.095,height:.105},
    {z:-1.85,y:1.35,width:.21,height:.16},
    {z:-1.60,y:1.44,width:.34,height:.27},
    {z:-1.31,y:1.52,width:.42,height:.38},
    {z:-1.02,y:1.46,width:.51,height:.45},
    {z:-.60,y:1.37,width:.62,height:.55},
    {z:-.15,y:1.28,width:.66,height:.54},
    {z:.42,y:1.24,width:.63,height:.49},
    {z:.91,y:1.22,width:.56,height:.42},
    {z:1.23,y:1.16,width:.34,height:.30},
    {z:1.41,y:1.13,width:.075,height:.08},
  ],62,24);
}

/** Four separately pivoted legs stay animated by the existing enemy FSM. */
export function makeGloamHoundLeg(rear: boolean): THREE.BufferGeometry {
  return makeRiderContour([
    {y:-.90,x:0,z:rear?-.09:-.19,radiusX:.10,radiusZ:.12},
    {y:-.70,x:0,z:rear?.03:-.09,radiusX:.14,radiusZ:.15},
    {y:-.51,x:0,z:rear?.09:-.03,radiusX:.145,radiusZ:.155},
    {y:-.31,x:0,z:rear?.12:.015,radiusX:.19,radiusZ:.22},
    {y:-.01,x:0,z:0,radiusX:rear?.27:.23,radiusZ:.25},
  ],18,5);
}

export function makeGloamHoundPaw(): THREE.BufferGeometry {
  return makeOrganicLoft([
    {z:-.50,y:-.88,width:.045,height:.04},
    {z:-.37,y:-.90,width:.20,height:.10},
    {z:-.20,y:-.87,width:.26,height:.15},
    {z:.07,y:-.84,width:.20,height:.15},
    {z:.23,y:-.82,width:.07,height:.07},
  ],24,12);
}

/**
 * Deterministic normal detail for the shared hound pelt. A small original
 * weave of rippled fur direction breaks up plastic-smooth silhouettes.
 */
export function makeGloamPeltNormal(size=64): THREE.DataTexture {
  if(!Number.isInteger(size)||size<32||size>128)throw new Error('Invalid pelt normal size');
  const bytes=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const streak=Math.sin(x*.78+y*.31)*.14+Math.sin(x*2.31-y*.84)*.06;
    const offset=Math.cos(y*1.63+x*.26)*.13+Math.sin(y*.47-x*1.24)*.05;
    const nx=streak,ny=offset,nz=1/Math.hypot(streak,offset,1);
    const k=(y*size+x)*4;
    bytes[k]=Math.round(127.5*(1+nx*nz));
    bytes[k+1]=Math.round(127.5*(1+ny*nz));
    bytes[k+2]=Math.round(127.5*(1+nz));
    bytes[k+3]=255;
  }
  const tex=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
  tex.colorSpace=THREE.NoColorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.magFilter=THREE.LinearFilter;
  tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps=true;
  tex.needsUpdate=true;
  return tex;
}
