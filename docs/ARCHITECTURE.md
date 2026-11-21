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
- `src/actors/dragon/forms.ts` defines portable sizes and movement parameters. `flight.ts` owns pure fixed-step air/ground simulation, form transitions and dismount position. `src/world/collision.ts` defines terrain/structure clearance proxies; all are renderer-independent.
- `src/data/assets.ts` owns stable asset identifiers and required rig sockets. Asset replacement must not alter game rules.
- `src/world/azureCoast.ts` owns disposable Three.js tile groups, LOD streaming, and shared materials. `tileLod.ts` is a renderer-independent stitched-edge contract; `terrainTile.ts` generates painted vertex colors and shoreline ribbons; `ocean.ts` renders original procedural water.
- `src/actors/dragon/wingRig.ts` constructs original three-bone skinned membrane meshes and animates them; `src/actors/dragon/visual.ts` composes the creature and a physically independent rider. `src/world/dressing.ts` and `src/world/landmarks.ts` own procedural scene-assembly recipes; `src/world/discoveries.ts` is an in-memory, renderer-independent discovery tracker.
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
- **Playwright**: Apache-2.0; dev-only Chromium software-WebGL smoke and screenshot testing (not shipped).

No paid assets. No remote CDN dependencies. Browser assets can later be exported with dedicated offline Blender and GLB tooling. Dependency size and iGPU performance must be measured rather than assumed.

## Known engineering gaps

1. `package-lock.json` must be generated and committed before declaring reproducibility.
2. Chromium software-WebGL smoke testing is available as a GitHub Actions workflow; real integrated-GPU benchmarks are still required before claiming 60 FPS.
3. 32:8 terrain LOD transitions are edge-height-stitched in G1; transition normal differences, foam continuity, and runtime screenshot QA remain.
4. Foliage is globally instanced rather than chunk-streamed; profile large-world memory before expansion.
5. Generated dragon model uses animated wing pivots, not a complete deforming bone rig. G2 requires an offline generator with GLB output and animation QA.
6. No water physics, quest persistence, audio, NPC schedules or actual asset replacement implementation yet.

### G2 form/interaction rules

- Flight is an arcade simulation, not a physics engine. A clearance height is recomputed from deterministic terrain plus conservative structure bounding cylinders.
- Land requires a clear slope and a near-ground position. A safety-oriented instantaneous takeoff lift is temporary until full animation-driven takeoff exists.
- Young rider remains 1:1 scale. On land, shrinking transfers the rider to an unmounted scene root; when the dragon remounts nearby, the rider is reattached.
- Small dragon can be controlled independently, but returning to the rider is required before mounting. Co-op puzzles, shoulder perch and rider walking are explicitly future work.
- Dragon mesh scale affects visuals only; gameplay collision dimensions come from immutable form configuration. Adaptation to Unreal must preserve this separation.
- Three-bone skinned wing mesh construction is an initial procedural animation rig, not complete production animation retargeting or GLB export.

### Animated G2 traversal contract (follow-up)

Landing and takeoff use renderer-independent time-stepped transitions in
`traversalTransition.ts`. Input is ignored for horizontal movement during the
fixed 1.45-second descent and 1.15-second ascent; size transformations are
blocked until the active transition completes. `animationPose.ts` maps
simulation state to normalized pose channels that drive the current three-bone
wing skins, diagonal walking gait, head, tail and rider lean. Visuals read the
**interpolated** simulation height rather than snapping directly to ground height.

The `?start=meadow` route starts at the fixed training meadow for repeatable
manual and Chromium checks. It does not introduce a new world seed or save state.

Do not conflate logical `mode` (ground/air, switched when the transition
begins) with `transition.phase` (landing/takingOff); HUD and animation
must report the latter until completed. Full obstacle collisions and
animation-root-motion are intentionally deferred.

### G3 cross-environment traversal (incremental)

- `src/world/waterPhysics.ts` owns permanent-sea-level, analytical seabed clearance, safe depths, and approach interpolation. It has no renderer dependency.
- `src/actors/dragon/swimming.ts` owns swimming response, depth changes and surface/dive switching. The G2 flight state is now explicitly `air|ground|surface|underwater`; the same deterministic `stepFlight` function routes to the water controller, so all forms retain identity and no level load occurs.
- `src/actors/rider/movement.ts` owns the young rider's separate x/y/z, heading, speed and `ground|surface|underwater` state. With the dragon in grounded small form, Tab switches control without remounting. Rider and dragon retain their own positions.
- `src/world/marineDressing.ts` generates reef, kelp and the Sunken Shrine from the Azure Coast seed. These are initial procedural assets, not imported art.
- The HUD/camera follow the **controlled** actor; fog and sky change when that actor is submerged. A water launch or splashdown is an eased vertical transition, just as G2 landing/takeoff is.
- Sea-entry requires sufficiently deep water and low approach altitude. Ocean floor is bounded by deterministic terrain-height samples; no collision is computed against triangle meshes, and no fluid dynamics or oxygen consumption is simulated.
- Form changes cannot dismount a rider in water, and remounting requires both actors on land within the established radius. The small dragon may not switch rider control while flying.
- Controls: F land/splash/launch, C dive/surface, Q/E underwater depth, Tab rider/dragon, W/S travel while swimming or on foot, A/D steering. All control definitions remain centralized for future remapping.

### G3.1 — Tidegate and rider-pose prototype

- `src/world/tidegate.ts` is an engine-independent, session-local state machine with explicit proximity, small-dragon, ground, actor focus and anchored-rune preconditions. It deliberately does not grant rewards unless **both** actors complete their own interactions. An unsolved anchor releases if the dragon leaves its stone.
- `src/world/tidegateVisual.ts` generates the rune plates and an awakening beacon. `AzureCoast` owns the visual object while the `Game` composition root owns the persistent-for-session puzzle state. No renderer objects enter the puzzle logic.
- `src/actors/rider/pose.ts` evaluates deterministic rider locomotion/swimming pose channels. The generated rider now has named shoulder and hip pivot groups so new authored assets can replace procedural geometry without altering gameplay state.
- G is the rune interaction key, avoiding conflict with E's existing bank/depth assignment. The on-screen panel reports nearby puzzle progress, including locked, anchored and awakened states.
- `azure.tidegate` is a stable discovery/asset ID. This first puzzle is purposely in a dry meadow; complex underwater cooperation, shoulder perching and cross-region gating remain pending. No quest or inventory persistence is claimed.
