import type { FlightState } from '../dragon/flight';
import type { RiderPose } from './pose';

/** Independent subtle facial pose; never changes gameplay or the child-scale rig. */
export interface RiderFacialPose {
  eyeOpen: number;
  browLift: number;
  mouthShift: number;
  headPitch: number;
  headYaw: number;
  headBank: number;
}
export function riderFacialPose(state:FlightState, pose:RiderPose):RiderFacialPose {
  const time=Number.isFinite(state.time)?Math.max(0,state.time):0;
  const phase=time%4.6;
  const close=Math.max(0,1-Math.abs(phase-2.4)/.115);
  const afterBlink=Math.max(0,1-Math.abs(phase-2.61)/.08);
  const eyeOpen=Math.max(.075,1-.925*Math.max(close,afterBlink*.5));
  const bank=Number.isFinite(state.roll)?Math.min(1,Math.abs(state.roll)):0;
  const mounted=pose.motion==='mounted';
  const focus=mounted?Math.min(1,bank*1.2+(state.mode==='air'?.18:0)):0;
  const signedRoll=Number.isFinite(state.roll)
    ? Math.max(-.8,Math.min(.8,state.roll)) : 0;
  return {
    eyeOpen,
    browLift:Math.max(-.015,Math.min(.012,
      -.009*focus+.004*Math.sin(time*.7))),
    mouthShift:mounted?-focus*.004:.002*Math.sin(time*.8),
    // Tiny independent head responses keep the bonded child alert without
    // breaking the planted pelvis or taking over the player's camera aim.
    headPitch:Math.max(-.075,Math.min(.075,
      -pose.torsoLean*.18 + Math.sin(time*.9)*.010)),
    headYaw:mounted ? -signedRoll*.14 : Math.sin(time*.53)*.038,
    headBank:mounted ? -signedRoll*.07 : Math.sin(time*1.1)*.006,
  };
}
