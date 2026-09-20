# Character rendering — what ships, and what was tried

**Status: billboard sprites of the owner's reference art are the shipped look.**
The skinned-3D experiment (PR #7) was removed by this branch. This file records
why, and what a future 3D pass has to clear before it can replace the sprites.

---

## 1. The contract a character renderer has to satisfy

| Requirement | Source | How sprites meet it |
|---|---|---|
| Look like *the* student and *the* teacher | owner brief + `assets/source-art/` | they are literally the owner's renders, alpha-trimmed, never reinterpreted |
| Never stretch | `PLAYER.FIT_ASPECT`, `TEACHER.FIT_ASPECT` | height authoritative, width from the PNG's own aspect |
| Read as turning, not sliding sideways | `PLAYER.VIEW_*` | X-foreshortening `scale.x = W·cos(yaw)` + `SpriteMaterial.rotation` roll, front render swaps in when the body faces the camera |
| Slide must clear the HIGH bar | `OBSTACLES.TYPES.high` clearance 2.0 u | sprite crouches to `PLAYER.SLIDE_HEIGHT` 0.8 u; `getBounds()` is what collisions use |
| Zero-dependency boot | README "Zero-asset boot" | procedural placeholder frames if the PNGs are deleted |

Collision never consults the visual — `Player.getBounds()` / the teacher's
distance state machine drive gameplay, so a renderer swap is presentation-only
as long as those two APIs keep their shape. That is why the sprite fallback in
PR #7 could exist at all, and why removing the 3D path is a clean revert.

## 2. What PR #7 built, and why it came out

- Bodies were **generated in code** (capsules/boxes skinned onto the CC0
  KayKit `kaykit_char` skeleton, ~7.4k tris, 15 skinned meshes per character)
  with run/jump/land/crouch clips from `Med_MovementBasic/Advanced/General.glb`.
- The slide was a genuine procedural **bend** (per-bone euler targets blended
  over the cycle; crown 2.85 u → ~1.56 u, hips off the floor), which was the
  interesting part and is worth keeping in mind for round two.
- It was removed because a procedurally-assembled mannequin in a tie does not
  resemble the reference art. Everything else it cost — 1.5 MB of GLBs, a
  vendored `GLTFLoader`, a second render path in `Player.js`/`Teacher.js`, and
  the `?char=3d|sprite` mode switch — is now gone from the shipped game.
- Files deleted here: `js/characters/` (7 modules), `assets/models/rig/`,
  `.harness/{tools,art} rig helpers`, `research/{CHARACTER_SYSTEM,CHARACTER_SYSTEM_PLAN,ASSET_SOURCES}.md`.
  ~10.5k lines out of the tree.

## 3. If real 3D is attempted again

1. **Start from the art, not from a rig.** The gate is a side-by-side render vs
   `assets/source-art/student-front.png` judged by the owner, not by a test.
   A mannequin cannot pass that; a hand-modelled or photogrammetry-style mesh
   (or the owner's own model) might.
2. **Buy the shape, build the wardrobe.** Reusing the CC0 skeleton/animation
   layer is fine and cheap — licensing and network reachability were measured
   in the old `ASSET_SOURCES.md`: `cdn.jsdelivr.net`, `threejs.org`,
   `quaternius.com`, `kenney.nl`, `poly.pizza` and `raw.githubusercontent.com`
   were **all blocked** from the build sandbox; `registry.npmjs.org`,
   `github.com`/`api.github.com` and `codeload.github.com` (repo tarballs)
   worked. That is why the pack came from a `codeload` tarball of
   `sketchpunklabs/kaykit_char` (CC0-1.0, https://kaylousberg.itch.io/kaykit-character-animations).
3. **Rig facts worth keeping** (measured, not assumed): 23 bones; `GLTFLoader`
   sanitises names (`upperarm.l` → `upperarml`) and animation tracks must use
   the sanitised names; `Rig_Medium` carries a −90° X (Blender Z-up → Y-up);
   bind crown ≈ 1.24 rig units, so one uniform parent scale maps it to world
   height exactly once on a co-assembled `SkinnedMesh`+`Skeleton`; clips are
   in-place (root translation stays 0), so no root-motion cleanup is needed;
   `Crouching` only drops the crown 1.24 → 1.13, so **a slide must be authored,
   not borrowed** from that clip.
4. **Keep it behind a capability check, and keep one renderer authoritative.**
   PR #7's mode switch doubled the surface area of both entities for a look the
   owner did not ask for. Prefer a `CharacterRenderer` interface with the
   sprite implementation as the default and the 3D one only selected when a
   *real* character model ships.
5. Budget: draw calls ≤ 70 during play (guard), mobile ≤ 50 — see
   `.harness/tests/soak.mjs`.

## 4. Verification for this revert

`.harness/tests/run.mjs` (boot 27/27, empty 6/6, views 10/10, aspect 9/9,
gameplay 20/20 + environment contracts) and `.harness/tests/shot.mjs`
(menu / running / chase renders) run against the sprite renderer directly — the
`?char=sprite` pin the harness needed while both paths existed is gone, so the
suites test the only thing a player can now see.
