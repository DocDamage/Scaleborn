/** Portable, meter-based creature forms. Rendering scale and physical rules remain separate. */
export type DragonForm = 'small' | 'rideable' | 'giant';
export type DragonMode = 'air' | 'ground';

export interface FormSpec {
  id: DragonForm;
  label: string;
  /** Model-scale multiplier. The original procedural dragon is ~7 m long. */
  visualScale: number;
  /** Conservative wing/shoulder collision radius, in meters. */
  radius: number;
  /** Vertical offset from feet to body pivot when standing. */
  standHeight: number;
  cruise: number;
  surge: number;
  turnRate: number;
  groundSpeed: number;
  bankLimit: number;
}

export const FORMS: Readonly<Record<DragonForm, Readonly<FormSpec>>> = {
  small: {
    id: 'small', label: 'Small companion', visualScale: 0.12,
    radius: 0.65, standHeight: 0.17, cruise: 23, surge: 43,
    turnRate: 1.25, groundSpeed: 7.0, bankLimit: 0.65,
  },
  rideable: {
    id: 'rideable', label: 'Rideable', visualScale: 0.65,
    radius: 3.3, standHeight: 0.85, cruise: 55, surge: 112,
    turnRate: 0.76, groundSpeed: 9.0, bankLimit: 0.72,
  },
  giant: {
    id: 'giant', label: 'Giant', visualScale: 1.72,
    radius: 8.6, standHeight: 2.24, cruise: 70, surge: 130,
    turnRate: 0.40, groundSpeed: 7.0, bankLimit: 0.49,
  },
};

export const FORM_ORDER: readonly DragonForm[] = ['small', 'rideable', 'giant'];
export const FORM_LENGTHS_METERS: Readonly<Record<DragonForm, number>> = {
  small: 0.84,
  rideable: 4.55,
  giant: 12.04,
};

export function describeForm(form: DragonForm): string {
  return FORMS[form].label + ' · ' + FORM_LENGTHS_METERS[form].toFixed(1) + ' m';
}
