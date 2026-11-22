import { describe, expect, it } from 'vitest';
import { newFlightState, type FlightState } from '../src/actors/dragon/flight';
import { FORMS } from '../src/actors/dragon/forms';
import { heightAt } from '../src/world/terrain';
import {
  GLOAM_SPAWNS, castDragonFire, castRiderSigil, castBondSurge, combatNearby, combatRemaining,
  newCombatState, stepCombat,
} from '../src/combat/combat';

function groundDragon(x = -446, z = -52): FlightState {
  const s = newFlightState();
  s.x = x; s.z = z; s.y = heightAt(x, z) + FORMS.rideable.standHeight;
  s.yaw = Math.PI / 2; s.pitch = 0; s.roll = 0;
  s.speed = 0; s.mode = 'ground'; s.form = 'rideable';
  return s;
}
function targetAhead(c: ReturnType<typeof newCombatState>, s: FlightState, meters = 14): void {
  const target = c.hounds[0]!;
  target.x = s.x + meters; target.z = s.z;
  target.y = heightAt(target.x, target.z);
  // Keep the test concerned with aim and hit registration, not hill occlusion.
  target.y = Math.max(target.y, s.y - 0.35);
}
const step = (c: ReturnType<typeof newCombatState>, s: FlightState, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    s.time += 1 / 60;
    stepCombat(c, s, 1 / 60);
  }
};

describe('G4 deterministic encounter and dragon breath', () => {
  it('spawns the same world-aligned hounds with stable identities', () => {
    const a = newCombatState(), b = newCombatState();
    expect(a).toEqual(b);
    expect(a.hounds.map((h) => h.id)).toEqual(GLOAM_SPAWNS.map((h) => h.id));
    expect(new Set(a.hounds.map((h) => h.id)).size).toBe(a.hounds.length);
    for (const h of a.hounds) {
      expect(h.y).toBeCloseTo(heightAt(h.x, h.z), 5);
      expect(h.hp).toBeGreaterThan(0);
    }
  });

  it('deals damage through a forward fire cone, not behind or beyond range', () => {
    const s = groundDragon(), c = newCombatState();
    targetAhead(c, s, 13);
    const front = c.hounds[0]!;
    const behind = c.hounds[1]!;
    behind.x = s.x - 12; behind.z = s.z; behind.y = s.y;
    const far = c.hounds[2]!;
    far.x = s.x + 91; far.z = s.z; far.y = s.y;
    expect(castDragonFire(c, s).ok).toBe(true);
    expect(front.hp).toBeLessThan(front.maxHp);
    expect(behind.hp).toBe(behind.maxHp);
    expect(far.hp).toBe(far.maxHp);
    expect(c.lastFire?.direction.x).toBeCloseTo(1, 5);
    expect(c.ember).toBe(78);
  });

  it('misses an enemy outside the cone instead of applying auto-target damage', () => {
    const s = groundDragon(), c = newCombatState();
    const victim = c.hounds[0]!;
    victim.x = s.x + 16; victim.z = s.z + 28; victim.y = s.y;
    const before = victim.hp;
    castDragonFire(c, s);
    expect(victim.hp).toBe(before);
  });

  it('enforces cooldown, ember cost and regenerative resource', () => {
    const s = groundDragon(), c = newCombatState();
    expect(castDragonFire(c, s).ok).toBe(true);
    expect(castDragonFire(c, s).ok).toBe(false);
    expect(c.fireSequence).toBe(1);
    s.time = 0.9;
    expect(castDragonFire(c, s).ok).toBe(true);
    expect(c.ember).toBe(56);
    step(c, s, 2);
    expect(c.ember).toBeCloseTo(86, 4);
    expect(c.ember).toBeLessThanOrEqual(c.maxEmber);
    c.ember = 1; s.time += 1;
    expect(castDragonFire(c, s).ok).toBe(false);
    expect(c.ember).toBe(1);
  });

  it('rejects rider firing, submerged firing and traversal attack exploits', () => {
    const s = groundDragon(), c = newCombatState();
    s.controlTarget = 'rider';
    expect(castDragonFire(c, s).ok).toBe(false);
    s.controlTarget = 'dragon'; s.mode = 'underwater';
    expect(castDragonFire(c, s).ok).toBe(false);
    s.mode = 'surface';
    expect(castDragonFire(c, s).ok).toBe(false);
    s.mode = 'ground';
    s.transition = { phase: 'landing', elapsed: 0, duration: 1.45,
      startY: s.y, targetY: s.y, startSpeed: 0, targetSpeed: 0,
      startPitch: 0, targetPitch: 0, startRoll: 0 };
    expect(castDragonFire(c, s).ok).toBe(false);
    expect(c.fireSequence).toBe(0);
    expect(c.ember).toBe(100);
  });

  it('leaves hounds inert at flight altitude and pursues a grounded nearby target', () => {
    const s = groundDragon(), c = newCombatState();
    const first = c.hounds[0]!;
    s.x = first.x - 11; s.z = first.z;
    s.mode = 'air'; s.y = first.y + 38;
    step(c, s, 1.2);
    expect(first.alert).toBe(false);
    expect(first.x).toBeCloseTo(first.homeX, 5);
    s.mode = 'ground'; s.y = heightAt(s.x, s.z) + FORMS.rideable.standHeight;
    step(c, s, 1.2);
    expect(first.alert).toBe(true);
    expect(first.x).toBeLessThan(first.homeX);
  });

  it('telegraphs melee, enforces damage immunity and cannot hit underwater', () => {
    const s = groundDragon(), c = newCombatState();
    s.x = c.hounds[0]!.x - 1; s.z = c.hounds[0]!.z;
    s.y = heightAt(s.x, s.z) + FORMS.rideable.standHeight;
    const h = c.hounds[0]!;
    h.windup = 0.64;
    c.invulnerableUntil = 3;
    step(c, s, 0.8);
    expect(c.hp).toBe(100);
    c.invulnerableUntil = 0;
    h.attackCooldown = 0;
    step(c, s, 1.0);
    expect(c.hp).toBeLessThan(100);
    const remainingHp = c.hp;
    s.mode = 'underwater'; s.y = h.y - 12;
    step(c, s, 3);
    expect(c.hp).toBe(remainingHp);
  });

  it('supports lethal hits, nonpunishing respawn and persistent enemy defeats', () => {
    const s = groundDragon(), c = newCombatState();
    c.hounds[1]!.hp = 0;
    c.hounds[1]!.deathAge = 1;
    c.hp = 11;
    const first = c.hounds[0]!;
    s.x = first.x - 1; s.z = first.z;
    s.y = heightAt(s.x, s.z) + FORMS.rideable.standHeight;
    first.windup = 0.01;
    step(c, s, 0.08);
    expect(c.respawns).toBe(1);
    expect(c.hp).toBe(c.maxHp);
    expect(c.hounds[1]!.hp).toBe(0);
    expect(s.controlTarget).toBe('dragon');
    expect(s.y).toBeCloseTo(heightAt(-555, 100) + 18, 5);
    expect(c.notice?.kind).toBe('respawn');
    expect(c.invulnerableUntil).toBeGreaterThan(s.time);
  });

  it('reports actual encounter proximity and living threats, not a permanent HUD', () => {
    const s = groundDragon(), c = newCombatState();
    expect(combatNearby(c, s)).toBe(true);
    expect(combatRemaining(c)).toBe(3);
    c.hounds.forEach((h) => { h.hp = 0; });
    expect(combatRemaining(c)).toBe(0);
    expect(combatNearby(c, s)).toBe(false);
    s.x = 1550; s.z = 1440;
    expect(combatNearby(newCombatState(), s)).toBe(false);
  });

  it('rejects invalid delta without mutating simulation state', () => {
    const s = groundDragon(), c = newCombatState();
    const before = structuredClone(c);
    stepCombat(c, s, NaN);
    stepCombat(c, s, -1);
    stepCombat(c, s, 0.3);
    expect(c).toEqual(before);
  });
  it('lets the unmounted rider cast a focused directional tidal sigil', () => {
    const s = groundDragon(), c = newCombatState();
    s.form = 'small';
    s.controlTarget = 'rider';
    s.riderX = s.x; s.riderZ = s.z;
    s.riderY = heightAt(s.riderX, s.riderZ) + 0.05;
    s.riderYaw = Math.PI / 2;
    s.riderMode = 'ground';
    targetAhead(c, s, 13);
    const foe = c.hounds[0]!;
    const result = castRiderSigil(c, s);
    expect(result.ok).toBe(true);
    expect(foe.hp).toBeLessThan(foe.maxHp);
    expect(c.focus).toBe(77);
    expect(c.ember).toBe(100);
    expect(c.lastSigil?.direction.x).toBeCloseTo(1, 5);
    expect(castRiderSigil(c, s).ok).toBe(false);
    s.time = 0.8;
    expect(castRiderSigil(c, s).ok).toBe(true);
    expect(c.sigilSequence).toBe(2);
  });

  it('requires a real grounded dragon/rider pairing to spend both bond resources', () => {
    const s = groundDragon(), c = newCombatState();
    expect(castBondSurge(c, s).ok).toBe(false); // Still mounted.
    s.form = 'small'; s.y = heightAt(s.x, s.z) + FORMS.small.standHeight;
    s.riderMode = 'ground'; s.riderX = s.x + 2; s.riderZ = s.z;
    s.riderY = heightAt(s.riderX, s.riderZ) + 0.05;
    const h = c.hounds[0]!;
    h.x = s.x + 9; h.z = s.z; h.y = heightAt(h.x, h.z);
    const result = castBondSurge(c, s);
    expect(result.ok).toBe(true);
    expect(h.hp).toBeLessThan(h.maxHp);
    expect(c.ember).toBe(68);
    expect(c.focus).toBe(68);
    expect(c.lastBond?.radius).toBe(15);
    expect(castBondSurge(c, s).ok).toBe(false);
    s.time = 7;
    s.riderX += 30;
    expect(castBondSurge(c, s).ok).toBe(false);
    s.riderX = s.x + 2;
    c.focus = 2;
    expect(castBondSurge(c, s).ok).toBe(false);
    expect(c.bondSequence).toBe(1);
  });

  it('recovers independent rider focus while preserving the Ember budget', () => {
    const c = newCombatState(), s = groundDragon();
    c.ember = 10; c.focus = 25;
    step(c, s, 2);
    expect(c.ember).toBeCloseTo(40, 4);
    expect(c.focus).toBeCloseTo(51, 4);
    s.controlTarget = 'dragon';
    expect(castRiderSigil(c, s).ok).toBe(false);
    expect(c.focus).toBeCloseTo(51, 4);
  });

});
