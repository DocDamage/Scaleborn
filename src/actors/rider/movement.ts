import type { FlightControls, FlightState, InteractionResult } from '../dragon/flight';
import { canStand, OBSTACLES } from '../../world/collision';
import { heightAt } from '../../world/terrain';
import { waterSurfaceAt } from '../../world/highlandLake';
import { plungeCurrentStep } from '../../world/waterDynamics';
import { approach, riderSurfaceY, riderDiveY, riderCanSwim, riderFloorY } from '../../world/waterPhysics';

const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));

/** Rider is independently controlled only while the dragon is in small form. */
export function toggleRiderControl(state: FlightState): InteractionResult {
  if (state.form !== 'small' || state.transition ||
      (state.controlTarget === 'dragon' && state.mode !== 'ground')) {
    return { ok: false, message: 'Land and shrink the dragon before switching rider control.' };
  }
  state.controlTarget = state.controlTarget === 'rider' ? 'dragon' : 'rider';
  state.riderSpeed = 0;
  state.speed = 0;
  return { ok: true, message: state.controlTarget === 'rider' ? 'Controlling the rider.' : 'Controlling the small dragon.' };
}

export function toggleRiderDive(state: FlightState): InteractionResult {
  if (state.controlTarget !== 'rider') return { ok: false, message: 'Switch to rider control first.' };
  if (state.riderMode === 'ground') return { ok: false, message: 'Enter the sea before diving.' };
  if (state.riderMode === 'surface') {
    if (riderFloorY(state.riderX, state.riderZ) >= riderDiveY(state.riderX, state.riderZ) - 0.6) {
      return { ok: false, message: 'The water is too shallow to dive.' };
    }
    state.riderMode = 'underwater';
    state.riderTargetY = riderDiveY(state.riderX, state.riderZ);
    return { ok: true, message: 'The rider dives beneath the waves.' };
  }
  state.riderMode = 'surface';
  state.riderTargetY = riderSurfaceY(state.riderX, state.riderZ);
  return { ok: true, message: 'The rider swims toward the surface.' };
}

/** Same fixed-step time as dragon flight, no browser APIs or renderer dependencies. */
export function stepRider(state: FlightState, controls: FlightControls, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) return;
  const direction = clamp(controls.move ?? 0, -1, 1);
  const water = state.riderMode !== 'ground';
  const maxSpeed = water ? (controls.boost ? 4.9 : 3.1) : controls.boost ? 6.4 : 3.8;
  const goal = direction * maxSpeed * (direction < 0 ? 0.55 : 1);
  state.riderSpeed += (goal - state.riderSpeed) * Math.min(1, dt * 7.5);
  state.riderYaw += clamp(controls.turn, -1, 1) * dt * (water ? 1.9 : 2.4);
  let nx = state.riderX + Math.sin(state.riderYaw) * state.riderSpeed * dt;
  let nz = state.riderZ - Math.cos(state.riderYaw) * state.riderSpeed * dt;
  if (water) {
    const flow=plungeCurrentStep(nx,nz,dt,(x,z)=>
      riderCanSwim(x,z) && riderFloorY(x,z)<state.riderY-.1);
    nx=flow.x; nz=flow.z;
  }
  const nextHeight = heightAt(nx, nz);
  const nextWaterLevel = waterSurfaceAt(nx, nz);
  const aboveWater = nextHeight >= nextWaterLevel + 2;
  const clearStructures = !OBSTACLES.some((o) =>
    Math.hypot(o.x - nx, o.z - nz) < o.radius + 0.5 && o.top > nextHeight + 1.0);
  const canWalk = aboveWater && canStand(nx, nz, 'small').ok;
  const shallows = nextHeight > nextWaterLevel - 1.1 && nextHeight < nextWaterLevel + 2;
  const canWade = shallows && clearStructures &&
    Math.abs(nextHeight - heightAt(state.riderX, state.riderZ)) < 1.0;
  const canSwim = riderCanSwim(nx, nz) && nextHeight < Math.min(nextWaterLevel, state.riderY - 0.2);
  if (canWalk && (!water || state.riderY >= riderSurfaceY(state.riderX, state.riderZ) - 0.3)) {
    state.riderX = nx; state.riderZ = nz;
    state.riderMode = 'ground';
    state.riderTargetY = nextHeight + 0.05;
  } else if (canWade || canSwim) {
    state.riderX = nx; state.riderZ = nz;
    if (state.riderMode === 'ground') {
      state.riderMode = 'surface';
      state.riderTargetY = riderSurfaceY(state.riderX, state.riderZ);
    }
  } else if (Math.abs(state.riderSpeed) > 0.0001) {
    state.riderSpeed = 0;
  }

  if (state.riderMode === 'ground') {
    state.riderY = heightAt(state.riderX, state.riderZ) + 0.05;
    state.riderTargetY = state.riderY;
    return;
  }
  const bottom = riderFloorY(state.riderX, state.riderZ);
  if (state.riderMode === 'underwater') {
    state.riderTargetY += clamp(controls.bank, -1, 1) * dt * 3.2;
    if (state.riderTargetY >= riderSurfaceY(state.riderX, state.riderZ)) {
      state.riderMode = 'surface';
      state.riderTargetY = riderSurfaceY(state.riderX, state.riderZ);
    }
  } else {
    state.riderTargetY = riderSurfaceY(state.riderX, state.riderZ);
  }
  if (bottom > riderSurfaceY(state.riderX, state.riderZ)) {
    state.riderY = bottom;
    return;
  }
  state.riderTargetY = clamp(state.riderTargetY, bottom, riderSurfaceY(state.riderX, state.riderZ));
  state.riderY = Math.max(bottom, approach(state.riderY, state.riderTargetY, dt * 3.8));
}
