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
  private viewSector=-2;
  private viewConeBucket=Number.NaN;
  private cameraCellX=Number.NaN;
  private cameraCellZ=Number.NaN;
  private readonly cameraForward=new THREE.Vector3();

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

  /**
   * Cull distant instances behind the actual rendering camera. The actor's
   * distance remains the streaming bound, while a broad horizontal view cone
   * eliminates invisible leaf-card overdraw. For perspective cameras, the
   * horizontal FOV plus a 25-degree margin sets a conservative view cone.
   * Keep all trees within 90 m to
   * prevent near-camera popping; near-overhead views keep 360-degree cover.
   *
   * Repack on a 48m actor cell or a changed 15-degree camera sector/32m camera
   * cell or a changed FOV bucket, not every frame. No-camera callers retain
   * their previous results.
   */
  update(x:number,z:number,camera?:THREE.Camera):void {
    if(!Number.isFinite(x)||!Number.isFinite(z))return;
    let viewX=0,viewZ=0,fx=0,fz=0,hasDirection=false;
    // Bound off-screen foliage to the actual horizontal FOV, with a generous
    // 25-degree margin for large canopies and camera interpolation.
    let viewCos=-.25;
    if(camera){
      camera.getWorldDirection(this.cameraForward);
      const length=Math.hypot(this.cameraForward.x,this.cameraForward.z);
      if(length>.25){
        hasDirection=true;
        fx=this.cameraForward.x/length;
        fz=this.cameraForward.z/length;
        viewX=camera.position.x;viewZ=camera.position.z;
        if(camera instanceof THREE.PerspectiveCamera
          && Number.isFinite(camera.aspect) && camera.aspect>0){
          const halfVertical=THREE.MathUtils.degToRad(camera.getEffectiveFOV())*.5;
          const halfHorizontal=Math.atan(Math.tan(halfVertical)*camera.aspect);
          viewCos=Math.cos(Math.min(Math.PI,
            halfHorizontal+THREE.MathUtils.degToRad(25)));
        }
      }
    }
    const sector=hasDirection
      ? Math.floor((Math.atan2(fz,fx)+Math.PI)*12/Math.PI) : -1;
    const coneBucket=hasDirection?Math.round(viewCos*100):0;
    const cameraCellX=hasDirection?Math.floor(viewX/32):0;
    const cameraCellZ=hasDirection?Math.floor(viewZ/32):0;
    const cx=Math.floor(x/48),cz=Math.floor(z/48);
    if(cx===this.cellX&&cz===this.cellZ
      &&sector===this.viewSector
      &&coneBucket===this.viewConeBucket
      &&cameraCellX===this.cameraCellX
      &&cameraCellZ===this.cameraCellZ)return;
    this.cellX=cx;this.cellZ=cz;
    this.viewSector=sector;
    this.viewConeBucket=coneBucket;
    this.cameraCellX=cameraCellX;this.cameraCellZ=cameraCellZ;

    for(const batch of this.batches){
      const dst=batch.mesh.instanceMatrix.array as Float32Array;
      const dstColors=batch.mesh.instanceColor?.array as Float32Array | undefined;
      let count=0;
      for(let i=0;i<batch.sites.length;i++){
        const site=batch.sites[i]!;
        const dx=site.x-x,dz=site.z-z;
        if(dx*dx+dz*dz>batch.distanceSquared)continue;
        if(hasDirection){
          const vx=site.x-viewX,vz=site.z-viewZ;
          const radiusSq=vx*vx+vz*vz;
          if(radiusSq>90*90 && vx*fx+vz*fz<viewCos*Math.sqrt(radiusSq))continue;
        }
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
