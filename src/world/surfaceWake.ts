import * as THREE from 'three';
import type { FlightState } from '../actors/dragon/flight';
import { waterSurfaceAt } from './highlandLake';
import { waterWaveOffsetAt } from './waterWaves';

type WakeRing = {mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; age:number; duration:number; active:boolean};

/**
 * Generated fluid-surface disturbance emitted by moving dragon and rider.
 * Ring scale/opacity follow time; centers follow the same physical wave
 * elevation as swimming. Fixed-pool, no dynamic allocations per frame.
 */
export class SurfaceWake {
  readonly group = new THREE.Group();
  private readonly ringGeometry = new THREE.RingGeometry(.76,1.0,42);
  private readonly rings:WakeRing[]=[];
  private next=0;
  private lastDragonTime=-100;
  private lastRiderTime=-100;
  private lastTime=0;

  constructor(scene: THREE.Scene, quality: 'high'|'low'='high') {
    this.group.name='water.azure.creature-surface-wake';
    scene.add(this.group);
    for(let i=0;i<(quality==='high'?24:12);i++){
      const mat=new THREE.MeshBasicMaterial({
        color:0xc7e6db,
        side:THREE.DoubleSide,
        transparent:true,
        opacity:0,
        depthWrite:false,
        toneMapped:false,
      });
      const mesh=new THREE.Mesh(this.ringGeometry,mat);
      mesh.rotation.x=-Math.PI/2;
      mesh.visible=false;
      mesh.renderOrder=4;
      this.group.add(mesh);
      this.rings.push({mesh,material:mat,age:0,duration:1.45,active:false});
    }
  }

  private spawn(x:number,z:number,y:number,scale:number):void{
    const ring=this.rings[this.next]!;
    this.next=(this.next+1)%this.rings.length;
    ring.mesh.visible=true;
    ring.mesh.position.set(x,y+.38,z);
    ring.mesh.scale.setScalar(scale);
    ring.age=0;
    ring.duration=1.15+scale*.14;
    ring.active=true;
  }

  update(state:FlightState,time:number):void{
    const rawDelta=Math.max(0,time-this.lastTime);
    const dt=Math.min(.1,rawDelta);
    this.lastTime=time;
    if(rawDelta>1.1){
      // Elapsed-time discontinuities should never leave wake rings stuck.
      for(const ring of this.rings){
        ring.active=false;
        ring.mesh.visible=false;
      }
    }
    const surface=(x:number,z:number)=>waterSurfaceAt(x,z)+waterWaveOffsetAt(x,z,time);
    if(state.mode==='surface' && Math.abs(state.speed)>1.2 && time-this.lastDragonTime>.31){
      const surfaceY=surface(state.x,state.z);
      this.spawn(state.x,state.z,surfaceY,
        state.form==='giant'?2.8:state.form==='small'?.65:1.25);
      this.lastDragonTime=time;
    }
    if(state.riderMode==='surface' && state.form==='small'
      && Math.abs(state.riderSpeed)>.8 && time-this.lastRiderTime>.37) {
      this.spawn(state.riderX,state.riderZ,
        surface(state.riderX,state.riderZ),.65);
      this.lastRiderTime=time;
    }
    for(const ring of this.rings){
      if(!ring.active)continue;
      ring.age+=dt;
      const p=Math.min(1,ring.age/ring.duration);
      ring.mesh.scale.multiplyScalar(1+dt*.90);
      ring.material.opacity=.24*(1-p)*(1-p);
      if(p>=1){ring.active=false;ring.mesh.visible=false;}
    }
  }

  dispose():void{
    this.group.removeFromParent();
    this.ringGeometry.dispose();
    for(const ring of this.rings)ring.material.dispose();
  }
}
