import * as THREE from 'three';
import { rng } from '../core/random';
import type { FlightState } from '../actors/dragon/flight';
import type { TraversalTransition } from '../actors/dragon/traversalTransition';
import { FORMS } from '../actors/dragon/forms';
import { AZURE_SEED } from './terrain';
import { waterSurfaceAt } from './highlandLake';
import { waterWaveOffsetAt } from './waterWaves';
import { makeSprayStreakGeometry, makeSprayStreakTexture } from './sprayStreak';

type SplashDrop = {
  x:number;y:number;z:number;
  vx:number;vy:number;vz:number;
  age:number;life:number;size:number;active:boolean;
};

/**
 * Creature splash response for physical contact with a water surface.
 * Spawned on actual splashdown, water launch, or rider first entering water.
 * Bounded, gravity-driven alpha streaks with one GPU draw call and no per
 * frame allocation; distinct from the waterfall's permanent plume.
 */
export class CreatureSplash {
  readonly group=new THREE.Group();
  readonly spray:THREE.InstancedMesh;
  private readonly drops:SplashDrop[]=[];
  private readonly random=rng(AZURE_SEED+24319);
  private readonly texture:THREE.DataTexture;
  private readonly material:THREE.MeshBasicMaterial;
  private readonly dummy=new THREE.Object3D();
  private readonly velocity=new THREE.Vector3();
  private readonly up=new THREE.Vector3(0,1,0);
  private readonly tint=new THREE.Color();
  private next=0;
  private previousRiderMode:FlightState['riderMode']|null=null;
  private splashTransition:TraversalTransition|null=null;
  private pendingSplashdown=false;
  private launchTransition:TraversalTransition|null=null;
  private lastTime=0;

  constructor(scene:THREE.Scene,quality:'high'|'low'='high'){
    this.group.name='water.azure.creature-splash-impact';
    scene.add(this.group);
    this.texture=makeSprayStreakTexture(quality==='high'?128:64);
    this.material=new THREE.MeshBasicMaterial({
      map:this.texture,color:0xeaf6f2,transparent:true,opacity:.75,
      depthWrite:false,side:THREE.DoubleSide,alphaTest:.018,
      // Instance colors are supplied per-particle; no per-vertex color buffer.
      vertexColors:false,
    });
    const capacity=quality==='high'?120:64;
    this.spray=new THREE.InstancedMesh(
      makeSprayStreakGeometry(),this.material,capacity);
    this.spray.name='water.azure.creature-ballistic-splash';
    this.spray.count=0;
    this.spray.frustumCulled=false;
    this.spray.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for(let i=0;i<capacity;i++){
      this.drops.push({x:0,y:0,z:0,vx:0,vy:0,vz:0,
        age:0,life:0,size:0,active:false});
    }
    this.group.add(this.spray);
  }

  private emit(x:number,z:number,scale:number,count:number,time:number):void {
    if(![x,z,time].every(Number.isFinite))return;
    const y=waterSurfaceAt(x,z)+waterWaveOffsetAt(x,z,time)+.16;
    for(let i=0;i<count;i++){
      const d=this.drops[this.next]!;
      this.next=(this.next+1)%this.drops.length;
      const a=this.random()*Math.PI*2;
      const r=this.random()*scale*.64;
      const speed=(3+this.random()*8)*Math.sqrt(scale);
      d.x=x+Math.cos(a)*r; d.z=z+Math.sin(a)*r; d.y=y;
      d.vx=Math.cos(a)*speed;
      d.vz=Math.sin(a)*speed;
      d.vy=3+this.random()*(7.5+scale*1.1);
      d.size=.07+this.random()*.085*Math.sqrt(scale);
      d.life=.65+this.random()*.90;
      d.age=0;d.active=true;
    }
  }

  update(state:FlightState,time:number):void {
    if(!Number.isFinite(time))return;
    const rawDelta=Math.max(0,time-this.lastTime);
    const dt=Math.min(.08,rawDelta);
    this.lastTime=time;
    if(rawDelta>1.1){
      for(const d of this.drops)d.active=false;
    }

    // The simulation switches to 'surface' when splashdown STARTS,
    // potentially ten metres above water. Release spray only when the
    // dragon's body actually intersects the moving water surface.
    const transition=state.transition;
    const nearWater=state.y <= waterSurfaceAt(state.x,state.z)
      + FORMS[state.form].standHeight*.55
      + waterWaveOffsetAt(state.x,state.z,time)*.62 + 1.15;
    if(transition?.phase==='splashdown' &&
      transition!==this.splashTransition){
      this.pendingSplashdown=true;
      this.splashTransition=transition;
    }
    // On very slow software-rendered frames, the animation may complete
    // between renders. Keep its pending contact instead of losing the splash.
    if(this.pendingSplashdown && state.mode==='surface' && nearWater){
      this.emit(state.x,state.z,FORMS[state.form].radius,
        state.form==='giant'?78:state.form==='small'?25:48,time);
      this.pendingSplashdown=false;
    }
    if(transition?.phase==='waterLaunch'
      && transition!==this.launchTransition && transition.elapsed<.48){
      this.emit(state.x,state.z,FORMS[state.form].radius*.76,
        state.form==='giant'?50:state.form==='small'?14:32,time);
      this.launchTransition=transition;
    }
    if(transition?.phase!=='splashdown'){
      this.splashTransition=null;
      if(state.mode!=='surface')this.pendingSplashdown=false;
    }
    if(transition?.phase!=='waterLaunch')this.launchTransition=null;

    if(this.previousRiderMode==='ground' && state.riderMode==='surface'){
      this.emit(state.riderX,state.riderZ,.85,22,time);
    }
    this.previousRiderMode=state.riderMode;

    let active=0;
    for(const d of this.drops){
      if(!d.active)continue;
      d.age+=dt;
      d.vy-=9.81*dt;
      const drag=Math.exp(-.62*dt);
      d.vx*=drag;d.vz*=drag;
      d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;
      const waterY=waterSurfaceAt(d.x,d.z)
        +waterWaveOffsetAt(d.x,d.z,time)+.03;
      if(d.age>=d.life||d.y<waterY){
        d.active=false;
        continue;
      }
      this.velocity.set(d.vx,d.vy,d.vz);
      const speed=this.velocity.length();
      if(speed>.001){
        this.velocity.multiplyScalar(1/speed);
        this.dummy.quaternion.setFromUnitVectors(this.up,this.velocity);
      }else this.dummy.quaternion.identity();
      this.dummy.position.set(d.x,d.y,d.z);
      this.dummy.scale.set(d.size,.22+Math.min(1,speed*.017),d.size);
      this.dummy.updateMatrix();
      this.spray.setMatrixAt(active,this.dummy.matrix);
      const fade=Math.max(0,1-d.age/d.life);
      this.tint.setRGB(.55+.45*fade,.66+.34*fade,.67+.33*fade);
      this.spray.setColorAt(active,this.tint);
      active++;
    }
    this.spray.count=active;
    this.spray.instanceMatrix.needsUpdate=true;
    if(this.spray.instanceColor)this.spray.instanceColor.needsUpdate=true;
  }

  dispose():void {
    this.group.removeFromParent();
    this.spray.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
