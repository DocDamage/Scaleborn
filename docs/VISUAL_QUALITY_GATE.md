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
  while reserving geological cliff masks for a later triplanar material shader. This
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

### Shoreline UV-regression correction

Actual rider-height screenshot review showed dense striated moiré bands where
the horizontal and vertical UV coordinate sets were interpolated across
Mirrorfall's slopes. The cliff mask is retained for later triplanar **shader**
blending, but mixed vertex UV projections are disabled. Both flat and steep
terrain now use stable continuous world-XZ tiling; this trades some steep-face
anisotropy for correct texture filtering and no projection-induced ripples.

### Underwater visibility correction after real-image inspection

The real submerged frame still showed a full-bright waterfall and thin distant
shoreline line. Surface-shader crest foam is now suppressed from below (in
addition to ribbon back-face suppression), and the waterfall's transparent
curtains opt into the scene's depth-aware fog. The resulting optical behavior
is still an approximation; the next captured frames must be reviewed for
readability and improved masking.

### Visual pass 5 — forest silhouettes and understory

The earlier prototype instanced four random variations of essentially one
tree mesh. Rider-height captures showed skeletal, repeating canopies and large
bare spaces. A new `treeCanopy.ts` now constructs four physically distinguishable
profiles (broad oak, high birch, conical shore pine, waterside alder), including
multi-segment tapered trunks, secondary twigs and thicker multi-angle leaf
clusters. A generated four-region leaf atlas gives each species different
individual alpha-tested shapes. These are still original procedural meshes,
not scanned or downloaded PBR forest assets.

`fernUnderstory.ts` supplies curved fronds with actual separate leaflets and
the same instanced wind-responsive material as ground grass. Plants are placed
only on suitable terrain heights and slopes; shoreline bank samples add
undergrowth without obstructing the established lake overflight corridor.
Meshes remain instanced by species/geometry with high/low detail budgets.

Art and performance acceptance remains **open** until the actual rider-height
captures are reviewed for canopy silhouette, groundcover coverage and
triangle/overdraw cost on an RTX 3060.

### Rider-height forest visual acceptance

The visual-capture script now stages an independently controlled rider on
real terrain twenty meters from an actual instanced lakeside oak. It saves
`artifacts/mirrorfall-forest-browser.png` in addition to the aerial,
shoreline and underwater renders. The scene uses normal game assets,
physics geography and camera framing, not stock or fabricated artwork.
Review canopy fullness, branch visibility, fern coverage and alpha cutouts
at this viewpoint before describing the new forest as visually adequate.

### Camera-local meadow grass (visual pass 5 follow-up)

A fixed-size `LocalGroundcover` field anchors original curved grass-blade patches
to deterministic world grid coordinates around the active rider/dragon, rather
than allocating millions of grass props over 4 km. The field is updated only
after a four-cell observer movement, rejects submerged/steep/built terrain,
preserves leaf-wind variation, and uses exactly **one instanced draw group**.
At the high setting the field covers a wider radius with finer spacing; low
uses less geometry. The screenshot inspection must still check distant
population fade/popping, foliage shading, frame rate and overdraw.

### Per-instance forest visibility (visual pass 5 performance safety)

Foliage formerly used one world-sized batch per species, causing every tree,
grass patch and boulder across the 4 km region to be submitted even from a
small shoreline camera view. `InstanceVisibility` records immutable instance
matrices and tints at generation, then repacks only nearby specimens into
the existing instanced mesh buffers when the player crosses a 48 m cell.
Low-quality foliage has a smaller submission radius, while forest trees retain
a longer distance than near-ground grass. One draw call per surviving batch;
no per-frame new mesh creation, world-coordinate reseeding or gameplay changes.

Known limitation: this is a CPU distance gate, not hardware occlusion culling,
impostor LOD, or GPU-driven per-instance culling. Test distant pop-in and
performance on the actual desktop GPU before visual release.

### Visual pass 6: physically inspired waterfall spray and plume breakup

The waterfall impact originally used 4 opaque torus outlines and 720 visible
icosahedral droplet beads. These read as game primitives in the real lake
screenshot. `PlungePoolFoam` replaces the toruses with one deterministic
lake-clipped mesh of translucent, irregular foam sheets. Its vertex waves use
the lake's four wind-wave bands and waterfall impact displacement; turbulent
fragment breakup prevents white unbroken ring outlines, with underwater
backface suppression. `sprayStreak.ts` supplies a crossed-card tapered alpha
texture and geometry; each ballistic particle rotates along its real velocity
and becomes a small soft splash streak rather than a polygonal sphere.

High uses the original 720 fixed-pool ballistic droplets, low uses 420.
Geometry and material disposal deduplicates shared waterfall materials.
The visible effect is still an approximation to splashing water; particle
pressure, mass conservation, waterfall-body collision and detailed 3D fluid
simulation remain unimplemented. Review *actual* browser waterline screenshots
and desktop-GPU alpha overdraw rather than treating the code as final realism.

### Plunge-pool 3D swimmer interaction

`waterDynamics.ts` now exposes `plungeVelocityAt(x,y,z)`, a bounded
world-space vector field for Mirrorfall Lake. Surface water retains the
previous radial push; with depth the outflow attenuates, a localized
downwelling jet forms under the impact and a weak surrounding upwelling
models recirculation. Dragon and rider diving targets integrate a controlled
fraction of the vertical component, clamped to their existing terrain-floor
and surface bounds. Normal upward controls are intentionally stronger than
the downwelling; outside Mirrorfall the velocity is zero. This is a
deterministic physically-inspired gameplay force, not a conserved or
pressure-coupled fluid volume. The rendered waterfall and foam still use
their existing visual wave approximation.

### Directional swimmer wake ribbons (visual pass 6)

Swimming no longer emits perfect full circles of opaque foam. A bounded
`SurfaceWake` pool uses original, open V-shaped Kelvin-style crest geometry,
a feathered alpha texture and the actual actor/rider heading, scale and
movement speed. Crests expand and fade behind each moving swimmer, with the
wake root following the shared lake/ocean wave height every frame.
These are simple painterly wave-edge visuals, not displaced fluid volume;
tests enforce geometry bounds, texture alpha and direction/wave alignment.

### Contact-triggered creature splash spray

`CreatureSplash` adds a fixed-pool instanced ballistic spray, reusing the
waterfall's original feathered streak geometry and texture. It responds
to an actual dragon splashdown contact, the start of water launch and
the separately controlled rider stepping from land into water. The
existing swimming wake no longer triggers in midair merely because
`beginTraversal` logically changed mode to surface. Particles obey
bounded gravity and drag, stop at the shared animated water surface and
are recycled without new per-frame geometry or texture allocation. This
is visually driven contact splash, **not** dynamic fluid displacement
or rigid-body buoyancy.

### Mirrorfall lakebed habitat

`LakebedHabitat` adds deterministic submerged river stones and ribbon
freshwater plants tied to the same physical heightfield used by swimming and
caustics. Two instanced materials/batches provide high/low density budgets;
the plants bend with a low-frequency underwater current. The habitat becomes
invisible outside a bounded lake viewing radius. Rocks are low and partly
buried; large collidable boulders, caves, wildlife, and photogrammetric
replacements are still future work. The lake depth remains navigable and the
procedural habitat does not alter terrain collision or quest state.

### Runoff across Mirrorfall cliff wings

The waterfall-adjacent rock strata gain a subtle animated mineral wetness
shader sharing the existing indexed cliff geometry. World-space moisture
varies with waterfall distance and height, with thin rivulets, broad damp
patches and distance fade. The overlay has its own fog-safe uniforms and
transparent no-depth-write shading; it does not allocate more rock triangles.
This is painterly runoff approximation, not a groundwater or erosion solver.

### Third-person terrain and landmark camera clearance

The chase, orbit, wide and overhead cameras now clamp their actual smoothed
view line against the gameplay heightfield and existing authored-structure
proxy cylinders. A bounded segment test with short binary refinement pulls the
camera ahead of occluding terrain instead of allowing hills, lighthouse walls
or cliffs to cut between the rider/dragon and the viewpoint. First-person
dragon-eye mode is unaffected. This is deterministic geometry-proxy
occlusion, not full mesh-triangle raycasting or a cinematic camera system;
verify framing near steep Mirrorfall banks and structures in the actual game.

### Flight interaction with the falling waterfall curtain

`waterfallCurtainDragAt` now maps a bounded airflow/water-pressure-like
deflection around the same curved X/Y trajectory and Z width as the actual
Mirrorfall curtain mesh. Airborne dragon flight is pushed gently downward
and outward when crossing it, then terrain and structure floor clearance
remain authoritative. Outside the falling sheet or below the lake surface,
the force is exactly zero. This is an arcade contact approximation, not a
full physical waterfall volume, pressure simulation or damage system.

### Visual pass 6 continuation — cliff material projection and camera collision

- All terrain presets now use world-space triplanar sampling of the existing
  painted albedo, normal and roughness maps, with slope-weighted XY/XZ/YZ
  projections. The projection is evaluated in the fragment shader rather than
  interpolating horizontal/vertical UV coordinates across steep triangles.
  Tile borders and LODs share fixed world coordinates and 13 m texture scale.
  This directly targets the stretched grain on Mirrorfall's high escarpments.
- The higher preset retains its additional procedural PBR microstructure and
  wet-material treatment. The low preset retains standard lit materials but
  no longer depends on top-down UVs for steep-slope texture appearance.
- Chase-camera clearance now solves structure-cylinder intersections along the
  complete sight segment (including roof-height crossings), rather than
  checking discrete samples alone. Terrain still uses bounded ray sampling.
  Narrow obstacles between samples no longer pass through the chase camera.

**Remaining visual gate:** these are source-level changes, not proof of
attractive rendered output or stable frame rate. Review actual browser captures
from rider height and near the cliff, shader compile logs and dedicated-GPU
frame budgets before accepting the visual overhaul. Original procedural maps
are not equivalent to high-resolution authored or scanned environment assets.

### Wake surface alignment (visual pass 6 continuation)

A fixed-origin height on the two 9 m swimmer wake shoulders left their
far tips cutting through or hovering above animated wind waves. The pooled
wake meshes now use a per-event vertex deformation that evaluates the same
four wave frequencies and the same lake-specific waterfall ripple as
`waterSurface.ts` and `waterWaves.ts`. The CPU origin sample is subtracted
because the mesh is already translated to the sampled water level. The
freshwater V-crests also clip their fragments against the real radial shore
mask, avoiding a white V continuing over dry lake-bank geometry.

The wave-following geometry is not two-way fluid displacement or a
fluid-pressure wake. Confirm contact and foam breakup in an **actual**
rider-height moving-water browser capture; keep final quality blocked until
that evidence and dedicated-GPU profiling exist.


### Underwater suspended material (visual pass 7 foundation)

- A camera-local but **world-cell stable** silt/particle field follows actual
  camera immersion and lake/ocean optical state, not a scripted dive trigger.
  Its deterministic hashed jitter reuses world-space cell locations as the
  camera moves, so it avoids whole-field random popping and per-frame buffers.
- The one-draw-call point shader clips at the same irregular Mirrorfall shore,
  prevents water particles floating above the waterline, softly fades the
  camera-near/far and particle-disc edges, and attenuates brightness at depth.
- High uses 5,733 points; low uses 1,521. Points are camera-local with a fixed
  per-quality budget, and the system disposes its GPU resources explicitly.
  Visual screenshot inspection and real hardware GPU profiling remain open.
- This is a surface/detail optical approximation, **not** volumetric fluid
  scattering or mass-conserving sediment transport.

### Dragon silhouette geometry pass (visual pass 7)

- The procedural dragon now uses closed, UV-unwrapped, smoothly lofted torso
  and tail meshes instead of segmented, visibly intersecting body spheres.
- Both wing membranes are tessellated and cambered with scalloped trailing
  edges, preserved three-bone weights and correctly mirrored skeletal spars.
- Creature form scales, wing bone/socket names and animation channels remain
  compatible with gameplay. This is a **geometry foundation**, not a claim of
  final creature art, final rider art or production-ready animation quality.
- Acceptance still requires an actual high-quality gameplay screenshot and
  in-game motion review, followed by authored creature/rider assets and rigs.


### Rider silhouette and simulated travel cloak (visual pass 7 continuation)

The rider now uses UV-unwrapped elliptical anatomical/garment contours for the
torso, overcoat, arms, trousers and swept dragon-hybrid horns rather than
intersecting oval torso/limb primitives or a six-sided cone cape. Existing
rider limb-pivot names, world-space dismount and unscaled mounted placement
remain unchanged. A tessellated double-sided cloth cape has anchored shoulder
vertices, animated curved fabric folds and bounded speed-responsive billow;
it updates in one persistent buffer without per-frame geometry allocation.
A generated repeatable weave texture provides modest material detail.

The rider is still **an original procedural stand-in**, not a fully authored,
rigged production character or evidence of the user's exact character design.
Replace with approved art and skeletal GLB/Unreal assets before final visual
acceptance. Validate close-range rider-height screenshots, face readability,
cape clipping during mounts, transparent fabric overdraw and frame cost.


### Rock-specific triplanar PBR and LOD-boundary lighting (visual pass 7)

Terrain now blends a dedicated seeded mineral albedo, normal and roughness
texture set into steep faces in the fragment shader on BOTH graphic presets.
The blend follows the interpolated terrain slope and elevation, uses the same
world-coordinate triplanar sampling on neighboring tiles and includes resource
cleanup for the additional textures. It is procedural PBR detail, not a scanned
rock material or proof of cinematic-quality cliffs. Slope masks and mip
behavior still require real-browser screenshot inspection.

Each streamed tile now derives a shared border normal from the authoritative
collision heightfield at fixed world-meter offsets. Two interior vertex rings
fade toward its original triangle-computed normals. This reduces shading seams
where high/low LOD boundaries meet without changing geometry, terrain height
or collision, and without recomputing all interior vertex gradients. Focused
regression tests cover both equal-LOD and mixed-LOD edges; validate actual
lighting on the lake escarpment in a browser frame before acceptance.


### Freshwater emergent bank vegetation (visual pass 7)

ShorelineReeds adds deterministic wind-responsive sedge/cattail clusters with
tapered stems, curved lit leaves and compact seed spikes. Plants are rooted to
the same lakebed heightfield used by collision, water masking and caustics.
Placement rejects dry land, deep water, steep slopes, sparse habitats and
the main waterfall plunge corridor, instead of projecting flat strips across
the bank. The high and low settings use different geometric/population budgets.

A single opaque instanced draw group is repacked around the player with
InstanceVisibility, preserving seed-stable site positions when revisiting.
Only plant tips sway: roots remain stable on the physical lakebed.
Tests check geometry validity, visible plant depths and heights, revisit
determinism and bounded draw populations.

These are **procedural environment assets, not the final approved art**.
Actual browser waterline and underwater captures must be reviewed for
plant height, color, overdraw and shoreline blend; RTX 3060 and integrated
GPU benchmarks remain required before closing the visual quality gate.

### Rider-height meadow mesh correction (groundcover visual pass)

- Local meadow tufts now use continuously curved, indexed grass blades with
  smooth vertex normals and gradient-painted blade colors instead of three
  flat disconnected triangles per blade. The high preset has more profile
  segments; low retains a smaller mesh. Both reuse a single instanced draw.
- High/low distribution spacing is slightly denser, and grass geometry
  shrinks smoothly over the final 14 m before the local view cutoff. This
  addresses abrupt patch-radius popping without transparency sorting or new
  draw calls. Quality screenshots at rider height and RTX 3060 profiling are
  still required; this change does not establish final foliage quality.

### Adaptive near-field ocean and lake wave tessellation (visual pass 7)

- The original 6.6 km ocean plane had ~60 m vertex spacing despite 8.3 m
  short-wave wavelengths. It could not faithfully displace short crests near
  a rider; broad polygons could visibly undercut the specular lighting.
- The ocean now keeps its far-water mesh but masks a 232 m square under a
  camera-following 256 m detail patch. A feathered 12 m overlap hides the
  patch rectangle while preventing coarse transparent waves showing through.
  The patch tracks a 16 m world grid; its GLSL wave origin updates in world
  coordinates to avoid phase resets when the camera moves.
- High uses a 160x160 detail patch and 320x264 lake tessellation; Low uses
  a 104x104 patch and 192x156 lake tessellation. Both preserve the existing
  four-band wave shader, lake/ocean masking, fragment fog and animated water
  physics; they add no per-frame buffers and keep independent disposal.
- **Still unverified visually:** actual waterline screenshots for patch-edge
  blending, underwater alpha overlap, GPU vertex cost and ocean/horizon
  transitions. No genuine FFT ocean or volumetric refraction is claimed.

### Cascade sheet breakup and live splash collision (visual pass 7)

The existing three irregular waterfall ribbons now shear in both horizontal
axes under a time-varying gust, with displacement weighted from a fixed crest
toward the plunge. Fragment streak advection accelerates with descent and
lower-sheet porosity breaks rectangular translucent veils into intermittent
water strands. The shared GLSL time uniform updates all curtains at once.

Ballistic spray now samples the exact CPU wind-wave/plunge-ripple height at its
position before recycling, including the active waterline after launching. It
falls back to the static basin level beyond the lake boundary. This is still
an artist-directed sheet shader and point-spray approximation, **not** an
interacting volumetric water simulation. Verify water sheet breakup, splash
placement, fogged underwater appearance and frame timing in real browser
screenshots before accepting the visual gate.


### Ocean multi-ring surface LOD (visual pass 6 follow-up)

The original 256 m camera-following ocean patch met the 8.3 m wave
Nyquist spacing locally, but cross-faded immediately into the ocean's
60 m-spaced long-range grid. That produced highly inconsistent wave
silhouettes and obvious geometry changes just beyond the rider.
The ocean now uses three independently shaded surface resolutions:
a 256 m detail patch (existing), a new 640 m middle patch (192×192
High / 128×128 Low), and the distant broad ocean. Each patch follows
the observer on the same snapped world-space origin, animates against
the same absolute wave coordinates and cuts out the underlying lower
detail inside its coverage. Separate feathered borders at 116–128 m
and 296–320 m limit transparent overlap and hard square seams.
The independent Mirrorfall Lake mesh and collision/wave equations are
unchanged. This is *not* FFT ocean synthesis or volumetric water;
capture real coastline, flight and waterline views to validate seams
and check increased vertex processing on desktop hardware.

### Wave-coupled coastal surf and breaking foam (ocean visual pass)

Streamed ocean shoreline ribbons now carry explicit cross-shore UV coordinates
and sit only 0.08 m above the undisplaced sea datum. Their vertex shader
follows the same four wind-wave bands **and** horizontal drift as the moving
ocean surface; the lake shoreline retains its separate plunge-pool ripple.
Both water bodies use a tapered foam-width envelope, with world-space
noise and animated crest break-up to avoid a flat full-width white strip.
This corrects static ocean-foam shelves cutting through animated waves;
it is an art-directed breaking-surf approximation, not shallow-water CFD.

Review actual moving browser coastline frames for land intersection,
alpha-sorted wave overlap, and offshore ribbon continuity. Source and
regression contracts do not replace screenshot inspection or GPU testing.

### Layered boulder geometry and grounded talus (visual pass 7)

The shared instanced scree/boulder mesh now has an indexed closed surface
with sculpted asymmetric fracture shoulders, height-dependent bedding
creases and per-vertex mineral stratigraphy. Both low and high budgets
use UV-mapped triangles with welded meridian normals. Instances are
aligned to local collision-heightfield gradients and partly embedded in
the soil, rather than using arbitrary steep Euler rotations that can
produce visibly hovering stones. Rendering still uses the existing PBR
rock maps and one instanced draw group with the established distance gate.
Tests cover normal/UV/strata validity, silhouette variation and footing.

The boulders remain original procedural geology, not approved scanned
production assets. Inspect actual rider-height scree and waterfall-cliff
screenshots for repeating forms, scale, penetration and normal seams;
dedicated GPU profiling is still required.

### Instanced-rock and forest world-space shader correction

High-quality rock/bark custom shaders now incorporate each object's
`instanceMatrix` when deriving world-space material positions, wetness and
geological/moss shading. Nonuniform instanced scales are removed before
transforming world normals. Previously, all instanced boulders and tree
trunks shaded the same origin-relative location even though their
positions and rotations differed. Low-budget map-only materials remain
unchanged; existing rock/bark geometry and instanced draw budgets remain
unchanged. Regression checks inspect shader injection for both materials.

This corrects a source-level shading defect, but it does not replace
actual browser screenshots or prove the absence of WebGL shader errors.


### Synchronized forest bough and leaf motion / alpha-tested shadows

Forest tree branches and foliage now share an instance-position-seeded,
root-anchored gust field, so leaves no longer drift independently of the
visible branches. The existing bark mineral/PBR shader remains chained,
rather than being replaced. On High, the same displacement is applied to
shared shadow-depth materials, including the actual leaf-atlas alpha cutoff,
avoiding rigid silhouettes and solid rectangular leaf-card shadows.
Low retains wind on lit tree meshes but skips shadow-only resources.
Regressions cover shader chaining, rooted displacements, shared clocks,
depth/alpha parity and the low/high graphics budgets.

This fixes a **source-level forest-motion and shadow defect**; it is not
evidence of in-game visual fidelity. Still require moving forest gameplay
captures, actual Chromium shader validation and GPU shadow-cost profiling.

### Actual low-mode forest capture: meadow density correction

The real rider-height forest and shore images captured from PR #12's
`3dbc77bc` pass show **isolated grass tufts separated by mostly featureless
dark-green terrain**, especially in the foreground. The
`LocalGroundcover` high/low world-grid spacing is now 2.10 m / 2.80 m
(previously 2.70 m / 4.35 m) with explicit bounded instancing and no new
draw groups. Grass blades are broader and the painted root-to-tip palette
was lifted to compensate for color multiplication through vertex paint,
instance tint and base PBR color. Fading and deterministic world-seeding
remain unchanged. This is a measurable density/material adjustment rather
than proof that the meadow looks finished; evaluate real shader screenshots
and GPU time before visual approval.
