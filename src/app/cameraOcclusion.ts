import * as THREE from 'three';

export interface CameraBlocker {
  x:number; z:number; radius:number; top:number;
}

/**
 * Conservative line-of-sight clamp. The camera is pulled inward whenever its
 * segment to the tracked character intersects terrain or simple structure
 * proxies. It is deliberately not mesh-triangle raycasting; collision data
 * is the same stable, renderer-independent geography as gameplay.
 */
export function resolveCameraOcclusion(
  focus:THREE.Vector3,
  desired:THREE.Vector3,
  terrain:(x:number,z:number)=>number,
  blockers:readonly CameraBlocker[],
  clearance=1.15,
):THREE.Vector3 {
  const valid=(v:THREE.Vector3):boolean=>
    [v.x,v.y,v.z].every(Number.isFinite);
  if(!valid(focus)||!valid(desired)||!Number.isFinite(clearance)){
    return desired.clone();
  }
  const delta=desired.clone().sub(focus);
  const distance=delta.length();
  if(distance<.01)return desired.clone();

  const blocked=(t:number):boolean=>{
    const x=focus.x+delta.x*t;
    const z=focus.z+delta.z*t;
    const y=focus.y+delta.y*t;
    if(y<terrain(x,z)+clearance)return true;
    for(const o of blockers){
      const dx=x-o.x,dz=z-o.z;
      const r=o.radius+.65;
      if(dx*dx+dz*dz<r*r && y<o.top+.65)return true;
    }
    return false;
  };

  // The actor origin is expected to be outside terrain. If that contract
  // fails, return a terrain-cleared near-camera position, not NaNs.
  if(blocked(0)){
    return new THREE.Vector3(focus.x,
      Math.max(focus.y,terrain(focus.x,focus.z)+clearance),focus.z);
  }
  const samples=Math.min(30,Math.max(8,Math.ceil(distance/2.5)));
  let safe=0;
  for(let i=1;i<=samples;i++){
    const t=i/samples;
    if(!blocked(t)){safe=t;continue;}
    let lo=safe,hi=t;
    for(let j=0;j<5;j++){
      const mid=(lo+hi)*.5;
      if(blocked(mid))hi=mid; else lo=mid;
    }
    // Leave a little room for the camera near plane and terrain motion.
    const allowed=Math.max(0,lo-.25/distance);
    const result=focus.clone().addScaledVector(delta,allowed);
    result.y=Math.max(result.y,terrain(result.x,result.z)+clearance);
    return result;
  }
  return desired.clone();
}
