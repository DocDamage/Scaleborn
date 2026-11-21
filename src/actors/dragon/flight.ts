import { minimumFlightY, SPAWN, heightAt } from '../../world/terrain';
import { canExpandInAir, canStand, safeFlightY } from '../../world/collision';
import { FORMS, type DragonForm, type DragonMode } from './forms';

export interface FlightState {
  x: number; y: number; z: number;
  yaw: number; pitch: number; roll: number;
  speed: number; time: number;
  form: DragonForm;
  mode: DragonMode;
  /** Dismount anchor: rider is independent while the small dragon is controlled. */
  riderX: number; riderZ: number;
}

export interface FlightControls {
  turn: number;
  pitch: number;
  bank: number;
  boost: boolean;
  flap: boolean;
  /** On ground this is W/S movement, separate from mouse pitch. */
  move?: number;
}

export interface InteractionResult {
  ok: boolean;
  message: string;
}
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const accept = (message: string): InteractionResult => ({ ok: true, message });
const reject = (message: string): InteractionResult => ({ ok: false, message });

export function newFlightState(): FlightState {
  return {
    ...SPAWN, pitch: 0.02, roll: 0, speed: FORMS.rideable.cruise, time: 0,
    form: 'rideable', mode: 'air', riderX: SPAWN.x, riderZ: SPAWN.z,
  };
}

/** Free size changes, subject to actual space and safe dismount/remount in the G2 prototype. */
export function requestDragonForm(state: FlightState, target: DragonForm): InteractionResult {
  if (target === state.form) return accept(FORMS[target].label + ' form already active.');
  if (target === 'small' && state.mode === 'air') {
    return reject('Land first so the young rider can dismount safely.');
  }
  if (state.form === 'small' && target !== 'small') {
    if (state.mode !== 'ground') return reject('Return to land before remounting.');
    if (Math.hypot(state.x - state.riderX, state.z - state.riderZ) > 4.5) {
      return reject('Move closer to the rider before remounting.');
    }
  }
  if (state.mode === 'ground') {
    const check = canStand(state.x, state.z, target);
    if (!check.ok) return reject(check.reason);
  } else if (FORMS[target].radius > FORMS[state.form].radius) {
    const check = canExpandInAir(state.x, state.y, state.z, target);
    if (!check.ok) return reject(check.reason);
  }
  if (target === 'small') {
    state.riderX = state.x + Math.cos(state.yaw) * 2.0;
    state.riderZ = state.z + Math.sin(state.yaw) * 2.0;
  }
  state.form = target;
  const config = FORMS[target];
  state.speed = state.mode === 'air' ? Math.min(state.speed, config.surge) : 0;
  if (state.mode === 'ground') state.y = heightAt(state.x, state.z) + config.standHeight;
  return accept(config.label + ' form activated.');
}

/** Assisted landing/takeoff: no crash penalty; water entry comes in G3. */
export function toggleLanding(state: FlightState): InteractionResult {
  if (state.mode === 'ground') {
    const check = canStand(state.x, state.z, state.form);
    if (!check.ok) return reject(check.reason);
    state.mode = 'air';
    state.y = Math.max(state.y, safeFlightY(state.x, state.z, state.form));
    state.speed = FORMS[state.form].cruise * 0.72;
    return accept('Wings spread — airborne.');
  }
  const check = canStand(state.x, state.z, state.form);
  if (!check.ok) return reject(check.reason);
  if (state.y - heightAt(state.x, state.z) > 22) {
    return reject('Descend within 22 meters of the ground to land.');
  }
  state.mode = 'ground';
  state.pitch = 0;
  state.roll = 0;
  state.speed = 0;
  state.y = heightAt(state.x, state.z) + FORMS[state.form].standHeight;
  return accept('Touchdown. Press F to take off again.');
}

/** Pure fixed-step simulation, portable to another engine. */
export function stepFlight(s: FlightState, c: FlightControls, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) return;
  s.time += dt;
  const form = FORMS[s.form];
  if (s.mode === 'ground') {
    const drive = clamp(c.move ?? c.pitch, -1, 1);
    const goal = drive > 0 ? drive * form.groundSpeed * (c.boost ? 1.7 : 1)
      : drive * form.groundSpeed * 0.46;
    s.speed += (goal - s.speed) * Math.min(1, dt * 7.4);
    s.yaw += clamp(c.turn, -1, 1) * dt * form.turnRate * 1.5;
    const nextX = s.x + Math.sin(s.yaw) * s.speed * dt;
    const nextZ = s.z - Math.cos(s.yaw) * s.speed * dt;
    if (canStand(nextX, nextZ, s.form).ok) {
      s.x = nextX; s.z = nextZ;
    } else {
      s.speed = 0;
    }
    s.pitch = 0;
    s.roll += (clamp(-c.turn * 0.07, -0.18, 0.18) - s.roll) * Math.min(1, dt * 6);
    s.y = heightAt(s.x, s.z) + form.standHeight;
    return;
  }
  const targetSpeed = c.boost ? form.surge : c.flap ? form.cruise * 1.40 : form.cruise;
  s.speed += (targetSpeed - s.speed) * Math.min(1, dt * (c.boost ? 2.6 : 1.4));
  const turnRate = form.turnRate * (0.9 + 0.1 * Math.min(1, form.cruise / Math.max(s.speed, 1))) * dt;
  s.yaw += clamp(c.turn, -1, 1) * turnRate;
  s.pitch = clamp(s.pitch + clamp(c.pitch, -1, 1) * dt * 0.68, -0.76, 0.78);
  const targetBank = clamp(-c.turn * form.bankLimit * 0.68 + c.bank * 0.40, -form.bankLimit, form.bankLimit);
  s.roll += (targetBank - s.roll) * Math.min(1, dt * 5);
  const cos = Math.cos(s.pitch);
  s.x += Math.sin(s.yaw) * cos * s.speed * dt;
  s.y += Math.sin(s.pitch) * s.speed * dt;
  s.z -= Math.cos(s.yaw) * cos * s.speed * dt;
  const floor = Math.max(minimumFlightY(s.x, s.z), safeFlightY(s.x, s.z, s.form));
  if (s.y < floor) {
    s.y = floor;
    s.pitch = Math.max(s.pitch, 0.10);
  }
}
