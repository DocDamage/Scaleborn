/** Smooth, symmetric relief sculpted into the original girl's continuous
 * child-proportioned face. Signed depth is along the local Z axis:
 * positive recesses the orbit, negative raises the brow/cheek.
 * No separate mask spheres, rig transforms, or frame allocations.
 */
const bell=(value:number,center:number,width:number):number=>{
  const d=(value-center)/width;
  return Math.exp(-2*d*d);
};

/** nx/ny are the horizontal/radial loft normals at the face cross-section. */
export function riderFaceRelief(y:number,nx:number,ny:number):number {
  if(![y,nx,ny].every(Number.isFinite)){
    throw new Error('Rider facial sculpt requires finite coordinates');
  }
  const front=Math.max(0,-ny);
  if(front===0)return 0;
  const side=Math.abs(nx);
  const orbit=bell(y,1.302,.042)*bell(side,.50,.26);
  const brow=bell(y,1.359,.035)*bell(side,.53,.28);
  const bridge=bell(y,1.320,.085)*bell(side,.02,.18);
  const cheek=bell(y,1.272,.044)*bell(side,.58,.30);
  const jaw=bell(y,1.230,.039)*bell(side,.55,.35);
  return front*(.008*orbit-.0085*brow-.009*bridge
    -.010*cheek+.003*jaw);
}
