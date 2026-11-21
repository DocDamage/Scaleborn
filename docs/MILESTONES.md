# Scaleborn implementation gates — acceptance checklist

These gates describe **completion criteria**, not completed claims. Deliver one working, verified milestone at a time.

| Gate | Required user-visible result | Evidence before calling complete |
| --- | --- | --- |
| G0 | Runnable desktop-browser project, stable world seed, TypeScript, lint/tests/build, asset IDs, debug telemetry | Lockfile, green CI, fresh install/build, browser console/smoke checks |
| G1 | Cohesive Azure Coast, continuous coastline and water, readable harbor/lighthouse/ruins, painterly light/weather, efficient tiles/vegetation | Seeded screenshot comparisons, tile seam checks, asset QA, 60 FPS iGPU profiling |
| G2 | Original dragon+rider model with deforming wings and animation graph, takeoff/landing, stable assisted flight, five cameras, clearance-safe size changes | 5-minute continuous flight QA, animations and no collision/rig popping |
| G3 | Seamless flying/landing/swimming/diving/mount/dismount and independently controlled small dragon | Underwater passage + co-op puzzle without scene loading |
| G4 | Fire, rider magic, damage/respawn, AI enemies and a bonded attack | Targeting/hit effects, deterministic damage tests and battle scenario |
| G5 | Egg/hatching narrative, harbor NPCs, first quest, secrets, save slots, journal, audio | Complete opening, quest/save/load roundtrip and no broken narrative paths |
| G6 | Refined UX and performance, replacement asset pipeline, export packages, migration instructions | Manual iGPU benchmark, browser automation and actual GLB/Unreal import validation |

## Snapshot: first development branch

- **Implemented draft:** browser scaffold, first procedural terrain tiles, 4 km world contract, seeded biome query, coastal cottages/trees/rocks, lighthouse, cloud banks, original dragon silhouette, rider model, assisted flight maths, cameras, HUD, diagnostics and unit tests.
- **Needs validation:** real browser screenshot, CI result, iGPU benchmark, color/lighting tuning, clean dependency lock.
- **Not implemented:** fully authored hero/dragon character rigs and animations; complete G1, G2; transformation; water diving; on-foot movement; NPCs; quests; boss combat; audio and saves.

## Portability and development discipline

- No downloaded or paid textures, characters, or sound resources required to start.
- Keep files cohesive and small; use consistent meters Y-up runtime and versioned asset IDs.
- Procedural generation is a source implementation, not a colored-debug-object excuse.
- When introducing extra dependencies, record license, performance cost, use and export implications in the architecture decision record.
- Never mark a gate complete without executable acceptance evidence and reproducible run instructions.
