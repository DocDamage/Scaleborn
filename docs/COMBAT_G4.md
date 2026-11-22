# G4 combat foundation — first playable encounter

**Status: implementation slice; G4 is not complete.** Preserve the visual-quality hold in `docs/VISUAL_QUALITY_GATE.md`. Original generated enemies and flame effects are a functional implementation, not approved final painterly combat art.

## Try the encounter

Open `/?start=combat` (optionally `&quality=low`) and click **Take flight**. This stages a mounted Onyx on safe land facing the three original Gloam hounds east of the Tidegate meadow. Normal play can reach the same hounds around **(-410, -45)**. Press **R** or primary mouse button with pointer lock for directional fire breath. Turn with A/D or mouse, watch the plume, and aim at the creatures; the cone has bounded width/range, respects actual terrain occlusion, and cannot hit behind the dragon.

- Breath consumes a regenerating **Ember** pool; attacks have a 0.78-second cooldown. Small, rideable and giant forms have different reach and damage. Swimming, controlled rider and active traversal transitions cannot breathe fire.
- Gloam hounds pursue ground/low-air targets inside a finite aggro radius, stop at terrain blockers, wind up before melee, recoil when hit and leash home. High flying or diving escapes melee; their hit reaction and deaths have visible feedback.
- **Bond vitality** is shared between rider and dragon for this first slice. Repeated strikes can exhaust it. Defeat returns both safely to the Tidegate meadow with a short grace period, while preserving quest/discovery progress and already banished hounds. Encounter state is session-only until G5 save slots.
- The minimal two-bar display appears only near living threats or when vitality/ember is below full. It does not resurrect cluttered old HUD panels.

## Code boundaries and validation

- `src/combat/combat.ts`: renderer-independent fixed-step combat, directional damage, terrain occlusion, cooldown/resource math, enemy AI, telegraph, hit immunity, checkpoint recovery.
- `src/combat/visuals.ts`: original code-sculpted Three.js enemy and pooled fire-breath visuals, with stable enemy IDs and disposal. Meshes never determine gameplay hits.
- `src/app/game.ts`: composition + input, HUD and pause alignment.
- `tests/combat.test.ts` and `tests/combatVisual.test.ts`: deterministic regression tests. Run `npm run check` and inspect an actual browser/WebGL playthrough.

## Next G4 work (not yet delivered)

Rider magic (separate input/resource and casting), one genuinely coordinated dragon/rider bonded attack, additional threat archetypes/behaviors, encounter reward and checkpoint migration, enemy navigation improvements, properly authored impact/sound/facial/animation sets, targeting/accessibility options, and real RTX 3060 profiling/screenshot acceptance.
