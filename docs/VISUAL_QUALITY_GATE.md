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
Gerstner waves, a bounded shared waterfall impact-current field and ballistic spray are physically inspired real-time
approximations, not coupled two-way CFD. No fluid-pressure or buoyancy solver,
waterfall volume continuity simulation, screen-space reflections, real-time
global illumination, full shadow cascades, or photogrammetric art assets
are claimed. Those require a later simulation/renderer stage and real-GPU
evaluation. The waterfall visual is not an interactable current yet.

Keep the world self-contained and asset IDs renderer-neutral so future Fab
content and Unreal replacements remain possible.

## Render budgets
- **High (default):** full procedural surface shaders, denser geometry,
  higher pixel ratio; target dedicated desktop GPU.
- **Low (`?quality=low`):** uses the same terrain and water simulation with
  a reduced internal resolution and vegetation population and cheaper
  standard-material surface passes. Supports software-WebGL smoke tests.
  A successful low-mode test is NOT proof of high-mode fps, which must be
  measured on the user's GPU.

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

### Waterfall impact coupling (G3 visual-physics adapter)
- `src/world/waterDynamics.ts` provides one bounded current/wave/foam
  field centered at the rendered Cascade plunge point. Both swimmer
  controllers integrate the same current through collision-safe
  fixed-step updates. The freshwater shader receives the same
  impact coordinates and displaces waves, normals and foam.
- This improves movement response and visual continuity at the base of the
  waterfall, but still does **not** model mass conservation, water
  pressure, turbulence transport, dynamically changing depth or true
  interacting fluids. Keep full hydrodynamics on the visual blocker list.

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

### Bathymetry and material acceptance (visual pass 2)

- `src/world/lakeBathymetry.ts` samples the gameplay heightfield into a limited-size 2D data texture; the shader uses the same bathymetry to attenuate light through water using a Beer–Lambert approximation. This is **not** a refractive raytracer; it is a real-time shaded/transmissive approximation.
- Shallow water can reveal painted seabed; depth and wave normals modulate Fresnel reflection and directional highlights. Shoreline ribbons carry UV fade and time-varying wave breakup so white outlines do not dominate the image.
- Steep lake-facing terrain has rock/mineral vertex colors even on low settings. The standalone cliff face has independent mineral strata vertex coloration; geometry and gameplay still share the heightfield, with the cliff face a supplementary scenic detail.
- After starting flight, nonessential title/header and numerical cards are hidden; the M panel still exposes actual controls/status. The compass remains minimally visible. The completed UI must be verified across desktop, mobile and keyboard controls.

### Shared dynamic wave heights (rendering ↔ simulation)

`src/world/waterWaves.ts` uses the same four directional wave phase/amplitude components as the vertex shader and the same impact-ripple function as the waterfall. The swimmer controllers follow damped, time-dependent surface elevation instead of an unrelated perfectly flat plane. This prevents obvious visual/physics desynchronization while maintaining bounded arcade movement. High-frequency dynamics and actual two-way water pressure are still outside the implementation.

The waterfall curtain now has noisy, feathered break-up edges and a progressively wider impact sheet. This is animated transparent geometry and impact spray—not a volumetrically simulated liquid volume.
