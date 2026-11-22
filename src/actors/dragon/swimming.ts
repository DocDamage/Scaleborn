import type { FlightControls, FlightState, InteractionResult } from './flight';
import { FORMS } from './forms';
import { plungeCurrentStep } from '../../world/waterDynamics';
import {
  approach, canDragonDive, canEnterSea, dragonBottomY, dragonDiveY, dragonSurfaceY,
} from '../../world/waterPhysics';

const clamp = (x: number, min: number, max: number): number => Math.max(min, Math.min(max, x));

export function toggleDragonDive(state: FlightState): InteractionResult {
  if (state.transition) return { ok: false, message: 'Finish the current maneuver before diving.' };
  if (state.mode !== 'surface' && state.mode !== 'underwater') {
    return { ok: false, message: 'Enter the water before diving.' };
  }
  if (state.mode === 'surface') {
    const check = canDragonDive(state.x, state.z, state.form);
    if (!check.ok) return { ok: false, message: check.reason };
    state.mode = 'underwater';
    state.waterTargetY = dragonDiveY(state.form, state.x, state.z);
    return { ok: true, message: 'Dragon dives below the waves.' };
  }
  state.mode = 'surface';
  state.waterTargetY = dragonSurfaceY(state.form, state.x, state.z);
  return { ok: true, message: 'Dragon swims toward the surface.' };
}

/** Deterministic swimming with undersea clearance and smooth transitions. */
export function stepDragonSwimming(state: FlightState, controls: FlightControls, dt: number): void {
  const form = FORMS[state.form];
  const underwater = state.mode === 'underwater';
  const move = clamp(controls.move ?? 0, -1, 1);
  const topSpeed = (underwater ? 15.5 : 10.2) * (state.form === 'giant' ? 1.2 : state.form === 'small' ? 0.65 : 1);
  const requested = move * topSpeed * (controls.boost ? 1.65 : 1) * (move < 0 ? 0.48 : 1);
  state.speed += (requested - state.speed) * Math.min(1, dt * 5.0);
  state.yaw += clamp(controls.turn, -1, 1) * form.turnRate * dt * (underwater ? 1.55 : 1.30);
  state.roll += (-clamp(controls.turn, -1, 1) * 0.16 - state.roll) * Math.min(1, dt * 4);
  state.pitch += ((underwater ? clamp(controls.bank, -1, 1) * 0.20 : 0) - state.pitch) * Math.min(1, dt * 3);
  let nx = state.x + Math.sin(state.yaw) * state.speed * dt;
  let nz = state.z - Math.cos(state.yaw) * state.speed * dt;
  // Waterfall wake applies a continuous, collision-safe outward force.
  const flow=plungeCurrentStep(nx,nz,dt,(x,z)=>canEnterSea(x,z,state.form).ok);
  nx=flow.x; nz=flow.z;
  if (canEnterSea(nx, nz, state.form).ok) {
    state.x = nx;
    state.z = nz;
  } else state.speed = 0;
  const bottom = dragonBottomY(state.x, state.z, state.form);
  const top = dragonSurfaceY(state.form, state.x, state.z);
  if (underwater) {
    state.waterTargetY += clamp(controls.bank, -1, 1) * dt * 8;
    state.waterTargetY = clamp(state.waterTargetY, bottom, top - 1.0);
    if (state.waterTargetY >= top - 1.01 && controls.bank > 0) {
      state.mode = 'surface';
      state.waterTargetY = top;
    }
  } else state.waterTargetY = top;
  state.y = clamp(approach(state.y, state.waterTargetY, dt * (underwater ? 8 : 9)), bottom, top);
  if (!underwater) state.pitch *= 0.95;
  // Bonded dragon and rider share permanent underwater breathing: no air timer.
}
