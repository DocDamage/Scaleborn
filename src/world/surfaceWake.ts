import * as THREE from 'three';
import type { FlightState } from '../actors/dragon/flight';
import { waterSurfaceAt } from './highlandLake';
import { waterWaveOffsetAt } from './waterWaves';
import { makeWakeCrestGeometry, makeWakeCrestTexture } from './wakeCrest';

type WakeEvent = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age:number; duration:number;active:boolean;
  x:number; z:number; scale:number;
};

/**
 * Two feathered, directional wake shoulders trail each swimmer rather than
 * emitting artificial circular white rings. Geometry and texture are shared
 * across a fixed pool, with only actor motion generating new wake events.
 */
export class SurfaceWake {
  readonly group = new THREE.Group();
  private readonly crestGeometry:THREE.BufferGeometry;
  private readonly crestTexture:THREE.DataTexture;
  private readonly events:WakeEvent[]=[];
  private next=0;
  private lastDragonTime=-100;
  private lastRiderTime=-100;
  private lastTime=0;

  constructor(scene: THREE.Scene, quality: 'high'|'low'='high') {
    this.group.name='water.azure.creature-surface-wake';
    scene.add(this.group);
    this.crestGeometry=makeWakeCrestGeometry(quality);
    this.crestTexture=makeWakeCrestTexture(quality==='high'?128:64);
    for(let i=0;i<(quality==='high'?24:12);i++){
      const mat=new THREE.MeshBasicMaterial({
        map:this.crestTexture,
        color:0xe1f1e8,
        side:THREE.DoubleSide,
        transparent:true,
        opacity:0,
        depthWrite:false,
        depthTest:true,
        toneMapped:true,
      });
      const mesh=new THREE.Mesh(this.crestGeometry,mat);
      mesh.visible=false;
      mesh.renderOrder=4;
      mesh.name='water.azure.directional-swim-wake';
      this.group.add(mesh);
      this.events.push({mesh,material:mat,age:0,duration:1.5,
        active:false,x:0,z:0,scale:1});
    }
  }

  private spawn(x:number,z:number,heading:number,scale:number,time:number):void{
    const event=this.events[this.next]!;
    this.next=(this.next+1)%this.events.length;
    event.active=true;
    event.age=0;
    event.duration=1.28+scale*.12;
    event.x=x;event.z=z;event.scale=scale;
    event.mesh.visible=true;
    event.mesh.position.set(
      x,waterSurfaceAt(x,z)+waterWaveOffsetAt(x,z,time)+.14,z,
    );
    // Actor yaw 0 faces -Z. Geometry grows behind (+Z); rotating by -yaw
    // keeps its open V trailing the swimmer in the actual movement direction.
    event.mesh.rotation.set(0,-heading,0);
    event.mesh.scale.setScalar(scale*.65);
    event.material.opacity=.27;
  }

  update(state:FlightState,time:number):void{
    if(!Number.isFinite(time))return;
    const rawDelta=Math.max(0,time-this.lastTime);
    const dt=Math.min(.1,rawDelta);
    this.lastTime=time;
    if(rawDelta>1.1){
      // A pause/teleport must not leave foam suspended in the sky.
      for(const event of this.events) {
        event.active=false;
        event.mesh.visible=false;
      }
    }
    // During splashdown the logical mode is 'surface' before physical water
    // contact. Never draw a moving wake while the dragon is still airborne.
    const atWaterline=state.transition?.phase!=='splashdown'
      || state.y <= waterSurfaceAt(state.x,state.z)
        +waterWaveOffsetAt(state.x,state.z,time)+2.2;
    if(state.mode==='surface' && atWaterline && Math.abs(state.speed)>1.2 &&
       time-this.lastDragonTime>.31) {
      this.spawn(state.x,state.z,state.yaw+(state.speed<0?Math.PI:0),
        state.form==='giant'?2.8:state.form==='small'?.65:1.25,time);
      this.lastDragonTime=time;
    }
    if(state.riderMode==='surface' && state.form==='small' &&
       Math.abs(state.riderSpeed)>.8 && time-this.lastRiderTime>.37) {
      this.spawn(state.riderX,state.riderZ,
        state.riderYaw+(state.riderSpeed<0?Math.PI:0),.65,time);
      this.lastRiderTime=time;
    }
    for(const event of this.events){
      if(!event.active)continue;
      event.age+=dt;
      const p=Math.min(1,event.age/event.duration);
      const spread=event.scale*(.65+p*.42);
      event.mesh.scale.set(spread,1,spread*(1+p*.19));
      event.mesh.position.y=waterSurfaceAt(event.x,event.z)
        +waterWaveOffsetAt(event.x,event.z,time)+.14;
      event.material.opacity=.27*Math.pow(1-p,1.55);
      if(p>=1){
        event.active=false;
        event.mesh.visible=false;
      }
    }
  }

  dispose():void {
    this.group.removeFromParent();
    this.crestGeometry.dispose();
    this.crestTexture.dispose();
    for(const event of this.events)event.material.dispose();
  }
}
