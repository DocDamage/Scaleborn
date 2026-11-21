import { minimumFlightY, SPAWN } from '../../world/terrain';

export interface FlightState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  speed: number;
  time: number;
}

export interface FlightControls {
  turn: number;
  pitch: number;
  bank: number;
  boost: boolean;
  flap: boolean;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function newFlightState(): FlightState {
  return { ...SPAWN, pitch: 0.02, roll: 0, speed: 56, time: 0 };
}

/** Fixed-step, Three.js-independent flight simulation. Forward at yaw 0 is -Z. */
export function stepFlight(s: FlightState, c: FlightControls, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) return;
  s.time += dt;
  const targetSpeed = c.boost ? 112 : c.flap ? 78 : 55;
  s.speed += (targetSpeed - s.speed) * Math.min(1, dt * (c.boost ? 2.6 : 1.4));
  const turnRate = (0.68 + 0.17 * Math.min(1, 60 / Math.max(s.speed, 1))) * dt;
  s.yaw += clamp(c.turn, -1, 1) * turnRate;
  s.pitch = clamp(s.pitch + clamp(c.pitch, -1, 1) * dt * 0.68, -0.76, 0.78);
  const targetBank = clamp(-c.turn * 0.48 + c.bank * 0.4, -0.75, 0.75);
  s.roll += (targetBank - s.roll) * Math.min(1, dt * 5);
  const cos = Math.cos(s.pitch);
  s.x += Math.sin(s.yaw) * cos * s.speed * dt;
  s.y += Math.sin(s.pitch) * s.speed * dt;
  s.z -= Math.cos(s.yaw) * cos * s.speed * dt;
  const floor = minimumFlightY(s.x, s.z);
  if (s.y < floor) {
    s.y = floor;
    s.pitch = Math.max(s.pitch, 0.10);
  }
  // No world hard-wall: the region is bounded narratively by sea and storms in future milestones.
}
