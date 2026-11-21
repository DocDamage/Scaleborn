# Architectural decision 0001 — Browser-first, portable data

**Status:** Accepted for the initial branch.

## Product contract

- Original game **Scaleborn**, 13-year-old female dragon-human hybrid, original expressive dark-iridescent dragon; egg discovered in tide-exposed ancient underwater ruins.
- Azure Coast is a fixed-seed (~4 × 4 km) coastal region. Priorities: enjoyable responsive flight, painterly visuals, strong procedural assets.
- Dragon forms: small-dog, rideable/horse-sized and giant (~40 feet); transformation is free when clearance permits. Planned, not implemented yet.
- Seamless air, ground, water and underwater traversal, unlimited magical underwater breathing, selectable difficulty, no harsh death penalty.
- Later: fire first; more magic learned through exploration, bonded abilities, mostly linear narrative, living NPC settlements and optional quests.
- The browser build must run without any proprietary assets or externally hosted services; all required art starts generated.

## Boundaries

- `src/world/terrain.ts` and `src/core/random.ts` are deterministic, renderer-neutral gameplay data.
- `src/actors/dragon/flight.ts` is renderer-neutral, fixed-step flight simulation.
- `src/data/assets.ts` owns stable asset identifiers and required rig sockets. Asset replacement must not alter game rules.
- `src/world/azureCoast.ts` owns disposable Three.js tile groups, LOD streaming, and shared materials. `tileLod.ts` is a renderer-independent stitched-edge contract; `terrainTile.ts` generates painted vertex colors and shoreline ribbons; `ocean.ts` renders original procedural water.
- `src/world/dressing.ts` and `src/world/landmarks.ts` own procedural scene-assembly recipes; `src/world/discoveries.ts` is an in-memory, renderer-independent discovery tracker.
- `src/actors/dragon/visual.ts` is an initial generated character implementation, not final rigging.
- `src/input/flightInput.ts` translates browser events into abstract action commands.
- `src/app/game.ts` is composition root: fixed-step loop, camera and HUD. Move cameras/UI into dedicated modules as features grow.

## Portability

Stable asset IDs and JSON-like definitions transfer; JavaScript, Three.js materials, WebGL shaders, collision math, game AI and browser input must be reimplemented or validated in Unreal. Units: **meters; Y-up, -Z forward** in browser, with coordinate conversion at export to Unreal centimeters/Z-up. Future authored GLB replacement must satisfy versioned rig/socket manifests.

## Dependencies and licenses (initial)

- **Three.js**: MIT; sole runtime 3D renderer; procedural meshes and textures are app-owned.
- **Vite**: MIT; local dev server/optimized browser bundler.
- **TypeScript**: Apache-2.0; type checking.
- **Vitest**: MIT; deterministic unit tests.
- **ESLint**: MIT; source validation.
- **typescript-eslint**: MIT; TypeScript rules.
- **@types/three**: MIT; TypeScript declarations.
- **@eslint/js**: MIT; ESLint flat config.

No paid assets. No remote CDN dependencies. Browser assets can later be exported with dedicated offline Blender and GLB tooling. Dependency size and iGPU performance must be measured rather than assumed.

## Known engineering gaps

1. `package-lock.json` must be generated and committed before declaring reproducibility.
2. Browser smoke testing and integrated-GPU benchmarks are required before claiming 60 FPS.
3. 32:8 terrain LOD transitions are edge-height-stitched in G1; transition normal differences, foam continuity, and runtime screenshot QA remain.
4. Foliage is globally instanced rather than chunk-streamed; profile large-world memory before expansion.
5. Generated dragon model uses animated wing pivots, not a complete deforming bone rig. G2 requires an offline generator with GLB output and animation QA.
6. No water physics, quest persistence, audio, NPC schedules or actual asset replacement implementation yet.
