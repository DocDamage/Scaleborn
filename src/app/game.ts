import * as THREE from 'three';
import { DragonVisual } from '../actors/dragon/visual';
import { newFlightState, stepFlight } from '../actors/dragon/flight';
import { assertManifestUnique } from '../data/assets';
import { FlightInput } from '../input/flightInput';
import { AzureCoast } from '../world/azureCoast';
import { heightAt } from '../world/terrain';

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
  private readonly flight = newFlightState();
  private readonly input: FlightInput;
  private readonly intro = requireElement<HTMLElement>('#welcome');
  private readonly diagnostics = requireElement<HTMLElement>('#diagnostics');
  private readonly speedText = requireElement<HTMLElement>('#speed');
  private readonly altitudeText = requireElement<HTMLElement>('#altitude');
  private readonly cameraText = requireElement<HTMLElement>('#camera-name');
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
    this.coast = new AzureCoast(this.scene);
    this.scene.add(this.dragon.root);
    this.coast.update(this.flight.x, this.flight.z);
    this.dragon.update(this.flight);
    this.input = new FlightInput(canvas);
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
    let desired: THREE.Vector3;
    if (mode === 'WIDE') desired = root.clone().addScaledVector(forward, -40).add(new THREE.Vector3(0, 17, 0));
    else if (mode === 'DRAGON EYE') desired = root.clone().addScaledVector(forward, 2.4).add(new THREE.Vector3(0, 0.52, 0));
    else if (mode === 'OVERHEAD') desired = root.clone().add(new THREE.Vector3(0, 76, 0.1));
    else if (mode === 'ORBIT') {
      const angle = state.time * 0.22;
      desired = root.clone().add(new THREE.Vector3(Math.sin(angle) * 33, 16, Math.cos(angle) * 33));
    } else desired = root.clone().addScaledVector(forward, -21).add(new THREE.Vector3(0, 7.5, 0));
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
    this.altitudeText.textContent = Math.round(Math.max(0, this.flight.y - ground)).toString();
    this.speedText.textContent = Math.round(this.flight.speed).toString();
    this.cameraText.textContent = cameraModes[this.cameraIndex] ?? 'CHASE';
    if (this.diagnostics.hidden) return;
    const render = this.renderer.info.render;
    this.diagnostics.textContent = [
      'SEED 0x5ca1e0',
      'FPS ' + this.fps,
      'XYZ ' + Math.round(this.flight.x) + ', ' + Math.round(this.flight.y) + ', ' + Math.round(this.flight.z),
      'DRAWS ' + render.calls,
      'TRIANGLES ' + render.triangles,
      'WEBGL ' + this.renderer.capabilities.isWebGL2,
      'CURRENT GATE G0 / G1 PREVIEW',
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
      this.accumulator = Math.min(0.1, this.accumulator + elapsed);
      const controls = this.input.sample();
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
        stepFlight(this.flight, controls, FIXED_DT);
        this.accumulator -= FIXED_DT;
        steps++;
      }
      this.coast.update(this.flight.x, this.flight.z);
    } else this.accumulator = 0;
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
