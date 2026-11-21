import * as THREE from 'three';
import { DragonVisual } from '../actors/dragon/visual';
import { newFlightState, stepFlight, requestDragonForm, toggleLanding, type InteractionResult } from '../actors/dragon/flight';
import { FORMS, FORM_ORDER, type DragonForm } from '../actors/dragon/forms';
import { assertManifestUnique } from '../data/assets';
import { FlightInput } from '../input/flightInput';
import { AzureCoast } from '../world/azureCoast';
import { heightAt } from '../world/terrain';
import { CoastDiscovery } from '../world/discoveries';

const FIXED_DT = 1 / 60;
const MAX_STEPS = 5;
type CameraMode = 'CHASE' | 'WIDE' | 'DRAGON EYE' | 'OVERHEAD' | 'ORBIT';
const cameraModes: readonly CameraMode[] = ['CHASE', 'WIDE', 'DRAGON EYE', 'OVERHEAD', 'ORBIT'];

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error('UI element not found: ' + selector);
  return element;
}

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly coast: AzureCoast;
  private readonly dragon = new DragonVisual();
  private readonly discoveries = new CoastDiscovery();
  private readonly waypointName = requireElement<HTMLElement>('#waypoint-name');
  private readonly waypointDistance = requireElement<HTMLElement>('#waypoint-distance');
  private readonly reveal = requireElement<HTMLElement>('#discovery-toast');
  private revealTimer = 0;
  private readonly flight = newFlightState();
  private readonly input: FlightInput;
  private readonly intro = requireElement<HTMLElement>('#welcome');
  private readonly diagnostics = requireElement<HTMLElement>('#diagnostics');
  private readonly speedText = requireElement<HTMLElement>('#speed');
  private readonly altitudeText = requireElement<HTMLElement>('#altitude');
  private readonly cameraText = requireElement<HTMLElement>('#camera-name');
  private readonly formName = requireElement<HTMLElement>('#form-name');
  private readonly modeName = requireElement<HTMLElement>('#mode-name');
  private readonly actionToast = requireElement<HTMLElement>('#action-toast');
  private actionTimer = 0;
  private lastTime = 0;
  private accumulator = 0;
  private cameraIndex = 0;
  private paused = true;
  private frames = 0;
  private fps = 0;
  private fpsAccum = 0;
  private hudAccum = 0;

  constructor(canvas: HTMLCanvasElement) {
    assertManifestUnique();
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.camera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.2, 6500);
    // A seeded, safe location for repeatable manual and browser landing QA.
    if (new URLSearchParams(window.location.search).get('start') === 'meadow') {
      this.flight.x = -555;
      this.flight.z = 100;
      this.flight.y = heightAt(-555, 100) + 18;
      this.flight.yaw = 0;
    }
    this.coast = new AzureCoast(this.scene);
    this.dragon.attach(this.scene);
    this.coast.update(this.flight.x, this.flight.z);
    this.dragon.update(this.flight);
    this.input = new FlightInput(canvas);
    // Dev-only deterministic simulation advance for slow software-WebGL QA.
    // Never expose this hook in a production bundle or ordinary gameplay URLs.
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('qa') === '1') {
      const host = window as Window & { __scalebornQaAdvance?: (frames: number) => void };
      host.__scalebornQaAdvance = (frames: number): void => {
        if (!Number.isInteger(frames) || frames < 1 || frames > 180) {
          throw new Error('QA frames must be an integer between 1 and 180');
        }
        const idle = { turn: 0, pitch: 0, bank: 0, boost: false, flap: false, move: 0 };
        for (let i = 0; i < frames; i++) stepFlight(this.flight, idle, FIXED_DT);
        this.accumulator = 0;
        this.dragon.update(this.flight);
        this.updateHud(0.2);
      };
    }
    document.querySelectorAll<HTMLButtonElement>('[data-form]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!this.paused) {
          const form = button.dataset.form as DragonForm;
          if (FORM_ORDER.includes(form)) this.setForm(form);
        }
      });
    });
    requireElement<HTMLButtonElement>('#land-button').addEventListener('click', () => {
      if (!this.paused) this.notify(toggleLanding(this.flight));
    });
    requireElement<HTMLButtonElement>('#start').addEventListener('click', () => this.begin(canvas));
    canvas.addEventListener('click', () => {
      if (!this.paused && !this.input.isLocked()) void canvas.requestPointerLock();
    });
    window.addEventListener('resize', () => this.resize());
    this.updateCamera(1, true);
    this.cameraText.textContent = cameraModes[this.cameraIndex] ?? 'CHASE';
  }

  private begin(canvas: HTMLCanvasElement): void {
    this.paused = false;
    this.intro.hidden = true;
    void canvas.requestPointerLock().catch(() => {
      // Keyboard flight remains available when pointer lock is refused.
    });
  }

  private resize(): void {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private notify(result: InteractionResult): void {
    this.actionToast.textContent = result.message;
    this.actionToast.dataset.kind = result.ok ? 'ok' : 'blocked';
    this.actionToast.hidden = false;
    this.actionTimer = 3.1;
  }

  private setForm(form: DragonForm): void {
    this.notify(requestDragonForm(this.flight, form));
  }

  private updateCamera(dt: number, instant = false): void {
    const state = this.flight;
    const forward = new THREE.Vector3(
      Math.sin(state.yaw) * Math.cos(state.pitch),
      Math.sin(state.pitch),
      -Math.cos(state.yaw) * Math.cos(state.pitch),
    );
    const root = new THREE.Vector3(state.x, state.y, state.z);
    const target = root.clone().addScaledVector(forward, 7);
    const mode = cameraModes[this.cameraIndex] ?? 'CHASE';
    const scale = FORMS[state.form].visualScale;
    const distance = state.form === 'small' ? 5.8 : state.form === 'giant' ? 37 : 17;
    const rise = state.form === 'small' ? 2.0 : state.form === 'giant' ? 14 : 6.8;
    let desired: THREE.Vector3;
    if (mode === 'WIDE') desired = root.clone().addScaledVector(forward, -distance * 1.9).add(new THREE.Vector3(0, rise * 1.6, 0));
    else if (mode === 'DRAGON EYE') desired = root.clone().addScaledVector(forward, 2.4 * scale).add(new THREE.Vector3(0, 0.52 * scale, 0));
    else if (mode === 'OVERHEAD') desired = root.clone().add(new THREE.Vector3(0, distance * 3.8, 0.1));
    else if (mode === 'ORBIT') {
      const angle = state.time * 0.22;
      desired = root.clone().add(new THREE.Vector3(Math.sin(angle) * distance * 1.5, rise * 1.9, Math.cos(angle) * distance * 1.5));
    } else desired = root.clone().addScaledVector(forward, -distance).add(new THREE.Vector3(0, rise, 0));
    // The camera should not cut into cliffs when following a grounded dragon.
    desired.y = Math.max(desired.y, heightAt(desired.x, desired.z) + 1.25);
    this.camera.up.set(0, 1, 0);
    const smoothing = instant ? 1 : 1 - Math.exp(-dt * 4.5);
    this.camera.position.lerp(desired, smoothing);
    this.camera.lookAt(mode === 'DRAGON EYE'
      ? target.clone().addScaledVector(forward, 80)
      : target);
  }

  private updateHud(dt: number): void {
    this.hudAccum += dt;
    if (this.hudAccum < 0.12) return;
    this.hudAccum = 0;
    const ground = Math.max(0, heightAt(this.flight.x, this.flight.z));
    this.altitudeText.textContent = this.flight.mode === 'ground' ? '0' : Math.round(Math.max(0, this.flight.y - ground)).toString();
    this.speedText.textContent = Math.round(Math.abs(this.flight.speed)).toString();
    this.formName.textContent = FORMS[this.flight.form].label.toUpperCase();
    this.modeName.textContent = this.flight.transition?.phase === 'landing' ? 'LANDING'
      : this.flight.transition?.phase === 'takingOff' ? 'TAKING OFF'
      : this.flight.mode === 'ground' ? 'ON LAND' : 'IN FLIGHT';
    document.querySelectorAll<HTMLButtonElement>('[data-form]').forEach((button) => {
      const selected = button.dataset.form === this.flight.form;
      button.setAttribute('aria-pressed', String(selected));
    });
    this.cameraText.textContent = cameraModes[this.cameraIndex] ?? 'CHASE';
    const target = this.discoveries.nearest(this.flight.x, this.flight.z);
    this.waypointName.textContent = target?.name ?? 'Coast fully charted';
    this.waypointDistance.textContent = target ? Math.round(target.meters) + ' m' : '4 of 4 discoveries';
    if (this.diagnostics.hidden) return;
    const render = this.renderer.info.render;
    this.diagnostics.textContent = [
      'SEED 0x5ca1e0',
      'FPS ' + this.fps,
      'XYZ ' + Math.round(this.flight.x) + ', ' + Math.round(this.flight.y) + ', ' + Math.round(this.flight.z),
      'DRAGON FORM ' + this.flight.form,
      'TRAVERSAL ' + (this.flight.transition?.phase ?? this.flight.mode),
      'TERRAIN TILES ' + this.coast.tileCount(),
      'DISCOVERED ' + this.discoveries.count() + '/4',
      'DRAWS ' + render.calls,
      'TRIANGLES ' + render.triangles,
      'WEBGL ' + this.renderer.capabilities.isWebGL2,
      'CURRENT GATE G2 EARLY',
    ].join('\n');
  }

  private frame = (now: number): void => {
    if (!this.lastTime) this.lastTime = now;
    const elapsed = Math.min(0.10, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.fpsAccum += elapsed;
    this.frames++;
    if (this.fpsAccum > 0.7) {
      this.fps = Math.round(this.frames / this.fpsAccum);
      this.fpsAccum = 0;
      this.frames = 0;
    }
    if (this.input.take('diagnostics')) this.diagnostics.hidden = !this.diagnostics.hidden;
    if (this.input.take('help')) {
      this.paused = !this.paused;
      this.intro.hidden = !this.paused;
      if (this.paused && document.pointerLockElement) void document.exitPointerLock();
    }
    if (this.input.take('camera')) this.cameraIndex = (this.cameraIndex + 1) % cameraModes.length;
    if (!this.paused) {
      if (this.input.take('land')) this.notify(toggleLanding(this.flight));
      for (const form of FORM_ORDER) {
        if (this.input.take(form)) this.setForm(form);
      }
    }
    this.actionTimer = Math.max(0, this.actionTimer - elapsed);
    if (this.actionTimer === 0) this.actionToast.hidden = true;
    if (!this.paused) {
      this.accumulator = Math.min(0.1, this.accumulator + elapsed);
      const controls = this.input.sample();
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
        stepFlight(this.flight, controls, FIXED_DT);
        this.accumulator -= FIXED_DT;
        steps++;
      }
      this.coast.update(this.flight.x, this.flight.z);
      const found = this.discoveries.update(this.flight.x, this.flight.z);
      if (found.length) {
        this.reveal.textContent = '✦  DISCOVERED  ·  ' + found.map((site) => site.name).join(', ');
        this.revealTimer = 4.2;
      }
      this.revealTimer = Math.max(0, this.revealTimer - elapsed);
      this.reveal.hidden = this.revealTimer === 0;
    } else this.accumulator = 0;
    this.coast.animate(this.flight.time, this.flight.x, this.flight.y, this.flight.z);
    this.dragon.update(this.flight);
    this.updateCamera(elapsed);
    this.renderer.render(this.scene, this.camera);
    this.updateHud(elapsed);
    requestAnimationFrame(this.frame);
  };

  start(): void {
    requestAnimationFrame(this.frame);
  }
}
