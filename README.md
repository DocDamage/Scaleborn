# Scaleborn

**VISUAL OVERHAUL IN PROGRESS:** the large HUD and primitive tree/terrain/water rendering are being replaced by an original painterly PBR environment, Mirrorfall Lake and Cascade. See [visual acceptance gate](docs/VISUAL_QUALITY_GATE.md). Gameplay G3 continues to work but the art is not finished.

**Scaleborn** is an original painterly 3D fantasy adventure about a 13-year-old dragon-human hybrid and her bonded dragon. The project begins with a **desktop-browser Azure Coast flight prototype** and is structured for a later **Unreal Engine implementation**. Browser gameplay will not automatically transfer to Unreal.

## Current state: G0–G3, expanding G3.2 multi-location Tidal Echo Trial

This branch contains a playable **first-flight preview**: an original code-generated dragon and rider, deterministic seam-stitched Azure Coast terrain streamed in tiles, animated shader ocean and coastal foam, layered cloud banks, clustered trees, coastal rocks, generated harbor cottages and piers, lighthouse, ancient temple and sea arch, four discoverable landmarks, three dragon forms with distinct flight profiles, animated landing/takeoff over fixed time, a directly controlled small dragon on land, separately scaled rider, deforming three-bone wings and multiple cameras. This branch adds independent rider walking, coast-to-water movement, dragon swimming/surface/diving, water transitions and a procedural submerged shrine. This G3.2 branch adds a multi-location underwater-to-land quest and small local progress checkpoints. It does **not** yet include a general quest journal/save-slot system, rider-on-shoulder behavior, combat, audio, asset-export tooling or finished painterly textures. Dragon transformations are an early G2 implementation: small form requires landing before dismount; full free midair remounting, shoulder riding and co-op puzzles are later. These remain planned work, not hidden or simulated features.

The 4 × 4 km world and all objects use meters with Y up. The packaged seed is `0x5ca1e0`. Geometry is procedurally generated and currently requires no third-party art/audio files.

## Running locally

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Click **Take flight**. Press Esc to release pointer lock. Run `npm run check` for lint/unit/build checks and `npm run build` to produce the deployable `dist/` directory. An npm lockfile has **not yet** been checked in; dependency pinning uses exact direct versions until the lockfile is generated and verified.

| Control | Effect |
| --- | --- |
| W / S | Climb / dive in flight; walk forward / backward on land |
| A / D | Turn left / right |
| Mouse (when captured) | Pitch / steer |
| Q / E | Bank |
| Shift | Speed surge |
| Space | Stronger wingbeat / increased cruise speed | 
| F | Land / take off on land; splash down or launch from deep water |
| 1 / 2 / 3 | Small / rideable / giant dragon; growth checks world clearance |
| C | Dive / surface in water, for either rider or dragon |
| G | Invoke or examine a nearby Tidegate rune stone |
| Q / E | Dive deeper / swim upward while underwater |
| Tab | Switch control between the grounded small dragon and independent rider |
| V | Cycle five cameras |
| H | Toggle controls panel (pauses preview) |
| F3 | Toggle seeded-world and renderer diagnostics |

## Milestone order

- **G0** — architecture, strict TypeScript, Vite, lint/tests/build, seeded generation and asset registry. Lockfile and smoke/benchmark verification remain.
- **G1** — painterly Azure Coast, recognizable landmarks, world-streaming quality/LOD, water, foliage and coastal architecture. **In progress:** stitched 32:8 terrain LOD edges, shader ocean, foam contours, temple/arch and discoverable landmarks; painterly art direction and benchmarks remain.
- **G2** — polished flight dynamics, original procedural dragon/rider rigs, expressive animation and all three dragon sizes. **In progress:** 3 size modes, distinct physics profiles, conservative collision proxies, eased landing/takeoff, diagonal ground gait, controllable small dragon, independent rider scale and animated skinned wing deformation. Real skeletal rig export, transitions, complete locomotion and animation QA remain.
- **G3** — seamless on-foot, riding, swimming and underwater traversal, co-op exploration. **In progress:** the Tidegate two-character trial now leads into the Sunken Shrine Tidal Echo recovery and rider attunement at Tidegate. Local progress checkpoints store completed flags and discovered landmarks. More complex co-op puzzles, authored animation and fluid simulation remain.
- **G4** — fire/elemental combat, threats and rider/dragon bond interactions.
- **G5** — story opening, villages/NPCs, quests, progression and persistent saves.
- **G6** — optimization, replacement art pipeline, accessibility, packaging and Unreal port plan.

See `docs/ARCHITECTURE.md` and `docs/MILESTONES.md` for contracts, omissions and acceptance gates.

## Browser smoke test and visual QA

The **Browser smoke and screenshot** GitHub Actions workflow runs Chromium with
software WebGL, clicks into flight, exercises the camera toggle, checks the HUD,
rejects browser console errors, and attaches a two 1280 × 720 PNG screenshots (chase and wide cameras).
Run it locally after `npm install` and `npx playwright install chromium`
with `npm run dev` active, then `npm run test:browser`. The screenshot lives
under `artifacts/azure-coast-*.png` (ignored by git).

**Important:** a successful software-WebGL smoke test does not prove the 60 FPS
integrated-GPU target. That requires profiling on the specified hardware.

## Dragon forms and G2 controls

**1 — Small companion:** dog-sized original dragon; on open land, the rider dismounts and remains at the dismount position. W/S moves the dragon; A/D turns. Return within 4.5 m of the rider to remount. The small dragon can take off with F, but may not remount until it returns and lands.

**2 — Rideable:** normal horse-sized companion; the rider remains physically unchanged in size while the dragon changes. Responsive assisted flight and modest ground movement.

**3 — Giant:** an approximately 12-meter-long dragon with stronger acceleration and wider turns. Transformation checks collision clearance to terrain and authored structures; crowded spaces block growth.

**F — Land or take off:** you can land only within 22 meters of clear solid terrain. Landing now takes 1.45 seconds and takeoff 1.15 seconds, with physically interpolated vertical movement and animated wing folding/unfolding; full obstacle collision and animation authoring remain upcoming.

None of these actions consumes stamina, magic, or a transformation charge. The geometry and hit proxies are generated in code and identified by stable IDs for future replacement.

**Known limitations:** the small dragon cannot yet ride on the girl's shoulders; on-foot rider control, swimming and other G3 systems have not been developed. The collision proxies are conservative circles/height bounds, not per-mesh physics. The dragon form conversion currently preserves entity identity but does not serialize save data.

### Repeatable landing test

Launch `npm run dev` and open `http://localhost:5173/?start=meadow` to begin above a safe training meadow. Press **F** to land (a 1.45-second descent), **1** to shrink and dismount, **2** to remount nearby, and **F** to launch (1.15 seconds). You cannot transform or trigger another traversal action while a landing or launch is underway. The browser smoke test exercises this path automatically.

### Software renderer test pacing

The Chromium smoke test uses `?start=meadow&qa=1`. Development-only `__scalebornQaAdvance(frames)` advances a bounded number of real fixed-timestep simulation steps, so software rendering on a CI server cannot cause false timeouts during 1.45-second transitions. The hook is excluded in production builds and disabled for ordinary gameplay URLs. Browser tests still check the DOM and actual rendered WebGL scene.

Under software WebGL, frames can take longer than a full flight-transition phase. The dev-only QA harness therefore stages the meadow landing atomically (using the **same** `toggleLanding` function as the F key) and advances fixed simulation frames before checking the DOM. This removes a slow-render/input scheduling race, without altering normal game inputs or physics.

## Early G3 water and rider controls

**Dragon:** Fly over sufficiently deep water and descend within 29 meters of sea level, then press **F** to splash down. Once swimming at the surface, press **C** to dive; press **Q/E** to swim deeper or ascend, W/S to swim forward/back, A/D to turn, and Shift to surge. Press C to surface. At the surface, press F to launch out of the water. The transition moves vertically without loading a new scene. Larger dragons require deeper water.

**Rider:** On open land, press **1** to shrink the dragon and dismount, then **Tab** to control the 13-year-old rider. W/S and A/D move/steer; crossing a shallow shoreline enters swimming. Once in deep water, C switches between surface swimming and diving. Q/E change depth. The magical bond provides indefinite underwater breathing. Tab returns control to the small dragon, and remounting requires proximity, solid ground and both characters out of the water.

**Exploration:** The Sunken Shrine is the fifth fixed-seed Azure Coast landmark (approximately 1560 m east, 1440 m north in game coordinates). The seabed includes procedurally generated kelp and coral clusters, and underwater viewing uses separate fog and sky treatment. This is an initial underwater visual pass, not a finished underwater biome.

**Quick tests:** `?start=meadow` starts near safe grass for F/1/Tab tests. `?start=water` starts above deep sea for F/C/Q/E tests. The default world remains fixed-seed. The browser screenshot smoke test also exercises a development-only underwater path.

**Scope note:** swimming currently relies on analytical seabed-height and structure proxies; procedural water is not a full fluid solver, there are no currents or underwater combat yet. Rider movement is separate from dragon movement and neither needs external assets. A future iteration will add rider swimming strokes, navigation hazards, shore animations, co-op puzzles and a richer environment.

## G3.1 — Tidegate dual-character trial

**Tidegate Runestones** is a procedural landmark in the training meadow around **(-555, 100)**. This is an actual interactive cooperative puzzle, not just a pair of glowing props.

1. Start near the meadow (`?start=meadow` is useful for testing), land with **F**, and shrink with **1**. Keep the small dragon on the left rune. Press **G** to anchor it.
2. Press **Tab** to control the dismounted rider. Walk with W/S and steer with A/D toward the right rune, then press **G**. The dragon must still be near its rune for this to work.
3. The runes activate and the **Tidebound Sigil** is awarded as an in-session exploration achievement. The nearby beacon illuminates. The state persists while the page is running; saving it across restarts belongs to G5.

The hint panel appears within roughly 36 meters. Moving the dragon off its rune before completion releases the anchor. Attempting to activate with the wrong actor, while airborne, or at too great a distance fails with a specific explanation. The same interaction is available through the on-screen button. This is a new standalone trial, not yet a gate into the Sunken Shrine.

For a quick browser QA pass, `npm run test:browser` exercises the dragon and rider interactions and captures a snapshot after the Sigil is awakened. No new runtime dependency or imported character art was added.

**Rider motion update:** generated shoulder/hip joints now swing during on-foot movement and perform opposing arm strokes and leg kicks during swimming and diving. These are procedural pose channels on the existing generated character, not authored motion clips or a finished retargetable GLB skeleton.

## G3.2 — Tidal Echo Trial (multi-location)

The original Tidegate now leads into a three-stage adventure spanning land and deep sea. All interactions use the existing **G** key and the controlled actor's position. A new quest panel displays the current objective and approximate distance.

1. **Awaken Tidegate:** Land at the runestones around (-555, 100), shrink with **1**, anchor the left rune with the small dragon using **G**, then **Tab** to the rider and activate the right rune with **G**.
2. **Recover the Tidal Echo:** Remount and fly to the **Sunken Shrine** at roughly (1560, 1440). Splash down with **F**, dive with **C**, and steer toward the luminous crystal. In dragon-controlled **underwater** mode, within 11 m horizontally and 8.5 m vertically of the heart, press **G** to recover the Echo. Swimming at the surface, approaching from above the water, or skipping the Tidegate will not work.
3. **Restore the Tidal Accord:** Return to Tidegate, land, shrink the dragon, switch to the rider with **Tab** and press **G** beside the right rune. The completed ritual changes the visual beacon and marks the trial complete.

**Progress is saved locally** under `scaleborn.azure-progress.v1` when browser storage is available. The record includes version, fixed world seed, completed Tidegate/Echo flags and discovered landmark IDs; it deliberately excludes actor positions, inventories and unfinished rune anchoring. Missing/corrupt/old/mismatched storage cannot crash the game and resets to a safe default. This is a compact **progress checkpoint**, not G5's full multiple-save system.

The existing asset-independent design remains unchanged. All new effects use generated rings and motes in Three.js; portable quest rules live separately in `src/world/tidalEcho.ts`. Software-WebGL QA uses development-only staging hooks to exercise both interactions without spending minutes flying between coordinates. Ordinary gameplay still requires actual travel and correct proximity.

**Limitations:** the Sunken Shrine is still a simple open-air submerged ruin, not a fully explorable interior; there are no underwater enemies, key inventory, dialog sequences, animated cutscenes or level transitions. The returned Echo is a narrative flag, not a physical carryable item. Full save slots, richer story and character assets remain future gates.

## Mirrorfall visual test location

`http://localhost:5173/?start=lake` places the rider above Mirrorfall Lake looking toward the waterfall. It is a real in-game camera, not a concept image. The lake and ocean use their own surface elevations; the game supports swimming and diving into the lake basin. M opens the control palette; F3 toggles diagnostic statistics. Existing keyboard and clickable actions remain wired. See `docs/VISUAL_QUALITY_GATE.md` for the accuracy limitations of the water simulation and the next visual quality acceptance checks.

### Graphics quality

The game runs **high** painterly PBR shaders by default. Add `?quality=low` to reduce foliage density, internal pixel ratio and shader cost on integrated GPUs or software renderers. The lake shape, collision, traversal and quest data are identical. `?start=lake&quality=high` is the dedicated visual acceptance view. CI tests lower-resolution software WebGL; high-mode screenshots require real-GPU review.

### Waterfall flow coupling

The lake waterfall now drives a shared, fixed-step local current field in `src/world/waterDynamics.ts` and an accompanying ripple/foam distortion in the lake shader. Swimming dragons and independently swimming riders are nudged away from the plunge point, with a collision-safety check. Impact current fades with distance and does not affect the ocean. This is not a fully coupled 3D fluid or water-pressure solver and will require additional work before being labeled realistic water physics.

### Surface texture generation

Rock, bark and terrain now have deterministic tileable original **albedo, normal and roughness maps** generated in memory. Both Low and High settings receive texture detail; High also uses the world-space procedural shader. The rock escarpment's UVs match its geometry, so procedural striations are visible rather than a smooth colored slab. There are still no third-party or temporary image assets. Textures are disposed when their materials are disposed.

### Shoreline foliage and interaction wake

Procedural broadleaf branches now carry leaf planes that remain visible from low third-person camera angles, and the wooded shores receive denser rooted tree stands with slope checks. Swimming riders and dragons create fading, spreading rings at the **moving water-surface elevation** using a bounded pool of generated geometry. These are local interactions, distinct from the waterfall's shared plunge current. Full fluid displacement and high-fidelity vegetation wind/bone simulation still require further work.

### Adaptive rendering for live gameplay

Scaleborn now samples its actual frame rate and uses hysteresis to lower internal rendering resolution when performance remains under 28 FPS, or gradually restore it above 56 FPS. This **does not** change controls, character speed, the world heightfield, collisions, saved quest progress, or the graphics material preset. The renderer reports its current internal pixel ratio under **F3**. Automated visual QA disables adaptation for comparable screenshots; integrated-GPU and RTX 3060 results must be measured in real gameplay.


## G4 — first playable combat encounter (in progress)

Open `/?start=combat` to begin on land near three Gloam hounds east of Tidegate. Press **R** or primary click (while pointer-locked) to breathe directed fire. Ember regenerates; enemies pursue, telegraph melee and can damage the shared bond vitality. Retreat, fly above their reach, or fight back. If vitality runs out, the dragon and rider return to the meadow without losing quest progress or defeated enemies. The compact HUD appears only during nearby combat or while recovering. See [`docs/COMBAT_G4.md`](docs/COMBAT_G4.md) for exact mechanics and outstanding G4/visual acceptance work.
