import type { FlightControls } from '../actors/dragon/flight';

const binding = {
  turnLeft: 'KeyA',
  turnRight: 'KeyD',
  climb: 'KeyW',
  dive: 'KeyS',
  bankLeft: 'KeyQ',
  bankRight: 'KeyE',
  boost: 'ShiftLeft',
  flap: 'Space',
  camera: 'KeyV',
  help: 'KeyH',
  diagnostics: 'F3',
} as const;

export type FlightAction = keyof typeof binding;

/** Action layer. Future save-backed rebinding will replace defaults without touching flight math. */
export class FlightInput {
  private pressed = new Set<string>();
  private toggles = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private locked = false;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (event) => {
      if (Object.values(binding).includes(event.code as (typeof binding)[FlightAction])) {
        event.preventDefault();
        this.pressed.add(event.code);
        if (!event.repeat) this.toggles.add(event.code);
      }
    });
    window.addEventListener('keyup', (event) => this.pressed.delete(event.code));
    window.addEventListener('blur', () => this.pressed.clear());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { this.mouseX = 0; this.mouseY = 0; }
    });
    document.addEventListener('mousemove', (event) => {
      if (!this.locked) return;
      this.mouseX += event.movementX;
      this.mouseY += event.movementY;
    });
  }

  isLocked(): boolean { return this.locked; }

  sample(): FlightControls {
    const has = (action: FlightAction): number => Number(this.pressed.has(binding[action]));
    const turn = has('turnRight') - has('turnLeft') + this.mouseX * 0.019;
    const pitch = has('climb') - has('dive') - this.mouseY * 0.016;
    this.mouseX = 0;
    this.mouseY = 0;
    return {
      turn: Math.max(-1, Math.min(1, turn)),
      pitch: Math.max(-1, Math.min(1, pitch)),
      bank: has('bankRight') - has('bankLeft'),
      boost: has('boost'),
      flap: has('flap'),
    };
  }

  take(action: 'camera' | 'help' | 'diagnostics'): boolean {
    const code = binding[action];
    const found = this.toggles.has(code);
    this.toggles.delete(code);
    return found;
  }
}
