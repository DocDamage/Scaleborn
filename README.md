# Scaleborn

**Scaleborn** is an original painterly 3D fantasy adventure about a 13-year-old dragon-human hybrid and her bonded dragon. The project begins with a **desktop-browser Azure Coast flight prototype** and is structured for a later **Unreal Engine implementation**. Browser gameplay will not automatically transfer to Unreal.

## Current state: G0/G1 and early G2 dragon flight/size prototype

This branch contains a playable **first-flight preview**: an original code-generated dragon and rider, deterministic seam-stitched Azure Coast terrain streamed in tiles, animated shader ocean and coastal foam, layered cloud banks, clustered trees, coastal rocks, generated harbor cottages and piers, lighthouse, ancient temple and sea arch, four discoverable landmarks, three dragon forms with distinct flight profiles, animated landing/takeoff over fixed time, a directly controlled small dragon on land, separately scaled rider, deforming three-bone wings and multiple cameras. It does **not** yet include full rider-on-foot control, swimming, underwater exploration, combat, quests, saves, audio, asset-export tooling or finished painterly textures. Dragon transformations are an early G2 implementation: small form requires landing before dismount; full free midair remounting, shoulder riding and co-op puzzles are later. These remain planned work, not hidden or simulated features.

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
| F | Land / take off (landing requires nearby clear solid ground) |
| 1 / 2 / 3 | Small / rideable / giant dragon; growth checks world clearance |
| V | Cycle five cameras |
| H | Toggle controls panel (pauses preview) |
| F3 | Toggle seeded-world and renderer diagnostics |

## Milestone order

- **G0** — architecture, strict TypeScript, Vite, lint/tests/build, seeded generation and asset registry. Lockfile and smoke/benchmark verification remain.
- **G1** — painterly Azure Coast, recognizable landmarks, world-streaming quality/LOD, water, foliage and coastal architecture. **In progress:** stitched 32:8 terrain LOD edges, shader ocean, foam contours, temple/arch and discoverable landmarks; painterly art direction and benchmarks remain.
- **G2** — polished flight dynamics, original procedural dragon/rider rigs, expressive animation and all three dragon sizes. **In progress:** 3 size modes, distinct physics profiles, conservative collision proxies, eased landing/takeoff, diagonal ground gait, controllable small dragon, independent rider scale and animated skinned wing deformation. Real skeletal rig export, transitions, complete locomotion and animation QA remain.
- **G3** — seamless on-foot, riding, swimming and underwater traversal, co-op exploration.
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
