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

### All-graphics-presets surface quality

Color-only terrain polygons failed the user's visual test. `surfaceTextures.ts` therefore generates tileable albedo, tangent-space normal and roughness maps for soil, rock and bark, with UVs generated for the cliff wall. Low quality gets map detail while High adds triplanar-style world-space material variation. These generated maps are **a substantial stepping stone** and must not be described as equivalent to high-resolution scan-based PBR assets. The screenshot review must verify visible grain at typical gameplay distances without conspicuous repetitive tiling. GPU/memory benchmarking on the real desktop remains required.

### Close-range foliage and movement visibility

A procedural tree may look full from above but skeletal at rider height if all leaves lie horizontally. The visual pass reorients leaf planes in three dimensions and increases woodland density around Mirrorfall while rejecting roots on extreme slopes. Acceptance requires inspection from low third-person camera positions, not exclusively aerial panoramas.

Swimming wakes are now generated around the controlled dragon and independent rider with a bounded pool of rings. The ring centers follow the same wave surface as physics and graphics. These are generated wake effects, not pressure-coupled volumetric water simulation.

### Responsive render budget (follow-up pass)

`src/app/adaptiveResolution.ts` independently controls internal pixel density using sustained frame-rate thresholds with cooldown. High-quality PBR materials remain enabled as resolution falls; this is a usability safety net rather than a replacement for profiling. Benchmark actual render GPU time, world-stream generation, and shader compilation, not just FPS. Quality screenshots with `?qa=1` lock their selected pixel ratio so regressions can be compared reliably.

### Mirrorfall lake light and shore-break alignment (visual pass 3)

- The shallow freshwater lakebed has a dedicated deterministic polar light
  mesh following `heightAt` (the exact collision terrain), with two moving
  interference bands, depth absorption and distance fade. It never crosses
  the procedural shore boundary. These are approximated caustics, not
  refractive ray tracing.
- Shoreline foam vertices now follow the same four wind-wave terms,
  directional drift and plunge-point displacement as the lake-water shader,
  with a thin 0.10 m separation rather than a detached static 0.82 m ring.
  Foam and the lake share one waterfall impact coordinate. Sea coast
  foam uses its existing behavior.
- The low preset uses fewer caustic mesh vertices; shader and lake physics
  remain present in both modes. Tests verify terrain alignment, shoreline
  containment, independent foam materials and animation uniforms.

### Depth-aware underwater optics (visual pass 4)

- Atmospheric color, exposure and fog strength respond to the **actual camera**
  depth below the collision-matched freshwater or seawater level. Fog transitions
  smoothly across the waterline rather than snapping when the player's
  swimming animation changes state; ocean and lake retain separate palettes.
- Sunlight attenuates with depth but remains navigable through Mirrorfall's
  full 148-meter basin. A deterministic crossed-card shaft field is confined
  to the lake and fades out well above the deep floor. This is screen-facing
  transparent geometry approximating visible light shafts, not volumetric
  raymarching, scattering integration or physically correct transmission.
- The new browser visual capture includes a third **actual submerged view**
  (`artifacts/mirrorfall-underwater-browser.png`) plus the existing overhead
  and shoreline views. Hardware GPU profiling and human image review remain
  mandatory before claiming final art quality.

### Actual-screenshot geometric correction (follow-up to visual pass 4)

A review of the **actual Chromium overhead and shoreline images** revealed broad,
smooth geometric walls and UV-stretched terrain at the lake's escarpment,
despite the earlier successful build and screenshot tests. Passing rendering
tests must not be mistaken for passing the artistic visual-quality gate.

- The flanking lake-bank heightfield now uses a broader eroded cliff ramp;
  the narrow central waterfall cleft stays steep. The same deterministic
  heightfield still drives terrain mesh, collision, and lake bathymetry.
- `terrainUvAt` projects painted surface maps in shared world coordinates
  with gradual vertical projection on Mirrorfall's high rock faces. This
  removes the previous single texture repetition across each 250 m tile,
  and preserves matched UV coordinates across LOD boundaries.
- Low-preset geological vertex colors receive layered strata rather than a
  flat gray slope. Seeded PBR scree uses the existing instanced boulder mesh
  and gently vegetated shelves, without introducing visible debug primitives.
- GPU-frame benchmarks and human review of new screenshots remain mandatory;
  generated textures and procedural rocks are still not photogrammetric assets.

### Underwater-facing water surface and foam correction

The initial real underwater screenshot exposed a dark solid-looking surface
and shoreline foam seen from below as a bright unnatural ring. The lake and
ocean shaders now use lower-alpha transmitted coloring for underwater-facing
fragments; surface-only breaking foam is discarded from below. Lake sunshaft
cards also use broader feathering and lower opacity to avoid vertical
laser-like streaks. These are shader approximations, not physical refraction,
and require a fresh **actual** browser screenshot before acceptance.
