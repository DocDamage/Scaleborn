import type { FlightState, InteractionResult } from '../actors/dragon/flight';
import type { DragonForm } from '../actors/dragon/forms';
import { FORMS } from '../actors/dragon/forms';
import { canStand } from '../world/collision';
import { heightAt } from '../world/terrain';

const clamp = (n: number, low: number, high: number): number => Math.max(low, Math.min(high, n));
export const COMBAT_DEN = { x: -410, z: -45 } as const;
/** Identical coordinates on each run. Enemies stay away from the Tidegate runestones. */
export const GLOAM_SPAWNS = [
  { id: 'enemy.azure.gloam.01', x: -410, z: -55 },
  { id: 'enemy.azure.gloam.02', x: -393, z: -35 },
  { id: 'enemy.azure.gloam.03', x: -428, z: -30 },
] as const;

export interface GloamHound {
  id: string;
  x: number; y: number; z: number;
  homeX: number; homeZ: number;
  yaw: number;
  hp: number; maxHp: number;
  alert: boolean;
  windup: number;
  attackCooldown: number;
  stagger: number;
  flash: number;
  deathAge: number;
}
export interface FireCast {
  id: number;
  origin: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  range: number;
  form: DragonForm;
}
export interface SigilCast {
  id: number;
  origin: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  range: number;
}
export interface BondCast {
  id: number; x: number; y: number; z: number; radius: number;
}
export interface CombatNotice {
  sequence: number;
  kind: 'hurt' | 'kill' | 'respawn';
  message: string;
}
export interface CombatState {
  hp: number;
  maxHp: number;
  ember: number;
  maxEmber: number;
  fireReadyAt: number;
  focus: number;
  maxFocus: number;
  sigilReadyAt: number;
  bondReadyAt: number;
  sigilSequence: number;
  lastSigil: SigilCast | null;
  bondSequence: number;
  lastBond: BondCast | null;
  invulnerableUntil: number;
  fireSequence: number;
  lastFire: FireCast | null;
  noticeSequence: number;
  notice: CombatNotice | null;
  respawns: number;
  hounds: GloamHound[];
}

const FIRE: Record<DragonForm, { range: number; damage: number; cost: number; width: number }> = {
  small: { range: 17, damage: 24, cost: 19, width: 0.17 },
  rideable: { range: 42, damage: 38, cost: 22, width: 0.17 },
  giant: { range: 66, damage: 56, cost: 30, width: 0.20 },
};
const HOUND_HP = 75;
const AGGRO_RANGE = 68;
const LEASH_RANGE = 88;
const ATTACK_REACH = 3.35;
const ATTACK_DAMAGE = 12;

export function newCombatState(): CombatState {
  return {
    hp: 100, maxHp: 100, ember: 100, maxEmber: 100,
    fireReadyAt: 0, invulnerableUntil: 0,
    focus: 100, maxFocus: 100, sigilReadyAt: 0, bondReadyAt: 0,
    sigilSequence: 0, lastSigil: null, bondSequence: 0, lastBond: null,
    fireSequence: 0, lastFire: null, noticeSequence: 0, notice: null,
    respawns: 0,
    hounds: GLOAM_SPAWNS.map((spawn, index) => ({
      id: spawn.id, x: spawn.x, z: spawn.z, y: heightAt(spawn.x, spawn.z),
      homeX: spawn.x, homeZ: spawn.z, yaw: index * 1.6,
      hp: HOUND_HP, maxHp: HOUND_HP, alert: false,
      windup: 0, attackCooldown: 0, stagger: 0, flash: 0, deathAge: 0,
    })),
  };
}

function notice(c: CombatState, kind: CombatNotice['kind'], message: string): void {
  c.noticeSequence++;
  c.notice = { sequence: c.noticeSequence, kind, message };
}

function actorPosition(s: FlightState): { x: number; y: number; z: number } {
  return s.controlTarget === 'rider'
    ? { x: s.riderX, y: s.riderY + 0.9, z: s.riderZ }
    : { x: s.x, y: s.y, z: s.z };
}

/** Check the physical terrain along the breath, not the renderer's visual polygons. */
function fireLineClear(
  origin: FireCast['origin'], target: { x: number; y: number; z: number },
): boolean {
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    const x = origin.x + (target.x - origin.x) * t;
    const z = origin.z + (target.z - origin.z) * t;
    const y = origin.y + (target.y - origin.y) * t;
    if (heightAt(x, z) > y - 0.65) return false;
  }
  return true;
}

/** R / primary click: one directional, terrain-occluded fire cone, not an auto-hit. */
export function castDragonFire(c: CombatState, s: FlightState): InteractionResult {
  if (s.controlTarget !== 'dragon') return { ok: false, message: 'Switch to Onyx to breathe fire.' };
  if (s.transition) return { ok: false, message: 'Complete the traversal maneuver first.' };
  if (s.mode === 'underwater' || s.mode === 'surface') {
    return { ok: false, message: 'Fire cannot ignite beneath the water.' };
  }
  if (s.time < c.fireReadyAt) return { ok: false, message: 'Onyx is gathering breath.' };
  const spec = FIRE[s.form];
  if (c.ember < spec.cost) return { ok: false, message: 'Embers need time to recover.' };

  c.ember = Math.max(0, c.ember - spec.cost);
  c.fireReadyAt = s.time + 0.78;
  const scale = FORMS[s.form].visualScale;
  const cos = Math.cos(s.pitch);
  const direction = {
    x: Math.sin(s.yaw) * cos, y: Math.sin(s.pitch), z: -Math.cos(s.yaw) * cos,
  };
  const muzzle = 2.05 * scale;
  const origin = {
    x: s.x + direction.x * muzzle,
    y: s.y + 0.25 * scale + direction.y * muzzle,
    z: s.z + direction.z * muzzle,
  };
  c.lastFire = { id: ++c.fireSequence, origin, direction, range: spec.range, form: s.form };

  let landed = 0;
  for (const hound of c.hounds) {
    if (hound.hp <= 0) continue;
    const target = { x: hound.x, y: hound.y + 1.25, z: hound.z };
    const dx = target.x - origin.x, dy = target.y - origin.y, dz = target.z - origin.z;
    const projected = dx * direction.x + dy * direction.y + dz * direction.z;
    if (projected < 0 || projected > spec.range) continue;
    const radial = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - projected * projected));
    if (radial > 1.05 + projected * spec.width) continue;
    if (!fireLineClear(origin, target)) continue;
    const damage = Math.max(1, Math.round(spec.damage * (1 - projected / spec.range * 0.16)));
    hound.hp = Math.max(0, hound.hp - damage);
    hound.flash = 0.24;
    hound.stagger = 0.68;
    hound.windup = 0;
    hound.alert = true;
    landed++;
    if (hound.hp === 0) {
      hound.deathAge = 0;
      notice(c, 'kill', 'Gloam hound banished.');
    }
  }
  if (c.hounds.every((hound) => hound.hp === 0)) {
    notice(c, 'kill', 'The Gloam Den falls silent.');
  }
  return { ok: true, message: landed > 0 ? 'Flame struck ' + landed + ' enemy.' : 'Onyx breathes fire.' };
}

/** Rider's focused tide sigil uses her own heading and reserve, not dragon Ember. */
export function castRiderSigil(c: CombatState, s: FlightState): InteractionResult {
  if (s.controlTarget !== 'rider' || s.form !== 'small') {
    return { ok: false, message: 'Switch to the dismounted rider to cast a sigil.' };
  }
  if (s.transition) return { ok: false, message: 'Finish the dragon maneuver first.' };
  if (s.time < c.sigilReadyAt) return { ok: false, message: 'The sigil is still resonating.' };
  if (c.focus < 23) return { ok: false, message: 'Rider focus must recover.' };

  c.focus -= 23;
  c.sigilReadyAt = s.time + 0.67;
  const direction = { x: Math.sin(s.riderYaw), y: 0, z: -Math.cos(s.riderYaw) };
  const origin = {
    x: s.riderX + direction.x * 0.4,
    y: s.riderY + 1.28,
    z: s.riderZ + direction.z * 0.4,
  };
  c.lastSigil = { id: ++c.sigilSequence, origin, direction, range: 29 };
  let hits = 0;
  for (const h of c.hounds) {
    if (h.hp <= 0) continue;
    const target = { x: h.x, y: h.y + 1.2, z: h.z };
    const dx = target.x - origin.x, dy = target.y - origin.y, dz = target.z - origin.z;
    const projected = dx * direction.x + dy * direction.y + dz * direction.z;
    if (projected < 0 || projected > 29) continue;
    const radial = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - projected * projected));
    if (radial > 1.1 + projected * 0.065 || !fireLineClear(origin, target)) continue;
    h.hp = Math.max(0, h.hp - 31);
    h.flash = 0.28; h.stagger = 0.53; h.windup = 0; h.alert = true;
    hits++;
    if (h.hp === 0) {
      h.deathAge = 0;
      notice(c, 'kill', 'Gloam hound dispelled by the rider.');
    }
  }
  if (hits && c.hounds.every((h) => h.hp === 0)) {
    notice(c, 'kill', 'The Gloam Den falls silent.');
  }
  return { ok: true, message: hits ? 'Tidal sigil struck ' + hits + ' enemy.' : 'The sigil flies forward.' };
}

/** X: both companions must cooperate on dry land for a close-range bond surge. */
export function castBondSurge(c: CombatState, s: FlightState): InteractionResult {
  if (s.form !== 'small' || s.mode !== 'ground' || s.riderMode !== 'ground' ||
      s.transition || Math.hypot(s.x - s.riderX, s.z - s.riderZ) > 8) {
    return { ok: false, message: 'Bring the small dragon and rider together on land.' };
  }
  if (s.time < c.bondReadyAt) return { ok: false, message: 'The bond surge is recharging.' };
  if (c.ember < 32 || c.focus < 32) {
    return { ok: false, message: 'Both Ember and rider focus are needed.' };
  }
  c.ember -= 32;
  c.focus -= 32;
  c.bondReadyAt = s.time + 6.5;
  const x = (s.x + s.riderX) * 0.5, z = (s.z + s.riderZ) * 0.5;
  const y = Math.max(s.y, s.riderY) + 1.35;
  const radius = 15;
  c.lastBond = { id: ++c.bondSequence, x, y, z, radius };
  let hits = 0;
  for (const h of c.hounds) {
    if (h.hp <= 0 || Math.hypot(h.x - x, h.z - z) > radius ||
        Math.abs(h.y + 1.2 - y) > 5) continue;
    if (!fireLineClear({ x, y, z }, { x: h.x, y: h.y + 1.2, z: h.z })) continue;
    h.hp = Math.max(0, h.hp - 53);
    h.flash = 0.4; h.stagger = 1.0; h.windup = 0; h.alert = true;
    hits++;
    if (h.hp === 0) {
      h.deathAge = 0;
      notice(c, 'kill', 'Gloam hound scattered by the bond.');
    }
  }
  if (hits && c.hounds.every((h) => h.hp === 0)) {
    notice(c, 'kill', 'The Gloam Den falls silent.');
  }
  return { ok: true, message: hits ? 'Bond surge struck ' + hits + ' enemy.' : 'The bond surge blossoms.' };
}

function moveHound(h: GloamHound, targetX: number, targetZ: number, speed: number, dt: number): void {
  const dx = targetX - h.x, dz = targetZ - h.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.01) return;
  const step = Math.min(distance, speed * dt);
  const nx = h.x + dx / distance * step;
  const nz = h.z + dz / distance * step;
  if (!canStand(nx, nz, 'small').ok) return;
  h.x = nx; h.z = nz; h.y = heightAt(nx, nz);
  h.yaw = Math.atan2(dx, -dz);
}

function respawnAtMeadow(c: CombatState, s: FlightState): void {
  // No lost quest progress, form unlocks or defeated encounters on defeat.
  const x = -555, z = 100;
  s.x = x; s.z = z; s.y = heightAt(x, z) + 18;
  s.yaw = Math.PI / 2; s.pitch = 0; s.roll = 0; s.speed = 0;
  s.form = 'rideable'; s.mode = 'air'; s.transition = null; s.controlTarget = 'dragon';
  s.riderX = x + 2; s.riderZ = z; s.riderY = heightAt(x + 2, z) + 0.05;
  s.riderYaw = s.yaw; s.riderSpeed = 0; s.riderMode = 'ground'; s.riderTargetY = s.riderY;
  c.hp = c.maxHp; c.ember = c.maxEmber; c.focus = c.maxFocus;
  c.invulnerableUntil = s.time + 2.5;
  c.fireReadyAt = s.time; c.sigilReadyAt = s.time; c.bondReadyAt = s.time;
  c.respawns++;
  for (const h of c.hounds) {
    h.x = h.homeX; h.z = h.homeZ; h.y = heightAt(h.x, h.z);
    h.alert = false; h.windup = 0; h.attackCooldown = 1.5;
  }
  notice(c, 'respawn', 'The bond rekindles at the meadow. No progress lost.');
}

/** Fixed-step hostile pursuit, telegraphed melee and forgiving bond recovery. */
export function stepCombat(c: CombatState, s: FlightState, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) return;
  c.ember = clamp(c.ember + dt * 15, 0, c.maxEmber);
  c.focus = clamp(c.focus + dt * 13, 0, c.maxFocus);
  const player = actorPosition(s);
  const vulnerable = s.controlTarget === 'rider'
    ? s.riderMode === 'ground'
    : s.mode === 'ground' || (s.mode === 'air' && !s.transition);
  for (const h of c.hounds) {
    h.flash = Math.max(0, h.flash - dt);
    h.stagger = Math.max(0, h.stagger - dt);
    h.attackCooldown = Math.max(0, h.attackCooldown - dt);
    if (h.hp <= 0) {
      h.deathAge = Math.min(1, h.deathAge + dt);
      h.alert = false;
      continue;
    }
    const distance = Math.hypot(player.x - h.x, player.z - h.z);
    const heightDiff = Math.abs(player.y - (h.y + 1.25));
    const tether = Math.hypot(h.x - h.homeX, h.z - h.homeZ);
    const close = vulnerable && heightDiff < 5.5 && distance < AGGRO_RANGE && tether < LEASH_RANGE;
    h.alert = close;
    if (!close) {
      h.windup = 0;
      if (tether > 0.3) moveHound(h, h.homeX, h.homeZ, 3.6, dt);
      continue;
    }
    if (h.stagger > 0) continue;
    if (h.windup > 0) {
      h.windup -= dt;
      if (h.windup <= 0) {
        h.windup = 0;
        h.attackCooldown = 1.65;
        const nowDistance = Math.hypot(player.x - h.x, player.z - h.z);
        if (nowDistance <= ATTACK_REACH + 0.55 && heightDiff < 3.2 &&
            s.time >= c.invulnerableUntil) {
          c.hp = Math.max(0, c.hp - ATTACK_DAMAGE);
          c.invulnerableUntil = s.time + 0.9;
          notice(c, 'hurt', 'The Gloam hound strikes the bond.');
          if (c.hp === 0) {
            respawnAtMeadow(c, s);
            return;
          }
        }
      }
      continue;
    }
    if (distance > ATTACK_REACH) {
      moveHound(h, player.x, player.z, 4.7, dt);
    } else if (h.attackCooldown <= 0) {
      h.windup = 0.64;
    }
  }
}

export function combatNearby(c: CombatState, s: FlightState): boolean {
  const p = actorPosition(s);
  return c.hounds.some((h) => h.hp > 0 &&
    Math.hypot(p.x - h.x, p.z - h.z) < 95 && Math.abs(p.y - h.y) < 48);
}
export function combatRemaining(c: CombatState): number {
  return c.hounds.filter((h) => h.hp > 0).length;
}
