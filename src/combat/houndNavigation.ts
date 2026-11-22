/** Renderer-neutral, bounded steering for agile ground threats. No per-frame path search. */
export interface GroundPoint { x: number; z: number }
export interface GroundStep extends GroundPoint {
  yaw: number;
  moved: boolean;
}
export type GroundClearance = (x: number, z: number) => boolean;

/**
 * Try forward motion and progressively wider left/right detours.
 * The stable side preference prevents identical pack members choosing the same
 * line when their direct path is blocked. Every segment is checked at midpoint
 * and endpoint to avoid passing through narrow collision proxies.
 *
 * This is local obstacle avoidance, not an A* navmesh or a guaranteed maze solver.
 */
export function steerGroundThreat(
  from: GroundPoint,
  toward: GroundPoint,
  speed: number,
  dt: number,
  canMove: GroundClearance,
  side: -1 | 1 = 1,
): GroundStep {
  const idle: GroundStep = { ...from, yaw: 0, moved: false };
  if (![from.x, from.z, toward.x, toward.z, speed, dt].every(Number.isFinite) ||
      dt <= 0 || dt > 0.1 || speed <= 0) return idle;
  const dx = toward.x - from.x, dz = toward.z - from.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.015) return idle;
  const length = Math.min(speed * dt, distance);
  const heading = Math.atan2(dz, dx);
  const angles = [0, side * Math.PI / 7, -side * Math.PI / 7,
    side * Math.PI / 3, -side * Math.PI / 3,
    side * Math.PI / 2, -side * Math.PI / 2,
    side * Math.PI * 0.72, -side * Math.PI * 0.72];

  for (const turn of angles) {
    const ux = Math.cos(heading + turn), uz = Math.sin(heading + turn);
    const nx = from.x + ux * length, nz = from.z + uz * length;
    if (canMove(from.x + ux * length * 0.5, from.z + uz * length * 0.5) &&
        canMove(nx, nz)) {
      return { x: nx, z: nz, yaw: Math.atan2(ux, -uz), moved: true };
    }
  }
  return idle;
}
