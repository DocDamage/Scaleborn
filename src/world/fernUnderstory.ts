import * as THREE from 'three';

/**
 * One merged fern clump with curved fronds and individual tapered leaflets.
 * Instancing this real geometry is much cheaper than placing many decorative
 * fern objects. Leaves have actual 3D thickness from double-sided lighting.
 */
export function makeFernTuft(quality: 'high' | 'low' = 'high'): THREE.BufferGeometry {
  const positions: number[]=[];
  const fronds=quality==='high'?9:7;
  const leafletPairs=quality==='high'?10:7;
  const emit=(x:number,y:number,z:number):void=>{positions.push(x,y,z);};
  for(let frond=0;frond<fronds;frond++){
    const angle=frond/fronds*Math.PI*2;
    const reach=.7+.12*Math.sin(frond*4.27);
    const spread=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
    const side=new THREE.Vector3(-Math.sin(angle),0,Math.cos(angle));
    const center=(t:number):THREE.Vector3=>new THREE.Vector3(
      spread.x*reach*t,
      .13+1.22*Math.sin(t*Math.PI*.76) + .10*Math.sin(t*3+frond),
      spread.z*reach*t,
    );
    for(let i=0;i<leafletPairs;i++) {
      const t=(i+1)/(leafletPairs+1),p=center(t);
      const before=center(Math.max(0,t-.045)),after=center(Math.min(1,t+.065));
      const length=(.30+.20*Math.sin(t*Math.PI))*(1-.40*t);
      const bladeWidth=.10+.06*Math.sin(t*Math.PI);
      for(const sign of [-1,1]) {
        const tip=p.clone().addScaledVector(side,sign*length)
          .addScaledVector(spread,.08);
        tip.y+=.05;
        const left=before.clone().addScaledVector(side,sign*bladeWidth);
        const right=after.clone().addScaledVector(side,-sign*bladeWidth);
        emit(p.x,p.y,p.z);
        emit(left.x,left.y,left.z);
        emit(tip.x,tip.y,tip.z);
        emit(p.x,p.y,p.z);
        emit(tip.x,tip.y,tip.z);
        emit(right.x,right.y,right.z);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  return geometry;
}
