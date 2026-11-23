import * as THREE from 'three';

/**
 * Small muscle-compression shape keys for Onyx's actual continuous foreleg
 * and hindleg lofts. The actor's four existing hip/ankle transforms still
 * determine the gait and world contact. This only gives the knee/hock flesh
 * a living bend rather than rotating a stiff straight limb as one bar.
 */
export const ONYX_LEG_FLEX_MORPHS=['forward-compression','back-compression'] as const;
const clamp01=(v:number):number=>Math.max(0,Math.min(1,v));
const smooth=(a:number,b:number,v:number):number=>{
  const t=clamp01((v-a)/(b-a));return t*t*(3-2*t);
};

export function installOnyxLegFlexMorph(flesh:THREE.Mesh):void {
  const geo=flesh.geometry;
  const p=geo.getAttribute('position');
  if(!p||!geo.index||geo.morphAttributes.position?.length){
    throw new Error('Leg compression requires an unmorphed indexed leg loft');
  }
  const forwards=new Float32Array(p.count*3);
  const backwards=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    // Soft muscle volume at the hock. The loft's root and ankle endpoints
    // remain unchanged, preventing a moving gap at the body and paw.
    const knee=Math.exp(-2*Math.pow((y+.36)/.23,2));
    const ends=smooth(-.67,-.48,y)*(1-smooth(.03,.30,y));
    const flex=knee*ends;
    const displacement=.047*flex;
    const fold=.014*flex*Math.sign(x)*Math.sqrt(Math.abs(x));
    const o=i*3;
    forwards[o]=x+fold;forwards[o+1]=y+.007*flex;
    forwards[o+2]=z-displacement;
    backwards[o]=x-fold;backwards[o+1]=y-.005*flex;
    backwards[o+2]=z+displacement;
  }
  const arrays=[forwards,backwards];
  geo.morphAttributes.position=arrays.map(a=>
    new THREE.Float32BufferAttribute(a,3));
  geo.morphAttributes.normal=arrays.map(a=>{
    const g=new THREE.BufferGeometry();
    g.setIndex(geo.index!.clone());
    g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));
    g.computeVertexNormals();
    const n=(g.getAttribute('normal') as THREE.BufferAttribute).clone();
    g.dispose();
    return n;
  });
  geo.morphTargetsRelative=false;
  flesh.updateMorphTargets();
  for(let i=0;i<ONYX_LEG_FLEX_MORPHS.length;i++){
    flesh.morphTargetDictionary![ONYX_LEG_FLEX_MORPHS[i]!]=i;
  }
  geo.computeBoundingSphere();
  if(geo.boundingSphere)geo.boundingSphere.radius+=.06;
}

/** Changes shape only, never the flight, collision or foot-placement state. */
export function poseOnyxLegFlex(flesh:THREE.Mesh,effort:number):void {
  const influence=flesh.morphTargetInfluences;
  if(!influence||influence.length<2)return;
  const safe=Number.isFinite(effort)?Math.max(-1,Math.min(1,effort)):0;
  influence[0]=Math.max(0,safe)*.75;
  influence[1]=Math.max(0,-safe)*.75;
}
