import * as THREE from 'three';

export interface VisibilitySite { x: number; z: number }

interface InstanceBatch {
  mesh: THREE.InstancedMesh;
  sites: readonly VisibilitySite[];
  matrices: Float32Array;
  colors: Float32Array | null;
  distanceSquared: number;
}

/**
 * Bounded CPU-side instance visibility. Unlike one world-sized InstancedMesh
 * per tree type, the renderer only receives transforms for nearby specimens.
 * The source matrices/colours are immutable copies; returning to a location
 * reproduces the same instance order without seeded-population regeneration.
 *
 * One draw per material/shape batch, no scene-graph prop spam or GPU readback.
 * Quality/fog-dependent fade is a separate visual acceptance concern.
 */
export class InstanceVisibility {
  private readonly batches: InstanceBatch[]=[];
  private cellX=Number.NaN;
  private cellZ=Number.NaN;

  register(mesh:THREE.InstancedMesh,sites:readonly VisibilitySite[],distance:number):void {
    if(mesh.count!==sites.length||!Number.isFinite(distance)||distance<=0){
      throw new Error('Invalid instanced vegetation visibility batch');
    }
    this.batches.push({
      mesh,sites,matrices:new Float32Array(mesh.instanceMatrix.array),
      colors:mesh.instanceColor
        ? new Float32Array(mesh.instanceColor.array) : null,
      distanceSquared:distance*distance,
    });
    // The original bounding sphere describes every tree in the 4km world.
    // Our camera-distance filter replaces that mesh-level culling decision.
    mesh.frustumCulled=false;
  }

  update(x:number,z:number):void {
    if(!Number.isFinite(x)||!Number.isFinite(z))return;
    const cx=Math.floor(x/48),cz=Math.floor(z/48);
    if(cx===this.cellX&&cz===this.cellZ)return;
    this.cellX=cx;this.cellZ=cz;

    for(const batch of this.batches){
      const dst=batch.mesh.instanceMatrix.array as Float32Array;
      const dstColors=batch.mesh.instanceColor?.array as Float32Array | undefined;
      let count=0;
      for(let i=0;i<batch.sites.length;i++){
        const site=batch.sites[i]!;
        const dx=site.x-x,dz=site.z-z;
        if(dx*dx+dz*dz>batch.distanceSquared)continue;
        const from=i*16,to=count*16;
        dst.set(batch.matrices.subarray(from,from+16),to);
        if(dstColors&&batch.colors){
          const colorFrom=i*3,colorTo=count*3;
          dstColors.set(batch.colors.subarray(colorFrom,colorFrom+3),colorTo);
        }
        count++;
      }
      batch.mesh.count=count;
      batch.mesh.instanceMatrix.needsUpdate=true;
      if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;
    }
  }
}
