# Visual quality gate — Scaleborn Azure Coast / Mirrorfall

**Priority: blocking.** The game is not visually release-ready. No more feature expansion
or new "playable screenshots" should be presented as complete before a visual review.

## Visual direction

Original, painterly dark-fantasy environment with believable natural materials and a
sparse, unobtrusive exploration HUD. Elden Ring is a reference for UI restraint,
not a target to copy assets, layout pixels or copyrighted UI artwork.

- Near terrain has a higher-resolution seamless mesh and a PBR shader with
  procedural world-space microstructure, slope-based stone transitions and
  water-adjacent wetness/roughness.
- Trees must have tapered trunks and branches and **actual individual leaf
  cards** with alpha-tested painted texture. Grass must be grass-shaped
  geometry and animated, not giant scaled cubes or icosahedrons. Rocks have
  irregular rounded geometry and moss/strata shading.
- The player may see **Mirrorfall Lake**, a ~750 m basin over 140 m deep,
  in the *same height field* used by geometry, collision and swimming.
  Ocean and lake have independent elevations. Lake water is masked to its
  shoreline; ocean water is discarded under the enclosed lake.
- Both bodies use a multi-band Gerstner-wave shader, wave-derived normals,
  Schlick-type Fresnel, view-dependent highlights, shallow/deep color and
  foam. Ocean and lake coasts use dynamic foam shaders.
- **Mirrorfall Cascade** is a multi-curtain flow with animated streaks,
  fixed-pool droplets obeying gravity and drag, impact ripples and mist.
  The waterfall feeds the lake visually, and its impact point/foam are
  anchored to the same lake surface.
- HUD: tiny header + compass + a short context-sensitive objective. Hide
  constant debug readouts and full control lists behind M. Keep the game's
  actual altitude/speed readouts; do not invent unimplemented HP or magic
  bars. F3 remains for performance and terrain diagnostics.

## Boundaries of this first visual overhaul

This is **not** a Navier–Stokes fluid solver or offline cinematic renderer.
Gerstner waves and ballistic spray are physically inspired real-time
approximations, not coupled two-way CFD. No fluid-pressure or buoyancy solver,
waterfall volume continuity simulation, screen-space reflections, real-time
global illumination, full shadow cascades, or photogrammetric art assets
are claimed. Those require a later simulation/renderer stage and real-GPU
evaluation. The waterfall visual is not an interactable current yet.

Keep the world self-contained and asset IDs renderer-neutral so future Fab
content and Unreal replacements remain possible.

## Quality checks to unblock a playable review build

1. `npm run check` green, existing gameplay and save tests still green.
2. Chromium WebGL2 browser test captures **artifacts/mirrorfall-lake-visual.png**
   from the actual game (not a generated mockup). No shader-compile or
   WebGL runtime errors.
3. Inspect the actual screenshot for large geometric blobs, obvious polygon
   color bands, terrain cracks, clipped water, unreadable waterfalls and
   intrusive HUD. Revise as required.
4. Confirm lake depth, lake/ocean collision distinction, safe splashdown,
   sea-level water and a continuous shoreline with automated tests.
5. Measure fps, draw calls and memory on the user's RTX 3060 as well as an
   integrated GPU; scaling/LOD decisions must follow measured evidence.
6. Never describe a screenshot as AAA quality or an actual fluid simulation
   merely because a shader or particle effect exists.

## Milestones after this branch

- Coastal vegetation and wet material art direction quality checks at
  low/medium/high presets.
- Waterfall curtain collision/flow and localized spray/foam field,
  full real-time lake current velocity field and water interaction coupling.
- Surface reflection, refraction, better caustics, underwater lighting,
  volumetric fog, dynamic weather/wind and splash animation from creatures.
- Authoring high quality dragon/rider creature replacements and imported
  animations, with stable asset ID/rig migration to Unreal.

The priorities are *environment materials and readability first*; expanding
quests and combat is on hold until the visual checkpoint improves meaningfully.
