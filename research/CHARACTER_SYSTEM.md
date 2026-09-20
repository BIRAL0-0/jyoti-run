# Character System — Shipped Design & Verification

**Status: SHIPPED (Phase 3 complete).** Both the student (player) and the teacher
(chaser) are now real, fully-3D skinned characters rendered by Three.js, replacing
the billboard sprites. The sprites remain as a zero-dependency fallback.

Supersedes [`CHARACTER_SYSTEM_PLAN.md`](./CHARACTER_SYSTEM_PLAN.md) (the original
plan; kept for history). Provenance details: [`ASSET_SOURCES.md`](./ASSET_SOURCES.md).

---

## 1. What shipped

| | Student (player) | Teacher (chaser) |
|---|---|---|
| Gender / look | **Male**, young — curly black hair | **Male**, middle-aged — grey baseball cap |
| Outfit (matches `assets/source-art/student-*.png`) | Black suit blazer + trousers, lavender/white collared shirt, dark tie + knot, blue lanyard (2 straps) with white ID badge + photo, white cuffs, black dress shoes | Blue short-sleeve polo (collar, placket, 2 buttons, chest logo), blue jeans (2 back pockets, back seam), dark-grey sneakers with thick white soles + heel tab, whistle on a ring at the belt |
| Triangles | ~7.4k | ~5.9k |
| Skinned meshes (materials) | 15 | 15 |
| Bones | 23 (CC0 KayKit humanoid) | 23 |
| World height (standing) | 2.85 u | 3.00 u |

Both wardrobes were read off the shipped reference PNGs
(`assets/source-art/{student,teacher}-{front,back}.png`) and rebuilt as
procedural geometry with matching colours and per-side detail (back vent, back
pockets, cap strap, badge, etc.) so the model is complete from every angle —
the chase camera mostly sees the back, so the back got as much detail as the front.

## 2. Provenance (free / open source)

- **Rig + animation clips:** [kaykit_char](https://github.com/sketchpunklabs/kaykit_char)
  (CC0-1.0), upstream "Character & Animations" by Kay Lousberg. We take **only**
  the 23-bone skeleton and the CC0 clips (`Idle_A`, `Running_A`, `Jump_Start`,
  `Jump_Full_Short`, `Jump_Land`, `Crouching`, `Hit_A`, `Interact`).
- **Bodies / clothes:** built procedurally in code (no downloaded meshes), so the
  wardrobe can match the reference art exactly and stays tiny in memory.
- Vendored under `assets/models/rig/` with `LICENSE` + `SOURCES.md`.

## 3. Architecture

```
js/characters/
├── RigLibrary.js        loads + caches the GLB rig once; sanitises bone names;
│                        extracts AnimationClips (three r160 has no clip.userData)
├── CharacterBody.js     PART BUILDERS (head/hair/cap/torso/arms/legs/shoes/
│                        tie/lanyard/badge/whistle…) → grouped by material →
│                        merged per material → skin weights → SkinnedMesh
├── skinning.js          rigid + tapered (2-bone) weight helpers, merge-by-material
├── CharacterTextures.js shared skin/hair/cloth palette + face texture
├── AnimController.js    clip state machine + the slide FOLD + bank/wobble
├── CharacterRig.js      public API: setMode/setSpeed/setSlideWeight/setBank/
│                        setWobble/setOpacity/setVisible/getCrownWorldY/…
└── CharacterFactory.js  studentSpec() / teacherSpec() — the two male wardrobes
```

**Skinning invariant** (order matters, or Three.js bakes a wrong inverse):
build parts at group scale 1 → add armature + meshes → `updateMatrixWorld(true)`
→ `new Skeleton` → `mesh.bind(skeleton)` → **then** set `group.scale/position`.
SkinnedMeshes set `frustumCulled = false` (skinned bounds are dynamic).

## 4. The slide is a BEND, never a flatten

`↓` / `S` / swipe-down folds the body at the joints. It is explicitly **not** a
scale/squash: `CharacterRig.group.scale` stays uniform at all times (asserted in
the tests), and the pose is authored as *bone rotations*.

- Pose deltas are authored as local Euler offsets and **baked at construction
  into absolute targets** (`bindQuat × deltaQuat`), because bind limb quats are
  not identity. `_applySlide` then slerps each bone toward its target by the
  slide weight; at weight 0 the mixer's clip pose is simply restored, so exiting
  the slide is automatic.
- Hip height is driven to an **absolute target** (`bindHipY − ROOT_DROP`), so the
  fold height never depends on which base clip is playing.
- Numbers (measured, world units): standing crown 2.85 → sliding crown **1.50**
  (HIGH obstacles clear at 2.0), hips stay **0.37** off the floor, knee flex ~84°,
  torso pitched forward, head tucked up-forward — a runner's slide, not a pancake.
- Tunables: `CONFIG.CHARACTER.SLIDE` (`ROOT_DROP`, `BLEND_IN/OUT`, `POSE`).

### Runner-cam dip

While sliding, the camera sinks/pulls in and widens FOV slightly
(`CONFIG.CHARACTER.SLIDE_CAMERA`) so the fold — and the bar being cleared —
reads clearly, Temple-Run style.

## 5. Modes & fallback

- `CONFIG.CHARACTER.MODE = '3d'` (default). URL override: `?char=3d` / `?char=sprite`.
- If the rig fails to load (missing files, GLTFLoader error) the game silently
  falls back to the legacy billboard sprites — gameplay contract unchanged.
- `Player`/`Teacher` keep their full public API in both modes
  (`getBounds`, `reset`, `stumble`, `forceCatch`, …).

## 6. Verification (the "verify tests")

| Suite | Where | What it proves | Result |
|---|---|---|---|
| `test-character.mjs` | node (no GPU) | both male wardrobes build clean (verts/materials, no NaN), skeleton intact, slide crown < 2.0, hips off floor, knees bent, **uniform scale**, bind height + scale-to-target | 15/15 |
| `tests/character.mjs` | headless Chrome (SwiftShader) | boots in 3D, both skinned rigs present, run clip animates, slide bends under the 2.0 bar without flattening, teacher chases in 3D, **fully-3D renders behind/side/front/¾**, zero console errors | 16/16 |
| `tests/run.mjs` | headless Chrome | the legacy sprite-mode contract (boot/views/aspect/gameplay) still passes, pinned to `?char=sprite` | green |

Run them:

```bash
cd .harness && npm install          # dev-only deps
node --import ./tools/node-loader.mjs tools/test-character.mjs   # node rig tests
node tests/character.mjs            # browser 3D tests (+ screenshots)
node tests/run.mjs                  # legacy contract suites (sprite)
```

Screenshots from the browser suite land in `research/screenshots/`
(`char-run-behind.jpg`, `char-slide-bend.jpg`, `char-teacher-chase.jpg`, `char-angle-*.jpg`).

## 7. Known limits / next steps

- Faces are a small texture + eye geometry, not a sculpted head — the semi-real
  look comes from proportion, silhouette and wardrobe, not facial detail.
- Hands are simple mitts (the CC0 rig has no finger bones).
- Hair/cloth are rigid-skinned (no secondary motion); a spring pass on the
  lanyard/hair would add life.
- Only one outfit variant per character is authored; the spec system makes
  adding variants (e.g. house colours) a data change in `CharacterFactory.js`.
