/**
 * Anatomical offsets are sculpted into the SAME continuous Onyx torso/skull
 * loft, rather than placed as intersecting spheres. X/Y normal inputs describe
 * each cross-section; Z is in original unscaled dragon model metres.
 * Pure, deterministic data is reusable by future Blender/Unreal exporters.
 */
export type OnyxSurfaceRegion = 'plain' | 'torso' | 'skull';

const bell = (value: number, at: number, width: number): number => {
  const d = (value - at) / width;
  return Math.exp(-d * d * 2);
};

export interface OnyxSurfaceOffset { x: number; y: number }

export function onyxSurfaceOffset(
  region: OnyxSurfaceRegion, z: number, nx: number, ny: number,
): OnyxSurfaceOffset {
  if (region === 'plain') return { x: 0, y: 0 };
  if (![z, nx, ny].every(Number.isFinite)) {
    throw new Error('Onyx surface sampling requires finite coordinates');
  }
  const side = Math.sign(nx);
  const top = Math.max(0, ny);
  const underside = Math.max(0, -ny);
  if (region === 'torso') {
    // The scapular / deltoid swell lies over the actual animated foreleg
    // socket. The central chest keel and raised trapezius share its skin.
    const shoulder = bell(z, -0.94, .47);
    const neck = bell(z, -1.23, .56);
    const chest = bell(z, -.57, .63);
    const hip = bell(z, 1.03, .44);
    return {
      x: side * (
        .105 * shoulder * Math.pow(Math.abs(nx), 3) * (.65 + .35 * top)
        + .047 * hip * Math.pow(Math.abs(nx), 4)
      ),
      y: .073 * neck * Math.pow(top, 4)
        - .095 * chest * Math.pow(underside, 4)
        + .018 * shoulder * top,
    };
  }
  // Dragon cheek and supraorbital ridge, shallow eye sockets, and flattened
  // upper muzzle. Paired eye meshes can sit within their sockets, rather than
  // as globes pasted onto an unbroken oval skull.
  const cheek = bell(z, -.43, .37) * bell(ny, -.31, .44);
  const brow = bell(z, -.30, .38) * bell(ny, .53, .30);
  const orbit = bell(z, -.35, .24) * bell(ny, .32, .22);
  const muzzle = bell(z, -1.02, .36);
  return {
    x: side * (.076 * cheek + .065 * brow - .052 * orbit),
    y: .023 * brow * top - .044 * muzzle * Math.pow(top, 4)
      - .026 * bell(z, -.47, .43) * Math.pow(underside, 5),
  };
}
