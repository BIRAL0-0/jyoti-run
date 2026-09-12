# 🏫 School Runner: Teacher Chase

A 3D endless-runner web game built with **Three.js** — you're a student sprinting
down the schoolyard, dodging obstacles and grabbing grade papers, while the
**teacher only appears when you make mistakes**. Inspired by Subway Surfers +
Temple Run.

> **Zero-asset boot:** the game ships fully playable with *no asset files* —
> all art is generated procedurally at load (canvas textures + low-poly
> primitives) and all audio is synthesized with the Web Audio API. Drop your
> own images and sounds into `assets/` to override anything (see below).

## 🎮 How to Play

- **Dodge obstacles** — jump over desks, slide under barriers, switch lanes
  around lockers
- **Collect grade papers** (D → C → B → A+) for points; better grades unlock
  at longer distances (B at 500 m, A+ at 1500 m)
- **Avoid the teacher** — she's *invisible* until your first mistake, then
  she's right behind you (red screen edges = she's close!)
- **Recover** by running **100 m clean** — hit three obstacles (or let her
  catch you) and it's game over

| Obstacle | Examples | Counter |
|----------|----------|---------|
| Low | desk, crate, bench | **Jump** (↑ / W / Space, swipe up) |
| High | barrier, gate | **Slide** (↓ / S, swipe down) |
| Blocker | locker, roadblock | **Change lane** (← → / A D, swipe left/right) |

## 🎯 Controls

**Desktop**

| Key | Action |
|-----|--------|
| `←` / `→` or `A` / `D` | Switch lanes |
| `↑` or `W` or `Space` | Jump |
| `↓` or `S` | Slide |
| `P` or `Esc` | Pause / resume |
| `M` | Mute / unmute |

**Mobile** — swipe in any direction (24 px threshold). No on-screen buttons.
The game auto-pauses when you switch tabs.

## ⚙️ Setup

The game is pure static files (vanilla ES modules, no build step) but **must
be served over HTTP** — ES modules + texture loading don't work from
`file://`. Any static server works:

**Option A: VS Code Live Server** *(recommended)*
1. Install the “Live Server” extension
2. Right-click `index.html` → *Open with Live Server* → `http://localhost:5500`

**Option B: Python**
```bash
cd jyoti-run
python3 -m http.server 8000
# open http://localhost:8000
```

**Option C: Node**
```bash
npx http-server -p 8000
# or: npx serve
```

> Three.js r160 and Howler.js 2.2.4 load from the jsDelivr CDN via an import
> map, so keep internet access on first load (or cache them into `assets/lib/`
> and edit the import map in `index.html` for fully-offline use).

## 🎨 Replacing the Placeholder Art

The three custom images are **optional drop-in overrides**. Put them here and
reload — no code changes needed:

```
assets/textures/
├── ground-gravel.png       ← seamless ground texture (1024×1024+, tiles 12×10 u)
├── student-character.png   ← student sprite, transparent background (≥ 512×512)
└── teacher-character.png   ← teacher sprite, transparent background (≥ 512×512)
```

- Character PNGs are rendered as **billboard sprites** with the pivot at the
  feet. Anything with a transparent background works; a front/back view of
  your character looks best (you see the student's back, the teacher's front).
- With a single-image character the run/jump/slide poses are animated with
  transforms (bob, squash, wobble). With the built-in placeholders each pose
  is a separately drawn frame.
- On boot the game silently probes for these files; if one is missing it uses
  the procedural version instead. (The probes show as 404s in the DevTools
  console/network tab when the files are absent — that's expected and
  harmless.)

### Adding real sounds (optional)

```
assets/sounds/
├── jump.mp3  collect.mp3  hit.mp3
├── teacher-alert.mp3  gameover.mp3
└── bg-music.mp3        ← loops
```

If `bg-music.mp3` exists, the game lazy-loads **Howler.js 2.2.4** (pinned CDN
URL) and plays whatever files are present; any missing file falls back to the
built-in Web-Audio synthesis. No game code needs to change.

### Adding 3D models (optional, advanced)

Obstacles are intentionally built from primitives in code (1 draw call each,
zero downloads). If you want GLB models instead, `scripts/download-assets.sh`
fetches the CC0 packs researched in Phase 1 (Kenney Furniture Kit, Quaternius
traffic props, KayKit road bits) into `assets/models/`. To use them you'd add
`GLTFLoader` (from `three/addons/loaders/GLTFLoader.js`) in
`js/managers/ObstacleManager.js` and replace `buildVariantGeometry()` — the
pooling/collision logic stays the same (each variant's collision box is in
`CONFIG.OBSTACLES.TYPES`).

## 🔧 Customization

Every tunable number lives in **`js/config.js`** — speed ramp, lane width,
jump height, teacher chase distances, obstacle types & spawn rates, grade
tiers & points, colors, audio volumes, mobile performance settings, and debug
flags:

```js
DEBUG: {
    SHOW_FPS: false,             // live FPS/draw-call/tri counter
    SHOW_COLLISION_BOXES: false,
    GOD_MODE: false,             // no collisions (testing)
    SKIP_START_SCREEN: false,
}
```

URL params `?desktop=1` / `?mobile=1` force desktop/mobile tuning (useful for
testing). `window.__game` exposes the live game instance in the console.

### Difficulty at a glance

| Distance | Papers | Speed | Obstacles |
|----------|--------|-------|-----------|
| 0–500 m | D + C | 15 → rising | sparse, single obstacles |
| 500–1500 m | C + B | mid | denser, doubles begin |
| 1500 m+ | B + A+ | → 45 (cap) | 65% spawn chance |

Speed ramps 15 → 45 units/s at +0.5/s; obstacle spawn chance eases from
25% → 65% between 500–1500 m (smoothstep — no difficulty cliffs).

## 🌐 Deployment

**GitHub Pages**
1. Push this repo to GitHub
2. *Settings → Pages → Source: Deploy from branch → `main` / root*
3. Live at `https://<user>.github.io/jyoti-run/`

**Netlify** — drag the repo folder onto [netlify.com/drop](https://app.netlify.com/drop)
for an instant URL. **itch.io** also works (zip the folder, upload as HTML5 game).

## 🖥️ Browser Compatibility

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome | 120+ | ⭐ best (primary target) |
| Edge | 120+ | excellent |
| Firefox | 120+ | excellent |
| Safari (macOS/iOS) | 17+ | good; audio unlocks on the START tap |
| Mobile Chrome/Safari | latest | good; shadows auto-disabled, pixel ratio capped |

Browsers without WebGL or import-map support get a friendly fallback screen.

## 🐛 Troubleshooting

- **Blank page / CORS error** — you opened `index.html` via `file://`. Serve
  it over HTTP (see Setup).
- **Textures black or missing** — check the Network tab for 404s and keep
  assets same-origin.
- **No sound** — click START first (browser autoplay policy); check the 🔊
  button; iOS silent-switch mutes Web Audio.
- **Low FPS** — set `LIGHTING.SHADOWS.enabled = false` or
  `GROUND.VISIBLE_TILES = 14` in `js/config.js`.

## 📦 Project Structure

```
├── index.html                  # entry point + import map (three@0.160.0)
├── css/style.css               # UI (glassmorphism HUD, screens, vignette)
├── js/
│   ├── config.js               # EVERY tunable value
│   ├── main.js                 # boot, game loop, collisions, camera
│   ├── managers/
│   │   ├── GroundManager.js    # instanced tile ring + decor + clouds
│   │   ├── ObstacleManager.js  # pooled props, difficulty-driven spawning
│   │   ├── CollectibleManager.js # grade papers, patterns, A+ glow
│   │   ├── AudioManager.js     # Web-Audio synth + Howler override
│   │   └── UIManager.js        # screens, HUD, popups, vignette
│   ├── entities/
│   │   ├── Player.js           # sprite controller + dust puffs
│   │   └── Teacher.js          # chase state machine + fairness guards
│   └── utils/
│       ├── InputHandler.js     # keyboard + swipe
│       ├── ObjectPool.js       # generic pooling (report §4.2)
│       ├── GameState.js        # state machine, scoring, best scores
│       ├── Difficulty.js       # speed/spawn/tier curves (report §4.3)
│       ├── placeholderArt.js   # ALL procedural art (swappable)
│       └── AssetLoader.js      # optional-file probes + fallbacks
├── assets/                     # empty by default — drop-in overrides
├── scripts/download-assets.sh  # optional CC0 asset fetcher (Phase 1)
└── research/RESEARCH_REPORT.md # Phase 1 research
```

## 📜 Credits

**Built with**
- [Three.js r160](https://threejs.org) (MIT) — rendering, sprites, instancing
- [Howler.js 2.2.4](https://howlerjs.com) (MIT) — optional real-file audio
- Vanilla ES modules — no build tools, no frameworks

**Procedural placeholder art & synth audio** generated in-code at load.

**Optional real assets (CC0 / free licenses)** researched in Phase 1:
- 3D props: [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit),
  [Quaternius traffic props on poly.pizza](https://poly.pizza/u/Quaternius),
  [KayKit Road Bits](https://poly.pizza/m/5BPCPOycxC) — all CC0
- Textures: [ambientCG gravel/concrete](https://ambientcg.com/view?id=Gravel001) — CC0
- Sounds: [Mixkit game SFX](https://mixkit.co/free-sound-effects/game/)
  (Mixkit License — free, no attribution),
  [Kenney UI Audio / Music Jingles](https://kenney.nl/assets/ui-audio) — CC0

**License:** MIT — feel free to modify and share!

---

**Enjoy running from the teacher! 🏃‍♂️👨‍🏫**
