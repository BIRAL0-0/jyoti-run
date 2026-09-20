# Phase 3 — Real 3D Characters (Teacher + Student) with a Bending Slide

**Goal (owner brief):** replace the flat billboard sprites with real **3D
characters** — a *student* and a *teacher* — with a proper **running
animation**, and a **slide on ↓ / S / swipe-down that BENDS the character
instead of flattening it**, in the spirit of *Temple Run* / *Subway Surfers*
(semi-realistic look, not a paper cut-out).

---

## 1. What is wrong today

`js/entities/Player.js` and `js/entities/Teacher.js` render `THREE.Sprite`
billboards. A sprite is a camera-facing quad, so:

| Requirement | Sprite behaviour today |
|---|---|
| slide | `scale.y` is squashed from 3.0 → 0.8 — the art is **flattened**, nothing bends (and with user PNGs there is only *one* frame, so it is literally a squashed photo) |
| run | two alternating still frames + a sine bob |
| turn | faked with `scale.x = W·cos(yaw)` + `material.rotation` |
| volume | none — no lighting response, no shadow of the body, no limbs |

Everything else in the game (lanes, jump parabola, hitboxes, teacher FSM,
difficulty, pooling) is solid and **must not change**.

## 2. Constraints discovered in this sandbox

Measured, not assumed (see `research/ASSET_SOURCES.md` for the full log):

| Route | Status |
|---|---|
| `cdn.jsdelivr.net`, `unpkg`, `esm.sh`, `threejs.org`, `quaternius.com`, `kenney.nl`, `poly.pizza`, `raw.githubusercontent.com`, `media.githubusercontent.com` (Git LFS) | **blocked** (`SSL_ERROR_SYSCALL` / empty reply) |
| `registry.npmjs.org` | ✅ reachable |
| `github.com`, `api.github.com`, **`codeload.github.com`** (repo tarballs) | ✅ reachable |
| `@pmndrs/assets` (npm, CC0 base64 assets) | ✅ downloadable but contains **no characters** (bunny / suzi / matcaps / HDRIs only) |

Consequences:

1. The only open-source **character animation** library that can actually be
   fetched here is one mirrored in a normal (non-LFS) GitHub repo:
   **`sketchpunklabs/kaykit_char` — CC0-1.0**, a mirror of Kay Lousberg's
   *KayKit Character Animations* (the "Universal Rig"). It ships
   **139 animation clips** as GLB + the rigged mannequin as glTF.
2. Because the CDNs are unreachable *from the sandbox*, the live preview needs
   an offline route for `three` itself → vendored copies under `assets/lib/`
   with a CDN pre-flight (the README already recommends vendoring).

## 3. Chosen approach — "open-source motion, authored body"

**Use the CC0 Universal Rig as the skeleton + motion library, and author the
semi-realistic bodies on top of it.**

Why not just re-texture the downloaded mannequin?
It is 6.7 k tris of *blocky* low-poly mannequin with a CRT face — re-skinning
it can never read as "semi-realistic student/teacher", and it has no hair,
clothes, backpack, saree or glasses. It also has exactly one material slot.

Why not build animations from scratch and ignore the CC0 pack?
Hand-authored motion is what makes runners feel good, but 139 professionally
keyed clips (run A/B, jump start/air/land, hit, death, dodge, crouch, sneak,
cheer) are free, CC0, and *already retargetable* — as long as our skeleton
uses the same joint names, hierarchy and rest pose. That is the cheapest path
to "Temple Run feel".

So the character pipeline is:

```
KayKit Universal Rig (CC0)  ──►  assets/models/rig/*.glb   (animation clips, unmodified bytes)
                                 .harness/art/rig-rest.json (rest pose extracted from the mannequin)
                                              │
                                              ▼
js/characters/RigSkeleton.js   bones rebuilt with the CC0 names/hierarchy/rest pose
js/characters/CharacterBody.js skinned, semi-realistic body + clothes authored around those bones
js/characters/CharacterFactory student / teacher wardrobes
js/characters/AnimController.js mixer + CC0 clips + procedural layers (banking, slide bend, wobble)
js/characters/CharacterRig.js  the façade Player.js / Teacher.js talk to
```

Retargeting is free: `AnimationMixer(root)` binds tracks by
`node.name → property`, and our bones carry the rig's exact names
(`hips`, `spine`, `chest`, `head`, `upperarm.l`, `lowerarm.l`, `wrist.l`,
`hand.l`, `upperleg.l`, `lowerleg.l`, `foot.l`, `toes.l`, …). The clips'
`root` translation drives vertical bob, so foot contact is preserved *because
we keep the rig's leg proportions* and only scale the whole character group.

### 3.1 The slide = a bend, never a flatten (the core requirement)

`ANIM.SLIDE` is a **procedural pose layer** applied on top of the mixer every
frame (so it works even if the clip pack is missing):

| Bone | Slide pose (target) | Why |
|---|---|---|
| `root` | y 0.41 → 0.30 | hips drop, feet stay on the ground |
| `hips` | pitch −0.35, roll into the trailing leg | sits *into* the slide |
| `spine` | pitch +0.55 (forward) | torso folds at the waist — the visible "bend" |
| `chest` | pitch +0.30 | continues the fold, shoulders stay under the bar |
| `head` | pitch −0.45 | looks *up/forward* (runner's eye line), not at the floor |
| `upperleg.r` | pitch −1.15 | trailing leg tucked under the body |
| `lowerleg.r` | pitch +1.45 | knee fully flexed (heel to hip) |
| `upperleg.l` | pitch +0.85 | leading leg shot forward, knee up |
| `lowerleg.l` | pitch −0.35 | almost straight — the "baseball slide" read |
| `foot.*` | toes up / planted | no floating ankles |
| `upperarm.*` | −0.9 / +0.5 | arms thrown back for balance |
| `lowerarm.*` | +0.7 | elbows bent, hands away from the ground |

Entry/exit are **eased** (`smoothstep` in over ~0.12 s, out over ~0.18 s) and
the pose is blended by weight, so the run cycle *morphs* into the slide and
back — the character bends at the waist and knees, keeps its volume, and the
group's `scale.y` is **never** touched (that was the flattening bug).

Verified numerically in the harness (`.harness/tests/character.mjs`):
head height < 1.9 world units under a 2.0 clearance bar, hips still > 0.3,
both knees flexed > 35°, `scale.y === 1`, and the slide hitbox matches
`PLAYER.SLIDE_HEIGHT`.

### 3.2 Semi-realistic look

* bodies authored from lathed/capsule/sphere primitives with real
  proportions (7.5-head adult teacher, ~6.5-head student),
* skin/fabric/hair **canvas textures** (512²) + generated **normal** and
  **roughness** maps (weave, folds, pores, plaid for the school tie/skirt),
* `MeshStandardMaterial` under the existing sun + hemisphere rig, with the
  character `castShadow` so the body finally throws a real shadow,
* separate meshes per material zone (skin / cloth / hair / dark / accent) →
  ~5 draw calls per character, still cheap,
* the sprite billboard path stays behind `CONFIG.CHARACTER.MODE = 'sprite'`
  (and is the automatic fallback if the rig fails to load).

## 4. Delivery plan

| # | Task | Output |
|---|---|---|
| 0 | plan + research log | `research/CHARACTER_SYSTEM_PLAN.md`, `research/ASSET_SOURCES.md` |
| 1 | fetch & verify the CC0 rig | `.harness/art/fetch-kaykit-rig.sh` → `assets/models/rig/*.glb` (+ `LICENSE`, `SOURCES.md`), `.harness/art/rig-rest.json` |
| 2 | skeleton + body authoring | `js/characters/RigSkeleton.js`, `CharacterBody.js`, `CharacterTextures.js`, `CharacterFactory.js` |
| 3 | animation | `js/characters/AnimLibrary.js` (GLB clips + procedural fallback), `AnimController.js` (state machine, crossfade, speed-scaled run, procedural layers), `CharacterRig.js` |
| 4 | integration | `Player.js` / `Teacher.js` use `CharacterRig` when `CHARACTER.MODE==='3d'`; `main.js` loads the rig, camera dips + FOV kick on slide; `config.js` gains `CHARACTER`/`ANIM` blocks |
| 5 | offline boot | `js/boot.js` (CDN pre-flight → vendored `assets/lib/`), vendored `three.module.js` + `GLTFLoader.js` |
| 6 | test & debug | `.harness/tests/character.mjs` (rig geometry, slide-bend assertions, animation playback, no console errors, screenshots), `run.mjs` suites updated for the 3D contract |
| 7 | docs | README section, asset credits/licenses, `.gitignore` whitelist |

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| CC0 clips reference bones we don't have (`handslot.l/r`) | the loader strips tracks whose bone is missing (same trick `sketchpunklabs` uses) — no mixer warnings |
| foot sliding from proportion changes | keep the rig's leg proportions exactly; scale only the root group |
| SwiftShader is slow in CI | characters are ≤ ~9 k tris each, ≤ 6 materials; soak test measures draw calls |
| CDN blocked for the preview | vendored `assets/lib/three` + GLTFLoader with a 1.5 s pre-flight |
| breaking the existing sprite contract tests | sprite mode stays fully intact and selectable; suites updated in the same change |
