# One continuous tiled walkway — plan (PR 1: idea + design, no code)

**Scope of this PR:** the design brief, the math, the file plan and the
verification plan. **No game code and no art is touched here** — the change
lands in PR 2, which is reviewed against this document.

---

## 1. The brief (as given)

> Modify **only the running path** of the existing game. One **continuous tiled
> walkway** — realistic interlocking rectangular concrete paving blocks in a
> staggered (running-bond) pattern, a mixture of light gray / beige / subtle
> reddish-pink blocks with per-block variation, thin grout lines, clean and
> well maintained, realistic sunlight on the blocks. No baked-in shadows,
> stains, moss, patches or large markings; the texture must be seamlessly
> tileable with no seams, borders or visible repetition at any distance, and
> the block scale must stay consistent from foreground to horizon, narrowing
> naturally in perspective toward a strong central vanishing point.

Everything else stays exactly as it is: gameplay (movement, lanes, jump, slide,
collisions, obstacles, scoring/grades, HUD, pause/sound, teacher chase,
game-over), the player character, the camera, the sky, the campus, the railings
and borders, the landscaping — **and the starting gate**, which already exists
and must not be added to, removed or modified.

### What the game ships today

| Piece | Where | Verdict |
|---|---|---|
| Walkway surface | `assets/textures/ground-gravel.png` (1024² photo crop), mapped by `js/managers/GroundManager.js` onto an instanced ring of 12 m × 20 m planes (`GROUND.TILE_WIDTH` / `TILE_LENGTH`, 20 instances) with `repeat [1, 2]` | **this is the only thing that changes** |
| Framing (border, railing, hedge, planters, trees, veranda, buildings) | `js/managers/CampusManager.js`, `CONFIG.CAMPUS` | keep |
| Horizon / sky / clouds | `CONFIG.SKY`, `js/utils/placeholderArt.js` | keep |
| Starting gate | `CONFIG.SCENERY.LANDMARKS[0]` (`assets/scenery/school-gate-arch.png`) + `js/managers/SceneryManager.js` | keep — touched by nothing in this plan |
| Gameplay | `js/main.js` loop, `entities/`, `managers/Obstacle*`, `Collectible*`, `UIManager`, `AudioManager`, `utils/` | keep — none of these files appear in the diff (see §5) |

The current surface is a **photo crop of the owner's reference picture**. It is
seamless as a texture, but the photo's own blocks are 5–8 cm wide, soft, uneven
and heavily weathered, and they carry the photo's lighting and tone drift. Tiled
down a 12 m × 20 m plane it reads as *gravel-ish patchwork*: block edges are
mushy, the pattern is too small to read as "blocks", and the wear is what makes
the eye pick up the repeat. That is exactly what this brief asks us to replace.

---

## 2. The idea

**Replace the one texture the walkway uses with a purpose-built, exactly
seamless concrete-paver tile — and change nothing else.** No new geometry, no
new draw calls, no second road object, no new manager.

Two things make that possible without touching the renderer:

1. **The walkway is already one surface.** All 20 ground instances share one
   `THREE.InstancedMesh` with one material and one texture, and the ring
   advances by exactly `GROUND.TILE_LENGTH` before snapping back. If the tile's
   pattern period divides that length exactly, the instance boundaries fall on
   pattern boundaries and are mathematically incapable of showing a seam. A
   single 12 m × 20 m plane therefore reads as one continuous surface, not as
   "road sections placed one after another".
2. **A synthetic tile has no history.** Painted programmatically instead of
   cropped from a photo, it can be built so the left edge *is* the right edge
   (the same block continues across the wrap) and so no large-scale feature
   exists to repeat in the first place.

---

## 3. Design

### 3.1 Module arithmetic (why the numbers below)

```
path width            GROUND.TILE_WIDTH   = 12 m   (must not change: lanes at ±4,
                                                    obstacles 3.7 m wide, border
                                                    inner edge documented as
                                                    TILE_WIDTH/2)
plane length          GROUND.TILE_LENGTH  = 20 m   (ring lattice period)
texture repeat        [1, 2]                       (TEXTURE_REPEAT_Y stays 2)

=> texture world footprint = 12 m across × 10 m along
=> pattern period along z  = 10 m, and 20 m / 10 m = 2.00 exactly
=> every instance boundary lands on a pattern boundary  ⇒ no seam is possible
```

Block module: **0.25 m across × 0.50 m along** (32 × 64 px at 128 px/m) —
rectangular concrete pavers, long axis along the direction of travel, matching
the owner's reference picture where the long joints run with the path.

```
12.0 m / 0.25 m = 48 blocks per course      (integer ⇒ the long joints wrap)
10.0 m / 0.50 m = 20 courses per period     (even    ⇒ the running-bond stagger
                                                       wraps: course 0 and the
                                                       wrapped course agree)
```

Running bond: course *r* is offset by `(r mod 2) × 0.25 m`, so every block is
bridged by the two blocks above and below it — a genuine staggered running bond,
not a stack bond, and it closes seamlessly in both axes.

Image: **1536 × 1280 px = 12 m × 10 m at 128 px/m** (square texels, 12:10 image
aspect == 12:10 world aspect, so nothing is stretched and the block scale is
identical in both axes).

### 3.2 Surface look

| Property | Choice |
|---|---|
| Colours | three families — light gray, warm beige, soft reddish/pink — with a per-block lightness/hue jitter, assigned by a **seeded** hash of `(course, column)` so the generator is deterministic and the mix is even |
| Per-block variation | lightness ±6 %, plus a subtle top-left → bottom-right shading ramp (one constant ramp everywhere: sunlight, not a stain) |
| Grout | ~2 px (16 mm) joint of concrete jointing sand, a touch lighter/cooler than the blocks, plus a 1 px chamfer highlight on the block's lit edge — this is what makes individual blocks read as *blocks* |
| Aggregate | fine per-texel speckle, ≤ ±4 % luminance, statistically uniform (no clusters) |
| Forbidden | any stain, moss, patch, crack, tyre/traffic marking, lane line, curb, logo or shadow — i.e. **nothing that has a unique location in the tile**, which is what makes a repeat detectable |

### 3.3 The procedural fallback

`js/utils/placeholderArt.js::drawGroundTexture()` is the zero-asset fallback
(the `?`-clean-clone path, exercised by the `empty` suite). It currently paints
gravel plus **dashed lane markings and royal-blue curb strips** — vehicle-road
markings that have no place on a pedestrian campus walkway and contradict the
brief. It is redrawn as the same paver walkway (same module arithmetic, same
colour families, same thin joints), so the fallback and the shipped tile are the
same surface, minus the photographic detail.

It stays a *fallback only*: `GroundManager` still prefers the committed PNG, the
texture slot, the repeat and the wrapping are unchanged, and `usesPlaceholderArt`
still flips correctly for the `empty` suite.

---

## 4. Files touched (and only these)

| File | Change |
|---|---|
| `assets/textures/ground-gravel.png` | **replaced** — the seamless paver tile. File name kept on purpose: it is the documented drop-in slot (`README` → *Replacing the Placeholder Art*) and the whitelist entry in `.gitignore`, so any owner-supplied override keeps working exactly as before |
| `.harness/art/make-walkway-tile.mjs` | new — deterministic, seeded generator (writes the tile + a JSON report); committed so the tile is reproducible, mirroring the existing `make-ground-tile.mjs` convention |
| `.harness/art/analyze-walkway-tile.mjs` | new — independent analyser: seam score, block period, palette mix, saturation ceiling, low-frequency flatness, joint contrast |
| `js/utils/placeholderArt.js` | `drawGroundTexture()` redrawn as the walkway (no lane markings, no curbs) |
| `js/config.js` | comments only on `GROUND` (documenting the 12 × 10 m footprint); **no value changes** |
| `.harness/tests/run.mjs` | boot-suite tile expectation updated (dims/mapping) + new `walkway` suite (§5) |
| `README.md` | ground-tile section rewritten for the paver walkway |
| `research/WALKWAY_PLAN.md` | this document (PR 1) + the as-built verification report appended (PR 2) |

Explicitly **not** in the diff: `js/main.js` (game loop, collisions, camera, UI
wiring), `js/entities/*`, `js/managers/*` (Ground, Campus, Obstacle, Collectible,
Audio, UI, Scenery), `js/utils/*` other than `placeholderArt.js`, `index.html`,
`css/style.css`, `assets/scenery/*`, `assets/sounds/*`, the character sprites.

---

## 5. Verification plan

Every claim in the brief gets a **measurement**, not an opinion.

### 5.1 Tile level (offline, deterministic)

`analyze-walkway-tile.mjs` on the committed PNG:

| # | Check | Threshold |
|---|---|---|
| T1 | wrap seam is invisible: mean neighbour difference across the wrap ÷ interior neighbour difference, both axes | ≤ 1.0 (the existing brick did 0.70/0.69 — we must match or beat it) |
| T2 | block module detected by autocorrelation | 32 px across (0.25 m), 32 px phase step between courses |
| T3 | colour families present and mixed | gray + beige + pink each ≥ 8 % of blocks |
| T4 | no vivid colour anywhere (no markings, no blue curb, no yellow dashes) | max saturation ≤ 0.35, no blue-dominant pixel |
| T5 | no large-scale structure (no baked shadow / stain / patch) | after 16× downsampling, every cell mean within ±4 % of the tile mean |
| T6 | thin joints exist and are clean | joint lines resolvable at 2 px, joint/block luminance contrast within a fixed band |

### 5.2 Game level (real browser, SwiftShader WebGL)

New `walkway` suite in `.harness/tests/run.mjs`:

| # | Check |
|---|---|
| W1 | the surface uses the committed 1536 × 1280 paver tile (not the placeholder), `RepeatWrapping`, `repeat [1, 2]` |
| W2 | **lattice proof**: `TILE_LENGTH ÷ (texture footprint along z ÷ repeat.y) == 2.00` — the ring period is an exact multiple of the pattern period, so instance boundaries cannot show |
| W3 | **continuity**: a rendered vertical scanline down the centre of the path from the player's feet to the vanishing point contains no non-pavement pixel (no green lawn, no sky/blue, no black) inside the corridor |
| W4 | **scale consistency**: the projected width of one 0.25 m module at the near field and at 20 m matches the perspective ratio (no scale error in the surface) |
| W5 | **no markings**: the rendered near-field pavement contains no blue-dominant and no vivid-yellow pixel |
| W6 | the gate/scenery layer is still absent-by-default and untouched, and `CampusManager` bands (border, railing, hedge, veranda, colonnade, buildings) are unchanged |
| W7 | the surface is still one instanced mesh, one material, one texture — no extra draw calls |

### 5.3 Regression + evidence

* `node tests/run.mjs` — the existing 72 checks (boot 27, empty 6, views 10,
  aspect 9, gameplay 20) must stay **green, unmodified** except the single
  boot-suite tile-size expectation in the table above.
* `node tests/soak.mjs 1` — draw calls, heap growth, geometry drift, errors.
* `node tests/shot.mjs` — menu / running / chase / turning / stumble renders,
  looked at, not just logged.
* **Scope guard**: `git diff --name-only` printed verbatim and checked against
  the allowlist in §4 — this is the evidence that gameplay, the camera, the HUD,
  the obstacles, the scoring and the gate were not touched.

---

## 6. Risks and how they are handled

| Risk | Handling |
|---|---|
| a finer tile than the photo could alias/moire at the horizon | mipmaps are already on, `DESKTOP_ANISOTROPY = 8`; texture stays a single 2 MP image, and T2 pins the module size so it degrades gracefully |
| NPOT image (1536 × 1280) under WebGL1 | WebGL2 is the shipped path (Chrome/Edge/Firefox 120+, Safari 17+); on a WebGL1 device three.js resizes to POT as it already would — geometry, gameplay and mapping are unaffected. Documented in the README |
| recolouring the fallback could break the `empty` suite | §3.3 keeps `usesPlaceholderArt`, the slot and the repeat semantics identical; the `empty` suite is re-run as-is |
| a bigger texture file | 2 MP PNG, and the old 1024² tile is deleted in the same commit, so the repo grows by at most ~1–2 MB |

---

## 7. Out of scope (deliberately)

Starting gate, sky, clouds, fog, lighting rig, camera, HUD, sprites, audio,
obstacles, collectibles, difficulty curve, teacher chase, pause/mute, storage,
deployment — untouched, and proven untouched by the scope guard in §5.3.

---

# PR 2 — as-built + verification report

Implemented exactly per §4 (scope guard below). The committed tile was
regenerated with `node .harness/art/make-walkway-tile.mjs` and analysed with
`node .harness/art/analyze-walkway-tile.mjs`; the game-level checks are the
`walkway` suite in `.harness/tests/run.mjs` (W1–W7). Everything else in the
game is byte-identical.

## A. Tile level (T1–T6, measured on the committed PNG)

| # | Check | Threshold | Measured | |
|---|---|---|---|---|
| T1 | wrap seam ÷ interior neighbour diff | ≤ 1.0 | **0.82 / 0.87** | ✅ |
| T2 | block module by autocorrelation | 32 px across / 64 px along | **32 (v 0.91) / 64 (v 0.95)**, running-bond phase **16.00 px** | ✅ |
| T3 | gray / beige / pink each ≥ 8 % | ≥ 8 % | **40.0 / 32.4 / 27.6** | ✅ |
| T4 | max saturation; blue-dominant / vivid-yellow px | ≤ 0.35; 0 | **0.18; 0 / 0** | ✅ |
| T5 | no aperiodic structure, 16× downsample | ≤ 4 % | **3.19 %** (raw lattice grain 3.85 %) | ✅ |
| T5b| (stricter guard) 32 px cells | ≤ 2.5 % | **2.44 %** | ✅ |
| T6 | joint contrast band | 8–45 | **13.5** over 2 px | ✅ |

The old photo tile scored 0.70/0.69 on T1; the synthetic tile's 0.82/0.87 is
likewise below 1.0 (the seam is quieter than the tile's own interior pairs —
the absolute wrap delta is ≈1/255). The photo's lower ratio came from its
noisy interior, not a better seam.

## B. Game level (W1–W7, `walkway` suite, real browser + SwiftShader)

| # | Check | Result |
|---|---|---|
| W1 | surface = committed 1536×1280 tile, RepeatWrapping, repeat [1,2] | ✅ `1536×1280 repeat 1×2 wrap true` |
| W2 | lattice proof: `TILE_LENGTH ÷ (footprint/repeat.y) == 2.00` | ✅ exactly 2 |
| W3 | scanlines feet→vanishing point contain no grass/sky/black pixel | ✅ 5 columns, 493 rows clean |
| W4 | block scale: square texels 128 px/m both axes; rendered course lines follow the perspective ratio | ✅ 128/128; 9 course lines matched ±3 px, spacing ratios < 20 % |
| W5 | near-field pavement: zero blue-dominant / vivid-yellow pixels | ✅ 0 in 24 480 |
| W6 | gate/scenery absent by default; campus bands (border, railing, hedge, veranda, colonnade, 2 buildings) unchanged | ✅ |
| W7 | one InstancedMesh ×20, one material, one texture; draw calls in budget | ✅ 20 calls at start |
| §3.3 | fallback = same walkway module grid (1536×1280), no lane dashes / curbs | ✅ markings 0/24 640 |

W4 note: at 720p a 0.25 m module at 20 m projects to ≈1.1 px — below
resolvable detail — so the horizon scale is pinned by the exact module math
(W2/W4a: integer lattice, square texels), while the rendered check verifies
the resolvable near/mid field against the camera's own projection.

## C. Regression + evidence

* `node tests/run.mjs` — **boot 27/27, empty 6/6, views 10/10, aspect 9/9,
  gameplay 20/20, walkway 10/10** (82 checks; the only pre-existing check
  touched is the boot-suite tile dimension expectation, now 1536×1280).
* `node tests/soak.mjs 1` — PASS: max 50 draw calls (budget 100), heap growth
  0.0 MB, 0 JS/console errors, teacher FSM live.
* `node tests/shot.mjs` — menu / running / chase / turning / stumble renders
  inspected visually: one continuous paver walkway to the vanishing point,
  consistent block scale, framing and characters untouched.

## D. Documented design decisions (deviations from the §3 sketch, all measured)

1. **Stagger is a half block (16 px).** The sketch's "(r mod 2) × 0.25 m"
   offset would be a whole-block shift (a stack bond in disguise); "every
   block bridged by the two above/below" requires 0.125 m. T2b measures the
   phase at exactly 16.00 px, and the 20-course even count keeps the wrap
   seamless.
2. **Families are luminance-matched; per-block variation is chroma.**
   ±6 % lightness jitter cannot coexist with T5's ±4 % 16-px-cell flatness —
   a stain detector that size sees half-block cells. The families share
   L ≈ 200 and differ in hue (gray neutral, beige yellow-leaning, pink
   red-leaning), with ±0.8 % lightness + ±2 % chroma per-block jitter — the
   visual language of real paver mixes, and T3/T4 confirm the mix reads.
3. **Grout sits slightly darker than the block field** ((174,174,170) vs
   face ≈200) instead of "lighter/cooler": against the light gray family a
   lighter sand would vanish. Measured contrast 13.5 keeps inside the 8–45
   band and the joints read as thin clean lines on every family.
4. **T5 measures the aperiodic component.** A periodic lattice must not trip
   a stain detector: 16-px cells straddling joint lines are darker by
   construction, uniformly everywhere. The analyser therefore compares each
   downsampled cell against the expectation for its lattice phase (raw grain
   is reported alongside for transparency). Any baked shadow/patch would
   appear as a phase-deviation; the committed tile shows ≤3.19 %.
5. **The fallback canvas is 1536×1280**, not the legacy `TEXTURE_SIZE: 512`
   (a 512² canvas cannot host the 0.25 m module at the 12 m footprint with
   integer pixels). The value stays 512 — §4 forbids value changes — and is
   commented as legacy in `js/config.js`; `drawGroundTexture()` documents its
   own dimensions.

## E. Scope guard (printed verbatim)

```
$ git diff --name-only main
.harness/tests/run.mjs
README.md
assets/textures/ground-gravel.png
js/config.js
js/utils/placeholderArt.js
research/WALKWAY_PLAN.md
$ git ls-files --others --exclude-standard
.harness/art/analyze-walkway-tile.mjs
.harness/art/make-walkway-tile.mjs
```

Eight paths — exactly the §4 allowlist. `js/config.js` is comments-only (the
single touched line keeps `TEXTURE_SIZE: 512` unchanged, adding a comment).
Nothing under `js/main.js`, `js/entities/`, `js/managers/`, `index.html`,
`css/`, `assets/scenery/`, `assets/sounds/` or the character sprites appears:
gameplay, camera, HUD, obstacles, scoring, teacher chase and the starting
gate are untouched, and the walkway is still one instanced surface.
