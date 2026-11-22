import * as THREE from 'three';
import { DragonVisual } from '../actors/dragon/visual';
import { newCombatState, castDragonFire, castRiderSigil, castMountedRiderSigil, castDragonClaw, castBondSurge, stepCombat, combatNearby, combatRemaining, restoreGloamVictory } from '../combat/combat';
import { CombatVisual } from '../combat/visuals';
import { newFlightState, stepFlight, requestDragonForm, toggleLanding, type InteractionResult } from '../actors/dragon/flight';
import { FORMS, FORM_ORDER, type DragonForm } from '../actors/dragon/forms';
import { assertManifestUnique } from '../data/assets';
import { FlightInput } from '../input/flightInput';
import { AzureCoast } from '../world/azureCoast';
import { heightAt } from '../world/terrain';
import { CoastDiscovery } from '../world/discoveries';
import { toggleDragonDive } from '../actors/dragon/swimming';
import { toggleRiderControl, toggleRiderDive } from '../actors/rider/movement';
import { LANDMARKS } from '../world/terrain';
import { GRAND_LAKE, MIRRORFALL, headwaterProfileAt, waterSurfaceAt } from '../world/highlandLake';
import { MIRRORFALL_IMPACT } from '../world/waterDynamics';
import { findLakebedReviewViewpoint } from '../world/lakebedReviewViewpoint';
import { AdaptiveResolution } from './adaptiveResolution';
import { QaFrameCaptureGate } from './qaFrameCaptureGate';
import { stageCharacterPortrait, poseCharacterPortraitCamera, type PortraitPose, type PortraitSubject } from './characterReviewCamera';
import { resolveCameraOcclusion } from './cameraOcclusion';
import { OBSTACLES } from '../world/collision';
import { TIDEGATE, newTidegateState, stepTidegate, interactTidegate, tidegateNearby, tidegateHint } from '../world/tidegate';
import {
  ECHO_SHRINE, newTidalEchoState, echoPhase, echoObjective,
  echoShrineNearby, interactEchoShrine, attuneEchoAtGate,
} from '../world/tidalEcho';
import {
  loadAzureProgress, saveAzureProgress, snapshotAzureProgress, type ProgressStorage,
} from '../data/azureProgress';

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
  private readonly quality: 'high' | 'low';
  private readonly resolution: AdaptiveResolution;
  private readonly qaRender: boolean;
  private readonly qaFrameCaptureGate = new QaFrameCaptureGate();
  private qaPortraitSubject: PortraitSubject | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly coast: AzureCoast;
  private readonly dragon = new DragonVisual();
  private readonly combat = newCombatState();
  private readonly combatVisual: CombatVisual;
  private combatNoticeSeen = 0;
  private readonly combatHud = requireElement<HTMLElement>('#combat-hud');
  private readonly combatHealth = requireElement<HTMLElement>('#combat-health-fill');
  private readonly combatEmber = requireElement<HTMLElement>('#combat-ember-fill');
  private readonly combatEnergyLabel = requireElement<HTMLElement>('#combat-energy-label');
  private readonly combatHealthBar = requireElement<HTMLElement>('#combat-health-bar');
  private readonly combatEmberBar = requireElement<HTMLElement>('#combat-ember-bar');
  private readonly combatThreats = requireElement<HTMLElement>('#combat-threats');
  private readonly discoveries = new CoastDiscovery();
  private readonly tidegate = newTidegateState();
  private readonly echo = newTidalEchoState();
  private readonly progressStorage: ProgressStorage | null;
  private saveAvailable = false;
  private gloamVictoryStored = false;
  private readonly echoTitle = requireElement<HTMLElement>('#echo-title');
  private readonly echoStage = requireElement<HTMLElement>('#echo-stage');
  private readonly echoPanel = requireElement<HTMLElement>('#echo-panel');
  private readonly echoHintText = requireElement<HTMLElement>('#echo-hint');
  private readonly echoDistance = requireElement<HTMLElement>('#echo-distance');
  private readonly echoSaveStatus = requireElement<HTMLElement>('#echo-save-status');
  private readonly echoAction = requireElement<HTMLButtonElement>('#echo-action');
  private readonly tidegatePanel = requireElement<HTMLElement>('#tidegate-panel');
  private readonly tidegateHintText = requireElement<HTMLElement>('#tidegate-hint');
  private readonly tidegateStatus = requireElement<HTMLElement>('#tidegate-status');
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
  private readonly focusName = requireElement<HTMLElement>('#focus-name');
  private readonly altLabel = requireElement<HTMLElement>('#altitude-label');
  private readonly waterTint = requireElement<HTMLElement>('#water-tint');
  private readonly actionToast = requireElement<HTMLElement>('#action-toast');
  private readonly menuButton = requireElement<HTMLButtonElement>('#menu-toggle');
  private readonly compass = requireElement<HTMLElement>('#compass-heading');
  private readonly app = requireElement<HTMLElement>('#app');
  private menuOpen = false;
  private actionTimer = 0;
  private lastTime = 0;
  private accumulator = 0;
  private cameraIndex = 0;
  private paused = true;
  private frames = 0;
  private fps = 0;
  private fpsAccum = 0;
  private hudAccum = 0;
  private lastQaRenderTime = Number.NEGATIVE_INFINITY;

  constructor(canvas: HTMLCanvasElement) {
    assertManifestUnique();
    // Low-quality rendering retains functionality, collision, water physics and
    // the same world seed; only GPU cost, vegetation density and shading change.
    const params=new URLSearchParams(window.location.search);
    this.quality = params.get('quality') === 'low' ? 'low' : 'high';
    this.qaRender=import.meta.env.DEV && params.get('qa')==='1';
    const requestedDpr=Math.min(window.devicePixelRatio||1,
      this.quality === 'low' ? 0.68 : 1.4);
    this.resolution=new AdaptiveResolution({
      min:Math.min(requestedDpr,this.quality === 'low' ? 0.48 : 0.72),
      max:requestedDpr,
      starting:requestedDpr,
    });
    let browserStorage: ProgressStorage | null = null;
    try { browserStorage = window.localStorage; } catch { /* Private mode may deny access. */ }
    this.progressStorage = browserStorage;
    this.saveAvailable = browserStorage !== null;
    const saved = loadAzureProgress(browserStorage);
    this.tidegate.solved = saved.tidegateSolved;
    this.echo.collected = saved.echo.collected;
    this.echo.attuned = saved.echo.attuned;
    this.discoveries.restore(saved.discovered);
    restoreGloamVictory(this.combat, saved.gloamCleared);
    this.gloamVictoryStored = saved.gloamCleared;
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.resolution.pixelRatio);
    this.renderer.shadowMap.enabled = this.quality === 'high';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.camera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.2, 6500);
    // A seeded, safe location for repeatable manual and browser landing QA.
    const start = new URLSearchParams(window.location.search).get('start');
    if (start === 'meadow') {
      this.flight.x = -555;
      this.flight.z = 100;
      this.flight.y = heightAt(-555, 100) + 18;
      this.flight.yaw = 0;
    } else if (start === 'combat') {
      // Repeatable ground-level combat without staging or fake enemy hits.
      this.flight.x = -446;
      this.flight.z = -52;
      this.flight.y = heightAt(-446, -52) + FORMS.rideable.standHeight;
      this.flight.yaw = Math.PI / 2;
      this.flight.pitch = 0;
      this.flight.roll = 0;
      this.flight.speed = 0;
      this.flight.mode = 'ground';
    } else if (start === 'water') {
      this.flight.x = 1900;
      this.flight.z = 1900;
      this.flight.y = 16;
      this.flight.yaw = 0.7;
      this.flight.speed = 0;
    } else if (start === 'lake' || start === 'mirrorfall') {
      this.flight.x = GRAND_LAKE.x + 78;
      this.flight.z = GRAND_LAKE.z + 76;
      this.flight.y = GRAND_LAKE.surfaceY + 77;
      this.flight.yaw = 1.31;
      this.flight.pitch = -0.07;
      this.flight.speed = 25;
    }
    this.coast = new AzureCoast(this.scene, this.quality);
    this.dragon.attach(this.scene);
    this.combatVisual = new CombatVisual(this.scene, this.combat);
    this.coast.update(this.flight.x, this.flight.z);
    this.dragon.update(this.flight);
    this.input = new FlightInput(canvas);
    // Dev-only deterministic simulation advance for slow software-WebGL QA.
    // Never expose this hook in a production bundle or ordinary gameplay URLs.
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('qa') === '1') {
      const host = window as Window & {
        __scalebornQaAdvance?: (frames: number) => void;
        __scalebornQaHoldNextFrame?: () => Promise<void>;
        __scalebornQaResumeFrames?: () => void;
        __scalebornQaCharacterPortrait?: (pose: PortraitPose) => void;
        __scalebornQaLand?: () => void;
        __scalebornQaLaunch?: () => void;
        __scalebornQaWater?: () => void;
        __scalebornQaDive?: () => void;
        __scalebornQaStageRiderRune?: () => void;
        __scalebornQaStageShrine?: () => void;
        __scalebornQaStageEchoReturn?: () => void;
        __scalebornQaLake?: () => void;
        __scalebornQaLakeDive?: () => void;
        __scalebornQaLakebed?: () => void;
        __scalebornQaHeadwaters?: () => void;
        __scalebornQaImpactDive?: () => void;
        __scalebornQaShore?: () => void;
        __scalebornQaForest?: () => void;
        __scalebornQaCombatSnapshot?: () => {
          hp: number; ember: number; focus: number; respawns: number;
          maxEmber: number; gloamCleared: boolean;
          fireSequence: number; sigilSequence: number; bondSequence: number;
          player: { x: number; y: number; z: number; yaw: number; form: DragonForm; mode: string };
          lastFire: { origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number } } | null;
          hounds: Array<{ id: string; x: number; y: number; z: number; hp: number; maxHp: number; alert: boolean; windup: number }>;
        };
        __scalebornQaStageCombat?: (mode: 'dragon' | 'rider' | 'bond' | 'melee') => void;
        __scalebornQaAdvanceCombat?: (frames: number) => void;
      };
      // Screenshot tests capture one fresh scene frame, then stop the CPU
      // renderer while Chromium copies its completed compositor surface.
      host.__scalebornQaHoldNextFrame = () => this.qaFrameCaptureGate.holdAfterNextFrame();
      host.__scalebornQaResumeFrames = () => this.qaFrameCaptureGate.resume();
      host.__scalebornQaCharacterPortrait = (pose: PortraitPose): void => {
        if (!['small','rideable','giant','rider'].includes(pose)) {
          throw new Error('Invalid character review pose');
        }
        this.qaPortraitSubject = stageCharacterPortrait(this.flight, pose, heightAt);
        this.coast.update(this.flight.x,this.flight.z);
        this.coast.setUnderwater(false);
        this.dragon.update(this.flight);
        this.updateCamera(1,true);
        this.coast.updateAtmosphere(this.flight.time,this.camera.position);
        this.updateHud(.2);
      };
      host.__scalebornQaLand = (): void => {
        // Stage and trigger atomically: no frame-rate-dependent input race.
        this.flight.x = -555;
        this.flight.z = 100;
        this.flight.y = heightAt(-555, 100) + 18;
        this.flight.speed = 0;
        this.flight.pitch = 0;
        this.flight.roll = 0;
        this.flight.mode = 'air';
        this.flight.transition = null;
        const result = toggleLanding(this.flight);
        if (!result.ok) throw new Error('Unable to stage landing: ' + result.message);
        this.updateHud(0.2);
      };
      host.__scalebornQaLaunch = (): void => {
        const result = toggleLanding(this.flight);
        if (!result.ok) throw new Error('Unable to launch: ' + result.message);
        this.updateHud(0.2);
      };
      host.__scalebornQaWater = (): void => {
        this.flight.x = 1900; this.flight.z = 1900;
        this.flight.y = 16; this.flight.yaw = 0.7;
        this.flight.pitch = 0; this.flight.roll = 0;
        this.flight.speed = 0;
        this.flight.mode = 'air';
        this.flight.form = 'rideable';
        this.flight.controlTarget = 'dragon';
        this.flight.transition = null;
        const result = toggleLanding(this.flight);
        if (!result.ok) throw new Error('Unable to stage water entry: ' + result.message);
        this.coast.update(this.flight.x, this.flight.z);
        this.updateHud(0.2);
      };
      host.__scalebornQaDive = (): void => {
        const result = toggleDragonDive(this.flight);
        if (!result.ok) throw new Error('Unable to dive: ' + result.message);
        this.updateHud(0.2);
      };
      host.__scalebornQaStageRiderRune = (): void => {
        if (this.flight.form !== 'small' || this.flight.controlTarget !== 'rider') {
          throw new Error('The rider must be independently controlled to stage the second rune');
        }
        this.flight.riderX = TIDEGATE.rider.x;
        this.flight.riderZ = TIDEGATE.rider.z;
        this.flight.riderY = heightAt(TIDEGATE.rider.x, TIDEGATE.rider.z) + 0.05;
        this.flight.riderTargetY = this.flight.riderY;
        this.updateHud(0.2);
      };
      host.__scalebornQaStageShrine = (): void => {
        if (!this.tidegate.solved) throw new Error('Tidegate must be awakened first.');
        // Stage at an actual interactable offset, looking toward the heart.
        // Snap only the QA camera after teleporting; ordinary travel remains smooth.
        this.flight.x = ECHO_SHRINE.x - 6.5;
        this.flight.z = ECHO_SHRINE.z;
        this.flight.y = ECHO_SHRINE.heartY;
        this.flight.yaw = Math.PI / 2;
        this.flight.waterTargetY = ECHO_SHRINE.heartY;
        this.flight.mode = 'underwater';
        this.flight.form = 'rideable';
        this.flight.controlTarget = 'dragon';
        this.flight.transition = null;
        this.flight.speed = 0;
        this.flight.pitch = 0;
        this.flight.roll = 0;
        this.cameraIndex = 0;
        this.coast.update(this.flight.x, this.flight.z);
        this.coast.setUnderwater(true);
        this.coast.updateEcho(echoPhase(this.echo, this.tidegate), this.flight.time);
        this.dragon.update(this.flight);
        this.updateCamera(1, true);
        this.updateHud(0.2);
      };
      host.__scalebornQaStageEchoReturn = (): void => {
        if (!this.echo.collected) throw new Error('The dragon has not collected the Echo.');
        this.flight.x = TIDEGATE.dragon.x;
        this.flight.z = TIDEGATE.dragon.z;
        this.flight.y = heightAt(this.flight.x, this.flight.z) + FORMS.small.standHeight;
        this.flight.yaw = 0;
        this.flight.pitch = 0;
        this.flight.roll = 0;
        this.flight.speed = 0;
        this.flight.form = 'small';
        this.flight.mode = 'ground';
        this.flight.transition = null;
        this.flight.controlTarget = 'rider';
        this.flight.riderX = TIDEGATE.rider.x;
        this.flight.riderZ = TIDEGATE.rider.z;
        this.flight.riderY = heightAt(this.flight.riderX, this.flight.riderZ) + 0.05;
        this.flight.riderTargetY = this.flight.riderY;
        this.flight.riderSpeed = 0;
        this.flight.riderMode = 'ground';
        this.coast.update(this.flight.x, this.flight.z);
        this.updateHud(0.2);
      };
      host.__scalebornQaShore = (): void => {
        // A distinct view of detailed shoreline material, vegetation and
        // natural lake contours; no reload or second WebGL context.
        this.flight.x = GRAND_LAKE.x + 258;
        this.flight.z = GRAND_LAKE.z + 320;
        this.flight.y = Math.max(heightAt(this.flight.x,this.flight.z)+14,
          GRAND_LAKE.surfaceY+19);
        this.flight.yaw = 0.51;
        this.flight.pitch = -0.08;
        this.flight.roll = 0;
        this.flight.speed = 0;
        this.flight.form = 'rideable';
        this.flight.mode = 'air';
        this.flight.controlTarget = 'dragon';
        this.flight.transition = null;
        this.cameraIndex = 0;
        this.coast.update(this.flight.x,this.flight.z);
        this.coast.setUnderwater(false);
        this.dragon.update(this.flight);
        this.updateCamera(1,true);
        this.updateHud(0.2);
      };
      host.__scalebornQaForest = (): void => {
        // Ground-level visual acceptance, staged next to a real seeded oak.
        // This uses an actual instanced tree from the world, not a test prop.
        // Expand visibility once for seed-stable oak selection; the next
        // actual gameplay frame restores camera-aware visibility filtering.
        this.coast.animate(this.flight.time, GRAND_LAKE.x, this.flight.y, GRAND_LAKE.z);
        const grove=this.scene.getObjectByName('vegetation.azure.pbr-tree-wood.0');
        if (!(grove instanceof THREE.InstancedMesh) || grove.count===0) {
          throw new Error('Oak forest not present in rendered scene');
        }
        const matrix=new THREE.Matrix4(), treePos=new THREE.Vector3();
        const chosen=new THREE.Vector3();
        let best=Number.POSITIVE_INFINITY;
        const targetX=GRAND_LAKE.x-GRAND_LAKE.radiusX*1.23;
        const targetZ=GRAND_LAKE.z+GRAND_LAKE.radiusZ*.16;
        for(let i=0;i<grove.count;i++){
          grove.getMatrixAt(i,matrix);
          treePos.setFromMatrixPosition(matrix);
          if(treePos.y<GRAND_LAKE.surfaceY+4 || treePos.y>181)continue;
          const distance=Math.hypot(treePos.x-targetX,treePos.z-targetZ);
          if(distance<best){best=distance;chosen.copy(treePos);}
        }
        if(!Number.isFinite(best))throw new Error('No accessible lakeside oak');
        const dx=chosen.x-GRAND_LAKE.x,dz=chosen.z-GRAND_LAKE.z;
        const length=Math.max(.01,Math.hypot(dx,dz));
        const viewX=chosen.x+dx/length*20;
        const viewZ=chosen.z+dz/length*20;
        const lookX=chosen.x-viewX,lookZ=chosen.z-viewZ;
        this.flight.x=viewX+2;
        this.flight.z=viewZ+2;
        this.flight.y=heightAt(this.flight.x,this.flight.z)+FORMS.small.standHeight;
        this.flight.yaw=Math.atan2(lookX,-lookZ);
        this.flight.pitch=0;
        this.flight.roll=0;
        this.flight.speed=0;
        this.flight.form='small';
        this.flight.mode='ground';
        this.flight.controlTarget='rider';
        this.flight.transition=null;
        this.flight.riderX=viewX;
        this.flight.riderZ=viewZ;
        this.flight.riderY=heightAt(viewX,viewZ)+.05;
        this.flight.riderTargetY=this.flight.riderY;
        this.flight.riderYaw=this.flight.yaw;
        this.flight.riderSpeed=0;
        this.flight.riderMode='ground';
        this.cameraIndex=0;
        this.coast.update(viewX,viewZ);
        this.coast.setUnderwater(false);
        this.dragon.update(this.flight);
        this.updateCamera(1,true);
        this.coast.updateAtmosphere(this.flight.time,this.camera.position);
        this.updateHud(.2);
      };
      host.__scalebornQaLake = (): void => {
        this.qaPortraitSubject = null;
        this.flight.x = GRAND_LAKE.x + 78;
        this.flight.z = GRAND_LAKE.z + 76;
        this.flight.y = GRAND_LAKE.surfaceY + 77;
        this.flight.yaw = 1.31;
        this.flight.pitch = -0.07;
        this.flight.roll = 0;
        this.flight.speed = 0;
        this.flight.form = 'rideable';
        this.flight.mode = 'air';
        this.flight.controlTarget = 'dragon';
        this.flight.transition = null;
        this.cameraIndex = 0;
        this.coast.update(this.flight.x, this.flight.z);
        this.coast.setUnderwater(false);
        this.dragon.update(this.flight);
        this.updateCamera(1, true);
        this.updateHud(0.2);
      };
      host.__scalebornQaLakeDive = (): void => {
        // Repeatable actual underwater camera inside the deep freshwater basin.
        const x = GRAND_LAKE.x + 42, z = GRAND_LAKE.z + 34;
        const y = GRAND_LAKE.surfaceY - 13;
        if (heightAt(x, z) > y - 15) throw new Error('Underwater QA site is too shallow');
        this.flight.x = x;
        this.flight.z = z;
        this.flight.y = y;
        this.flight.waterTargetY = y;
        this.flight.yaw = 1.31;
        this.flight.pitch = 0;
        this.flight.roll = 0;
        this.flight.speed = 0;
        this.flight.form = 'rideable';
        this.flight.mode = 'underwater';
        this.flight.controlTarget = 'dragon';
        this.flight.transition = null;
        this.cameraIndex = 0;
        this.coast.update(x, z);
        this.coast.setUnderwater(true);
        this.dragon.update(this.flight);
        this.updateCamera(1, true);
        this.coast.updateAtmosphere(this.flight.time, this.camera.position);
        this.updateHud(0.2);
      };
      host.__scalebornQaLakebed = (): void => {
        // A shallow bed-level camera is needed to verify that lake rocks,
        // vegetation, caustics and sediments actually render. The older
        // midwater capture could only show fog over the 148m-deep basin.
        const { x, z, eyeY } = findLakebedReviewViewpoint();
        this.flight.x=x;
        this.flight.z=z;
        this.flight.y=eyeY;
        this.flight.waterTargetY=this.flight.y;
        this.flight.yaw=-Math.PI/2;
        this.flight.pitch=-.16;
        this.flight.roll=0;
        this.flight.speed=0;
        this.flight.form='rideable';
        this.flight.mode='underwater';
        this.flight.controlTarget='dragon';
        this.flight.transition=null;
        this.cameraIndex=0;
        this.coast.update(x,z);
        this.coast.setUnderwater(true);
        this.dragon.update(this.flight);
        this.updateCamera(1,true);
        this.coast.updateAtmosphere(this.flight.time,this.camera.position);
        this.updateHud(.2);
      };
      host.__scalebornQaHeadwaters = (): void => {
        // The real rider-height creek camera sees water flowing into the
        // waterfall lip. Keep it opt-in so recurring CI does not render
        // another expensive software-WebGL screenshot every code commit.
        const x=MIRRORFALL.x+64;
        const channel=headwaterProfileAt(x,GRAND_LAKE.z);
        if(!channel)throw new Error('No visible feeder stream at QA site');
        const z=channel.centerZ+channel.halfWidth*1.18;
        const y=heightAt(x,z);
        if(waterSurfaceAt(x,z)!==0 || y<channel.surfaceY-1){
          throw new Error('Headwater QA rider must stand on the dry bank');
        }
        this.flight.x=x+2;
        this.flight.z=z+4;
        this.flight.y=heightAt(this.flight.x,this.flight.z)+FORMS.small.standHeight;
        this.flight.form='small';
        this.flight.mode='ground';
        this.flight.controlTarget='rider';
        this.flight.transition=null;
        this.flight.speed=0;
        this.flight.roll=0;
        this.flight.pitch=0;
        this.flight.riderX=x;
        this.flight.riderZ=z;
        this.flight.riderY=y+.05;
        this.flight.riderTargetY=this.flight.riderY;
        this.flight.riderMode='ground';
        this.flight.riderSpeed=0;
        this.flight.riderYaw=-Math.PI/2+.36;
        this.cameraIndex=1;
        this.coast.update(x,z);
        this.coast.setUnderwater(false);
        this.dragon.update(this.flight);
        this.updateCamera(1,true);
        this.coast.updateAtmosphere(this.flight.time,this.camera.position);
        this.updateHud(.2);
      };
      host.__scalebornQaImpactDive = (): void => {
        // Inspect the *real* below-surface waterfall entrainment bubbles,
        // wave underside and lakebed in the same gameplay WebGL scene.
        const x=MIRRORFALL_IMPACT.x-18;
        const z=MIRRORFALL_IMPACT.z+5;
        const water=waterSurfaceAt(x,z);
        const floor=heightAt(x,z);
        if(Math.abs(water-GRAND_LAKE.surfaceY)>.001 || water-floor<12){
          throw new Error('Plunge bubble QA camera is not safely underwater');
        }
        this.flight.x=x;
        this.flight.z=z;
        this.flight.y=water-8;
        this.flight.waterTargetY=this.flight.y;
        this.flight.yaw=Math.PI/2;
        this.flight.pitch=0;
        this.flight.roll=0;
        this.flight.speed=0;
        this.flight.form='rideable';
        this.flight.mode='underwater';
        this.flight.controlTarget='dragon';
        this.flight.transition=null;
        this.cameraIndex=0;
        this.coast.update(x,z);
        this.coast.setUnderwater(true);
        this.dragon.update(this.flight);
        this.updateCamera(1,true);
        this.coast.updateAtmosphere(this.flight.time,this.camera.position);
        this.updateHud(.2);
      };
      // Read-only combat diagnostics; no fake damage or enemy state changes.
      host.__scalebornQaCombatSnapshot = () => ({
        hp: this.combat.hp,
        maxEmber: this.combat.maxEmber,
        gloamCleared: this.combat.gloamCleared,
        ember: this.combat.ember,
        focus: this.combat.focus,
        respawns: this.combat.respawns,
        fireSequence: this.combat.fireSequence,
        player: { x: this.flight.x, y: this.flight.y, z: this.flight.z,
          yaw: this.flight.yaw, form: this.flight.form, mode: this.flight.mode },
        lastFire: this.combat.lastFire ? { origin: this.combat.lastFire.origin,
          direction: this.combat.lastFire.direction } : null,
        sigilSequence: this.combat.sigilSequence,
        bondSequence: this.combat.bondSequence,
        hounds: this.combat.hounds.map((h) => ({
          id: h.id, x: h.x, y: h.y, z: h.z,
          hp: h.hp, maxHp: h.maxHp, alert: h.alert, windup: h.windup,
        })),
      });
      host.__scalebornQaStageCombat = (mode): void => {
        // Only actor placement is staged for screenshot speed. Every cast,
        // AI reaction and damage change still passes through gameplay code.
        const victim = mode === 'melee' ? this.combat.hounds[1]
          : this.combat.hounds.find((hound) => hound.hp > 0);
        if (!victim || victim.hp <= 0) {
          throw new Error('QA target not alive for ' + mode);
        }
        const offset = mode === 'bond' ? 6 : mode === 'melee' ? 2.5
          : mode === 'rider' ? 11 : 13;
        const x = victim.x - offset, z = victim.z;
        const form = mode === 'dragon' || mode === 'melee' ? 'rideable' : 'small';
        this.flight.x = x; this.flight.z = z;
        this.flight.y = heightAt(x, z) + FORMS[form].standHeight;
        this.flight.yaw = Math.PI / 2;
        this.flight.pitch = 0; this.flight.roll = 0; this.flight.speed = 0;
        this.flight.mode = 'ground'; this.flight.form = form;
        this.flight.transition = null;
        this.flight.riderX = x + 1; this.flight.riderZ = z;
        this.flight.riderY = heightAt(x + 1, z) + 0.05;
        this.flight.riderTargetY = this.flight.riderY;
        this.flight.riderYaw = Math.PI / 2;
        this.flight.riderSpeed = 0; this.flight.riderMode = 'ground';
        this.flight.controlTarget = mode === 'rider' ? 'rider' : 'dragon';
        this.coast.update(x, z);
        this.dragon.update(this.flight);
        this.updateCamera(1, true);
        this.updateHud(0.2);
      };
      host.__scalebornQaAdvanceCombat = (frames): void => {
        if (!Number.isInteger(frames) || frames < 1 || frames > 180) {
          throw new Error('QA combat frames must be between 1 and 180');
        }
        const idle = { turn: 0, pitch: 0, bank: 0, boost: false, flap: false, move: 0 };
        for (let i = 0; i < frames; i++) {
          stepFlight(this.flight, idle, FIXED_DT);
          stepCombat(this.combat, this.flight, FIXED_DT);
          stepTidegate(this.tidegate, this.flight);
        }
        this.accumulator = 0;
        this.dragon.update(this.flight);
        this.combatVisual.update(this.combat, this.flight.time, frames * FIXED_DT);
        this.updateHud(0.2);
      };
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
    requireElement<HTMLButtonElement>('#fire-button').addEventListener('click', () => {
      if (!this.paused) this.fireAction();
    });
    requireElement<HTMLButtonElement>('#claw-button').addEventListener('click', () => {
      if (!this.paused) this.clawAction();
    });
    requireElement<HTMLButtonElement>('#mounted-sigil-button').addEventListener('click', () => {
      if (!this.paused) this.mountedSigilAction();
    });
    requireElement<HTMLButtonElement>('#bond-button').addEventListener('click', () => {
      if (!this.paused) this.bondAction();
    });
    requireElement<HTMLButtonElement>('#land-button').addEventListener('click', () => {
      if (!this.paused) this.landAction();
    });
    requireElement<HTMLButtonElement>('#focus-button').addEventListener('click', () => {
      if (!this.paused) this.notify(toggleRiderControl(this.flight));
    });
    requireElement<HTMLButtonElement>('#dive-button').addEventListener('click', () => {
      if (!this.paused) this.diveAction();
    });
    requireElement<HTMLButtonElement>('#tidegate-action').addEventListener('click', () => {
      if (!this.paused) this.interactWithRune();
    });
    this.echoAction.addEventListener('click', () => {
      if (!this.paused) this.interactWithRune();
    });
    this.menuButton.addEventListener('click', () => this.toggleMenu());
    requireElement<HTMLButtonElement>('#start').addEventListener('click', () => this.begin(canvas));
    canvas.addEventListener('click', () => {
      if (!this.paused && !this.input.isLocked()) void canvas.requestPointerLock();
    });
    window.addEventListener('resize', () => this.resize());
    this.updateCamera(1, true);
    this.cameraText.textContent = cameraModes[this.cameraIndex] ?? 'CHASE';
  }

  private toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    this.app.classList.toggle('hud-menu-open', this.menuOpen);
    this.menuButton.setAttribute('aria-expanded', String(this.menuOpen));
    this.menuButton.textContent = this.menuOpen ? 'Close · M' : 'Controls · M';
    if (this.menuOpen && document.pointerLockElement) void document.exitPointerLock();
  }

  private begin(canvas: HTMLCanvasElement): void {
    this.paused = false;
    this.intro.hidden = true;
    this.app.classList.add('game-started');
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

  private finishCombatAction(result: InteractionResult): void {
    if (!result.ok) this.notify(result);
    // A victory can occur on the R, T or X action path, outside the fixed
    // simulation loop. Persist it immediately and retry if storage is denied.
    if (this.combat.gloamCleared && !this.gloamVictoryStored) {
      this.persistProgress();
    }
  }

  private fireAction(): void {
    const result = this.flight.controlTarget === 'rider'
      ? castRiderSigil(this.combat, this.flight) : castDragonFire(this.combat, this.flight);
    this.finishCombatAction(result);
  }

  private clawAction(): void {
    this.finishCombatAction(castDragonClaw(this.combat, this.flight));
  }

  private mountedSigilAction(): void {
    this.finishCombatAction(castMountedRiderSigil(this.combat, this.flight));
  }

  private bondAction(): void {
    this.finishCombatAction(castBondSurge(this.combat, this.flight));
  }

  private landAction(): void {
    if (this.flight.controlTarget === 'rider') {
      this.notify({ ok: false, message: 'Switch back to dragon control for takeoff or landing.' });
      return;
    }
    this.notify(toggleLanding(this.flight));
  }

  private diveAction(): void {
    this.notify(this.flight.controlTarget === 'rider'
      ? toggleRiderDive(this.flight) : toggleDragonDive(this.flight));
  }

  private persistProgress(): void {
    this.saveAvailable = saveAzureProgress(this.progressStorage,
      snapshotAzureProgress(this.tidegate, this.echo,
        this.discoveries.visitedIds(), this.combat.gloamCleared));
    if (this.saveAvailable && this.combat.gloamCleared) this.gloamVictoryStored = true;
  }

  private interactWithRune(): void {
    let response: InteractionResult;
    if (echoShrineNearby(this.flight)) {
      response = interactEchoShrine(this.echo, this.tidegate, this.flight);
    } else if (tidegateNearby(this.flight)) {
      response = this.tidegate.solved && this.echo.collected
        ? attuneEchoAtGate(this.echo, this.tidegate, this.flight)
        : interactTidegate(this.tidegate, this.flight);
    } else {
      response = { ok: false, message: 'No ancient runes within reach.' };
    }
    if (response.ok) this.persistProgress();
    this.notify(response);
    this.updateHud(0.2);
  }

  private focusPosition(): { x: number; y: number; z: number } {
    const s = this.flight;
    return s.controlTarget === 'rider'
      ? { x: s.riderX, y: s.riderY, z: s.riderZ }
      : { x: s.x, y: s.y, z: s.z };
  }

  private isUnderwater(): boolean {
    const s = this.flight;
    return s.controlTarget === 'rider'
      ? s.riderMode === 'underwater' : s.mode === 'underwater';
  }

  private isWaterborne(): boolean {
    // At the water surface the third-person camera can dip through a wave.
    // Optical submersion must follow the camera there, too.
    const s = this.flight;
    return s.controlTarget === 'rider'
      ? s.riderMode === 'underwater' || s.riderMode === 'surface'
      : s.mode === 'underwater' || s.mode === 'surface';
  }

  private updateCamera(dt: number, instant = false): void {
    const state = this.flight;
    const rider = state.controlTarget === 'rider';
    const submerged = this.isUnderwater();
    const position = this.focusPosition();
    const yaw = rider ? state.riderYaw : state.yaw;
    const pitch = rider ? 0 : state.pitch;
    const forward = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch),
    );
    const root = new THREE.Vector3(position.x, position.y + (rider ? 1 : 0), position.z);
    const mode = cameraModes[this.cameraIndex] ?? 'CHASE';
    const scale = rider ? 1 : FORMS[state.form].visualScale;
    const distance = rider ? 7 : submerged ? 10 :
      state.form === 'small' ? 5.8 : state.form === 'giant' ? 34 : 11;
    const rise = rider ? (submerged ? 0.45 : 2.1) : submerged ? 0.75 :
      state.form === 'small' ? 2 : state.form === 'giant' ? 13 : 4.5;
    const target = root.clone().addScaledVector(forward, rider ? 2.5 : 7);
    let desired: THREE.Vector3;
    if (mode === 'WIDE') desired = root.clone().addScaledVector(forward, -distance * 1.9)
      .add(new THREE.Vector3(0, rise * 1.6, 0));
    else if (mode === 'DRAGON EYE') desired = root.clone().addScaledVector(forward, 2.4 * scale)
      .add(new THREE.Vector3(0, 0.52 * scale, 0));
    else if (mode === 'OVERHEAD') desired = root.clone().add(new THREE.Vector3(0, distance * 3.8, 0.1));
    else if (mode === 'ORBIT') {
      const angle = state.time * 0.22;
      desired = root.clone().add(new THREE.Vector3(
        Math.sin(angle) * distance * 1.5, rise * 1.9, Math.cos(angle) * distance * 1.5,
      ));
    } else {
      desired = root.clone().addScaledVector(forward, -distance)
        .add(new THREE.Vector3(0, rise, 0));
      // An original over-shoulder exploration composition, revealing
      // the vista instead of covering waterfalls with the player's dragon.
      if (!rider && !submerged && state.form !== 'giant') {
        const right = new THREE.Vector3(Math.cos(yaw),0,Math.sin(yaw));
        desired.addScaledVector(right,-distance*.28);
      }
    }
    desired.y = Math.max(desired.y, heightAt(desired.x, desired.z) + 1.25);
    this.camera.up.set(0, 1, 0);
    this.camera.position.lerp(desired, instant ? 1 : 1 - Math.exp(-dt * 4.5));
    if (mode !== 'DRAGON EYE') {
      // Terrain and landmark proxies can cut through the line between
      // player and a smoothed chase camera even when its endpoint is clear.
      const eye=root.clone().add(new THREE.Vector3(
        0,rider?1.45:Math.max(1.5,scale*1.25),0));
      this.camera.position.copy(resolveCameraOcclusion(
        eye,this.camera.position,heightAt,OBSTACLES,submerged?.85:1.15,
      ));
    }
    this.camera.lookAt(mode === 'DRAGON EYE'
      ? target.clone().addScaledVector(forward, 80) : target);
    if (this.qaPortraitSubject) {
      poseCharacterPortraitCamera(this.camera,state,this.qaPortraitSubject,heightAt);
    }
  }

  private updateHud(dt: number): void {
    this.hudAccum += dt;
    if (this.hudAccum < 0.12) return;
    this.hudAccum = 0;
    const rider = this.flight.controlTarget === 'rider';
    const current = this.focusPosition();
    const swimming = rider ? this.flight.riderMode !== 'ground' :
      this.flight.mode === 'surface' || this.flight.mode === 'underwater';
    const belowSurface = this.isUnderwater();
    this.altLabel.textContent = belowSurface ? 'DEPTH' : swimming ? 'SEA LEVEL' : 'GROUND CLEARANCE';
    this.altitudeText.textContent = belowSurface
      ? String(Math.round(Math.max(0, waterSurfaceAt(current.x, current.z) - current.y)))
      : swimming || (rider ? this.flight.riderMode === 'ground' : this.flight.mode === 'ground')
        ? '0' : String(Math.round(Math.max(0, current.y - Math.max(0, heightAt(current.x, current.z)))));
    this.speedText.textContent = Math.round(Math.abs(rider ? this.flight.riderSpeed : this.flight.speed)).toString();
    const combatActive = combatNearby(this.combat, this.flight) ||
      this.combat.hp < this.combat.maxHp || this.combat.ember < this.combat.maxEmber - 0.5 ||
      this.combat.focus < this.combat.maxFocus - 0.5;
    this.combatHud.hidden = !combatActive;
    this.combatHud.dataset.actor = rider ? 'rider' : 'dragon';
    this.combatEnergyLabel.textContent = rider ? 'RIDER FOCUS'
      : this.flight.form === 'small' ? 'EMBER'
        : 'EMBER · RIDER FOCUS ' + Math.round(this.combat.focus);
    this.combatEmberBar.setAttribute('aria-label', rider ? 'Rider focus' : 'Dragon Ember');
    const hpPercent = Math.round(100 * this.combat.hp / this.combat.maxHp);
    const energy = rider ? this.combat.focus : this.combat.ember;
    const energyMax = rider ? this.combat.maxFocus : this.combat.maxEmber;
    const emberPercent = Math.round(100 * energy / energyMax);
    this.combatHealth.style.width = hpPercent + '%';
    this.combatEmber.style.width = emberPercent + '%';
    this.combatHealthBar.setAttribute('aria-valuenow', String(this.combat.hp));
    this.combatEmberBar.setAttribute('aria-valuenow', String(Math.round(energy)));
    this.combatEmberBar.setAttribute('aria-valuemax', String(energyMax));
    const enemiesLeft = combatRemaining(this.combat);
    this.combatThreats.textContent = enemiesLeft === 0 ? 'GLOAM DEN CLEARED'
      : 'GLOAM HOUNDS · ' + enemiesLeft + ' REMAIN';
    this.formName.textContent = FORMS[this.flight.form].label.toUpperCase();
    this.focusName.textContent = rider ? 'RIDER' : 'DRAGON';
    this.tidegatePanel.hidden = !tidegateNearby(this.flight);
    this.tidegateHintText.textContent = tidegateHint(this.tidegate, this.flight);
    this.tidegateStatus.textContent = this.tidegate.solved ? 'TIDEBOUND SIGIL AWAKENED'
      : this.tidegate.dragonAnchored ? '1 / 2 RUNES' : '0 / 2 RUNES';
    const objective = echoObjective(this.echo, this.tidegate);
    const phase = echoPhase(this.echo, this.tidegate);
    this.echoStage.textContent = phase === 'complete' ? 'COMPLETE'
      : phase === 'return-to-gate' ? 'ECHO COLLECTED'
      : phase === 'seek-shrine' ? 'SEEK THE SHRINE' : 'LOCKED';
    this.echoTitle.textContent = objective.title;
    this.echoHintText.textContent = objective.instruction;
    const goalDistance=Math.hypot(current.x-objective.x,current.z-objective.z);
    this.echoDistance.textContent = phase === 'complete' ? 'Trial completed'
      : Math.round(goalDistance) + ' m to objective';
    // Dark-fantasy minimal HUD: present the quest during the opening,
    // near interactions, or while the M menu is open. Otherwise let the
    // environment own the screen rather than pinning a constant quest card.
    const questContext=goalDistance < 105 || tidegateNearby(this.flight)
      || echoShrineNearby(this.flight) || this.menuOpen;
    const questAmbient=this.flight.time>13 && !questContext;
    this.echoPanel.classList.toggle('quest-ambient',questAmbient);
    this.echoSaveStatus.textContent = this.saveAvailable ? 'Local checkpoints enabled' : 'Session progress only';
    this.echoAction.hidden = !echoShrineNearby(this.flight) &&
      !(tidegateNearby(this.flight) && this.tidegate.solved && this.echo.collected);
    this.modeName.textContent = this.flight.transition?.phase === 'landing' ? 'LANDING'
      : this.flight.transition?.phase === 'takingOff' ? 'TAKING OFF'
      : this.flight.transition?.phase === 'splashdown' ? 'SPLASHDOWN'
      : this.flight.transition?.phase === 'waterLaunch' ? 'WATER LAUNCH'
      : (rider ? this.flight.riderMode : this.flight.mode) === 'ground'
        ? (rider ? 'ON FOOT' : 'ON LAND')
      : (rider ? this.flight.riderMode : this.flight.mode) === 'surface' ? 'SWIMMING'
      : (rider ? this.flight.riderMode : this.flight.mode) === 'underwater' ? 'DIVING' : 'IN FLIGHT';
    document.querySelectorAll<HTMLButtonElement>('[data-form]').forEach((button) => {
      const selected = button.dataset.form === this.flight.form;
      button.setAttribute('aria-pressed', String(selected));
    });
    this.cameraText.textContent = cameraModes[this.cameraIndex] ?? 'CHASE';
    const yaw = this.flight.controlTarget === 'rider' ? this.flight.riderYaw : this.flight.yaw;
    const deg = ((yaw * 180 / Math.PI) % 360 + 360) % 360;
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    this.compass.textContent = dirs[Math.round(deg / 45) % 8] ?? 'N';
    const target = this.discoveries.nearest(current.x, current.z);
    this.waypointName.textContent = target?.name ?? 'Coast fully charted';
    this.waypointDistance.textContent = target ? Math.round(target.meters) + ' m' : LANDMARKS.length + ' discoveries found';
    if (this.diagnostics.hidden) return;
    const render = this.renderer.info.render;
    this.diagnostics.textContent = [
      'SEED 0x5ca1e0',
      'FPS ' + this.fps,
      'XYZ ' + Math.round(this.flight.x) + ', ' + Math.round(this.flight.y) + ', ' + Math.round(this.flight.z),
      'DRAGON FORM ' + this.flight.form,
      'TRAVERSAL ' + (this.flight.transition?.phase ?? this.flight.mode),
      'CONTROL ' + this.flight.controlTarget,
      'RIDER ' + this.flight.riderMode,
      'TIDEGATE ' + (this.tidegate.solved ? 'AWAKENED' : this.tidegate.dragonAnchored ? 'ANCHORED' : 'INACTIVE'),
      'ECHO ' + echoPhase(this.echo, this.tidegate),
      'BOND HP ' + this.combat.hp + '/' + this.combat.maxHp,
      'EMBER ' + Math.round(this.combat.ember),
      'RIDER FOCUS ' + Math.round(this.combat.focus),
      'BOND READY ' + (this.flight.time >= this.combat.bondReadyAt),
      'HOSTILES ' + combatRemaining(this.combat),
      'TERRAIN TILES ' + this.coast.tileCount(),
      'DISCOVERED ' + this.discoveries.count() + '/' + LANDMARKS.length,
      'DRAWS ' + render.calls,
      'TRIANGLES ' + render.triangles,
      'WEBGL ' + this.renderer.capabilities.isWebGL2,
      'QUALITY ' + this.quality,
      'INTERNAL DPR ' + this.resolution.pixelRatio.toFixed(2),
      'CURRENT GATE G4 COMBAT FOUNDATION (VISUAL HOLD)',
    ].join('\n');
  }

  private frame = (now: number): void => {
    if (this.qaRender && this.qaFrameCaptureGate.isHeld) {
      requestAnimationFrame(this.frame);
      return;
    }
    // CI uses SwiftShader (CPU WebGL). Rendering every RAF starves Playwright's
    // main-thread DOM polling on large scenes. Keep the real world/shaders and
    // deterministic QA simulation, but limit QA-only rendering to 8 FPS.
    // Normal playable builds retain unrestricted requestAnimationFrame.
    if (this.qaRender && now - this.lastQaRenderTime < 125) {
      requestAnimationFrame(this.frame);
      return;
    }
    if (!this.lastTime) this.lastTime = now;
    const elapsed = Math.min(0.10, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.fpsAccum += elapsed;
    this.frames++;
    if (this.fpsAccum > 0.7) {
      this.fps = Math.round(this.frames / this.fpsAccum);
      this.fpsAccum = 0;
      this.frames = 0;
      if(!this.qaRender){
        const ratio=this.resolution.recordFps(this.fps);
        if(ratio!==null)this.renderer.setPixelRatio(ratio);
      }
    }
    if (this.input.take('diagnostics')) this.diagnostics.hidden = !this.diagnostics.hidden;
    if (this.input.take('help')) {
      this.paused = !this.paused;
      this.intro.hidden = !this.paused;
      if (this.paused && document.pointerLockElement) void document.exitPointerLock();
    }
    if (this.input.take('menu')) this.toggleMenu();
    if (this.input.take('camera')) this.cameraIndex = (this.cameraIndex + 1) % cameraModes.length;
    if (!this.paused && !this.menuOpen) {
      if (this.input.take('land')) this.landAction();
      if (this.input.take('switchFocus')) this.notify(toggleRiderControl(this.flight));
      if (this.input.take('submerge')) this.diveAction();
      if (this.input.take('interact')) this.interactWithRune();
      if (this.input.take('fire')) this.fireAction();
      if (this.input.take('claw')) this.clawAction();
      if (this.input.take('mountedSigil')) this.mountedSigilAction();
      if (this.input.take('bond')) this.bondAction();
      for (const form of FORM_ORDER) {
        if (this.input.take(form)) this.setForm(form);
      }
    }
    this.actionTimer = Math.max(0, this.actionTimer - elapsed);
    if (this.actionTimer === 0) this.actionToast.hidden = true;
    if (!this.paused && !this.menuOpen) {
      this.accumulator = Math.min(0.1, this.accumulator + elapsed);
      const controls = this.input.sample();
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
        stepFlight(this.flight, controls, FIXED_DT);
        stepCombat(this.combat, this.flight, FIXED_DT);
        stepTidegate(this.tidegate, this.flight);
        this.accumulator -= FIXED_DT;
        steps++;
      }
      const focus = this.focusPosition();
      this.coast.update(focus.x, focus.z);
      const found = this.discoveries.update(focus.x, focus.z);
      if (found.length) {
        this.reveal.textContent = '✦  DISCOVERED  ·  ' + found.map((site) => site.name).join(', ');
        this.revealTimer = 4.2;
        this.persistProgress();
      }
      this.revealTimer = Math.max(0, this.revealTimer - elapsed);
      this.reveal.hidden = this.revealTimer === 0;
    } else this.accumulator = 0;
    if (this.combat.notice && this.combat.notice.sequence !== this.combatNoticeSeen) {
      this.combatNoticeSeen = this.combat.notice.sequence;
      this.notify({ ok: this.combat.notice.kind !== 'hurt', message: this.combat.notice.message });
    }
    const focus = this.focusPosition();
    this.coast.setUnderwater(this.isWaterborne());
    // Resolve the real chase/wide/orbit camera before choosing visible
    // vegetation, so flight turns do not leave a whole world of leaf cards
    // behind the player in the CPU renderer or dedicated GPU draw pass.
    this.dragon.update(this.flight, this.combat.lastClaw);
    this.combatVisual.update(this.combat, this.flight.time, this.paused || this.menuOpen ? 0 : elapsed);
    this.updateCamera(elapsed);
    this.coast.animate(this.flight.time, focus.x, focus.y, focus.z, this.flight, this.camera);
    this.coast.updateTidegate(this.tidegate, this.flight.time, this.echo.attuned);
    this.coast.updateEcho(echoPhase(this.echo, this.tidegate), this.flight.time);
    const immersion = this.coast.updateAtmosphere(this.flight.time, this.camera.position);
    this.waterTint.hidden = immersion < .06;
    this.waterTint.style.opacity = immersion.toFixed(2);
    this.renderer.render(this.scene, this.camera);
    // Begin the QA cooldown *after* software rasterization. Measuring from
    // frame entry fails to yield when one SwiftShader frame exceeds 125 ms.
    if (this.qaRender) this.lastQaRenderTime = performance.now();
    this.updateHud(elapsed);
    if (this.qaRender) this.qaFrameCaptureGate.didRenderFrame();
    requestAnimationFrame(this.frame);
  };

  start(): void {
    requestAnimationFrame(this.frame);
  }
}
