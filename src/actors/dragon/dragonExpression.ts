import type { FlightState } from './flight';
import type { DragonPose } from './animationPose';

export interface DragonExpression {
  eyeOpen: number;
  pupilShift: number;
  browLift: number;
  jawAngle: number;
  crestAngle: number;
}

const clamp=(x:number,lo:number,hi:number):number=>Math.max(lo,Math.min(hi,x));

/**
 * A restrained, deterministic facial performance for original Onyx. Each
 * expression is a function of the existing fixed-step flight state. There
 * are no random frame-to-frame twitching or newly invented combat states.
 *
 * Eye closure scales the WHOLE iris/pupil/highlight assembly, unlike the
 * former pupil-only blink which left an exposed luminous eye.
 */
export function dragonExpression(state:FlightState,pose:DragonPose):DragonExpression {
  const t=Number.isFinite(state.time)?Math.max(0,state.time):0;
  // Two unequal blink intervals per long cycle avoid a mechanical metronome.
  const cycle=t%8.3;
  const pulse=(at:number,width:number):number=>
    clamp(1-Math.abs(cycle-at)/width,0,1);
  const blink=Math.max(pulse(3.22,.17),pulse(6.95,.11));
  const swimming=pose.name==='swim'||pose.name==='dive';
  const flight=pose.name==='fly'||pose.name==='surge';
  const launching=pose.name==='launch'||pose.name==='breach';
  const landing=pose.name==='land'||pose.name==='splash';
  const effort=pose.name==='surge'?1:launching?.64:landing?.37:0;
  const calmJaw=state.mode==='ground'?.012:flight?.018:.007;
  return {
    eyeOpen:clamp(1-blink*.972-(swimming?.16:0),.026,1),
    pupilShift:clamp(-state.roll*.11+Math.sin(t*.37)*.027,-.09,.09),
    browLift:(swimming?-.042:launching?.054:pose.name==='surge'?.04:.008)
      +Math.sin(t*.74)*.006,
    jawAngle:calmJaw+.16*effort+(swimming?.018:0),
    crestAngle:.055*Math.sin(t*1.3)+.11*effort
      +(swimming?.10:flight?.03:0),
  };
}
