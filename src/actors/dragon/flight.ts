import { minimumFlightY, SPAWN, heightAt, SEA_LEVEL } from '../../world/terrain';
import { waterSurfaceAt } from '../../world/highlandLake';
import { waterfallCurtainDragAt } from '../../world/waterDynamics';
import { canExpandInAir, canStand, safeFlightY } from '../../world/collision';
import {
  canEnterSea, dragonBottomY, dragonSurfaceY, WATER_ENTRY_HEIGHT,
} from '../../world/waterPhysics';
import { FORMS, type DragonForm, type DragonMode, type RiderMode, type ControlTarget } from './forms';
import { beginTraversal, advanceTraversal, type TraversalTransition } from './traversalTransition';
import { stepDragonSwimming } from './swimming';
import { stepRider } from '../rider/movement';

export interface FlightState {
  x: number; y: number; z: number;
  yaw: number; pitch: number; roll: number;
  speed: number; time: number;
  form: DragonForm;
  mode: DragonMode;
  transition: TraversalTransition | null;
  waterTargetY: number;
  controlTarget: ControlTarget;
  riderX: number; riderY: number; riderZ: number;
  riderYaw: number;
  riderMode: RiderMode;
  riderTargetY: number;
  riderSpeed: number;
}
export interface FlightControls {
  turn: number; pitch: number; bank: number;
  boost: boolean; flap: boolean; move?: number;
}
export interface InteractionResult { ok: boolean; message: string }
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const accept = (message: string): InteractionResult => ({ ok: true, message });
const reject = (message: string): InteractionResult => ({ ok: false, message });

export function newFlightState(): FlightState {
  return {
    ...SPAWN, pitch: 0.02, roll: 0, speed: FORMS.rideable.cruise, time: 0,
    form: 'rideable', mode: 'air', transition: null, waterTargetY: SEA_LEVEL,
    controlTarget: 'dragon',
    riderX: SPAWN.x, riderY: heightAt(SPAWN.x, SPAWN.z) + 0.05,
    riderZ: SPAWN.z, riderYaw: SPAWN.yaw,
    riderMode: 'ground', riderTargetY: heightAt(SPAWN.x, SPAWN.z) + 0.05,
    riderSpeed: 0,
  };
}

/** Find a safe dismount point rather than spawning the 13-year-old in a wall. */
function dismountPoint(state: FlightState): { x: number; z: number } | null {
  for (const radius of [2, 2.8, 3.5]) {
    for (let i = 0; i < 12; i++) {
      const angle = state.yaw + i / 12 * Math.PI * 2;
      const x = state.x + Math.cos(angle) * radius;
      const z = state.z + Math.sin(angle) * radius;
      if (canStand(x, z, 'small').ok) return { x, z };
    }
  }
  return null;
}

/** No stamina cost; reject unsafe growth, water dismounts and distant remounts. */
export function requestDragonForm(state: FlightState, target: DragonForm): InteractionResult {
  if (state.transition) return reject('Finish the current traversal maneuver first.');
  if (target === state.form) return accept(FORMS[target].label + ' form already active.');
  if (target === 'small' && state.mode !== 'ground') {
    return reject('Land first so the young rider can dismount safely.');
  }
  if (state.form === 'small' && target !== 'small') {
    if (state.mode !== 'ground' || state.riderMode !== 'ground') {
      return reject('Both companions must be on land before remounting.');
    }
    if (Math.hypot(state.x - state.riderX, state.z - state.riderZ) > 4.5) {
      return reject('Move closer to the rider before remounting.');
    }
  }
  if (state.mode === 'ground') {
    const check = canStand(state.x, state.z, target);
    if (!check.ok) return reject(check.reason);
  } else if (state.mode === 'air' && FORMS[target].radius > FORMS[state.form].radius) {
    const check = canExpandInAir(state.x, state.y, state.z, target);
    if (!check.ok) return reject(check.reason);
  } else if (state.mode === 'surface' || state.mode === 'underwater') {
    const check = canEnterSea(state.x, state.z, target);
    if (!check.ok || state.y < dragonBottomY(state.x, state.z, target) + 0.4) {
      return reject('Find deeper water before growing.');
    }
  }
  const spot = target === 'small' ? dismountPoint(state) : null;
  if (target === 'small' && !spot) return reject('There is no clear space for the rider to dismount.');
  if (spot) {
    state.riderX = spot.x;
    state.riderZ = spot.z;
    state.riderY = heightAt(spot.x, spot.z) + 0.05;
    state.riderTargetY = state.riderY;
    state.riderMode = 'ground';
    state.riderYaw = state.yaw;
  }
  state.form = target;
  state.controlTarget = 'dragon';
  const config = FORMS[target];
  state.speed = state.mode === 'air' ? Math.min(state.speed, config.surge) : 0;
  if (state.mode === 'ground') state.y = heightAt(state.x, state.z) + config.standHeight;
  if (state.mode === 'surface') state.waterTargetY = dragonSurfaceY(target);
  return accept(config.label + ' form activated.');
}

/** F: land on solid ground, splash into the ocean, or emerge into flight. */
export function toggleLanding(state: FlightState): InteractionResult {
  if (state.transition) return reject('Finish the current flight maneuver first.');
  if (state.mode === 'underwater') return reject('Return to the surface before taking off.');
  if (state.mode === 'surface') {
    if (state.y < dragonSurfaceY(state.form, state.x, state.z) - 1) {
      return reject('Reach the surface before taking off.');
    }
    beginTraversal(state, 'waterLaunch',
      Math.max(safeFlightY(state.x, state.z, state.form) + 1, state.y + 11),
      FORMS[state.form].cruise * 0.72);
    return accept('Rising out of the water — wings unfurling.');
  }
  const localWaterLevel = waterSurfaceAt(state.x, state.z);
  if (state.mode === 'air' && heightAt(state.x, state.z) < localWaterLevel - 3) {
    const check = canEnterSea(state.x, state.z, state.form);
    if (!check.ok) return reject(check.reason);
    if (state.y - localWaterLevel > WATER_ENTRY_HEIGHT) {
      return reject('Descend closer to the sea before splashing down.');
    }
    beginTraversal(state, 'splashdown', dragonSurfaceY(state.form, state.x, state.z), 0);
    return accept('Dragon splashes into the sea.');
  }
  const check = canStand(state.x, state.z, state.form);
  if (!check.ok) return reject(check.reason);
  if (state.mode === 'ground') {
    beginTraversal(state, 'takingOff',
      Math.max(state.y + 8, safeFlightY(state.x, state.z, state.form) + 1),
      FORMS[state.form].cruise * 0.72);
    return accept('Taking off — wings unfurling.');
  }
  if (state.y - heightAt(state.x, state.z) > 22) {
    return reject('Descend within 22 meters of the ground to land.');
  }
  beginTraversal(state, 'landing', heightAt(state.x, state.z) + FORMS[state.form].standHeight, 0);
  return accept('Landing — preparing to touch down.');
}

/** Fixed-step simulation; game controls and renderer are downstream consumers. */
export function stepFlight(state: FlightState, controls: FlightControls, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) return;
  state.time += dt;
  if (advanceTraversal(state, dt)) return;
  if (state.controlTarget === 'rider') {
    state.speed = 0;
    stepRider(state, controls, dt);
    return;
  }
  if (state.mode === 'surface' || state.mode === 'underwater') {
    stepDragonSwimming(state, controls, dt);
    return;
  }
  const form = FORMS[state.form];
  if (state.mode === 'ground') {
    const drive = clamp(controls.move ?? controls.pitch, -1, 1);
    const goal = drive > 0 ? drive * form.groundSpeed * (controls.boost ? 1.7 : 1)
      : drive * form.groundSpeed * 0.46;
    state.speed += (goal - state.speed) * Math.min(1, dt * 7.4);
    state.yaw += clamp(controls.turn, -1, 1) * dt * form.turnRate * 1.5;
    const nx = state.x + Math.sin(state.yaw) * state.speed * dt;
    const nz = state.z - Math.cos(state.yaw) * state.speed * dt;
    if (canStand(nx, nz, state.form).ok) {
      state.x = nx; state.z = nz;
    } else state.speed = 0;
    state.pitch = 0;
    state.roll += (clamp(-controls.turn * 0.07, -0.18, 0.18) - state.roll) * Math.min(1, dt * 6);
    state.y = heightAt(state.x, state.z) + form.standHeight;
    return;
  }
  const requestedSpeed = controls.boost ? form.surge : controls.flap ? form.cruise * 1.40 : form.cruise;
  state.speed += (requestedSpeed - state.speed) * Math.min(1, dt * (controls.boost ? 2.6 : 1.4));
  const turnRate = form.turnRate * (0.9 + 0.1 * Math.min(1, form.cruise / Math.max(state.speed, 1))) * dt;
  state.yaw += clamp(controls.turn, -1, 1) * turnRate;
  state.pitch = clamp(state.pitch + clamp(controls.pitch, -1, 1) * dt * 0.68, -0.76, 0.78);
  const targetBank = clamp(-controls.turn * form.bankLimit * 0.68 + controls.bank * 0.40,
    -form.bankLimit, form.bankLimit);
  state.roll += (targetBank - state.roll) * Math.min(1, dt * 5);
  const cos = Math.cos(state.pitch);
  state.x += Math.sin(state.yaw) * cos * state.speed * dt;
  state.y += Math.sin(state.pitch) * state.speed * dt;
  state.z -= Math.cos(state.yaw) * cos * state.speed * dt;
  // A dragon that crosses the actual falling curtain feels a local,
  // collision-safe downward/outward push; ordinary flight is unchanged.
  const fall=waterfallCurtainDragAt(state.x,state.y,state.z,form.radius);
  state.x+=fall.x*dt;
  state.y+=fall.y*dt;
  state.z+=fall.z*dt;
  const floor = Math.max(minimumFlightY(state.x, state.z), safeFlightY(state.x, state.z, state.form));
  if (state.y < floor) {
    state.y = floor;
    state.pitch = Math.max(state.pitch, 0.10);
  }
}
