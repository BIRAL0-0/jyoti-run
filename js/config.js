/**
 * School Runner: Teacher Chase — Game Configuration
 * -------------------------------------------------
 * ALL tuneable game values live here. Every number used by the game is
 * config-driven; nothing is hard-coded in the managers/entities.
 *
 * Placeholders: the game boots with ZERO asset files. Procedural art
 * (canvas textures / primitive geometry / Web-Audio synth) is generated at
 * load. Drop real files into assets/textures/ and assets/sounds/ to override
 * (see README.md "Replacing the placeholder art").
 */

export const CONFIG = {
    // ========== GROUND & MOVEMENT ==========
    GROUND: {
        TILE_LENGTH: 20,              // Length of each ground tile
        TILE_WIDTH: 12,               // Width (must cover 3 lanes)
        VISIBLE_TILES: 20,            // Number of tiles in the recycling ring
        INITIAL_SPEED: 15,            // Starting movement speed (units/s)
        MAX_SPEED: 45,                // Maximum speed cap
        SPEED_INCREMENT: 0.5,         // Speed increase per second
        // Procedural fallback gravel texture (used when the user's
        // ground-gravel.png is absent)
        TEXTURE_SIZE: 512,
        TEXTURE_REPEAT_Y: 2,          // texture tiles per tile along Z
        CURB_WIDTH: 0.6,              // blue curb strips at the track edge
        CURB_HEIGHT: 0.3,
        GRASS_COLOR: 0x7ec850,        // schoolyard lawn beyond the curbs
    },

    // ========== LANE SYSTEM ==========
    LANES: {
        COUNT: 3,                     // Always 3 lanes
        WIDTH: 4,                     // Distance between lane centers
        POSITIONS: [-4, 0, 4],        // X positions: left, center, right
        SWITCH_SPEED: 12,             // Lane switch lerp rate (1/s)
        SWITCH_DURATION: 0.2,         // Seconds to complete lane switch
    },

    // ========== PLAYER CHARACTER ==========
    PLAYER: {
        SPRITE_HEIGHT: 2.5,           // Sprite scale height
        SPRITE_WIDTH: 1.5,            // Sprite scale width (placeholder/fallback)
        // User PNGs rarely match 3:5 exactly. When FIT_ASPECT is true and a
        // student-character.png is present, SPRITE_HEIGHT stays authoritative
        // and the width is derived from the image's own aspect ratio, so the
        // art is never stretched. MAX_SPRITE_WIDTH clamps absurdly wide art.
        FIT_ASPECT: true,
        MAX_SPRITE_WIDTH: 2.5,
        // Optional FRONT render (assets/textures/student-character-front.png).
        // A THREE.Sprite always faces the camera, so a "3D turn" is faked the
        // way sprite-based games do it: the billboard is foreshortened on X
        // (scale.x = W·cos(turn)) and rolled in screen space
        // (SpriteMaterial.rotation), and the optional front render takes over
        // whenever the body genuinely faces the camera (e.g. a stumble).
        // Note: sprite.rotation.* has NO effect in three.js for Sprite objects
        // — the roll must go through the material.
        FRONT_URL: 'assets/textures/student-character-front.png',
        VIEW_TURN: 0.16,              // implied turn (rad) per world unit of lane offset
        VIEW_LEAN: 0.34,              // screen-space roll per radian of implied turn
        VIEW_SWAY: 1,                 // turn smoothing rate (0 = instant, higher = snappier)
        VIEW_MIN_SCALE: 0.55,         // clamp for the foreshortening
        VIEW_STUMBLE_FRONT: true,     // show the front render while stumbling
        JUMP_HEIGHT: 3.5,             // How high player jumps
        JUMP_DURATION: 0.6,           // Seconds in air
        SLIDE_DURATION: 0.8,          // Slide animation time
        SLIDE_HEIGHT: 0.8,            // Collision height when sliding
        STUMBLE_DURATION: 1.5,        // Slowdown after hit
        STUMBLE_SPEED_MULT: 0.3,      // Speed multiplier when stumbling (30%)
        RUN_BOB_AMOUNT: 0.12,         // Up/down bobbing amount
        RUN_BOB_SPEED: 9,             // Bobbing frequency
        COLLISION_RADIUS: 0.8,        // Collision detection size (x/z width)
        RUN_FRAME_RATE: 7,            // placeholder run-cycle frames per second
        HIT_TINT: 0xff5555,           // red flash colour when stumbling
        // Dust puff particles (pooled sprites)
        DUST_POOL_SIZE: 12,
        DUST_LAND_COUNT: 5,           // puffs on landing
        DUST_HIT_COUNT: 6,            // puffs on stumbling
        DUST_LIFETIME: 0.55,
    },

    // ========== TEACHER CHASE MECHANIC ==========
    // State machine: HIDDEN -> CHASING -> FADING_OUT -> HIDDEN
    //                            \-> CAUGHT (3rd mistake or sustained contact)
    // Fairness guards from the research report §4.4.
    TEACHER: {
        APPEAR_DISTANCE: 12,          // Normalisation distance for warning intensity
        CATCH_DISTANCE: 1.5,          // "Caught" contact distance
        CHASE_SPEED_MULTIPLIER: 1.3,  // Teacher runs 30% faster than the player
        RECOVERY_DISTANCE: 100,       // Clean metres to run to hide the teacher
        MINOR_BLUNDER_THRESHOLD: 1,   // Mistakes needed to trigger appearance
        MAJOR_BLUNDER_THRESHOLD: 3,   // Instant game over threshold
        SPRITE_HEIGHT: 3,             // Teacher sprite size
        SPRITE_WIDTH: 2,              // Teacher sprite width (placeholder/fallback)
        // Same aspect handling as the player (see CONFIG.PLAYER.FIT_ASPECT).
        FIT_ASPECT: true,
        MAX_SPRITE_WIDTH: 3,
        // Same view handling as the player (see CONFIG.PLAYER.FRONT_URL).
        FRONT_URL: 'assets/textures/teacher-character-front.png',
        VIEW_TURN: 0.14,              // implied turn (rad) per world unit of lane offset
        VIEW_LEAN: 0.28,
        VIEW_SWAY: 1,
        VIEW_MIN_SCALE: 0.6,
        VIEW_CATCH_FRONT: true,       // face the camera for the catch pose
        FADE_DURATION: 0.5,           // Fade in/out animation time

        // --- Refined chase behaviour (research report §4.4) ---
        // The teacher spawns between the camera and the player (positive Z is
        // "behind" the runner). She eases in to a hover distance, surges
        // closer after the 2nd mistake, and eases back as mistakes decay.
        SPAWN_MARGIN: 2.6,            // how far in front of the camera she fades in
        MENACE_DISTANCE: 5.5,         // hover distance after 1st mistake
        SURGE_DISTANCE: 3.2,          // hover distance after 2nd mistake
        SURGE_BOOST: 1.0,             // extra approach speed multiplier on surge (0.6 s)
        SURGE_DURATION: 0.6,
        AGGRO_CLEAN_METERS: 40,       // clean metres over which chase multiplier eases 1.3 -> 1.0
        RELAX_RATE: 1.5,              // u/s at which she drifts back out after mistake decay
        MISTAKE_DECAY_METERS: 50,     // -1 mistake per 50 m of clean running
        CATCH_SUSTAIN: 0.4,           // <= CATCH_DISTANCE sustained this long (s) = caught
        FADE_GRACE: 0.5,              // no catch checks during fade-in
        LUNGE_GRACE_DISTANCE: 1.6,    // holds here if contact while mid-jump/slide...
        LUNGE_GRACE_TIME: 1.0,        // ...for at most this long
        CATCH_ANIM_DISTANCE: 0.55,    // final distance for the grab pose
        CATCH_ANIM_SPEED: 10,         // u/s closing speed of the catch animation
        WEAVE_LERP: 3,                // how lazily she weaves toward the player's lane
        RUN_FRAME_RATE: 8,            // placeholder run-cycle frames per second
        WARNING_MAX: 0.55,            // vignette scale while CHASING
        SURGE_WARNING_BONUS: 0.25,    // extra vignette right after a surge
    },

    // ========== OBSTACLES ==========
    OBSTACLES: {
        SPAWN_DISTANCE_AHEAD: 60,     // How far ahead to spawn
        MIN_GAP_BETWEEN: 12,          // Minimum space (u) between rows
        INITIAL_SPAWN_CHANCE: 0.25,   // 25% spawn chance at start
        MAX_SPAWN_CHANCE: 0.65,       // Increases to 65% at max difficulty
        DESPAWN_DISTANCE: 15,         // Recycle when this far behind the player
        START_GRACE_DISTANCE: 25,     // no obstacles for the first N metres
        DOUBLE_CHANCE_START: 0.25,    // chance a row holds 2 obstacles (early)
        DOUBLE_CHANCE_MAX: 0.5,       // chance a row holds 2 obstacles (late)
        INTRO_ROWS: 3,                // first rows are always single LOW (tutorial)
        // A slide locks the lane for SLIDE_DURATION; never place a BLOCKER in
        // the same lane this close behind a HIGH obstacle (fairness guard).
        HIGH_LOCK_SAFE_DISTANCE: 36,

        // Relative type weights, early -> late difficulty
        WEIGHTS: {
            LOW:      [0.45, 0.35],
            HIGH:     [0.25, 0.35],
            BLOCKER:  [0.30, 0.30],
        },

        TYPES: {
            LOW: {                     // Must jump over
                height: 1.2,
                requiresJump: true,
                models: ['desk', 'crate', 'bench'],
                variants: [
                    { id: 'desk',  halfW: 0.85, halfD: 0.55, yMin: 0,    yMax: 1.15 },
                    { id: 'crate', halfW: 0.72, halfD: 0.55, yMin: 0,    yMax: 1.15 },
                    { id: 'bench', halfW: 0.85, halfD: 0.45, yMin: 0,    yMax: 1.0  },
                ],
            },
            HIGH: {                    // Must slide under
                height: 2.8,
                requiresSlide: true,
                clearance: 2.0,        // free space under the crossbar
                top: 3.8,              // top of the crossbar (above jump apex 3.5)
                models: ['barrier', 'gate'],
                variants: [
                    { id: 'barrier', halfW: 1.85, halfD: 0.25, yMin: 2.0, yMax: 3.8 },
                    { id: 'gate',    halfW: 1.85, halfD: 0.25, yMin: 2.0, yMax: 3.9 },
                ],
            },
            BLOCKER: {                 // Must switch lanes (full height)
                height: 2,
                requiresLaneSwitch: true,
                top: 4.2,              // taller than jump apex => unjumpable
                models: ['locker', 'roadblock'],
                variants: [
                    { id: 'locker',    halfW: 0.8,  halfD: 0.45, yMin: 0,   yMax: 4.2 },
                    { id: 'roadblock', halfW: 1.25, halfD: 0.3,  yMin: 0.3, yMax: 4.15 },
                ],
            },
        },

        // Prop palette (procedural primitive props share these)
        COLORS: {
            wood:       0xc68642,
            woodDark:   0x8b5a2b,
            crate:      0xd9a85f,
            metal:      0x9aa5b1,
            blue:       0x4169e1,
            blueDark:   0x2b3a67,
            gold:       0xffd700,
            white:      0xf4f6f8,
            green:      0x34c759,
            orange:     0xff8c42,
            red:        0xd9534f,
            lockerBlue: 0x3d5fbf,
        },
    },

    // ========== COLLECTIBLES (GRADE PAPERS) ==========
    GRADES: {
        SPAWN_CHANCE: 0.5,            // 50% chance to spawn a pattern per window
        SPAWN_DISTANCE_AHEAD: 50,
        SPAWN_WINDOW_MIN: 18,         // metres between spawn windows
        SPAWN_WINDOW_VAR: 14,         // + random metres
        START_GRACE_DISTANCE: 25,     // no papers for the first N metres
        FLOAT_HEIGHT: 1.5,            // Y position
        FLOAT_BOB_AMOUNT: 0.3,        // Up/down floating animation
        FLOAT_BOB_SPEED: 2.4,         // bob frequency (rad/s)
        FLOAT_ROTATION_SPEED: 2,      // Rotation speed (rad/s, full spin)
        COLLECTION_RADIUS: 1.2,       // Pickup distance (x/z)
        COLLECTION_HALF_HEIGHT: 0.55, // vertical pickup tolerance
        PAPER_WIDTH: 1.05,
        PAPER_HEIGHT: 1.35,
        POOL_SIZE: 14,                // max concurrent papers (mobile: fewer)
        COMBO_WINDOW: 1.5,            // seconds between collects to keep combo

        PATTERNS: ['line', 'across', 'arc', 'zigzag'], // Spawn patterns
        PATTERN_STEP: 2.6,            // metres between papers inside a pattern
        PATTERN_LENGTHS: { line: 5, across: 2, arc: 7, zigzag: 7 },

        // Difficulty tiers
        TIERS: [
            {
                minDistance: 0,
                grade: 'D',
                color: 0x8B4513,      // Brown
                cssColor: '#a05a2c',
                points: 10,
                spawnWeight: 0.4      // relative spawn weight once unlocked
            },
            {
                minDistance: 0,
                grade: 'C',
                color: 0xFFD700,      // Gold
                cssColor: '#FFD700',
                points: 15,
                spawnWeight: 0.6
            },
            {
                minDistance: 500,
                grade: 'B',
                color: 0x4169E1,      // Royal Blue
                cssColor: '#4169E1',
                points: 25,
                spawnWeight: 1.0
            },
            {
                minDistance: 1500,
                grade: 'A+',
                color: 0xFF1493,      // Hot Pink
                cssColor: '#FF1493',
                points: 50,
                spawnWeight: 1.0
            }
        ],
        // Weight multiplier for tiers that have been superseded by a newer one
        SUPERSEDED_WEIGHT: 0.35,
    },

    // ========== ROADSIDE DECOR ==========
    DECOR: {
        SPACING: 9,                   // metres between decor slots (per side)
        LANE_OFFSET_MIN: 7.6,         // decor starts this far from track centre
        LANE_OFFSET_VAR: 3.4,         // + random outward scatter
        SCALE_MIN: 0.8,
        SCALE_VAR: 0.7,
        TYPES: [
            { id: 'tree',  weight: 0.50 },
            { id: 'bush',  weight: 0.20 },
            { id: 'rock',  weight: 0.15 },
            { id: 'cone',  weight: 0.15 },
        ],
        COLORS: {
            trunk:  0x8b5a2b,
            leaf1:  0x3fa34d,
            leaf2:  0x2e7d32,
            bush:   0x46b04a,
            rock:   0x9e9e9e,
            rockD:  0x7d7d7d,
            cone:   0xff8c42,
            coneW:  0xf4f6f8,
        },
    },

    // ========== SKY & CLOUDS ==========
    SKY: {
        COLOR: 0x87CEEB,              // bright cartoon sky
        FOG_COLOR: 0x87CEEB,          // fog matches sky for a seamless horizon
        CLOUD_COUNT: 6,
        CLOUD_DRIFT: 0.4,             // u/s sideways drift
        CLOUD_SPREAD_X: 46,
        CLOUD_MIN_Y: 13,
        CLOUD_MAX_Y: 24,
        CLOUD_Z: -70,
    },

    // ========== SCENERY BILLBOARDS ==========
    // The scenery renders in assets/scenery/ are drop-in billboards. Every
    // slot is optional: a missing file (or SCENERY.ENABLED = false) leaves the
    // procedural world exactly as it was, so an empty assets/ is unaffected.
    // Widths are DERIVED from each image's own aspect ratio (height is
    // authoritative), so no scenery art is ever stretched.
    SCENERY: {
        ENABLED: true,

        // Distant backdrop, re-anchored to the camera every frame so it never
        // gets closer (same "infinite distance" trick as a skybox).
        // fog is disabled on it, otherwise FOG.far would wash it out entirely.
        HORIZON: {
            ENABLED: true,
            URL: 'assets/scenery/school-gate-avenue.png',
            HEIGHT: 74,               // world units tall
            MAX_WIDTH: 200,           // clamp for unexpectedly wide art
            Y: 25,                    // centre height
            DISTANCE: 200,            // metres ahead of the camera
            PARALLAX: 0.1,            // lateral drift vs camera x (0 = pinned)
            OPACITY: 1,
        },

        // Landmarks the runner passes through. Each entry is a recycling ring:
        // COUNT billboards spaced SPACING metres apart, looping back once they
        // pass RECYCLE_BEHIND metres behind the camera. PHASE offsets one ring
        // against the next so landmarks alternate instead of stacking.
        RECYCLE_BEHIND: 26,
        LANDMARKS: [
            {
                ID: 'gate',
                ENABLED: true,
                URL: 'assets/scenery/school-gate-arch.png',
                HEIGHT: 18,
                MAX_WIDTH: 34,
                Y: 8.6,               // feet of the arch sit just below ground
                COUNT: 2,
                SPACING: 90,          // metres between gates
                PHASE: 0,             // start offset along the track (m)
                OPACITY: 1,
            },
            {
                ID: 'corridor',
                ENABLED: true,
                URL: 'assets/scenery/school-corridor.png',
                HEIGHT: 20,
                MAX_WIDTH: 40,
                Y: 9.8,
                COUNT: 2,
                SPACING: 90,
                PHASE: 45,            // half a period: alternates with the gate
                OPACITY: 0.96,
            },
        ],
    },

    // ========== CAMERA ==========
    CAMERA: {
        FOV: 75,                      // Field of view
        NEAR: 0.1,                    // Near clipping plane
        FAR: 1000,                    // Far clipping plane
        POSITION_OFFSET: {            // Offset from player
            x: 0,
            y: 5,                     // Height above player
            z: 10                     // Distance behind player
        },
        LOOK_AHEAD_DISTANCE: 8,       // How far ahead to look
        FOLLOW_SMOOTHNESS: 0.1,       // Camera lerp factor (0.1 = smooth, 1 = instant)
        LATERAL_FOLLOW: 0.45,         // how much the camera follows lane changes (x)
        FOV_SPEED_KICK: 8,            // extra FOV degrees at max speed
        SHAKE_DURATION: 0.4,
        SHAKE_INTENSITY: 0.35,
    },

    // ========== LIGHTING ==========
    LIGHTING: {
        AMBIENT: {
            color: 0xffffff,          // White
            intensity: 0.6
        },
        DIRECTIONAL: {
            color: 0xffffff,
            intensity: 0.8,
            position: { x: -10, y: 20, z: 10 },
            castShadow: true
        },
        HEMISPHERE: {                 // sky/ground gradient
            skyColor: 0x87CEEB,       // Light blue
            groundColor: 0x654321,    // Brown
            intensity: 0.3
        },
        SHADOWS: {
            enabled: true,
            mapSize: 2048,            // Shadow quality (1024 for mobile)
            cameraSize: 20            // Shadow frustum size
        },
        FOG: {
            enabled: true,
            color: 0x87CEEB,          // matches SKY.COLOR for a seamless horizon
            near: 30,
            far: 100
        }
    },

    // ========== AUDIO ==========
    AUDIO: {
        MASTER_VOLUME: 0.7,
        MUSIC_VOLUME: 0.4,
        SFX_VOLUME: 0.6,
        // Real files are used when present (via Howler.js); anything missing
        // falls back to Web-Audio synthesis. These are the drop-in paths.
        SOUNDS: {
            jump: 'assets/sounds/jump.mp3',
            collect: 'assets/sounds/collect.mp3',
            hit: 'assets/sounds/hit.mp3',
            teacherAlert: 'assets/sounds/teacher-alert.mp3',
            gameOver: 'assets/sounds/gameover.mp3',
            bgMusic: 'assets/sounds/bg-music.mp3',
            // synth-only extras (no drop-in files expected):
            ui: null,
            caught: null,
        },
        // Pinned CDN fallback for Howler.js (loaded only when mp3s exist)
        HOWLER_URL: 'https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js',
        MUSIC_BPM: 132,               // chiptune loop tempo
        MUSIC_LOOKAHEAD: 0.12,        // scheduler lookahead (s)
        MUSIC_TIMER_MS: 30,           // scheduler tick (ms)
    },

    // ========== UI COLORS ==========
    COLORS: {
        PRIMARY: '#FFD700',           // Gold (grades, highlights)
        SECONDARY: '#4169E1',         // Royal Blue (school theme)
        DANGER: '#FF3B30',            // Red (teacher warning)
        SUCCESS: '#34C759',           // Green (good streak)
        TEXT_LIGHT: '#FFFFFF',
        TEXT_DARK: '#1A1A2E',
        BACKGROUND: '#1a1a2e',        // Dark blue-grey
        WARNING_OVERLAY: 'rgba(255, 0, 0, 0.3)' // Red tint
    },

    // ========== UI / HUD ==========
    UI: {
        POPUP_POOL_SIZE: 8,
        TOAST_DURATION: 3200,
        START_SCREEN_SCROLL_SPEED: 8, // ambient world scroll behind the menu
    },

    // ========== INPUT ==========
    INPUT: {
        SWIPE_THRESHOLD: 24,          // px — responsive on phone + tablet
        SWIPE_COOLDOWN_MS: 120,       // prevent double-fires
        EDGE_DEAD_ZONE: 16,           // px — Android back-gesture safety
    },

    // ========== STORAGE (best scores) ==========
    STORAGE: {
        PREFIX: 'schoolrunner',
        BEST_SCORE_KEY: 'best.score',
        BEST_DISTANCE_KEY: 'best.distance',
        MUTED_KEY: 'muted',
    },

    // ========== PERFORMANCE ==========
    PERFORMANCE: {
        TARGET_FPS: 60,
        MOBILE_PIXEL_RATIO: 1.5,      // Limit on mobile
        DESKTOP_PIXEL_RATIO: 2,       // Limit on desktop
        ENABLE_SHADOWS_MOBILE: false, // Disable shadows on mobile
        MAX_DELTA: 0.1,               // clamp dt after tab switches (anti-tunnel)
        // Applied at boot when a touch device / low-end device is detected
        MOBILE_OVERRIDES: {
            visibleTiles: 14,
            obstaclePoolPerVariant: 3,
            paperPool: 10,
            decorDensity: 0.6,        // fraction of decor slots populated
            anisotropy: 4,
        },
        DESKTOP_ANISOTROPY: 8,
    },

    // ========== DEBUG ==========
    DEBUG: {
        SHOW_FPS: false,              // FPS counter
        SHOW_COLLISION_BOXES: false,  // Wireframe helpers
        GOD_MODE: false,              // No collisions
        SKIP_START_SCREEN: false,     // Jump straight into gameplay (testing)
        EXPOSE_TO_WINDOW: true,       // window.__game for console debugging
    }
};

// Export individual sections for easier imports
export const GROUND = CONFIG.GROUND;
export const LANES = CONFIG.LANES;
export const PLAYER = CONFIG.PLAYER;
export const TEACHER = CONFIG.TEACHER;
export const OBSTACLES = CONFIG.OBSTACLES;
export const GRADES = CONFIG.GRADES;
export const DECOR = CONFIG.DECOR;
export const SKY = CONFIG.SKY;
export const SCENERY = CONFIG.SCENERY;
export const CAMERA = CONFIG.CAMERA;
export const LIGHTING = CONFIG.LIGHTING;
export const AUDIO = CONFIG.AUDIO;
export const COLORS = CONFIG.COLORS;
export const UI = CONFIG.UI;
export const INPUT = CONFIG.INPUT;
export const STORAGE = CONFIG.STORAGE;
export const PERFORMANCE = CONFIG.PERFORMANCE;
export const DEBUG = CONFIG.DEBUG;
