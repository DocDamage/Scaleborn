/**
 * The original hybrid rider is 1:1 scale in every Onyx form. Her hips are
 * approximately 0.66m above her own origin; the dragon's upper back is
 * approximately 0.63 times its visual scale above the dragon origin.
 *
 * Place the pelvis on the back, not the character's feet above it.
 */
export function mountedRiderSeat(scale: number): { y: number; z: number } {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error('Dragon mount scale must be finite and positive');
  }
  return {
    y: 0.63 * scale - 0.66 - 0.055,
    z: -0.23 * scale,
  };
}
