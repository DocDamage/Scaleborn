/**
 * Renderer-only mount contact. Onyx's continuous torso at z = -0.23 has
 * approximately 0.70 model-metres of dorsal height, measured against the
 * actual sculpt; the former 0.63 height buried the pelvis and both knees.
 * The original heroine's pelvis remains 0.66 m above her unscaled origin.
 *
 * A modest 95 mm soft-tissue clearance puts the seat/coat in contact with
 * the upper back without driving the child's thighs through the surface.
 * Neither actor physics nor collision geometry uses these offsets.
 */
export const ONYX_SADDLE_DORSAL_Y = 0.70;
export const RIDER_PELVIS_Y = 0.66;
export const SADDLE_CONTACT_CLEARANCE = 0.095;

export function mountedRiderSeat(scale: number): { y: number; z: number } {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error('Dragon mount scale must be finite and positive');
  }
  return {
    y: ONYX_SADDLE_DORSAL_Y * scale
      + SADDLE_CONTACT_CLEARANCE - RIDER_PELVIS_Y,
    z: -0.23 * scale,
  };
}
